// [claude-code 2026-04-16] T7: IndexedDB message queue for offline chat sends

const DB_NAME = "fintheon-offline";
const STORE_NAME = "chat-queue";
const DB_VERSION = 1;

interface QueuedMessage {
  id: string;
  text: string;
  conversationId: string | null;
  images?: string[];
  riskFlowContext?: string;
  traderName?: string;
  createdAt: number;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueMessage(
  msg: Omit<QueuedMessage, "id" | "createdAt">,
): Promise<string> {
  const db = await openDB();
  const id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const record: QueuedMessage = { ...msg, id, createdAt: Date.now() };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function drainQueue(): Promise<QueuedMessage[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const items: QueuedMessage[] = req.result;
      // Clear the store after reading
      store.clear();
      // Sort oldest first
      items.sort((a, b) => a.createdAt - b.createdAt);
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function queueSize(): Promise<number> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
