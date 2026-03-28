# S3 Plan — Sanctum Intelligence Overhaul

## Context
The Sanctum (MiroFish simulation dashboard) has four problems:
1. **Scored RiskFlow items are barely used** — context fetches 7 basic columns; rich data (sub_scores, econ_data, risk_type, agent_note, price_brain_score) is ignored
2. **Econ print data is disconnected** — hardcoded tickers with fragile matching; real econ data in scored items is untapped
3. **Analysis is formulaic gibberish** — briefing is 100% deterministic template text, KPI labels use scoring-engine internals ("Composite IV", "Regime Shift %") that confuse traders
4. **NarrativeFlow doesn't pass scored items** — Sanctum rendered without riskflowItems or macroContext

## User Decisions (2026-03-27)
- KPI labels: trader-friendly rewrites with interpretive sub-text
- Briefing: LLM-powered using existing model-selector pattern
- RiskFlow depth: full scored items everywhere (sub_scores, econ_data, risk_type, agent_notes, price_brain_score)
- Scope: fix NarrativeFlow's Sanctum instance too

## Track Breakdown

| Track | Slug | Depends On | Scope |
|-------|------|------------|-------|
| T1 | foundation-types-context | None (runs first) | Expand types + context pipeline to fetch full scored items |
| T2 | llm-briefing-engine | T1 types | Rewrite mirofish-briefing.ts with AI call |
| T3 | kpi-rewrites-interpretation | T1 types | Trader-friendly KPIs, briefing display, NarrativeFlow fix |
| T4 | scored-items-econ-risk | T1 types | Econ print integration + rich risk assessment cards |

## Execution Order
1. T1 runs first (owns expanded types)
2. T2, T3, T4 run in parallel after T1

## Shared File Conflicts
- `frontend/types/mirofish.ts` — T1 creates expanded types; T3 and T4 consume them (no conflict)
- `backend-hono/src/services/mirofish/mirofish-types.ts` — T1 only
- `backend-hono/src/services/mirofish/mirofish-briefing.ts` — T2 only
- `frontend/components/narrative/Sanctum.tsx` — T3 only (KPI row)
- `frontend/components/narrative/SanctumEconIntel.tsx` — T4 only
- `frontend/components/narrative/SanctumRiskAssessment.tsx` — T4 only

No two tracks write the same file. Clean parallel execution.

## Git Strategy
- All work on branch `v.8.25.4` (current)
- Each track commits independently
- Unification commit after all tracks merge

## Verification
- `npx tsc --noEmit` — zero type errors
- `bun run build` — clean Vite build
- Backend: `cd backend-hono && bun run dev` — starts without errors
- Manual: open Sanctum, verify KPIs render, briefing generates, econ cards show print data
