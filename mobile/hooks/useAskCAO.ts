// [claude-code 2026-04-19] S25: Ask CAO dispatch hook. Seeds a new Harper conversation with
//   catalyst context, stashes the conversationId in sessionStorage so the Chat tab can pick it
//   up on next render, fires the existing `fintheon:relay-dispatch` custom event in case
//   ChatPage is already mounted, and returns an imperative `ask()` fn for the caller to await.
import { useCallback, useState } from "react";
import { useAuth } from "../contexts/AuthContext";

const API_BASE = import.meta.env.VITE_API_URL || "";

export interface DispatchContext {
  title?: string;
  summary?: string;
  severity?: string;
  iv?: number;
  sentiment?: string;
  tickers?: string[];
  sourceUrl?: string;
}

export interface AskCAOInput {
  source: "catalyst" | "riskflow" | "brief";
  sourceId: string;
  context?: DispatchContext;
  question?: string;
}

export function useAskCAO() {
  const { getAccessToken } = useAuth();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(
    async (input: AskCAOInput): Promise<string | null> => {
      setError(null);
      setIsPending(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(`${API_BASE}/api/harper/dispatch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(input),
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `HTTP ${res.status}`);
        }
        const data = (await res.json()) as { conversationId: string };
        // Stash for ChatPage mount pickup (mirrors relay-dispatch pattern in App.tsx)
        try {
          sessionStorage.setItem(
            "fintheon:pending-relay-conv",
            data.conversationId,
          );
        } catch {
          /* ignore */
        }
        // If ChatPage is already mounted, nudge it to load this conversation
        window.dispatchEvent(
          new CustomEvent("fintheon:relay-dispatch", {
            detail: { conversationId: data.conversationId },
          }),
        );
        return data.conversationId;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Dispatch failed");
        return null;
      } finally {
        setIsPending(false);
      }
    },
    [getAccessToken],
  );

  return { ask, isPending, error };
}
