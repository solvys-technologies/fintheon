// [claude-code 2026-04-28] S47-T5: Commentary context loader for Arbitrum.
// Pulls recent commentary transcript summaries and shapes them into the
// ArbitrumCommentaryContext consumed by seats.ts buildUserPrompt.

import { getRecentTranscripts } from "../commentary-transcript.js";
import type { ArbitrumCommentaryContext } from "./types.js";

const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_LIMIT = 5;

export async function loadArbitrumCommentaryContext(opts?: {
  userId?: string;
  windowHours?: number;
  limit?: number;
}): Promise<ArbitrumCommentaryContext | null> {
  const summaries = await getRecentTranscripts({
    userId: opts?.userId,
    hours: opts?.windowHours ?? DEFAULT_WINDOW_HOURS,
    limit: opts?.limit ?? DEFAULT_LIMIT,
  });

  if (summaries.length === 0) return null;

  return {
    windowHours: opts?.windowHours ?? DEFAULT_WINDOW_HOURS,
    entries: summaries.map((s) => ({
      title: s.title ?? "Commentary",
      sourceUrl: s.sourceUrl ?? s.videoUrl,
      watchedAt: s.watchedAt,
      summary: s.summary ?? "",
    })),
  };
}
