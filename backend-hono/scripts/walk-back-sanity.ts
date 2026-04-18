// [claude-code 2026-04-19] S24-T2: Walk-back sanity check.
// Runs pure-function tests against the pairer's subject-token logic first, then
// (if Supabase configured) inserts a synthetic L10 "ceasefire confirmed" +10min
// "ceasefire collapses" pair and asserts detectWalkBack pairs them.
//
// Run:
//   bun run backend-hono/scripts/walk-back-sanity.ts

import {
  detectWalkBack,
  __test,
} from "../src/services/scoring/walk-back-pairer.js";
import { getSupabaseClient, isSupabaseConfigured } from "../src/config/supabase.js";
import type { FeedItem } from "../src/types/riskflow.js";

const { tokenizeSubject, jaccard, oppositeSentiment, hasSharedSubject } =
  __test;

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`OK:   ${msg}`);
}

async function main(): Promise<void> {
  console.log("── tokenizeSubject strips direction tokens ──");
  const t1 = tokenizeSubject("Iran Israel ceasefire confirmed");
  const t2 = tokenizeSubject("Iran Israel ceasefire collapses");
  console.log(`   t1 = ${JSON.stringify([...t1])}`);
  console.log(`   t2 = ${JSON.stringify([...t2])}`);
  assert(!t1.has("confirmed"), "confirmed is a direction token, stripped");
  assert(!t2.has("collapses"), "collapses is a direction token, stripped");
  assert(t1.has("iran") && t2.has("iran"), "subject tokens preserved");
  const overlap = jaccard(t1, t2);
  console.log(`   jaccard(t1,t2) = ${overlap.toFixed(3)}`);
  assert(overlap >= 0.5, "ceasefire confirmed/collapses share subject tokens");

  console.log("\n── oppositeSentiment / hasSharedSubject ──");
  assert(
    oppositeSentiment("bullish", "bearish") && oppositeSentiment("bearish", "bullish"),
    "bullish ↔ bearish is opposite",
  );
  assert(!oppositeSentiment("neutral", "bearish"), "neutral is not opposite");

  const bullish: FeedItem = {
    id: "bull-1",
    source: "Custom",
    headline: "Iran Israel ceasefire confirmed",
    symbols: ["CL"],
    tags: ["geopolitical"],
    isBreaking: false,
    urgency: "immediate",
    publishedAt: new Date().toISOString(),
    sentiment: "bullish",
    ivScore: 9.5,
  };
  const bearish: FeedItem = {
    ...bullish,
    id: "bear-1",
    headline: "Iran Israel ceasefire collapses after missile strikes",
    sentiment: "bearish",
    ivScore: 9.7,
  };
  assert(hasSharedSubject(bullish, bearish), "shared CL symbol → shared subject");

  console.log("\n── End-to-end (requires Supabase + SCORING_V4) ──");
  if (!isSupabaseConfigured()) {
    console.log("   SKIP: Supabase not configured");
    return;
  }
  const sb = getSupabaseClient();
  if (!sb) {
    console.log("   SKIP: Supabase client unavailable");
    return;
  }

  const stamp = Date.now();
  const CONFIRMED_ID = `sanity-walkback-confirmed-${stamp}`;
  const COLLAPSE_ID = `sanity-walkback-collapse-${stamp}`;
  const tenMinAgo = new Date(stamp - 10 * 60 * 1000).toISOString();
  const now = new Date(stamp).toISOString();

  // Seed the original L10 "confirmed" row
  const { error: seedErr } = await sb.from("scored_riskflow_items").insert({
    tweet_id: CONFIRMED_ID,
    source: "Custom",
    headline: "Iran Israel ceasefire confirmed after talks",
    symbols: ["CL"],
    tags: ["geopolitical", "subj:iran"],
    is_breaking: true,
    urgency: "immediate",
    sentiment: "bullish",
    iv_score: 9.6,
    macro_level: 4,
    published_at: tenMinAgo,
    analyzed_at: tenMinAgo,
    scored_by: "sanity-script",
  });
  if (seedErr) {
    console.error("seed insert failed:", seedErr.message);
    process.exit(1);
  }

  const collapsingItem: FeedItem = {
    id: COLLAPSE_ID,
    source: "Custom",
    headline: "Iran Israel ceasefire collapses after missile strikes",
    symbols: ["CL"],
    tags: ["geopolitical", "subj:iran"],
    isBreaking: true,
    urgency: "immediate",
    publishedAt: now,
    sentiment: "bearish",
    ivScore: 9.7,
    macroLevel: 4,
  };

  const result = await detectWalkBack(collapsingItem);
  console.log(
    `   detectWalkBack → action=${result.action} pairsWith=${result.pairsWith} overlap=${result.overlapScore}`,
  );
  assert(result.action === "fade", "action=fade on opposing L10 pair");
  assert(result.pairsWith === CONFIRMED_ID, "pairs with the seeded confirmed row");
  assert((result.overlapScore ?? 0) >= 0.25, "overlap ≥ 0.25 threshold");

  // Cleanup
  await sb.from("scored_riskflow_items").delete().eq("tweet_id", CONFIRMED_ID);

  console.log("\nAll walk-back sanity checks passed.");
}

main().catch((err) => {
  console.error("walk-back-sanity ERROR:", err);
  process.exit(1);
});
