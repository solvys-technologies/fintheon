import test from "node:test";
import assert from "node:assert/strict";
import {
  assignMacroLevel,
  type MacroLevelInput,
} from "../utils/assign-macro-level.js";

const baseInput: MacroLevelInput = {
  ivScore: 0,
  fjEmojiTier: "none",
  riskType: "Commentary",
  keywordMatches: [],
  urgencySignals: 0,
};

test("assignMacroLevel unit table", () => {
  const cases: Array<{
    name: string;
    input: Partial<MacroLevelInput>;
    expected: 1 | 2 | 3 | 4;
  }> = [
    {
      name: "Fed rate decision keyword",
      input: { keywordMatches: ["fed rate decision"], ivScore: 55 },
      expected: 4,
    },
    {
      name: ">2 SD CPI surprise",
      input: { sdSurprise: 2.5, ivScore: 60 },
      expected: 4,
    },
    {
      name: "FJ tier1 emoji",
      input: { fjEmojiTier: "tier1", ivScore: 30 },
      expected: 4,
    },
    {
      name: "High IV alone",
      input: { ivScore: 92 },
      expected: 4,
    },
    {
      name: "FOMC minutes + elevated IV",
      input: {
        keywordMatches: ["fomc minutes"],
        ivScore: 75,
        urgencySignals: 2,
        riskType: "Macro",
      },
      expected: 3,
    },
    {
      name: "Tariff announcement, tier2 emoji, Macro riskType",
      input: { fjEmojiTier: "tier2", riskType: "Macro" },
      expected: 3,
    },
    {
      name: "Housing starts keyword, IV 50",
      input: {
        keywordMatches: ["housing starts"],
        ivScore: 50,
        riskType: "Macro",
      },
      expected: 2,
    },
    {
      name: "Analyst upgrade, low IV",
      input: { keywordMatches: ["analyst upgrade"], ivScore: 20 },
      expected: 1,
    },
    {
      name: "No signals",
      input: { ivScore: 0, keywordMatches: [], fjEmojiTier: "none" },
      expected: 1,
    },
  ];

  for (const c of cases) {
    const actual = assignMacroLevel({ ...baseInput, ...c.input });
    assert.equal(actual, c.expected, c.name);
  }
});
