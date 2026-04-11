import test from "node:test";
import assert from "node:assert/strict";
import { fjTierFromEmoji } from "../services/riskflow/fj-emoji-filter.js";

test("fjTierFromEmoji maps canonical tiers", () => {
  assert.equal(fjTierFromEmoji("🚨"), "tier1");
  assert.equal(fjTierFromEmoji("⚠️"), "tier2");
  assert.equal(fjTierFromEmoji(null), "none");
  assert.equal(fjTierFromEmoji("🟣"), "tier4");
});
