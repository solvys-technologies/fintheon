// [claude-code 2026-04-16] T3: API-backed conversation sessions with client-side search
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getMobileBackend } from "../lib/backend";

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface ConversationDetail {
  id: string;
  title: string;
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    createdAt: string;
  }>;
}

export interface UseConversationsReturn {
  sessions: ConversationSummary[];
  isLoading: boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  loadSession: (id: string) => Promise<ConversationDetail | null>;
  refresh: () => Promise<void>;
}

export function useConversations(): UseConversationsReturn {
  const { getAccessToken } = useAuth();
  const [allSessions, setAllSessions] = useState<ConversationSummary[]>([]);
  const [sessions, setSessions] = useState<ConversationSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRecent = useCallback(async () => {
    setIsLoading(true);
    try {
      const backend = getMobileBackend(getAccessToken);
      const data = await backend.ai.listConversations();
      const mapped: ConversationSummary[] = (data ?? [])
        .slice(0, 10)
        .map((c: any) => ({
          id: c.id,
          title: c.title || "Untitled",
          createdAt: c.createdAt ?? c.created_at ?? "",
          updatedAt: c.updatedAt ?? c.updated_at ?? "",
          lastMessageAt: c.lastMessageAt ?? c.updatedAt ?? "",
          messageCount: c.messageCount ?? 0,
        }));
      setAllSessions(mapped);
      setSessions(mapped);
    } catch {
      setAllSessions([]);
      setSessions([]);
    } finally {
      setIsLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchRecent();
  }, [fetchRecent]);

  // Client-side debounced search
  const handleSearchQuery = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (debounceRef.current) clearTimeout(debounceRef.current);

      if (!q.trim()) {
        setSessions(allSessions);
        return;
      }

      debounceRef.current = setTimeout(() => {
        const lower = q.toLowerCase();
        setSessions(
          allSessions.filter((s) => s.title.toLowerCase().includes(lower)),
        );
      }, 300);
    },
    [allSessions],
  );

  const loadSession = useCallback(
    async (id: string): Promise<ConversationDetail | null> => {
      try {
        const backend = getMobileBackend(getAccessToken);
        const data = await backend.ai.getConversation(id);
        if (!data) return null;
        return {
          id: data.id,
          title: data.title || "Untitled",
          messages: (data.messages ?? []).map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            createdAt: m.createdAt ?? m.created_at ?? "",
          })),
        };
      } catch {
        return null;
      }
    },
    [getAccessToken],
  );

  return {
    sessions,
    isLoading,
    searchQuery,
    setSearchQuery: handleSearchQuery,
    loadSession,
    refresh: fetchRecent,
  };
}
