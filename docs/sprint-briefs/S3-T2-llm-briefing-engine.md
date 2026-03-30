# S3-T2: LLM-Powered Briefing Engine

**Sprint:** S3 (Sanctum Intelligence Overhaul)
**Track:** T2 — Backend
**Dependencies:** T1 must be complete (expanded RiskFlowHeadline type)

---

## Objective
Replace the deterministic briefing generator (`mirofish-briefing.ts`) with an LLM-powered one that produces trader-friendly analysis referencing actual scored RiskFlow headlines, econ print data, regime context, and VIX levels. The output should read like a market analyst wrote it, not like a formula reformatted numbers.

---

## Files to Read First
- `backend-hono/src/services/mirofish/mirofish-briefing.ts` — current deterministic generator (REWRITE target)
- `backend-hono/src/services/brief-generator.ts` — existing LLM brief pattern (lines 63-180). THIS IS THE PATTERN TO FOLLOW for model selection, prompt construction, error handling, and Nous Direct fallback.
- `backend-hono/src/services/ai/model-selector.ts` — `selectModel()`, `createModelClient()`, `getFallbackModel()`, `markProviderUnhealthy()` functions
- `backend-hono/src/services/mirofish/mirofish-types.ts` — MiroFishReport, MiroFishBriefing, SimulationContext, RiskFlowHeadline (AFTER T1 expansion)
- `backend-hono/src/services/mirofish/mirofish-service.ts` — calls `generateBriefing()` at line 108

---

## Files to Modify

### 1. `backend-hono/src/services/mirofish/mirofish-briefing.ts` — FULL REWRITE

**Current state:** 106 lines of deterministic template text. Produces output like:
> "Composite IV at 5.3/10 (moderate). Regime shift probability 18%. Model confidence 72%."

**Target state:** LLM-powered generator that produces output like:
> "Market risk is moderate with pressure concentrated in monetary policy — the Fed's hawkish pivot has traders repricing rate expectations. Two CPI prints in the last 48h came in hot (+0.4% vs +0.2% forecast), confirming sticky inflation. VIX at 18.3 signals cautious positioning ahead of tomorrow's FOMC. The geopolitical backdrop is cooling after the tariff pause announcement. Key risk: any hawkish surprise at FOMC could push market heat above 7.0."

**Implementation:**

