// [claude-code 2026-04-19] S24-T3: Score gate sanity script.
// Run: SCORING_V4=true bun run backend-hono/scripts/scarcity-sanity.ts
// Verifies the V4 gate produces the expected L8/L9/L10 caps for known inputs.

import { parseHeadline } from "../src/services/headline-parser.js";
import { computeV4ScarcityGate } from "../src/services/analysis/iv-scorer.js";
import { getLexicon, refreshLexicon } from "../src/services/scoring/lexicon-cache.js";

interface SanityCase {
  headline: string;
  rawScore: number;
  expectedMaxLevel: number; // inclusive cap
  rationale: string;
}

const CASES: SanityCase[] = [
  {
    headline: "Talks of ceasefire between Iran and US continue",
    rawScore: 9.6,
    expectedMaxLevel: 8,
    rationale: "Hedged framing — must cap at L8 regardless of multipliers",
  },
  {
    headline: "Iran reportedly planning to halt Strait of Hormuz traffic",
    rawScore: 9.8,
    expectedMaxLevel: 8,
    rationale: "Hedge phrase 'reportedly planning' forces L8 cap",
  },
  {
    headline: "Trump considering tariffs on China imports",
    rawScore: 9.0,
    expectedMaxLevel: 8,
    rationale: "Speculative 'considering' — caps at L8",
  },
];

async function main(): Promise<void> {
  await refreshLexicon();
  const lexicon = await getLexicon();

  console.log(`[scarcity-sanity] Loaded ${lexicon.length} lexicon entries`);
  console.log(`[scarcity-sanity] SCORING_V4=${process.env.SCORING_V4 ?? "(unset)"}`);

  let passed = 0;
  let failed = 0;
  for (const tc of CASES) {
    const parsed = parseHeadline(tc.headline).parsed;
    const gate = computeV4ScarcityGate(tc.rawScore, parsed, lexicon);
    const ok = gate.level <= tc.expectedMaxLevel;
    const tag = ok ? "PASS" : "FAIL";
    console.log(
      `[${tag}] "${tc.headline}" → L${gate.level} (cap=${gate.cappedScore}) — ${gate.capReason}`,
    );
    if (ok) passed++;
    else failed++;
  }
  console.log(`\n[scarcity-sanity] ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[scarcity-sanity] Fatal:", err);
  process.exit(2);
});
