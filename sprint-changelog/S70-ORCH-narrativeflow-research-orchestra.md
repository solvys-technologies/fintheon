# S70-ORCH -- NarrativeFlow Research Orchestra

- **Parent sprint branch**: `sprint/S70`
- **Cycle**: Cycle 8 (Closed Beta)
- **Owner**: Shashank
- **Status**: Launched in Linear
- **Linear ORCH**: SOL-130

## What this covers

Refactors NarrativeFlow from a static impact-intelligence surface into a living research-orchestra surface inspired by S69 Agent Lounge autonomous research.

The prior S68 plan correctly identified Theme Tracker, IPV, drift, and canvas polish, but it still treated NarrativeFlow as a sorted display of themes and catalyst cards. This sprint shifts the product feel: NarrativeFlow becomes the desk-facing command surface where raw catalysts become research hypotheses, agents deliberate, evidence is attached, consensus is formed, and only corroborated findings get promoted to the trader.

## Why this version

S69's Agent Lounge plan has the missing shape:

1. Gather external intelligence.
2. Compile it into a structured brief.
3. Wake specialized agents.
4. Let them deliberate in a threaded room.
5. Detect consensus.
6. Route only corroborated outputs to humans.
7. Store the rest for continued agent work.

NarrativeFlow should be the human-readable projection of that loop, not a second feed. It should feel like watching a research desk assemble a market story in real time.

## Product Principle

NarrativeFlow is not "cards on a canvas." It is the market story room.

Every visible object should answer one of four questions:

- What is the market story?
- What evidence supports or weakens it?
- Which agents agree, dissent, or need more data?
- Why is this being shown to the human now?

## Current Repo Reality

### Existing surface

- `@frontend/components/narrative/NarrativeCanvas.tsx` -- 497 lines; currently combines old canvas physics with an S68-style overlay list of themes.
- `@frontend/components/narrative/NarrativeMap.tsx` -- 805 lines; force map and camera behavior remain separate from the S68 overlay.
- `@frontend/components/narrative/Sanctum.tsx` -- 485 lines; parent host for NarrativeFlow, ArbitrumChamber, and related Sanctum panels.
- `@frontend/contexts/NarrativeContext.tsx` -- receives `surface.narrative` SSE catalyst pushes and writes to NarrativeFlow state.
- `@frontend/lib/narrative-store.ts` -- durable local/cloud narrative state.
- `@backend-hono/src/routes/narrative/handlers.ts` -- score, drill, thread, and catalyst APIs.

### S68 work already present

- `@frontend/hooks/useThemes.ts` -- polls `/api/themes`.
- `@backend-hono/src/services/theme-tracker/` -- Theme Tracker service, IPV, status, trajectory, persistence.
- `@frontend/components/narrative/ThemeHeader.tsx`
- `@frontend/components/narrative/ThemeCatalystGroup.tsx`
- `@frontend/components/narrative/DriftBubble.tsx`
- `@frontend/components/narrative/NarrativeFlowFilterBar.tsx`

### Research-orchestra inspiration

- `@sprint-md/S69-ORCH-agent-lounge-autonomous-research.md`
- `@sprint-md/S69-T4-lounge-gatherer.md`
- `@sprint-md/S69-T5-deliberation-engine.md`
- `@sprint-md/S69-T6-output-router.md`
- `@frontend/components/consilium/AgentLounge.tsx` -- current dream-feed placeholder that S69 plans to replace.
- `@backend-hono/src/services/agent-bus/bus.ts`
- `@backend-hono/src/services/agent-bus/types.ts`
- `@backend-hono/src/services/research/task-board.ts`
- `@frontend/lib/narrative-research.ts`

## Target Experience

NarrativeFlow should open to a full-surface research board with four persistent zones:

### 1. Story Spine

The primary vertical or horizontal spine of active market narratives. Each story is a research hypothesis, not merely a theme label.

Each story shows:

- title
- IPV and trajectory
- live status: forming, under review, corroborated, decaying, rejected
- top supporting catalysts
- current consensus score
- last meaningful agent action

### 2. Evidence Constellation

Connected evidence clusters around the selected story:

- RiskFlow catalysts
- YouTube or long-form research snippets from S69 inputs
- X/chart observations
- prior MDB/ADB/PMDB/TWT references
- ArbitrumChamber verdict links
- contradiction cards

Evidence should be first-class. Weak evidence and dissent should be visible instead of hidden behind a polished score.

### 3. Agent Deliberation Rail

A threaded agent conversation attached to the selected story:

- Herald posts the compiled research brief.
- Oracle posts probability/scenario analysis.
- Feucht posts futures and level implications.
- Consul posts statistical/fundamental checks.
- Harper posts synthesis and routing recommendation.

