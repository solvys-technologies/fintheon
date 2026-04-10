#!/usr/bin/env bun
// [claude-code 2026-03-28] S7-T2: Reclassify seed events into the 10 real narrative threads
// Run: bun run backend-hono/scripts/reclassify-seeds.ts

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

// ── Narrative thread definitions (from migration 027) ───────────────
const THREADS: Record<string, string[]> = {
  "middle-east-conflict": [
    "iran",
    "israel",
    "houthi",
    "hezbollah",
    "middle east",
    "gaza",
    "lebanon",
    "syria",
    "yemen",
    "red sea",
    "strait of hormuz",
    "idf",
    "netanyahu",
    "khamenei",
  ],
  "liquidity-credit-contraction": [
    "liquidity",
    "credit",
    "blue owl",
    "lending",
    "tightening",
    "spread",
    "high yield",
    "junk bond",
    "default",
    "bankruptcy",
    "delinquency",
  ],
  "ai-singularity": [
    "ai ",
    "artificial intelligence",
    "anthropic",
    "openai",
    "nvidia",
    "gpu",
    "semiconductor",
    "chip",
    "claude",
    "gpt",
    "model release",
    "agi",
    "deepseek",
  ],
  "usd-jpy-carry-trade": [
    "yen",
    "jpy",
    "boj",
    "bank of japan",
    "carry trade",
    "ueda",
    "usdjpy",
    "japan",
    "yen flash",
    "yen carry",
  ],
  "trade-war": [
    "tariff",
    "trade war",
    "liberation day",
    "reciprocal",
    "import tax",
    "customs",
    "trade barrier",
    "retaliation",
  ],
  "us-china-relations": [
    "china",
    "beijing",
    "xi jinping",
    "cnh",
    "yuan",
    "pboc",
    "delegation",
    "huawei",
    "tiktok",
    "chip ban",
    "entity list",
    "smic",
  ],
  "rate-cut-cycle": [
    "rate cut",
    "traders price in",
    "cuts priced",
    "basis points",
    "recession",
    "fed cut",
    "powell",
    "fomc",
    "dovish",
    "soft landing",
    "hard landing",
    "warsh",
  ],
  "trump-presidency": [
    "trump",
    "white house",
    "executive order",
    "maga",
    "bessent",
    "lutnick",
    "vance",
    "doge",
    "musk",
    "cabinet",
  ],
  "price-stability": [
    "cpi",
    "ppi",
    "pce",
    "inflation",
    "deflation",
    "disinflation",
    "price stability",
    "consumer price",
    "producer price",
    "core inflation",
  ],
  "maximum-employment": [
    "nfp",
    "jobs",
    "unemployment",
    "payroll",
    "jobless claims",
    "labor",
    "employment",
    "hiring",
    "layoff",
    "quits rate",
    "jolts",
  ],
};

// ── Scoring ─────────────────────────────────────────────────────────
interface SeedEvent {
  id: string;
  title: string;
  description: string;
  tags?: string[];
  [key: string]: unknown;
}

function scoreEvent(event: SeedEvent): { slug: string; score: number }[] {
  const text = [event.title, event.description, ...(event.tags ?? [])]
    .join(" ")
    .toLowerCase();

  const scores: { slug: string; score: number }[] = [];

  for (const [slug, keywords] of Object.entries(THREADS)) {
    let score = 0;
    for (const kw of keywords) {
      // Count occurrences — title hits weighted 2x
      const titleHits = event.title.toLowerCase().split(kw).length - 1;
      const fullHits = text.split(kw).length - 1;
      score += titleHits * 2 + fullHits;
    }
    if (score > 0) scores.push({ slug, score });
  }

  return scores.sort((a, b) => b.score - a.score);
}

// ── Main ────────────────────────────────────────────────────────────
const seedPath = resolve(
  import.meta.dir,
  "../../frontend/data/narrative-seed-events.json",
);
const raw = readFileSync(seedPath, "utf-8");
const events: SeedEvent[] = JSON.parse(raw);

let classified = 0;
let unmatched = 0;

for (const event of events) {
  const scores = scoreEvent(event);

  if (scores.length === 0) {
    console.warn(`⚠ No match: ${event.id} — "${event.title}"`);
    unmatched++;
    // Keep existing narrative if present, otherwise default to rate-cut-cycle
    if (!event.narrative) event.narrative = "rate-cut-cycle";
    if (
      !event.narrativeThreads ||
      (event.narrativeThreads as string[]).length === 0
    ) {
      event.narrativeThreads = [event.narrative as string];
    }
    continue;
  }

  // Primary = highest score
  event.narrative = scores[0].slug;

  // Secondary threads: top 3 that score above 30% of the best
  const threshold = scores[0].score * 0.3;
  event.narrativeThreads = scores
    .filter((s) => s.score >= threshold)
    .slice(0, 3)
    .map((s) => s.slug);

  classified++;
}

// Write back
writeFileSync(seedPath, JSON.stringify(events, null, 2) + "\n");

console.log(`\n✓ Reclassified ${classified}/${events.length} events`);
if (unmatched > 0) console.log(`⚠ ${unmatched} events had no keyword match`);

// Distribution summary
const dist: Record<string, number> = {};
for (const e of events) {
  const n = (e.narrative as string) ?? "unknown";
  dist[n] = (dist[n] ?? 0) + 1;
}
console.log("\nDistribution:");
for (const [slug, count] of Object.entries(dist).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${slug}: ${count}`);
}
