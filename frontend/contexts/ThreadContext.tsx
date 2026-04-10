// [claude-code 2026-03-24] Added cloud sync — threads persist to Supabase via useCloudState
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "./AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const CLOUD_DEBOUNCE_MS = 2000;

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface Thread {
  id: string;
  title: string;
  createdAt: Date;
  messages: Message[];
  pnl?: number;
  resonanceState?: "Stable" | "Tilt" | "Neutral";
}

interface ThreadContextType {
  threads: Thread[];
  activeThreadId: string | null;
  setActiveThreadId: (id: string | null) => void;
  createThread: (title: string) => string;
  addMessage: (
    threadId: string,
    message: Omit<Message, "id" | "timestamp">,
  ) => void;
  updateThread: (threadId: string, updates: Partial<Thread>) => void;
  deleteThread: (threadId: string) => void;
}

const ThreadContext = createContext<ThreadContextType | undefined>(undefined);

export function ThreadProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, getAccessToken } = useAuth();
  const [threads, setThreads] = useState<Thread[]>(() => {
    const saved = localStorage.getItem("fintheon:threads");
    return saved ? JSON.parse(saved) : [];
  });
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const cloudDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedCloudRef = useRef(false);

  // Load threads from cloud on first authenticated mount
  useEffect(() => {
    if (!isAuthenticated || hasLoadedCloudRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        const token = await getAccessToken();
        if (!token || cancelled) return;

        const res = await fetch(`${API_BASE}/api/profile/app-state`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok || cancelled) return;

        const data = (await res.json()) as {
          app_state?: Record<string, unknown>;
        };
        const cloudThreads = data.app_state?.threads;
        if (
          Array.isArray(cloudThreads) &&
          cloudThreads.length > 0 &&
          !cancelled
        ) {
          setThreads(cloudThreads as Thread[]);
          localStorage.setItem(
            "fintheon:threads",
            JSON.stringify(cloudThreads),
          );
        }
        hasLoadedCloudRef.current = true;
      } catch {
        // Fall back to localStorage (already loaded)
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, getAccessToken]);

  // Debounced cloud persist
  const persistToCloud = useCallback(
    async (threadData: Thread[]) => {
      if (!isAuthenticated) return;
      try {
        const token = await getAccessToken();
        if (!token) return;
        await fetch(`${API_BASE}/api/profile/app-state`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ state: { threads: threadData } }),
        });
      } catch {
        // Silent — localStorage is still source of truth
      }
    },
    [isAuthenticated, getAccessToken],
  );

  const createThread = (title: string): string => {
    const newThread: Thread = {
      id: `thread_${Date.now()}`,
      title,
      createdAt: new Date(),
      messages: [],
      resonanceState: "Neutral",
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newThread.id);
    return newThread.id;
  };

  const addMessage = (
    threadId: string,
    message: Omit<Message, "id" | "timestamp">,
  ) => {
    const newMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random()}`,
      timestamp: new Date(),
    };
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId
          ? { ...thread, messages: [...thread.messages, newMessage] }
          : thread,
      ),
    );
  };

  const updateThread = (threadId: string, updates: Partial<Thread>) => {
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, ...updates } : thread,
      ),
    );
  };

  const deleteThread = (threadId: string) => {
    setThreads((prev) => prev.filter((thread) => thread.id !== threadId));
    if (activeThreadId === threadId) {
      setActiveThreadId(null);
    }
  };

  useEffect(() => {
    localStorage.setItem("fintheon:threads", JSON.stringify(threads));

    // Debounced cloud sync
    if (cloudDebounceRef.current) clearTimeout(cloudDebounceRef.current);
    cloudDebounceRef.current = setTimeout(() => {
      persistToCloud(threads);
    }, CLOUD_DEBOUNCE_MS);

    return () => {
      if (cloudDebounceRef.current) clearTimeout(cloudDebounceRef.current);
    };
  }, [threads, persistToCloud]);

  return (
    <ThreadContext.Provider
      value={{
        threads,
        activeThreadId,
        setActiveThreadId,
        createThread,
        addMessage,
        updateThread,
        deleteThread,
      }}
    >
      {children}
    </ThreadContext.Provider>
  );
}

export function useThread() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThread must be used within a ThreadProvider");
  }
  return context;
}