This rail should feel like a live research room, not chat garnish.

### 4. Routing Gate

The human-facing reason a narrative is promoted:

- research-only: visible in lounge/history, not pushed
- live headline corroborated: eligible for human surface
- trader attention needed: pushed to NarrativeFlow primary lane
- rejected: stored with reason

The gate should expose the match that caused promotion, not merely the final card.

## Data Model Additions

Add a NarrativeFlow-specific projection over S69 lounge outputs. Do not make NarrativeFlow own the entire research pipeline.

### Backend types

Create `backend-hono/src/services/narrative-orchestra/types.ts`:

- `NarrativeHypothesis`
  - id
  - title
  - themeId
  - status: `forming | under_review | corroborated | decaying | rejected`
  - ipv
  - consensusScore
  - evidenceIds
  - deliberationSessionId
  - promotedAt
  - rejectionReason

- `NarrativeEvidence`
  - id
  - hypothesisId
  - sourceType: `riskflow | lounge_brief | youtube | x_chart | brief | arbitrum | manual`
  - sourceId
  - title
  - summary
  - stance: `supports | contradicts | neutral`
  - confidence
  - observedAt

- `NarrativeDeliberationEntry`
  - id
  - hypothesisId
  - sessionId
  - agentId
  - role
  - content
  - stance
  - replyTo
  - createdAt

- `NarrativeRoutingDecision`
  - id
  - hypothesisId
  - decision: `hold | promote | escalate | reject`
  - reason
  - headlineMatchId
  - confidence
  - decidedBy
  - decidedAt

## Child Tracks

### SOL-131 -- S70-T1 -- Narrative Orchestra Projection API

Build the backend projection layer that turns themes, catalysts, and lounge outputs into NarrativeFlow-ready hypotheses.

Scope:

- `@backend-hono/src/services/narrative-orchestra/types.ts` [new]
- `@backend-hono/src/services/narrative-orchestra/store.ts` [new]
- `@backend-hono/src/services/narrative-orchestra/projector.ts` [new]
- `@backend-hono/src/routes/narrative/orchestra.ts` [new]
- `@backend-hono/src/routes/narrative/index.ts` [modify]

Acceptance:

- `GET /api/narrative/orchestra` returns hypotheses with evidence, deliberation summary, and routing decision.
- If no S69 lounge tables exist yet, endpoint falls back to current Theme Tracker + promoted RiskFlow catalysts.
- Existing `/api/narrative/catalysts` behavior remains unchanged.

### SOL-132 -- S70-T2 -- Evidence Model + Corroboration Layer

Attach supporting and contradicting evidence to each hypothesis.

Scope:

- `@backend-hono/src/services/narrative-orchestra/evidence-linker.ts` [new]
- `@backend-hono/src/services/narrative-orchestra/corroboration.ts` [new]
- `@backend-hono/src/services/theme-tracker/` [read-only or narrow integration]
- `@backend-hono/src/services/riskflow/` [read-only dependency]

Acceptance:

- Evidence can be grouped by stance.
- RiskFlow catalysts and theme catalyst IDs resolve to the same hypothesis.
- Corroboration score is explainable from evidence, not magic.

### SOL-133 -- S70-T3 -- Agent Deliberation Bridge

Bridge S69 lounge deliberations into NarrativeFlow hypotheses.

Scope:

- `@backend-hono/src/services/narrative-orchestra/lounge-bridge.ts` [new]
- `@backend-hono/src/services/agent-bus/types.ts` [modify only for typed topics if missing]
- `@frontend/hooks/useAgentBusSSE.ts` [read-only pattern]
- `@frontend/contexts/NarrativeContext.tsx` [modify to consume richer narrative-orchestra events]

Acceptance:

- NarrativeFlow can show agent reflections for a hypothesis.
- `surface.narrative` can carry either legacy `catalyst-discovered` events or new `hypothesis-updated` events.
- Legacy catalyst SSE remains compatible.

### SOL-134 -- S70-T4 -- NarrativeFlow Surface Rebuild

Replace the S68 overlay-list feel with a research-room layout.

Scope:

- `@frontend/components/narrative/NarrativeCanvas.tsx` [split, do not keep as one 500+ line component]
- `@frontend/components/narrative/NarrativeStorySpine.tsx` [new]
- `@frontend/components/narrative/NarrativeEvidenceConstellation.tsx` [new]
- `@frontend/components/narrative/NarrativeAgentRail.tsx` [new]
- `@frontend/components/narrative/NarrativeRoutingGate.tsx` [new]
- `@frontend/hooks/useNarrativeOrchestra.ts` [new]

Acceptance:

