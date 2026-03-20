export interface ChatCheckpoint {
  id: string;
  conversationId: string;
  messageId: string;
  title: string;
  excerpt: string;
  createdAt: string;
}

const STORAGE_KEY = 'fintheon:chat-checkpoints:v1';

function readAll(): ChatCheckpoint[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as ChatCheckpoint[];
  } catch {
    return [];
  }
}

function writeAll(items: ChatCheckpoint[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-500)));
}

export function listCheckpoints(conversationId: string | undefined): ChatCheckpoint[] {
  if (!conversationId) return [];
  return readAll()
    .filter((c) => c.conversationId === conversationId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addCheckpoint(input: Omit<ChatCheckpoint, 'id' | 'createdAt'>): ChatCheckpoint {
  const item: ChatCheckpoint = {
    id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...input,
  };
  const all = readAll();
  writeAll([...all, item]);
  return item;
}

export function deleteCheckpoint(id: string) {
  const all = readAll();
  writeAll(all.filter((c) => c.id !== id));
}

