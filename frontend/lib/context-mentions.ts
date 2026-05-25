// [codex 2026-05-23] Shared chat @mention source contract.
import { API_BASE_URL } from "../components/chat/constants";

export type ContextMentionType =
  | "document"
  | "skill"
  | "connector"
  | "narrative"
  | "theme"
  | "riskflow"
  | "instrument"
  | "vault"
  | "memo"
  | "chart"
  | "agent";

export interface ContextMention {
  id: string;
  type: ContextMentionType;
  label: string;
  subtitle: string;
  preview: string;
  source: string;
  referenceId: string;
  tags: string[];
  updatedAt: string | null;
}

export async function fetchContextMentions(
  query: string,
): Promise<ContextMention[]> {
  const params = new URLSearchParams({
    q: query,
    limit: "30",
  });
  const res = await fetch(`${API_BASE_URL}/api/context/mentions?${params}`);
  if (!res.ok) throw new Error(`Mentions failed: ${res.status}`);
  const json = (await res.json()) as { mentions?: ContextMention[] };
  return json.mentions ?? [];
}

export function mentionToken(item: ContextMention): string {
  const slug = item.label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `@${slug || item.type}`;
}

export function formatMentionContext(items: ContextMention[]): string {
  if (items.length === 0) return "";
  const lines = items.map(
    (item) =>
      `- ${item.type}:${item.referenceId} | ${item.label} | ${item.preview}`,
  );
  return `\n\n[Referenced Context]\n${lines.join("\n")}`;
}
