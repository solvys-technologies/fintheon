# Sprint Brief: T1 -- RiskFlow, Refinement, and Data-Source Integrity

## Context

RiskFlow is admitting or displaying the wrong source classes, and Refinement Engine edits are not reliably respected by backend polling/scoring. This track owns source-account persistence, General/MSM stripping, official feed boundaries, mandatory rescoring, and TradingView-first market-data routing. It unblocks later UI tracks by stabilizing backend contracts.

## Branch Target

`s47-wave1-riskflow-data`

## Scope -- Included

- [ ] Fix Refinement Engine source-account add/edit/save semantics.
- [ ] Add source method support for accounts/feeds where needed.
- [ ] Ensure source accounts, POI ranking/list, filters, event weights, and lexicon changes persist and affect backend behavior.
- [ ] Strip `General` feed/category ingestion and UI exposure.
- [ ] Preserve recent MSM blocklist hardening while allowing approved wire relay text.
- [ ] Add official RSS sources only for tracked economic publishers/events.
- [ ] Route market data requests through TradingView first, fallback browser-harness second, RiskFlow headlines third, Yahoo only as explicit last resort.
- [ ] Add diagnostics for source-account cache, TradingView router, and RiskFlow source stats.

## Scope -- Excluded (DO NOT TOUCH)

- Chat composer, mobile chat, Agentic Forum UI, Arbitrum UI, voice engine, icons/spinners, and chart components.
- Electron `.ics` interception.
- PMDB prompt/rendering except for data-router context consumed by other tracks.
- Tooling/skills import decisions from T0.

## Reuse Inventory

- `RefinementEngine` at `frontend/components/refinement/RefinementEngine.tsx:88` -- main workbench state and save/rescore buttons.
- `SourceAccountsManager` at `frontend/components/refinement/SourceAccountsManager.tsx:38` -- current source CRUD UI.
- `handleAddAccount` at `backend-hono/src/routes/source-accounts/handlers.ts:20` -- add source-account route; currently reads `displayName` only.
- `createScoringRoutes` at `backend-hono/src/routes/scoring/index.ts:183` -- sensitivity/preset and rescore-status routes.
- `handleRescoreAll` mounted at `backend-hono/src/routes/riskflow/index.ts:79` -- persisted rescore endpoint.
- `publisher-blocklist.ts` -- recent direct MSM/general blocklist defense; preserve and extend tests.
- `tradingview/scanner.ts` -- existing TradingView scanner with `quotes()` and market helpers.
- `econ/tradingview-coverage.ts` -- existing TradingView econ range fetch/upsert.
- `econ-calendar-populator.ts` -- TradingView economic calendar ingestion already established as source of truth.

## Known Issues to Preserve

- Recent changelog entries v5.33.1-v5.33.6 intentionally stripped Exa/MSM and added super-admin auth fallback. Do not revert.
- Approved wire tweets that quote Reuters/Bloomberg inline must remain allowed when the actual source is an approved X/wire handle.
- Supabase JWT and super-admin gates must remain enforced.

## Implementation Steps

1. In `SourceAccountsManager.tsx`, replace immediate-add semantics with a clear Add modal/form plus persisted Save response. Normalize frontend body keys to backend contract.
2. In `backend-hono/src/types/source-account.ts`, add a polling method field if missing. Allowed values should be explicit string union values, not an enum.
3. In source-account route/service, accept both old `displayName` and current `display_name` for one release only if persisted data requires compatibility; otherwise standardize one contract and update frontend.
4. Add validation for source method/category/handle. Return field-specific errors.
5. In `RefinementEngine.tsx`, add a Save/Apply button left of Re-Score All. It should save pending settings, then trigger rescore when scoring-affecting data changed.
6. Audit all category options in backend types, scorer mapping, frontend filters, and seed data. Remove or block `General` from new ingestion and visible filter choices.
7. Extend publisher/source tests or route smokes to prove direct MSM/general rows are blocked and approved wire relay rows are preserved.
8. Add official RSS feed config for BLS, Federal Reserve, New York Fed, and Atlanta Fed only if it maps to tracked events. Add source labels as official/government/econ, not General.
9. Add a `market-data-router` service under `backend-hono/src/services/market-data/` or extend the existing market-data route/service if present. TradingView is first. Browser-harness is second. RiskFlow headlines are third for narrative context only. Yahoo is last resort.
10. Route VIX through the router. Use TradingView `TVC:VIX` or verified equivalent if supported; keep Yahoo fallback with reason logging.
11. Add diagnostics fields for TradingView last success, fallback source, source-account cache last refresh, and source stats.
12. Add/update changelog entry.

## Acceptance Criteria

- [ ] Adding/editing/toggling/deleting a source account persists and survives reload.
- [ ] Source method is visible, validated, and respected by backend worker/scorer paths.
- [ ] `General` no longer appears in RiskFlow categories/filters for new data.
- [ ] Source, POI, filter, event weight, and lexicon changes trigger mandatory rescore.
- [ ] TradingView is primary for VIX/quotes when available; fallback source is observable.
- [ ] Backend diagnostics include source/router health.

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Frontend type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Local smokes after backend restart if route changes are served
curl -s http://localhost:8080/api/diagnostics
curl -s http://localhost:8080/api/riskflow/feed
curl -s http://localhost:8080/api/riskflow/iv-aggregate
```

## Commit Format

```bash
[v5.34.0] fix: T1 enforce RiskFlow source integrity
```