```typescript
// [claude-code 2026-03-27] S3-T2: LLM-powered briefing — replaces deterministic templates
import { generateText } from 'ai';
import type { MiroFishReport, MiroFishBriefing, SimulationContext, RiskFlowHeadline } from './mirofish-types.js';
import { selectModel, createModelClient, getFallbackModel, markProviderUnhealthy, type AiModelKey } from '../ai/model-selector.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('MiroFishBriefing');

// ── Helpers for prompt context ──

function ivLevel(score: number): string {
  if (score >= 8) return 'extreme';
  if (score >= 6) return 'elevated';
  if (score >= 4) return 'moderate';
  if (score >= 2) return 'low';
  return 'calm';
}

function formatHeadline(h: RiskFlowHeadline, i: number): string {
  const parts = [`${i + 1}. [${h.macro_level >= 4 ? 'CRITICAL' : h.macro_level >= 3 ? 'HIGH' : 'MED'}] ${h.title}`];
  if (h.risk_type) parts.push(`   Type: ${h.risk_type}`);
  if (h.sentiment && h.sentiment !== 'neutral') parts.push(`   Sentiment: ${h.sentiment}`);
  if (h.iv_score) parts.push(`   IV Score: ${h.iv_score.toFixed(1)}/10`);
  if (h.econ_data?.actual != null) {
    const ed = h.econ_data;
    parts.push(`   Econ: Actual ${ed.actual}${ed.forecast != null ? ` vs Forecast ${ed.forecast}` : ''}${ed.beatMiss ? ` (${ed.beatMiss.toUpperCase()})` : ''}${ed.surprisePercent != null ? ` Surprise: ${ed.surprisePercent > 0 ? '+' : ''}${ed.surprisePercent.toFixed(1)}%` : ''}`);
  }
  if (h.price_brain_score?.impliedPoints != null) {
    parts.push(`   Implied: ${h.price_brain_score.impliedPoints > 0 ? '+' : ''}${h.price_brain_score.impliedPoints} pts (${h.price_brain_score.sentiment})`);
  }
  if (h.agent_note) parts.push(`   Note: ${h.agent_note.slice(0, 120)}`);
  return parts.join('\n');
}

const CATEGORY_LABELS: Record<string, string> = {
  'geopolitical': 'Geopolitical',
  'political': 'Political',
  'monetary-policy': 'Monetary Policy',
  'earnings-corporate': 'Earnings/Corporate',
  'market-structure': 'Market Structure',
  'black-swan': 'Black Swan',
};

// ── Main generator ──

/**
 * Generate a structured text briefing from MiroFish debate results.
 * Uses LLM for natural, trader-friendly analysis.
 * Falls back to deterministic if all AI providers fail.
 */
export async function generateBriefing(
  report: MiroFishReport,
  context: SimulationContext,
): Promise<MiroFishBriefing> {
  try {
    return await generateAiBriefing(report, context);
  } catch (err) {
    log.warn('AI briefing failed, falling back to deterministic:', err);
    return generateDeterministicBriefing(report, context);
  }
}

async function generateAiBriefing(
  report: MiroFishReport,
  context: SimulationContext,
): Promise<MiroFishBriefing> {
  const composite = report.nextSessionProjection;
  const regime = report.regimeShiftProbability;
  const conf = report.confidence;

  // Build category summary
  const sortedCats = [...report.categoryScores].sort((a, b) => b.ivScore - a.ivScore);
  const catSummary = sortedCats
    .map(cs => {
      const label = CATEGORY_LABELS[cs.category] ?? cs.category;
      const dir = cs.delta > 0.3 ? 'rising' : cs.delta < -0.3 ? 'falling' : 'stable';
      return `${label}: ${cs.ivScore.toFixed(1)}/10 (${dir}, delta ${cs.delta > 0 ? '+' : ''}${cs.delta.toFixed(1)})`;
    })
    .join('\n');

  // Build headlines context (use expanded fields from T1)
  const headlineContext = context.riskflowHeadlines.length > 0
    ? context.riskflowHeadlines.slice(0, 12).map(formatHeadline).join('\n\n')
    : 'No significant headlines in current window.';

  // Build econ prints summary (items with econ_data)
  const econItems = context.riskflowHeadlines.filter(h => h.econ_data?.actual != null);
  const econSummary = econItems.length > 0
    ? econItems.map(h => {
        const ed = h.econ_data!;
        return `${h.title}: Actual ${ed.actual}${ed.forecast != null ? ` vs ${ed.forecast} forecast` : ''} (${ed.beatMiss?.toUpperCase() ?? 'N/A'})`;
      }).join('\n')
    : 'No recent economic prints.';

  // Top scenario
  const topScenario = report.scenarios[0];

  const prompt = `You are Fintheon's Sanctum briefing engine — a concise market risk analyst for an active futures trader (NQ/ES/YM). Write a market risk briefing based on the following data.

## Market Heat (0-10 Scale)
- Composite: ${composite.toFixed(1)}/10 (${ivLevel(composite)})
- Regime Change Risk: ${(regime * 100).toFixed(0)}%
- Signal Strength: ${(conf * 100).toFixed(0)}%

## Risk Sector Breakdown
${catSummary}

## VIX & Macro
${context.vixLevel != null ? `VIX: ${context.vixLevel.toFixed(1)}` : 'VIX: unavailable'}
${Object.keys(context.fredIndicators).length > 0 ? `FRED: ${Object.entries(context.fredIndicators).map(([k, v]) => `${k}: ${v?.toFixed(2)}`).join(', ')}` : ''}

