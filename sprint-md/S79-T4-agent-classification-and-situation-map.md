# Sprint Brief: S79-T4 -- Agent Classification and Situation Map

## Context

The tricky part is making NarrativeFlow improve over time: agents need to tag catalysts, classify conflict/noise/signal, retain tag decisions, and expose a full Situation Map across a desk's selected catalysts. This track adds the backend classification/service layer plus a standalone Situation Map component without taking ownership of the main `NarrativeCanvas.tsx` integration.

## Linear Scope

- **Issue naming**: `S79-T4: Agent Classification and Situation Map`
- **Beta Phase**: Closed Beta
- **Linear Project**: Beta -- Sanctum & Arbitrum UX
- **Linear Initiative**: Beta Closed
- **Cycle**: Cycle 8 - Beta Closed
- **Due date**: 2026-05-23
- **Assigned owner**: local Solvys Agent
- **Brief reference**: `@sprint-md/S79-T4-agent-classification-and-situation-map.md`

## Branch Target

`sprint/S79`

## Scope -- Included

- [ ] Add agent classification service for catalyst tags, narrative membership, conflict labels, and confidence.
- [ ] Persist classification artifacts through the S79-T1 session tables when available.
- [ ] Add a Situation Map API that returns all desk-selected catalysts and multi-narrative links.
- [ ] Add a standalone frontend Situation Map component that can render all desk narratives and links.
- [ ] Ensure the three default narratives are promoted as first-run selectable session chips.
- [ ] Emit agent work events for classification, contradiction checks, report generation, and notable catalyst promotion.

## Scope -- Excluded (DO NOT TOUCH)

- `frontend/components/narrative/NarrativeCanvas.tsx` - owned by S79-T5.
- `frontend/components/narrative/NarrativeWorkDrawer.tsx` and tab files - owned by S79-T3.
- `frontend/components/narrative/NarrativeSensemakingComposer.tsx` - owned by S79-T2.
- Agent prompt rewrites outside the narrow narrative classification instructions.

## Reuse Inventory

- `scoreRelatedCatalyst` at `backend-hono/src/services/narrative-sensemaking/sensemaker.ts:46` - current deterministic relation scoring.
- `buildNarrativeGroups` at `backend-hono/src/services/narrative-sensemaking/sensemaker.ts:113` - current grouping logic.
- `narrative_threads.keywords` in `backend-hono/migrations/027_narrative_threads.sql:15` - existing keyword source for classifier seeding.
- `narrative_card_links.confidence` in `backend-hono/migrations/027_narrative_threads.sql:35` - existing confidence field to preserve.
- `frontend/data/narrative-seed-events.json` - large seed corpus with existing tags and narrative thread labels for fixture tests or examples.

## File Ownership

- `backend-hono/src/services/narrative-classification/types.ts` [NEW]
- `backend-hono/src/services/narrative-classification/tag-classifier.ts` [NEW]
- `backend-hono/src/services/narrative-classification/situation-map.ts` [NEW]
- `backend-hono/src/routes/narrative/classification.ts` [NEW]
- `frontend/components/narrative/NarrativeSituationMap.tsx` [NEW]
- `frontend/hooks/useNarrativeSituationMap.ts` [NEW]
- `backend-hono/src/routes/narrative/index.ts` only to mount the new classification route.

## Implementation Steps

1. Create `narrative-classification/types.ts` with interfaces for `NarrativeTagDecision`, `CatalystConflictLabel`, `SituationMapNode`, and `SituationMapEdge`.
2. Create deterministic classifier `tag-classifier.ts`:
   - Inputs: catalysts, existing narrative threads, optional user/agent notes.
   - Output: generated tags, narrative slugs, confidence, conflict label.
   - Conflict labels: `confirming`, `conflicting`, `noise`, `unclassified`.
   - Use existing keywords first. Do not require LLM calls for first pass.
   - Include a reason string so the Flow tab can show what the agentic desk actually did.
3. Create `situation-map.ts`:
   - read desk sessions and selected catalysts from S79-T1 tables when present.
   - fallback to existing `narrative_card_links` + `scored_riskflow_items` if S79-T1 is not merged yet.
   - return nodes for narratives and catalysts plus edges for catalyst-to-narrative and catalyst-to-catalyst relationships.
4. Create `routes/narrative/classification.ts`:
   - `POST /classification/session/:sessionId`
   - `GET /classification/situation-map?deskId=...`
   - `POST /classification/session/:sessionId/work-event` if S79-T1 has not already exposed a work-event endpoint.
5. Create `useNarrativeSituationMap.ts` to fetch the Situation Map.
6. Create `NarrativeSituationMap.tsx` with React Flow or existing canvas primitives. It must render:
   - all relevant desk-selected catalysts
   - multiple narrative links where applicable
   - color per narrative.
7. Ensure Rate Cut Cycle, Price Stability, and Max Employment are first-run defaults in exported constants.
8. Keep all files under 300 lines.

## Learning Boundary

- Store classification decisions and tags in session artifacts/tags so agents can learn later.
- Do not build a full autonomous learning loop in this track. Leave a small, typed surface that a future agent-memory updater can consume.

## Acceptance Criteria

- [ ] Classifier returns tags, narrative slugs, conflict labels, and confidence for a catalyst set.
- [ ] Classifier output includes concise reason strings suitable for display in the Flow work drawer.
- [ ] Situation Map endpoint returns desk-scoped narrative and catalyst graph data.
- [ ] Situation Map component renders multi-narrative catalyst links.
- [ ] Default first-run narratives are Rate Cut Cycle, Price Stability, and Max Employment.
- [ ] Existing sensemaking endpoint remains compatible.

## Validation Commands

```bash
cd backend-hono && bun run build
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
```

## Commit Format

```bash
[v6.7.10] feat: S79-T4 agent classification and situation map
```
