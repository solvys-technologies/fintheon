// [claude-code 2026-03-26] T2 — Oracle agent notes cron + manual generate-note endpoint
// Generates 1-2 sentence tactical desk analyst notes for high/critical RiskFlow items

import { createLogger } from "../../lib/logger.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { invokeAgent } from "../strands/index.js";

const log = createLogger("AgentNotes");

const CRON_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const BATCH_SIZE = 5; // max items per cron cycle (API cost guard)
const LOOKBACK_HOURS = 4;

const SYSTEM_PROMPT = `You are a senior macro trader's desk analyst. Given a market event, produce a single 1-2 sentence tactical note for an intraday futures trader. Focus on: likely short-term price action, key levels to watch, risk of reversal/round-trip. Be specific and actionable. No hedging language.`;

let cronTimer: ReturnType<typeof setInterval> | null = null;
let isGenerating = false;

// ── Core generation ─────────────────────────────────────────────────────────

interface NoteInput {
  headline: string;
  summary?: string;
  severity: string;
  tags: string[];
  econData?: Record<string, unknown> | null;
  subScores?: Record<string, unknown> | null;
}

/**
 * Generate a tactical agent note for a single item using Oracle's model
 */
export async function generateAgentNote(item: NoteInput): Promise<string> {
  // Build user prompt with all available context
  let userPrompt = `Headline: ${item.headline}`;
  if (item.summary) userPrompt += `\nSummary: ${item.summary}`;
  userPrompt += `\nSeverity: ${item.severity}`;
  if (item.tags.length > 0) userPrompt += `\nTags: ${item.tags.join(", ")}`;
  if (item.econData) {
    const econ = item.econData as Record<string, unknown>;
    const parts: string[] = [];
    if (econ.actual != null) parts.push(`Actual: ${econ.actual}`);
    if (econ.forecast != null) parts.push(`Forecast: ${econ.forecast}`);
    if (econ.previous != null) parts.push(`Previous: ${econ.previous}`);
    if (econ.beatMiss) parts.push(`Result: ${econ.beatMiss}`);
    if (econ.surprisePercent != null)
      parts.push(`Surprise: ${econ.surprisePercent}%`);
    if (parts.length > 0) userPrompt += `\nEcon Data: ${parts.join(" | ")}`;
  }
  if (item.subScores) {
    const ss = item.subScores as Record<string, unknown>;
    const scoreParts: string[] = [];
    if (ss.eventWeight != null) scoreParts.push(`Event: ${ss.eventWeight}/10`);
    if (ss.vixContext != null) scoreParts.push(`VIX: ${ss.vixContext}/10`);
    if (ss.momentum != null) scoreParts.push(`Momentum: ${ss.momentum}/2`);
    if (scoreParts.length > 0)
      userPrompt += `\nScore Context: ${scoreParts.join(" | ")}`;
  }

  const { text } = await invokeAgent({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    model: { temperature: 0.3, maxTokens: 200 },
  });

  return text.trim();
}

// ── Supabase helpers ────────────────────────────────────────────────────────

interface ScoredRow {
  id: string;
  headline: string;
  body?: string | null;
  macro_level: number;
  tags?: string[] | null;
  econ_data?: Record<string, unknown> | null;
  sub_scores?: Record<string, unknown> | null;
}

/**
 * Fetch items needing notes: macro_level >= 3, no agent_note, published in last N hours
 */