## Recent Economic Prints
${econSummary}

## Scored Headlines (last 72h)
${headlineContext}

${topScenario ? `## Top Scenario\n"${topScenario.label}" — ${(topScenario.probability * 100).toFixed(0)}% probability, projected heat ${topScenario.projectedIVScore.toFixed(1)}/10` : ''}

## Instructions
Write the briefing in this exact JSON format (raw JSON, no markdown fences):
{
  "summary": "2-4 sentences. Plain English market read. Reference specific headlines/prints that matter. Use trader lingo (risk-on, risk-off, dovish, hawkish, sticky, repricing). Mention VIX level and what it signals. End with the dominant risk vector.",
  "keyFindings": ["finding 1", "finding 2", "finding 3", "finding 4"],
  "riskAlerts": ["alert if any sector is above 7.0 or regime change risk > 25%"],
  "agentConsensus": "One sentence: what the overall signal says to do (risk-on lean, stay flat, reduce exposure, etc.)"
}

Rules:
- keyFindings: 3-5 bullet points. Each must reference a specific headline, print, or data point. No generic statements. Use numbers.
- riskAlerts: 0-3 items. Only include if risk is genuinely elevated. Empty array is fine.
- agentConsensus: actionable one-liner for a day trader.
- Do NOT use the term "Composite IV" — use "market heat" or "risk pressure" instead.
- Do NOT just reformat numbers — INTERPRET them. "VIX at 18 signals..." not "VIX is 18."
- Max 300 words total across all fields.`;

  const selection = selectModel({ taskType: 'analysis', maxBudgetUsd: 0.03 });
  let text: string;

  try {
    const model = createModelClient(selection.model as AiModelKey);
    const result = await generateText({ model, prompt });
    text = result.text;
  } catch (err: any) {
    const isNetworkError = ['EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'ECONNREFUSED', 'fetch failed']
      .some(code => err?.message?.includes(code) || err?.cause?.code === code);

    if (!isNetworkError) throw err;

    log.warn(`Primary provider failed (${selection.provider}), trying fallback`);
    markProviderUnhealthy(selection.provider);
    const fallback = getFallbackModel(selection.model as AiModelKey);
    const model = createModelClient(fallback);
    const result = await generateText({ model, prompt });
    text = result.text;
  }

  // Parse JSON from response (strip markdown fences if present)
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  const parsed = JSON.parse(cleaned);

  return {
    summary: parsed.summary ?? '',
    keyFindings: Array.isArray(parsed.keyFindings) ? parsed.keyFindings : [],
    riskAlerts: Array.isArray(parsed.riskAlerts) ? parsed.riskAlerts : [],
    agentConsensus: parsed.agentConsensus ?? '',
    generatedAt: new Date().toISOString(),
  };
}

// ── Deterministic fallback (kept from original) ──

function generateDeterministicBriefing(
  report: MiroFishReport,
  context: SimulationContext,
): MiroFishBriefing {
  const composite = report.nextSessionProjection;
  const regime = report.regimeShiftProbability;
  const conf = report.confidence;
  const topCat = [...report.categoryScores].sort((a, b) => b.ivScore - a.ivScore)[0];
  const topLabel = topCat ? CATEGORY_LABELS[topCat.category] ?? topCat.category : 'unknown';

  let summary = `Market heat at ${composite.toFixed(1)}/10 (${ivLevel(composite)}). `;
  summary += `Regime change risk ${(regime * 100).toFixed(0)}%. `;
  summary += `Signal strength ${(conf * 100).toFixed(0)}%. `;
  summary += `Dominant risk: ${topLabel} at ${topCat?.ivScore.toFixed(1) ?? 'N/A'}.`;
  if (context.vixLevel != null) summary += ` VIX: ${context.vixLevel.toFixed(1)}.`;

  const keyFindings: string[] = [];
  for (const cs of [...report.categoryScores].sort((a, b) => b.ivScore - a.ivScore).slice(0, 3)) {
    const label = CATEGORY_LABELS[cs.category] ?? cs.category;
    const dir = cs.delta > 0 ? 'rising' : cs.delta < 0 ? 'falling' : 'stable';
    keyFindings.push(`${label}: ${cs.ivScore.toFixed(1)} (${dir}, conf ${(cs.confidence * 100).toFixed(0)}%)`);
  }

  const riskAlerts: string[] = [];
  for (const cs of report.categoryScores) {
    if (cs.ivScore >= 7) riskAlerts.push(`${CATEGORY_LABELS[cs.category] ?? cs.category} at ${cs.ivScore.toFixed(1)} — elevated`);
  }
  if (regime >= 0.25) riskAlerts.push(`Regime change risk at ${(regime * 100).toFixed(0)}%`);

  const votes = report.agentVotes;
  const highVol = votes.filter(v => v.position === 'high-vol').length;
  const neutral = votes.filter(v => v.position === 'neutral').length;
  const lowVol = votes.filter(v => v.position === 'low-vol').length;

  return {
    summary,
    keyFindings,
    riskAlerts,
    agentConsensus: `${votes.length} agents: ${highVol} high-vol, ${neutral} neutral, ${lowVol} low-vol`,
    generatedAt: new Date().toISOString(),
  };
}
```

