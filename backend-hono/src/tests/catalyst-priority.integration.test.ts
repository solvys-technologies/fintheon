import test from "node:test";
import assert from "node:assert/strict";
import { assignMacroLevel } from "../utils/assign-macro-level.js";
import { shouldPushToConsilium } from "../services/riskflow/rettiwt-poller-transform.js";
import { shouldTriggerReactiveAdjustment } from "../services/agent-desk/agent-desk-reactive.js";
import {
  addClient,
  broadcastLevel4,
  removeClient,
} from "../services/riskflow/sse-broadcaster.js";
import { shouldUncapNarrativePressure } from "../services/market-data/point-estimator.js";
import type { FeedItem } from "../types/riskflow.js";

function makeFeedItem(level: 1 | 2 | 3 | 4, headline: string): FeedItem {
  return {
    id: `test-${level}-${Math.random().toString(36).slice(2, 8)}`,
    source: "Custom",
    headline,
    symbols: [],
    tags: [],
    isBreaking: level >= 3,
    urgency: level >= 3 ? "high" : "normal",
    macroLevel: level,
    publishedAt: new Date().toISOString(),
  };
}

test("Level 4 path: assignment + gates + SSE broadcast", () => {
  const macroLevel = assignMacroLevel({
    ivScore: 55,
    fjEmojiTier: "tier1",
    riskType: "Macro",
    keywordMatches: ["fed rate decision"],
    urgencySignals: 2,
  });
  assert.equal(macroLevel, 4);
  assert.equal(shouldPushToConsilium(macroLevel), true);
  assert.equal(shouldTriggerReactiveAdjustment(macroLevel), true);

  let enqueueCount = 0;
  const controller = {
    enqueue: () => {
      enqueueCount += 1;
    },
  } as unknown as ReadableStreamDefaultController;
  addClient(controller, "test-user");
  broadcastLevel4(makeFeedItem(4, "Fed rate decision"));
  removeClient(controller);
  assert.equal(enqueueCount, 1);
});

test("Level 3 path: no Level 4 broadcast", () => {
  const macroLevel = assignMacroLevel({
    ivScore: 72,
    fjEmojiTier: "tier2",
    riskType: "Macro",
    keywordMatches: ["fomc minutes"],
    urgencySignals: 2,
  });
  assert.equal(macroLevel, 3);
  assert.equal(shouldPushToConsilium(macroLevel), true);
  assert.equal(shouldTriggerReactiveAdjustment(macroLevel), true);

  let enqueueCount = 0;
  const controller = {
    enqueue: () => {
      enqueueCount += 1;
    },
  } as unknown as ReadableStreamDefaultController;
  addClient(controller, "test-user");
  broadcastLevel4(makeFeedItem(3, "FOMC minutes"));
  removeClient(controller);
  assert.equal(enqueueCount, 0);
});

test("Level 1 path: filtered/low-priority gates", () => {
  const macroLevel = assignMacroLevel({
    ivScore: 20,
    fjEmojiTier: "none",
    riskType: "Commentary",
    keywordMatches: ["analyst upgrade"],
    urgencySignals: 0,
  });
  assert.equal(macroLevel, 1);
  assert.equal(shouldPushToConsilium(macroLevel), false);
  assert.equal(shouldTriggerReactiveAdjustment(macroLevel), false);
});

test("narrativePressureCap hook", () => {
  assert.equal(
    shouldUncapNarrativePressure({ macroLevel: 4, riskType: "Macro" }),
    true,
  );
  assert.equal(
    shouldUncapNarrativePressure({ macroLevel: 3, riskType: "Macro" }),
    false,
  );
  assert.equal(
    shouldUncapNarrativePressure({ macroLevel: 4, riskType: "Earnings" }),
    false,
  );
});
