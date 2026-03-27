// [claude-code 2026-03-19] T1: Herald pattern, BoardroomFilter, paginated getBoardroomMessages
// [claude-code 2026-03-23] fix(boardroom): appendToBoardroom now writes to Supabase via boardroom-store
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BoardroomMessage, InterventionMessage, BoardroomAgent } from '../types/boardroom.js';
import { getOrCreateTodaySession, addBoardroomMessage } from './boardroom-store.js';

const HERMES_SESSIONS_DIR = join(process.env.HOME ?? '', '.hermes/agents/main/sessions');
const HERMES_SEND_URL = process.env.HERMES_SESSIONS_SEND_URL ?? 'http://localhost:47832/api/sessions/send';

interface RawSessionMessage {
  role?: string;
  content?: string;
  timestamp?: string;
  createdAt?: string;
  sessionKey?: string;
}

// [claude-code 2026-03-19] Agent backend v8.0: updated agent patterns for 5-agent roster (Herald restored)
const AGENT_PATTERNS: Array<{ regex: RegExp; agent: Exclude<BoardroomAgent, 'Unknown'>; emoji: string }> = [
  { regex: /harper[-\s]?hermes|harper/i, agent: 'Harper-Hermes', emoji: '🎩' },
  { regex: /feucht/i, agent: 'Feucht', emoji: '⚡' },
  { regex: /consul/i, agent: 'Consul', emoji: '📜' },
  { regex: /oracle/i, agent: 'Oracle', emoji: '📊' },
  { regex: /herald/i, agent: 'Herald', emoji: '👴' },
];

const safeJsonParse = <T>(line: string): T | null => {
  try {
    return JSON.parse(line) as T;
  } catch {
    return null;
  }
};

const getTimestamp = (raw: RawSessionMessage): string => {
  return raw.timestamp ?? raw.createdAt ?? new Date().toISOString();
};

const inferAgent = (content: string): { agent: BoardroomAgent; emoji: string } => {
  for (const pattern of AGENT_PATTERNS) {
    if (pattern.regex.test(content)) {
      return { agent: pattern.agent, emoji: pattern.emoji };
    }
  }
  return { agent: 'Unknown', emoji: '💬' };
};

const inferSender = (content: string, role: string): InterventionMessage['sender'] => {
  if (/harper/i.test(content)) return 'Harper-Hermes';
  if (role === 'user') return 'User';
  if (role === 'assistant') return 'Harper-Hermes';
  return 'Unknown';
};

async function findSessionFilesByLabel(sessionLabel: string): Promise<string[]> {
  const files = await readdir(HERMES_SESSIONS_DIR).catch(() => []);
  const normalized = sessionLabel.toLowerCase();
  return files
    .filter((file) => file.endsWith('.jsonl'))
    .filter((file) => file.toLowerCase().includes(normalized))
    .map((file) => join(HERMES_SESSIONS_DIR, file));
}

const splitLines = (content: string): string[] =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export interface BoardroomFilter {
  agents?: BoardroomAgent[];
  search?: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
}

export async function getBoardroomMessages(
  sessionLabel = 'pic-boardroom',
  filter?: BoardroomFilter
): Promise<{ messages: BoardroomMessage[]; total: number }> {
  const sessionFiles = await findSessionFilesByLabel(sessionLabel);
  if (!sessionFiles.length) return { messages: [], total: 0 };

  let messages: BoardroomMessage[] = [];
  for (const sessionFile of sessionFiles) {
    const fileContent = await readFile(sessionFile, 'utf-8').catch(() => '');
    for (const line of splitLines(fileContent)) {
      const raw = safeJsonParse<RawSessionMessage>(line);
      if (!raw?.content) continue;

      const { agent, emoji } = inferAgent(raw.content);
      const role = raw.role === 'user' || raw.role === 'assistant' || raw.role === 'system' ? raw.role : 'assistant';
      messages.push({
        id: crypto.randomUUID(),
        agent,
        emoji,
        content: raw.content,
        timestamp: getTimestamp(raw),
        role,
      });
    }
  }

  messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  // Apply filters
  if (filter?.agents?.length) {
    messages = messages.filter(m => filter.agents!.includes(m.agent));
  }
  if (filter?.search) {
    const q = filter.search.toLowerCase();
    messages = messages.filter(m => m.content.toLowerCase().includes(q));
  }
  if (filter?.since) {
    const sinceMs = new Date(filter.since).getTime();
    messages = messages.filter(m => new Date(m.timestamp).getTime() >= sinceMs);
  }
  if (filter?.until) {
    const untilMs = new Date(filter.until).getTime();
    messages = messages.filter(m => new Date(m.timestamp).getTime() <= untilMs);
  }

  const total = messages.length;

  if (filter?.offset) {
    messages = messages.slice(filter.offset);
  }
  if (filter?.limit) {
    messages = messages.slice(0, filter.limit);
  }

  return { messages, total };
}