**IMPORTANT:** The function signature changes from sync to async:
```typescript
// OLD: export function generateBriefing(...): MiroFishBriefing
// NEW: export async function generateBriefing(...): Promise<MiroFishBriefing>
```

### 2. `backend-hono/src/services/mirofish/mirofish-service.ts`

**What:** Update the `generateBriefing()` call at line 108 to `await` it (since it's now async).

```typescript
// Line 108 — OLD:
const briefing = generateBriefing(report, context);

// NEW:
const briefing = await generateBriefing(report, context);
```

That's it. The function was already called inside an async function (`startPrediction`), so adding `await` is safe.

---

## Key Rules
- Follow the EXACT error handling pattern from `brief-generator.ts` (lines 171-195): try primary model → catch network errors → mark unhealthy → try fallback → rethrow non-network errors
- Use `selectModel({ taskType: 'analysis', maxBudgetUsd: 0.03 })` — same task type as the MDB generator, slightly lower budget since this is a shorter output
- The prompt MUST request JSON output and the code MUST parse it with `JSON.parse()`. Strip markdown fences if present.
- Keep the deterministic fallback — if ALL AI providers fail, we still produce something
- The MiroFishBriefing interface stays unchanged: `{ summary, keyFindings, riskAlerts, agentConsensus, generatedAt }`
- Use "market heat" and "risk pressure" in prompts, NOT "Composite IV" — this aligns with T3's KPI rewrites

---

## DO NOT
- Modify mirofish-types.ts (that's T1)
- Modify any frontend files (that's T3/T4)
- Change the MiroFishBriefing interface shape
- Add new API endpoints
- Modify mirofish-context.ts (that's T1)

---

## Verification
```bash
cd /Users/tifos/Documents/Codebases/fintheon/backend-hono
npx tsc --noEmit  # Zero type errors
# Manual test: run a MiroFish simulation from the UI and check that the briefing text reads like analyst commentary, not formula output
```

---

## Changelog Entry
```typescript
{ date: '2026-03-27T__:__:__', agent: 'claude-code', summary: 'S3-T2: Replaced deterministic MiroFish briefing with LLM-powered generator. Uses model-selector pattern with Nous fallback. Produces trader-friendly analysis referencing specific headlines, econ prints, and regime context. Deterministic fallback preserved.', files: ['backend-hono/src/services/mirofish/mirofish-briefing.ts', 'backend-hono/src/services/mirofish/mirofish-service.ts'] }
```
