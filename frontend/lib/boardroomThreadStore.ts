// [claude-code 2026-04-11] S14-T2: Add Supabase write-through for thread persistence
/**
 * Boardroom Thread Store — IndexedDB + Supabase persistence for boardroom sessions.
 *
 * Each "thread" represents a single boardroom session (a contiguous set of
 * messages). Threads are saved as they arrive (auto-save) and can be
 * replayed later in a read-only view.
 *
 * IndexedDB is the fast local cache. Supabase is the durable remote store.
 * Writes go to both (write-through). Reads prefer local, with remote sync on load.
 */

import type {
  BoardroomMessage,
  InterventionMessage,
  BoardroomAgent,
} from "./services";
import { supabase } from "./supabase";

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

  // Write-through to Supabase (best-effort, don't block)
  void persistToSupabase(thread);
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

/* ------------------------------------------------------------------ */
/*  Supabase persistence (write-through + sync)                       */
/* ------------------------------------------------------------------ */

const TABLE = "boardroom_threads";

/** Upsert a thread to Supabase (best-effort, never throws). */
async function persistToSupabase(thread: BoardroomThread): Promise<void> {
  if (!supabase) return;
  try {
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id;
    if (!userId) return;

    await supabase.from(TABLE).upsert(
      {
        id: thread.id,
        user_id: userId,
        title: thread.title,
        participants: thread.participants,
        messages: thread.messages,
        intervention_messages: thread.interventionMessages,
        meeting_notes: thread.meetingNotes,
        message_count: thread.messageCount,
        created_at: thread.createdAt,
        updated_at: thread.updatedAt,
      },
      { onConflict: "id" },
    );
  } catch (err) {
    console.warn("[boardroomThreadStore] Supabase persist failed:", err);
  }
}

/** Delete a thread from Supabase (best-effort). */
async function deleteFromSupabase(id: string): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from(TABLE).delete().eq("id", id);
  } catch (err) {
    console.warn("[boardroomThreadStore] Supabase delete failed:", err);
  }
}

/**
 * Sync threads from Supabase into IndexedDB.
 * Merges remote threads that don't exist locally.
 * Call once on app load to hydrate from remote.
 */
export async function syncFromSupabase(): Promise<void> {
  if (!supabase) return;
  try {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session?.user?.id) return;

    const { data: rows, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("updated_at", { ascending: false });

    if (error || !rows) return;

    const localThreads = await getAllThreads();
    const localIds = new Set(localThreads.map((t) => t.id));

    for (const row of rows) {
      const thread: BoardroomThread = {
        id: row.id,
        title: row.title,
        participants: row.participants ?? [],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        messages: row.messages ?? [],
        interventionMessages: row.intervention_messages ?? [],
        meetingNotes: row.meeting_notes ?? "",
        messageCount: row.message_count ?? 0,
      };

      if (!localIds.has(thread.id)) {
        // New remote thread — save locally
        const db = await openDB();
        const store = txStore(db, "readwrite");
        await reqToPromise(store.put(thread));
        db.close();
      } else {
        // Exists locally — keep whichever is newer
        const local = localThreads.find((t) => t.id === thread.id)!;
        if (
          new Date(thread.updatedAt).getTime() >
          new Date(local.updatedAt).getTime()
        ) {
          const db = await openDB();
          const store = txStore(db, "readwrite");
          await reqToPromise(store.put(thread));
          db.close();
        }
      }
    }
  } catch (err) {
    console.warn("[boardroomThreadStore] Supabase sync failed:", err);
  }
}