async function fetchItemsNeedingNotes(): Promise<ScoredRow[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const cutoff = new Date(
    Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select("id, headline, body, macro_level, tags, econ_data, sub_scores")
    .gte("macro_level", 3)
    .is("agent_note", null)
    .gte("published_at", cutoff)
    .order("macro_level", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(BATCH_SIZE);

  if (error) {
    log.error("Failed to fetch items needing notes", { error: error.message });
    return [];
  }
  return (data ?? []) as ScoredRow[];
}

/**
 * Fetch a single scored item by ID
 */
async function fetchItemById(itemId: string): Promise<ScoredRow | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select("id, headline, body, macro_level, tags, econ_data, sub_scores")
    .eq("tweet_id", itemId)
    .single();

  if (error) {
    log.error("Failed to fetch item by tweet_id", {
      itemId,
      error: error.message,
    });
    return null;
  }
  return data as ScoredRow | null;
}

/**
 * Write generated note back to DB
 */
async function writeNoteToItem(itemId: string, note: string): Promise<boolean> {
  const sb = getSupabaseClient();
  if (!sb) return false;

  const { error } = await sb
    .from("scored_riskflow_items")
    .update({
      agent_note: note,
      agent_note_generated_at: new Date().toISOString(),
    })
    .eq("id", itemId);

  if (error) {
    log.error("Failed to write note", { itemId, error: error.message });
    return false;
  }
  return true;
}

// ── Severity helper ─────────────────────────────────────────────────────────

function macroLevelToSeverity(level: number): string {
  switch (level) {
    case 4:
      return "Critical";
    case 3:
      return "High";
    case 2:
      return "Medium";
    default:
      return "Low";
  }
}

// ── Cron cycle ──────────────────────────────────────────────────────────────

async function notesCycle(): Promise<void> {
  if (isGenerating) return;
  isGenerating = true;

  try {
    const items = await fetchItemsNeedingNotes();
    if (items.length === 0) return;

    let generated = 0;
    for (const item of items) {
      try {
        const note = await generateAgentNote({
          headline: item.headline,
          summary: item.body ?? undefined,
          severity: macroLevelToSeverity(item.macro_level),
          tags: item.tags ?? [],
          econData: item.econ_data,
          subScores: item.sub_scores,
        });

        const ok = await writeNoteToItem(item.id, note);
        if (ok) generated++;
      } catch (err) {
        log.warn("Failed to generate note for item", {
          itemId: item.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (generated > 0) {
      log.info(`Generated ${generated} notes`);
    }
  } catch (err) {
    log.error("Notes cycle error", {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isGenerating = false;
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Start the agent notes cron (3-minute interval)
 */
export function startAgentNotesCron(): void {
  if (cronTimer) return;

  log.info(
    `Starting (interval: ${CRON_INTERVAL_MS / 1000}s, batch: ${BATCH_SIZE}, lookback: ${LOOKBACK_HOURS}h)`,
  );

  // Run first cycle after a short delay to let other services initialize
  setTimeout(() => notesCycle(), 10_000);
  cronTimer = setInterval(notesCycle, CRON_INTERVAL_MS);
}

/**
 * Stop the agent notes cron
 */
export function stopAgentNotesCron(): void {
  if (cronTimer) {
    clearInterval(cronTimer);
    cronTimer = null;
    log.info("Stopped");
  }
}

/**
 * Auto-generate notes for all Critical (macroLevel 4) items missing notes.
 * Called during manual refresh to ensure every CRIT item gets an Oracle note immediately.
 * [claude-code 2026-03-27] S3: Auto-notes for critical items on refresh
 */
export async function generateNotesForCriticalItems(): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) return 0;

  const cutoff = new Date(
    Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select("id, headline, body, macro_level, tags, econ_data, sub_scores")
    .eq("macro_level", 4)
    .is("agent_note", null)
    .gte("published_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error || !data?.length) return 0;

  let generated = 0;
  for (const item of data as ScoredRow[]) {
    try {
      const note = await generateAgentNote({
        headline: item.headline,
        summary: item.body ?? undefined,
        severity: "Critical",
        tags: item.tags ?? [],
        econData: item.econ_data,
        subScores: item.sub_scores,
      });
      const ok = await writeNoteToItem(item.id, note);
      if (ok) generated++;
    } catch (err) {
      log.warn("Auto-note for critical item failed", {
        itemId: item.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (generated > 0) {
    log.info(`Auto-generated ${generated} notes for critical items`);
  }
  return generated;
}

/**
 * Auto-generate notes for items with econ data (beat/miss/inline).
 * Called immediately after scoring — econ catalysts should always have a note.
 */
export async function generateNotesForEconItems(): Promise<number> {
  const sb = getSupabaseClient();
  if (!sb) return 0;

  const cutoff = new Date(
    Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await sb
    .from("scored_riskflow_items")
    .select("id, headline, body, macro_level, tags, econ_data, sub_scores")
    .not("econ_data", "is", null)
    .is("agent_note", null)
    .gte("published_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error || !data?.length) return 0;

  let generated = 0;
  for (const item of data as ScoredRow[]) {
    // Only generate for items that actually have econ print data
    const econ = item.econ_data as Record<string, unknown> | null;
    if (!econ || !econ.beatMiss) continue;

    try {
      const note = await generateAgentNote({
        headline: item.headline,
        summary: item.body ?? undefined,
        severity: macroLevelToSeverity(item.macro_level),
        tags: item.tags ?? [],
        econData: item.econ_data,
        subScores: item.sub_scores,
      });
      const ok = await writeNoteToItem(item.id, note);
      if (ok) generated++;
    } catch (err) {
      log.warn("Auto-note for econ item failed", {
        itemId: item.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (generated > 0) {
    log.info(`Auto-generated ${generated} notes for econ data items`);
  }
  return generated;
}

/**
 * Manual trigger: generate a note for a specific item by ID
 * Returns the generated note or null if the item doesn't exist / generation fails
 */
export async function generateNoteForItem(
  itemId: string,
): Promise<string | null> {
  const item = await fetchItemById(itemId);
  if (!item) {
    log.warn("Item not found for manual note generation", { itemId });
    return null;
  }

  const note = await generateAgentNote({
    headline: item.headline,
    summary: item.body ?? undefined,
    severity: macroLevelToSeverity(item.macro_level),
    tags: item.tags ?? [],
    econData: item.econ_data,
    subScores: item.sub_scores,
  });

  const ok = await writeNoteToItem(item.id, note);
  if (!ok) return null;

  log.info("Manual note generated", { itemId });
  return note;
}