- The first viewport reads as an active research desk, not a card list.
- User can select a story and see evidence, agent deliberation, and routing status without leaving NarrativeFlow.
- Canvas physics can remain as ambient spatial context, but it must not obscure the research workflow.
- No gradients, no AI sparkles, no Kanban borders, no explanatory marketing text.

### SOL-135 -- S70-T5 -- Human Promotion + Review Controls

Give the trader controlled actions over hypotheses.

Scope:

- `@frontend/components/narrative/NarrativeRoutingGate.tsx`
- `@backend-hono/src/routes/narrative/orchestra.ts`
- `@backend-hono/src/services/narrative-orchestra/review-actions.ts` [new]

Actions:

- accept as active narrative
- send back for more research
- reject with reason
- pin to Sanctum
- create research task

Acceptance:

- Human decisions are persisted.
- Rejected hypotheses remain auditable.
- "Needs more research" creates or updates a research task via existing task-board patterns.

### SOL-136 -- S70-T6 -- Unification, Validation, and Visual Tightening

Unify the backend projection, SSE bridge, and new surface. Validate old NarrativeFlow routes still work.

Acceptance:

- `cd backend-hono && bun run build`
- `npx tsc --noEmit --project frontend/tsconfig.json`
- `rm -rf dist && npx vite build`
- Manual smoke:
  - `/api/narrative/catalysts`
  - `/api/themes`
  - `/api/narrative/orchestra`
  - NarrativeFlow loads with empty, fallback, and populated states.

## Execution Order

### Wave 1: Projection foundation

```
S70-T1 -- Narrative Orchestra Projection API
S70-T2 -- Evidence Model + Corroboration Layer
```

T1 and T2 can run together only if T1 owns routes/store and T2 owns evidence/corroboration. T2 should depend on T1's exported types, not route internals.

### Wave 2: Agent bridge

```
S70-T3 -- Agent Deliberation Bridge
```

This consumes S69-style lounge outputs when present, but must run against fallback data while S69 is incomplete.

### Wave 3: Surface rebuild

```
S70-T4 -- NarrativeFlow Surface Rebuild
S70-T5 -- Human Promotion + Review Controls
```

T4 owns layout and hooks. T5 owns action endpoints and the routing gate actions. Coordinate only through the `NarrativeHypothesis` and `NarrativeRoutingDecision` contracts.

### Wave 4: Unification

```
S70-T6 -- Unification, Validation, and Visual Tightening
```

One owner merges the visual surface, backend projection, legacy SSE compatibility, and validation evidence.

## Non-Goals

- Do not replace S69 Agent Lounge.
- Do not build a second autonomous research pipeline inside NarrativeFlow.
- Do not remove existing `/api/narrative/catalysts`.
- Do not make Theme Tracker the whole product experience.
- Do not turn NarrativeFlow into a generic dashboard or Kanban board.

## Validation Checklist

- [ ] NarrativeFlow has a story spine, evidence constellation, agent rail, and routing gate.
- [ ] Legacy catalyst promotion still works.
- [ ] Theme Tracker data appears as hypothesis context, not as a raw list.
- [ ] Agent deliberation can render from S69-style lounge data or fallback fixtures.
- [ ] Human routing decisions persist.
- [ ] Empty states are honest and compact.
- [ ] No banned visual ornaments.
- [ ] Backend build passes.
- [ ] Frontend typecheck passes.
- [ ] Vite build passes.

## Handoff Notes

The old S68 plan is useful as implementation inventory, but the product direction should come from S69's research lifecycle. Start with the backend projection contract, then rebuild the surface around the contract. The key upgrade is not "more cards"; it is visible market reasoning.

## Linear Issues

| Issue   | Title                                                  | Brief                                                         |
| ------- | ------------------------------------------------------ | ------------------------------------------------------------- |
| SOL-130 | S70-ORCH: NarrativeFlow Research Orchestra             | @sprint-md/S70-ORCH-narrativeflow-research-orchestra.md       |
| SOL-131 | S70-T1: Narrative Orchestra Projection API             | @sprint-md/S70-T1-narrative-orchestra-projection-api.md       |
| SOL-132 | S70-T2: Evidence Model + Corroboration Layer           | @sprint-md/S70-T2-evidence-corroboration-layer.md             |
| SOL-133 | S70-T3: Agent Deliberation Bridge                      | @sprint-md/S70-T3-agent-deliberation-bridge.md                |
| SOL-134 | S70-T4: NarrativeFlow Surface Rebuild                  | @sprint-md/S70-T4-narrativeflow-surface-rebuild.md            |
| SOL-135 | S70-T5: Human Promotion + Review Controls              | @sprint-md/S70-T5-human-promotion-review-controls.md          |
| SOL-136 | S70-T6: Unification, Validation, and Visual Tightening | @sprint-md/S70-T6-unification-validation-visual-tightening.md |
