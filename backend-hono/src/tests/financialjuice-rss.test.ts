import test from "node:test";
import assert from "node:assert/strict";
import { checkContentGuard } from "../services/riskflow/content-guard.js";
import { isFinancialJuiceAdOrPromo } from "../workers/riskflow-worker/sources/financialjuice-rss.js";

test("FinancialJuice RSS ad helper blocks platform ads and notices", () => {
  const blocked = [
    "Subscribe to FinancialJuice for real-time market news",
    "Download the FinancialJuice app",
    "Start your free trial today",
    "Use promo code FJ20",
    "VOICE USERS ONLY: Click blue stream button again. Wait for it to say streaming. Don't refresh site, please.",
    "FinancialJuice | Lets you trade like a pro",
    "Sponsored: market data offer",
    "Fed decision 😂",
  ];

  for (const headline of blocked) {
    assert.equal(isFinancialJuiceAdOrPromo(headline), true, headline);
  }
});

test("FinancialJuice RSS ad helper allows non-ad wire and commentary items", () => {
  const allowed = [
    "US Initial Jobless Claims Actual 231K Forecast 220K Previous 222K",
    "ECB's Lagarde says policy remains data dependent",
    "Araghchi and Pakistan's Dar aim to maintain stability, prevent escalation - Tasnim News",
    "Desk chatter points to quiet flows before the close",
    "Fed discount rate unchanged at 5.50%",
  ];

  for (const headline of allowed) {
    assert.equal(isFinancialJuiceAdOrPromo(headline), false, headline);
  }
});

test("FinancialJuice RSS bypasses editorial content guard filters", () => {
  const lowKeywordHeadline =
    "Araghchi and Pakistan's Dar held a phone conversation this afternoon, Thursday";

  assert.equal(checkContentGuard(lowKeywordHeadline).blocked, true);
  assert.deepEqual(
    checkContentGuard(lowKeywordHeadline, {
      sourceType: "wire",
      ingestPipeline: "financialjuice-rss",
    }),
    { blocked: false, reason: null },
  );
});
