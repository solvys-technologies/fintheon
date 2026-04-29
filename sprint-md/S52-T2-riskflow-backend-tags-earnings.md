# Sprint Brief: T2 -- RiskFlow Backend Tags, Earnings Classification, Priority Floor

## Context

RiskFlow card behavior depends on reliable backend tagging and risk typing, especially econ-print deviation gating and new Earnings handling. This track owns backend data-shape correctness for tags and earnings demotion, without touching frontend card rendering.

## Branch Target

`s51-cards-and-arbitrum`

## Scope -- Included

- [ ] Ensure econ print injections include `econ-print` and directional/magnitude tags.
- [ ] Ensure earnings keyword classification is broad enough for incoming headline mix.
- [ ] Ensure earnings risk type is low-priority floor.
- [ ] Verify feed payload fields required by UI deviation gate are present and stable.

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/components/RiskFlowMini.tsx`
- `mobile/components/riskflow/*`
- `frontend/components/arbitrum/*`
- `src/lib/changelog.ts` (owned by T4 only)

## File Ownership

- `backend-hono/src/services/riskflow/econ-bridge.ts`
- `backend-hono/src/services/riskflow/scorer-tagging.ts`
- `backend-hono/src/services/riskflow/feed-service.ts`

## Reuse Inventory (existing code to call, not reinvent)

- `injectEconPrintToFeed()` in `econ-bridge.ts` for print-tag payload shaping.
- `classifyRiskType()` in `scorer-tagging.ts` for keyword-driven risk typing.
- `resolveRiskTypeForAssignment()` path in `feed-service.ts` for post-enrichment floor logic.

## Known Issues to Preserve

- No new endpoint creation.
- No DB schema migration in this track unless explicitly blocked by missing field.
- Maintain existing riskflow pipeline and source normalization behavior.

## Implementation Steps

1. Validate econ-print tagging contract in `econ-bridge.ts`:
   - `econ-print`,
   - directional (`beat|miss|inline`),
   - magnitude (`high-surprise|moderate-surprise|inline-surprise`).
2. Expand/verify earnings keyword map in `scorer-tagging.ts` for preview/estimates/guidance/results terms.
3. Enforce earnings low-priority floor in `feed-service.ts` after risk type resolution.
4. Run feed smoke checks and confirm payloads consumed by UI gates.

## Acceptance Criteria

- [ ] Econ print items include expected tags for deviation gating.
- [ ] Earnings headlines classify to `riskType: "Earnings"` reliably.
- [ ] Earnings items are floored to low priority/macro level.
- [ ] Feed shape remains compatible with frontend/mobile consumers.

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Feed smoke checks
curl -s http://localhost:8080/api/riskflow/feed | jq '.[0] | {tags, riskType, econData, url}'
curl -s http://localhost:8080/api/riskflow/feed | jq '[.[] | select(.tags // [] | index("econ-print"))][0]'
curl -s http://localhost:8080/api/riskflow/feed | jq '[.[] | select(.riskType == "Earnings")][0:3] | map({headline, priority})'
```

## Commit Format

```text
[v.5.29.2] feat: S52-T2 RiskFlow econ-print tags + earnings priority floor
```
