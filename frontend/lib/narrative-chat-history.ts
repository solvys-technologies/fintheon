import { getAccessToken } from "./supabase";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface NarrativeChatThread {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  model?: string;
}

export async function fetchNarrativeChatThreads(
  workspaceId: string,
): Promise<NarrativeChatThread[]> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const params = new URLSearchParams({
    workspaceId,
    surface: "narrativeflow",
    limit: "30",
  });
  const response = await fetch(`${API_BASE}/api/ai/conversations?${params}`, {
    headers,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error ?? "Workspace chat threads failed to load.");
  }
  return (data?.conversations ?? []).map(toThread);
}

function toThread(value: Record<string, unknown>): NarrativeChatThread {
  return {
    id: String(value.id ?? ""),
    title: String(value.title ?? "Untitled chat"),
    messageCount: toNumber(value.messageCount ?? value.message_count),
    lastMessageAt: String(value.lastMessageAt ?? value.last_message_at ?? value.updatedAt ?? ""),
    model: value.model ? String(value.model) : undefined,
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