export async function getInterventionMessages(sessionLabel = 'pic-intervention'): Promise<InterventionMessage[]> {
  const sessionFiles = await findSessionFilesByLabel(sessionLabel);
  if (!sessionFiles.length) return [];

  const messages: InterventionMessage[] = [];
  for (const sessionFile of sessionFiles) {
    const fileContent = await readFile(sessionFile, 'utf-8').catch(() => '');
    for (const line of splitLines(fileContent)) {
      const raw = safeJsonParse<RawSessionMessage>(line);
      if (!raw?.content) continue;

      const role = typeof raw.role === 'string' ? raw.role : 'assistant';
      messages.push({
        id: crypto.randomUUID(),
        sender: inferSender(raw.content, role),
        content: raw.content,
        timestamp: getTimestamp(raw),
      });
    }
  }

  return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

// [claude-code 2026-03-26] T2: appendToBoardroom now accepts optional metadata and returns message ID
export async function appendToBoardroom(
  content: string,
  role: 'user' | 'assistant' | 'system' = 'assistant',
  metadata?: Record<string, unknown>
): Promise<string | undefined> {
  let messageId: string | undefined;

  // Primary: write to Supabase via boardroom-store
  try {
    const session = await getOrCreateTodaySession();
    const { agent } = inferAgent(content);
    const msg = await addBoardroomMessage(session.id, { agent, role, content, metadata });
    messageId = msg.id;
  } catch (err) {
    console.error('[Boardroom] Supabase write failed, falling back to JSONL:', err);
  }

  // Non-blocking JSONL fallback (fire-and-forget)
  appendToSession('pic-boardroom', content, role).catch((err) => {
    console.error('[Boardroom] JSONL fallback write failed:', err);
  });

  return messageId;
}

async function appendToSession(
  sessionLabel: string,
  content: string,
  role: 'user' | 'assistant' | 'system' = 'assistant'
): Promise<void> {
  const files = await findSessionFilesByLabel(sessionLabel);
  const targetFile = files[0] ?? join(HERMES_SESSIONS_DIR, `${sessionLabel}.jsonl`);
  const { writeFile, appendFile, access } = await import('node:fs/promises');
  const line = JSON.stringify({ role, content, timestamp: new Date().toISOString() }) + '\n';
  try {
    await access(targetFile);
    await appendFile(targetFile, line, 'utf-8');
  } catch {
    await writeFile(targetFile, line, 'utf-8');
  }
}

export async function sendToIntervention(message: string, sessionKey = 'pic-intervention'): Promise<void> {
  // Write to intervention session
  const response = await fetch(HERMES_SEND_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionKey, message }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Failed to send intervention message: ${response.status} ${text}`);
  }

  // Ensure the UI can immediately render the user's bubble by recording locally.
  // The gateway may not mirror this message back into the local session file.
  await appendToSession(sessionKey, message.trim(), 'user');

  // Also relay to boardroom so agents and the boardroom thread can see it
  await appendToBoardroom(`Human Executive (Intervention): ${message.trim()}`, 'user');
}

/**
 * Send a @mention message directly to the boardroom thread.
 * The message targets a specific agent; all agents acknowledge briefly but only the mentioned agent replies.
 */
export async function sendMentionToBoardroom(
  message: string,
  mentionedAgent: string
): Promise<void> {
  const content = `@${mentionedAgent} ${message.trim()}`;
  await appendToBoardroom(content, 'user');
}

export async function checkBoardroomStatus(): Promise<{ boardroomActive: boolean; interventionActive: boolean }> {
  const [boardroomFiles, interventionFiles] = await Promise.all([
    findSessionFilesByLabel('pic-boardroom'),
    findSessionFilesByLabel('pic-intervention'),
  ]);

  return {
    boardroomActive: boardroomFiles.length > 0,
    interventionActive: interventionFiles.length > 0,
  };
}
