import {
  boundedExcerpt,
  parseMarkdown,
  splitList,
  stringifyMarkdown,
  summarizeMarkdown,
} from "../file-room/markdown.js";
import type {
  DeskInboxItem,
  DeskInboxStatus,
  MemoDraftInput,
} from "./types.js";

export function encodeInboxItem(item: DeskInboxItem): string {
  return stringifyMarkdown(
    {
      id: item.id,
      type: item.type,
      status: item.status,
      title: item.title,
      authorAgent: item.authorAgent,
      summary: item.summary,
      confidence: item.confidence,
      catalystDriftSessions: item.catalystDriftSessions,
      tickers: item.tickers,
      sourceRefs: item.sourceRefs,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    },
    item.body,
  );
}

export function decodeInboxItem(
  raw: string,
  fallbackId: string,
): DeskInboxItem {
  const parsed = parseMarkdown(raw);
  const frontmatter = parsed.frontmatter;
  return {
    id: frontmatter.id || fallbackId,
    deskId: frontmatter.deskId || "priced-in-capital",
    type: "agentic_memo",
    status: normalizeStatus(frontmatter.status),
    title: frontmatter.title || "Untitled memo",
    authorAgent: "harper",
    summary: frontmatter.summary || summarizeMarkdown(parsed.body),
    body: boundedExcerpt(parsed.body, 5000),
    confidence: Number(frontmatter.confidence || 0.72),
    tickers: splitList(frontmatter.tickers),
    sourceRefs: splitList(frontmatter.sourceRefs),
    catalystDriftSessions: Number(frontmatter.catalystDriftSessions || 0),
    createdAt: frontmatter.createdAt || new Date().toISOString(),
    updatedAt: frontmatter.updatedAt || new Date().toISOString(),
  };
}

export function draftFromInput(
  input: MemoDraftInput,
  id: string,
): DeskInboxItem {
  const now = new Date().toISOString();
  return {
    id,
    deskId: input.deskId || "priced-in-capital",
    type: "agentic_memo",
    status: "pending",
    title: input.title.trim(),
    authorAgent: "harper",
    summary: input.summary?.trim() || summarizeMarkdown(input.body),
    body: input.body.trim(),
    confidence: clamp(input.confidence ?? 0.74),
    tickers: input.tickers ?? [],
    sourceRefs: input.sourceRefs ?? [],
    catalystDriftSessions: input.catalystDriftSessions ?? 0,
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeStatus(value?: string): DeskInboxStatus {
  if (
    value === "approved" ||
    value === "changes_requested" ||
    value === "dismissed"
  )
    return value;
  return "pending";
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0.74));
}
