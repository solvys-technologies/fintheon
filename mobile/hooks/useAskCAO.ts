// [claude-code 2026-05-03] S58-T2: Ask CAO uses direct DeepSeek when a user key is configured.
// [claude-code 2026-04-19] S25: Ask CAO dispatch hook. Seeds a new Harper conversation with
//   catalyst context, stashes the conversationId in sessionStorage so the Chat tab can pick it
//   up on next render, fires the existing `fintheon:relay-dispatch` custom event in case
//   ChatPage is already mounted, and returns an imperative `ask()` fn for the caller to await.
import { useCallback, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  createDeepSeekStreamResponse,
  fetchDeepSeekKey,
  type DeepSeekChatMessage,
} from "@frontend/lib/deepseek-sdk";

const API_BASE = import.meta.env.VITE_API_URL || "";

function formatDirectPrompt(input: AskCAOInput) {
  const context = input.context;
  return [
    input.question || "Analyze this item for TP.",
    context?.title ? `Title: ${context.title}` : "",
    context?.summary ? `Summary: ${context.summary}` : "",
    context?.severity ? `Severity: ${context.severity}` : "",
    typeof context?.iv === "number" ? `IV: ${context.iv}` : "",
    context?.sentiment ? `Sentiment: ${context.sentiment}` : "",
    context?.tickers?.length ? `Tickers: ${context.tickers.join(", ")}` : "",
    context?.sourceUrl ? `Source: ${context.sourceUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function drainResponse(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) return;
  while (true) {
    const { done } = await reader.read();
    if (done) return;
  }
}

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
        const hasDirectKey = Boolean(
          await fetchDeepSeekKey({ apiBaseUrl: API_BASE, getAccessToken }).catch(
            () => null,
          ),
        );
        if (hasDirectKey) {
          const messages: DeepSeekChatMessage[] = [
            { role: "user", content: formatDirectPrompt(input) },
          ];
          const result = await createDeepSeekStreamResponse(messages, {
            provider: "deepseek-direct",
            apiBaseUrl: API_BASE,
            getAccessToken,
            title: input.context?.title ?? "Ask CAO",
          });
          await drainResponse(result.response);
          if (!result.conversationId) return null;
          try {
            sessionStorage.setItem(
              "fintheon:pending-relay-conv",
              result.conversationId,
            );
          } catch {
            /* ignore */
          }
          window.dispatchEvent(
            new CustomEvent("fintheon:relay-dispatch", {
              detail: { conversationId: result.conversationId },
            }),
          );
          return result.conversationId;
        }

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
