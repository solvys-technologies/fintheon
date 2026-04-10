import test from "node:test";
import assert from "node:assert/strict";
import { getMatchedKeywords } from "../services/headline-parser.js";

test("headline keyword matching", () => {
  const fed = getMatchedKeywords(
    "BREAKING: Fed rate decision — rates cut 50bps",
  );
  assert.ok(fed.includes("fed rate decision"));
  assert.ok(fed.includes("rate cut"));

  const housing = getMatchedKeywords("Housing starts decline for third month");
  assert.ok(housing.includes("housing starts"));

  const generic = getMatchedKeywords("Generic market commentary");
  assert.deepEqual(generic, []);
});
