// [claude-code 2026-04-19] S24-T2: Novelty sanity check.
// Runs pure-function tests against the novelty decay curve, then (if Supabase
// is configured and SCORING_V4=true) seeds 3 near-dupe Trump headlines and
// asserts the returned novelty factors descend: 1.0 → ~0.4 → 0.3.
//
// Run:
//   bun run backend-hono/scripts/novelty-sanity.ts
//   SCORING_V4=true DATABASE_URL=... bun run backend-hono/scripts/novelty-sanity.ts

import {
  computeNoveltyFactor,
  recordUtterance,
  __test,
} from "../src/services/scoring/speaker-novelty.js";
import { isSupabaseConfigured } from "../src/config/supabase.js";

const { similarityToNoveltyFactor, jaccard, tokenize } = __test;

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK:   ${msg}`);
}

function near(a: number, b: number, eps = 0.05): boolean {
  return Math.abs(a - b) <= eps;
}

async function main(): Promise<void> {
  console.log("── similarityToNoveltyFactor decay curve ──");
  assert(similarityToNoveltyFactor(0.0) === 1.0, "sim=0.0 → 1.0 (novel)");
  assert(similarityToNoveltyFactor(0.29) === 1.0, "sim<0.3 → 1.0");
  assert(near(similarityToNoveltyFactor(0.3), 1.0), "sim=0.3 → 1.0 (boundary)");
  assert(near(similarityToNoveltyFactor(0.6), 0.7), "sim=0.6 → 0.7");
  assert(near(similarityToNoveltyFactor(0.9), 0.4), "sim=0.9 → 0.4");
  assert(similarityToNoveltyFactor(1.0) === 0.3, "sim=1.0 → 0.3 (floor)");
  assert(similarityToNoveltyFactor(99) === 0.3, "sim>>1 → 0.3");

  console.log("\n── Jaccard on tokenized headlines ──");
  const a = tokenize(
    "Trump on Iran: maybe will not extend ceasefire if attacks continue",
  );
  const b = tokenize(
    "Trump on Iran: may not extend ceasefire over continued attacks",
  );
  const c = tokenize("Powell: restrictive stance warranted amid inflation");
  const jAB = jaccard(a, b);
  const jAC = jaccard(a, c);
  console.log(`   jaccard(A,B) = ${jAB.toFixed(3)} (similar)`);
  console.log(`   jaccard(A,C) = ${jAC.toFixed(3)} (different)`);
  assert(jAB > 0.4, "near-dupe Trump headlines → high Jaccard");
  assert(jAC < 0.1, "Trump vs Powell → low Jaccard");

  console.log("\n── End-to-end (requires Supabase + SCORING_V4) ──");
  if (!isSupabaseConfigured()) {
    console.log("   SKIP: Supabase not configured");
    return;
  }
  if (process.env.SCORING_V4 !== "true") {
    console.log("   SKIP: SCORING_V4 is not 'true'");
    return;
  }

  const SPEAKER = "sanity-trump-" + Date.now().toString(36);
  const H1 = "Sanity: Trump on Iran ceasefire - may not extend if attacks";
  const H2 = "Sanity: Trump says Iran ceasefire may not extend over attacks";
  const H3 = "Sanity: Trump Iran ceasefire not extended attacks continue";

  const f1 = await computeNoveltyFactor(SPEAKER, H1);
  await recordUtterance(SPEAKER, H1);
  const f2 = await computeNoveltyFactor(SPEAKER, H2);
  await recordUtterance(SPEAKER, H2);
  const f3 = await computeNoveltyFactor(SPEAKER, H3);

  console.log(
    `   factors: f1=${f1.toFixed(2)} f2=${f2.toFixed(2)} f3=${f3.toFixed(2)}`,
  );
  assert(f1 === 1.0, "first utterance → 1.0 (no prior)");
  assert(f2 < f1, "second near-dupe → factor drops");
  assert(f3 <= f2, "third near-dupe → factor monotonically drops or floors");
  assert(f3 <= 0.5, "third near-dupe should be ≤ 0.5");

  console.log("\nAll novelty sanity checks passed.");
}

main().catch((err) => {
  console.error("novelty-sanity ERROR:", err);
  process.exit(1);
});
