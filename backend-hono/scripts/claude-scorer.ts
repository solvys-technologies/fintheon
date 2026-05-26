#!/usr/bin/env bun
// claude-scorer.ts — Score raw RiskFlow items via Claude CLI (Sonnet)
// Polls raw_riskflow_items for unscored items, classifies in batches,
// writes to scored_riskflow_items. Runs on a 2-minute loop.
//
// Usage: bun run scripts/claude-scorer.ts [--once]
// --once: process one batch and exit (for launchd/cron)
// default: continuous loop every 2 minutes

import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "child_process";
import { readFileSync, appendFileSync, mkdirSync } from "fs";
import { join } from "path";
import { enqueueRiskFlowObsidianFunnel } from "../src/services/riskflow/obsidian-funnel.js";

const ONCE = process.argv.includes("--once");
const BATCH_SIZE = 15;
const LOOP_INTERVAL_MS = 120_000; // 2 minutes
const CLAUDE_PATH = "/Users/tifos/.local/bin/claude";
const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "claude-scorer.log");

mkdirSync(LOG_DIR, { recursive: true });

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

// ── Supabase ──
try {
  const envText = readFileSync(join(import.meta.dir, "..", ".env"), "utf-8");
  for (const line of envText.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const sbUrl = process.env.SUPABASE_URL ?? "";
const sbKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
if (!sbUrl || !sbKey) {
  log("FATAL: No Supabase credentials");
  process.exit(1);
}
const supabase = createClient(sbUrl, sbKey);

// ── Fetch unscored items ──
async function fetchUnscored(limit: number): Promise<any[]> {
  // Get raw items that don't have a matching scored item yet
  const { data: raw, error } = await supabase
    .from("raw_riskflow_items")
    .select(
      "tweet_id, headline, body, source, symbols, tags, is_breaking, urgency, published_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit * 3); // fetch extra to filter

  if (error || !raw?.length) return [];

  // Get already-scored tweet_ids
  const tweetIds = raw.map((r) => r.tweet_id);
  const { data: scored } = await supabase
    .from("scored_riskflow_items")
    .select("tweet_id")
    .in("tweet_id", tweetIds);

  const scoredSet = new Set((scored ?? []).map((s) => s.tweet_id));
  return raw.filter((r) => !scoredSet.has(r.tweet_id)).slice(0, limit);
}

// ── Score via Claude CLI ──
function scoreViaClaude(items: any[]): any[] {
  const headlines = items
    .map(
      (item, i) =>
        `${i}|${item.tweet_id}|${item.headline ?? item.body ?? ""}|${item.source ?? ""}|${(item.symbols ?? []).join(",")}`,
    )
    .join("\n");

  const prompt = `You are a market news scoring engine for a futures trading desk. Score each headline below.

For each item, output a JSON array where each object has:
- tweet_id: from input
- sentiment: "bullish" | "bearish" | "neutral"
- iv_score: 0-10 (implied volatility impact. 0=irrelevant, 3=minor, 5=moderate, 7=significant, 10=crash/circuit-breaker level)
- macro_level: 1-4 (1=noise, 2=noteworthy, 3=important/tradeable, 4=market-moving/breaking)
- risk_type: "Macro" | "Geopolitical" | "Earnings" | "Technical" | "Credit" | "Liquidity" | "Commentary"
- agent_note: one sentence trading implication (e.g. "Hawkish tilt — watch /ZN for yield spike, /ES may fade")

Scoring guidelines:
- FOMC decisions, CPI/PPI/NFP prints, tariff announcements = macro_level 3-4, iv_score 5-8
- Fed official speeches = macro_level 2-3, iv_score 3-6
- Geopolitical escalation (military, sanctions) = macro_level 3-4, iv_score 5-9
- Earnings beats/misses = macro_level 2-3, iv_score 3-6
- Treasury auctions, yield moves = macro_level 2, iv_score 2-4
- Random commentary, minor data = macro_level 1, iv_score 1-3

Headlines (format: index|tweet_id|headline|source|symbols):
${headlines}

Return ONLY a valid JSON array. No markdown, no explanation.`;

  try {
    const result = execFileSync(
      CLAUDE_PATH,
      ["-p", prompt, "--model", "sonnet", "--output-format", "text"],
      { timeout: 90000, maxBuffer: 2 * 1024 * 1024, encoding: "utf-8" },
    );

    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      log("No JSON in Claude response");
      return [];
    }
    return JSON.parse(jsonMatch[0]);
  } catch (e) {
    log(`Claude CLI failed: ${e instanceof Error ? e.message : "unknown"}`);
    return [];
  }
}

// ── Write scored items ──
async function writeScored(items: any[], rawItems: any[]): Promise<number> {
  const rawMap = new Map(rawItems.map((r) => [r.tweet_id, r]));
  let written = 0;
  const writtenRows: Record<string, unknown>[] = [];

  for (const scored of items) {
    const raw = rawMap.get(scored.tweet_id);
    if (!raw) continue;

    // Only columns confirmed to exist in scored_riskflow_items table
    const row: Record<string, unknown> = {
      tweet_id: scored.tweet_id,
      headline: raw.headline ?? raw.body ?? "",
      source: raw.source ?? "",
      symbols: raw.symbols ?? [],
      tags: [...(raw.tags ?? []), scored.risk_type ?? "Commentary"].filter(
        Boolean,
      ),
      is_breaking: raw.is_breaking ?? false,
      urgency: raw.urgency ?? "normal",
      published_at: raw.published_at ?? new Date().toISOString(),
      sentiment: scored.sentiment ?? "neutral",
      iv_score: scored.iv_score ?? 0,
      macro_level: scored.macro_level ?? 1,
      scored_by: "claude-cli-sonnet",
      analyzed_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("scored_riskflow_items")
      .upsert(row, { onConflict: "tweet_id" });

    if (error) {
      log(`Write failed for ${scored.tweet_id}: ${error.message}`);
    } else {
      written++;
      writtenRows.push(row);
    }
  }

  enqueueRiskFlowObsidianFunnel(writtenRows as any[]);
  return written;
}

// ── Main loop ──
async function processBatch(): Promise<{
  fetched: number;
  scored: number;
  written: number;
}> {
  const raw = await fetchUnscored(BATCH_SIZE);
  if (raw.length === 0) return { fetched: 0, scored: 0, written: 0 };

  log(`Scoring ${raw.length} items via Claude CLI...`);
  const scored = scoreViaClaude(raw);
  log(`Claude returned ${scored.length} scored items`);

  const written = await writeScored(scored, raw);
  log(`Written ${written}/${scored.length} to scored_riskflow_items`);

  return { fetched: raw.length, scored: scored.length, written };
}

async function main() {
  log(
    `Claude Scorer starting (mode: ${ONCE ? "once" : "continuous"}, batch: ${BATCH_SIZE})`,
  );

  if (ONCE) {
    const result = await processBatch();
    log(
      `Done: ${result.fetched} fetched, ${result.scored} scored, ${result.written} written`,
    );
    return;
  }

  // Continuous loop
  while (true) {
    try {
      const result = await processBatch();
      if (result.fetched > 0) {
        log(`Cycle: ${result.fetched}→${result.scored}→${result.written}`);
      }
    } catch (e) {
      log(`Cycle error: ${e instanceof Error ? e.message : "unknown"}`);
    }
    await new Promise((r) => setTimeout(r, LOOP_INTERVAL_MS));
  }
}

main().catch((e) => {
  log(`FATAL: ${e instanceof Error ? e.message : "unknown"}`);
  process.exit(1);
});
