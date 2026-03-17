// [claude-code 2026-02-26] Ensure intervention UI shows user chat bubbles by mirroring sent messages locally.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { BoardroomMessage, InterventionMessage, BoardroomAgent } from '../types/boardroom.js';

const CLAWDBOT_SESSIONS_DIR = join(process.env.HOME ?? '', '.clawdbot/agents/main/sessions');
const CLAWDBOT_SEND_URL = process.env.CLAWDBOT_SESSIONS_SEND_URL ?? 'http://localhost:47832/api/sessions/send';

interface RawSessionMessage {
  role?: string;
  content?: string;
  timestamp?: string;
  createdAt?: string;
  sessionKey?: string;
}

// [claude-code 2026-03-16] Agent backend v7.9: updated agent patterns for new roster
const AGENT_PATTERNS: Array<{ regex: RegExp; agent: Exclude<BoardroomAgent, 'Unknown'>; emoji: string }> = [
  { regex: /harper[-\s]?hermes|harper/i, agent: 'Harper-Hermes', emoji: '🎩' },
  { regex: /oracle/i, agent: 'Oracle', emoji: '📊' },
  { regex: /feucht/i, agent: 'Feucht', emoji: '⚡' },
  { regex: /consul/i, agent: 'Consul', emoji: '📜' },
  { regex: /herald/i, agent: 'Herald', emoji: '📰' },
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
  const files = await readdir(CLAWDBOT_SESSIONS_DIR).catch(() => []);
  const normalized = sessionLabel.toLowerCase();
  return files
    .filter((file) => file.endsWith('.jsonl'))
    .filter((file) => file.toLowerCase().includes(normalized))
    .map((file) => join(CLAWDBOT_SESSIONS_DIR, file));
}

const splitLines = (content: string): string[] =>
  content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

export async function getBoardroomMessages(sessionLabel = 'pic-boardroom'): Promise<BoardroomMessage[]> {
  const sessionFiles = await findSessionFilesByLabel(sessionLabel);
  if (!sessionFiles.length) return [];

  const messages: BoardroomMessage[] = [];
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

  return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
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

export async function appendToBoardroom(
  content: string,
  role: 'user' | 'assistant' = 'assistant'
): Promise<void> {
  await appendToSession('pic-boardroom', content, role);
}

async function appendToSession(
  sessionLabel: string,
  content: string,
  role: 'user' | 'assistant' = 'assistant'
): Promise<void> {
  const files = await findSessionFilesByLabel(sessionLabel);
  const targetFile = files[0] ?? join(CLAWDBOT_SESSIONS_DIR, `${sessionLabel}.jsonl`);
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
  const response = await fetch(CLAWDBOT_SEND_URL, {
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
  await appendToSession('pic-boardroom', `Human Executive (Intervention): ${message.trim()}`, 'user');
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
  await appendToSession('pic-boardroom', content, 'user');
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
