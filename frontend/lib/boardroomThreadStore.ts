/**
 * Boardroom Thread Store — IndexedDB persistence for boardroom sessions.
 *
 * Each "thread" represents a single boardroom session (a contiguous set of
 * messages). Threads are saved as they arrive (auto-save) and can be
 * replayed later in a read-only view.
 */

import type {
  BoardroomMessage,
  InterventionMessage,
  BoardroomAgent,
} from "./services";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BoardroomThread {
  id: string;
  title: string;
  participants: string[]; // agent names + 'You' for the human
  createdAt: string; // ISO
  updatedAt: string; // ISO
  messages: BoardroomMessage[];
  interventionMessages: InterventionMessage[];
  meetingNotes: string; // user-editable notes
  messageCount: number;
}

/* ------------------------------------------------------------------ */
/*  IndexedDB helpers                                                  */
/* ------------------------------------------------------------------ */

const DB_NAME = "fintheon_boardroom_threads";
const DB_VERSION = 1;
const STORE_NAME = "threads";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt", { unique: false });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(db: IDBDatabase, mode: IDBTransactionMode) {
  return db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export async function getAllThreads(): Promise<BoardroomThread[]> {
  const db = await openDB();
  const store = txStore(db, "readonly");
  const all = (await reqToPromise(store.getAll())) as BoardroomThread[];
  db.close();
  // Sort newest first
  return all.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export async function getThread(
  id: string,
): Promise<BoardroomThread | undefined> {
  const db = await openDB();
  const store = txStore(db, "readonly");
  const result = (await reqToPromise(store.get(id))) as
    | BoardroomThread
    | undefined;
  db.close();
  return result;
}

export async function saveThread(thread: BoardroomThread): Promise<void> {
  const db = await openDB();
  const store = txStore(db, "readwrite");
  await reqToPromise(store.put(thread));
  db.close();
}

export async function deleteThread(id: string): Promise<void> {
  const db = await openDB();
  const store = txStore(db, "readwrite");
  await reqToPromise(store.delete(id));
  db.close();
}

export async function updateMeetingNotes(
  id: string,
  notes: string,
): Promise<void> {
  const thread = await getThread(id);
  if (!thread) return;
  thread.meetingNotes = notes;
  thread.updatedAt = new Date().toISOString();
  await saveThread(thread);
}

/* ------------------------------------------------------------------ */
/*  Thread creation / update helpers                                   */
/* ------------------------------------------------------------------ */

/**
 * Derive a title from the first meaningful message in the thread.
 */
export function deriveTitle(messages: BoardroomMessage[]): string {
  if (messages.length === 0) return "Empty Session";
  const first = messages[0];
  const preview = first.content.slice(0, 60).replace(/\n/g, " ");
  return preview.length < first.content.length ? `${preview}…` : preview;
}

/**
 * Extract unique participant names from messages.
 */
export function extractParticipants(
  messages: BoardroomMessage[],
  interventions: InterventionMessage[],
): string[] {
  const set = new Set<string>();
  for (const m of messages) {
    set.add(m.role === "user" ? "You" : m.agent);
  }
  for (const m of interventions) {
    set.add(m.sender === "User" ? "You" : m.sender);
  }
  return Array.from(set);
}

/**
 * Create a new thread from the current boardroom state.
 */
export function createThread(
  messages: BoardroomMessage[],
  interventions: InterventionMessage[],
): BoardroomThread {
  const now = new Date().toISOString();
  return {
    id: `br_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: deriveTitle(messages),
    participants: extractParticipants(messages, interventions),
    createdAt: messages.length > 0 ? messages[0].timestamp : now,
    updatedAt: now,
    messages: [...messages],
    interventionMessages: [...interventions],
    meetingNotes: "",
    messageCount: messages.length,
  };
}

/**
 * Update an existing thread with new messages (auto-save).
 */
export function mergeMessages(
  thread: BoardroomThread,
  messages: BoardroomMessage[],
  interventions: InterventionMessage[],
): BoardroomThread {
  // Build a set of existing message IDs to avoid duplicates
  const existingIds = new Set(thread.messages.map((m) => m.id));
  const newMessages = messages.filter((m) => !existingIds.has(m.id));

  const existingIntIds = new Set(thread.interventionMessages.map((m) => m.id));
  const newInterventions = interventions.filter(
    (m) => !existingIntIds.has(m.id),
  );

  if (newMessages.length === 0 && newInterventions.length === 0) return thread;

  return {
    ...thread,
    messages: [...thread.messages, ...newMessages],
    interventionMessages: [...thread.interventionMessages, ...newInterventions],
    participants: extractParticipants(
      [...thread.messages, ...newMessages],
      [...thread.interventionMessages, ...newInterventions],
    ),
    updatedAt: new Date().toISOString(),
    messageCount: thread.messages.length + newMessages.length,
    title:
      thread.title === "Empty Session"
        ? deriveTitle([...thread.messages, ...newMessages])
        : thread.title,
  };
}
