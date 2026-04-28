// [claude-code 2026-04-28] S47-T5: Commentary transcript capture service.
// Stores user-watched commentary metadata + optional transcript text.
// Summarizes before injecting into Arbitrum context. Raw transcript is kept
// for audit; only the compact summary reaches the chamber.

import { getSupabaseClient } from "../config/supabase.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("CommentaryTranscript");

export interface CommentaryTranscriptInput {
  videoUrl: string;
  sourceUrl?: string;
  title?: string;
  transcriptText?: string;
  userId: string;
  provider?: string;
  confidence?: number | null;
}

export interface CommentaryTranscriptRecord {
  id: string;
  video_url: string;
  source_url: string | null;
  title: string | null;
  watched_at: string;
  transcript_text: string | null;
  transcript_summary: string | null;
  user_id: string;
  created_at: string;
  provider: string | null;
  confidence: number | null;
}

export interface CommentaryTranscriptSummary {
  id: string;
  videoUrl: string;
  title: string | null;
  watchedAt: string;
  summary: string | null;
  sourceUrl: string | null;
}

const MAX_SUMMARY_LENGTH = 800;
const DEFAULT_WINDOW_HOURS = 24;

export async function recordWatchEvent(
  input: CommentaryTranscriptInput,
): Promise<CommentaryTranscriptRecord | null> {
  const sb = getSupabaseClient();
  if (!sb) {
    log.warn("recordWatchEvent skipped — no Supabase client");
    return null;
  }

  const summary = input.transcriptText
    ? await summarizeText(input.transcriptText)
    : null;

  const row = {
    video_url: input.videoUrl,
    source_url: input.sourceUrl ?? null,
    title: input.title ?? null,
    watched_at: new Date().toISOString(),
    transcript_text: input.transcriptText ?? null,
    transcript_summary: summary,
    user_id: input.userId,
    provider: input.provider ?? null,
    confidence: input.confidence ?? null,
  };

  const { data, error } = await sb
    .from("commentary_transcripts")
    .insert(row)
    .select()
    .single();

  if (error) {
    log.warn("recordWatchEvent insert failed", { error: error.message });
    return null;
  }

  return data as CommentaryTranscriptRecord;
}

export async function getRecentTranscripts(opts?: {
  userId?: string;
  hours?: number;
  limit?: number;
}): Promise<CommentaryTranscriptSummary[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const since = new Date(
    Date.now() - (opts?.hours ?? DEFAULT_WINDOW_HOURS) * 60 * 60 * 1000,
  ).toISOString();

  let q = sb
    .from("commentary_transcripts")
    .select("id, video_url, title, watched_at, transcript_summary, source_url")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 20);

  if (opts?.userId) {
    q = q.eq("user_id", opts.userId);
  }

  const { data, error } = await q;
  if (error) {
    log.warn("getRecentTranscripts failed", { error: error.message });
    return [];
  }

  return (data ?? []).map((r) => ({
    id: r.id,
    videoUrl: r.video_url,
    title: r.title,
    watchedAt: r.watched_at,
    summary: r.transcript_summary,
    sourceUrl: r.source_url,
  }));
}

export async function getTranscriptStats24h(): Promise<{
  count: number;
  lastCaptureAt: string | null;
  lastFailure: string | null;
}> {
  const sb = getSupabaseClient();
  if (!sb) return { count: 0, lastCaptureAt: null, lastFailure: null };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: countData }, { data: latestData }] = await Promise.all([
    sb.from("commentary_transcripts").select("id", { count: "exact", head: true }).gte("created_at", since),
    sb.from("commentary_transcripts").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);

  return {
    count: countData?.length ?? 0,
    lastCaptureAt: latestData?.[0]?.created_at ?? null,
    lastFailure: null, // failures are logged, not persisted in a separate table
  };
}

async function summarizeText(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= MAX_SUMMARY_LENGTH) return trimmed;

  // Naive summarization: first paragraph + last paragraph, truncated.
  // In production this should call a lightweight LLM (e.g. qwen3.5 via Hermes).
  const paragraphs = trimmed.split(/\n\s*\n/);
  if (paragraphs.length === 1) {
    return trimmed.slice(0, MAX_SUMMARY_LENGTH) +
      (trimmed.length > MAX_SUMMARY_LENGTH ? "…" : "");
  }

  const first = paragraphs[0].trim();
  const last = paragraphs[paragraphs.length - 1].trim();
  let summary = first;
  if (paragraphs.length > 2) {
    summary += "\n\n…\n\n" + last;
  }
  if (summary.length > MAX_SUMMARY_LENGTH) {
    summary = summary.slice(0, MAX_SUMMARY_LENGTH) + "…";
  }
  return summary;
}
