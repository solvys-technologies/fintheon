// [claude-code 2026-03-11] Systemic risk API routes
import { Hono } from "hono";
import { getCachedAssessment } from "../../services/systemic/risk-detector.js";
import { getActiveChainSummary } from "../../services/systemic/causal-chain-engine.js";
import { evaluateRhymes } from "../../services/systemic/historical-rhyming.js";
import {
  buildMacroIndicators,
  getCachedFredIndicators,
  getFredFetchedAt,
} from "../../services/systemic/fred-service.js";
import { getHeadlineSignals } from "../../services/systemic/risk-detector.js";
import { fetchVIX } from "../../services/vix-service.js";

const systemic = new Hono();

// GET /api/systemic/assessment — latest systemic risk assessment
systemic.get("/assessment", (c) => {
  const assessment = getCachedAssessment();
  if (!assessment) {
    return c.json({
      systemicScore: 0,
      activeChains: [],
      rhymeMatches: [],
      creditSignalCount: 0,
      ivScoreOverlay: 0,
      rationale: [
        "Systemic risk assessment not yet available — poller starting up",
      ],
      generatedAlerts: [],
      timestamp: new Date().toISOString(),
    });
  }
  return c.json(assessment);
});

// GET /api/systemic/chains — active causal chains
systemic.get("/chains", (c) => {
  const chains = getActiveChainSummary();
  return c.json({ chains, count: chains.length });
});

// GET /api/systemic/rhymes — current historical rhyme matches
systemic.get("/rhymes", async (c) => {
  try {
    const vixData = await fetchVIX();
    const indicators = buildMacroIndicators(
      vixData.level,
      undefined,
      getHeadlineSignals(),
    );
    const rhymes = evaluateRhymes(indicators, 0.3);
    return c.json({ rhymes, count: rhymes.length, indicators });
  } catch (err) {
    return c.json({ rhymes: [], count: 0, error: "Failed to evaluate rhymes" });
  }
});

// GET /api/systemic/fred — FRED macro indicator data
systemic.get("/fred", (c) => {
  const data = getCachedFredIndicators();
  const fetchedAt = getFredFetchedAt();
  return c.json({ data, fetchedAt: fetchedAt?.toISOString() ?? null });
});

export { systemic };
