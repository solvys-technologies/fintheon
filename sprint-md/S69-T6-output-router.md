# Sprint Brief: T6 — Output Router + Headline Correlation

## Context

Route deliberation output to the correct destination. If research corroborates with a live headline, push to human traders/analysts via SSE and narrative/risk signal pipeline. Otherwise, store in the Agent Lounge for continued agent deliberation. Generate autonomous reports and store in the fileroom (documents API). Depends on T5 (Deliberation Engine).

## Branch Target

`sprint/S69`

## Scope — Included

- [ ] `backend-hono/src/services/lounge/output-router.ts` [NEW] — Routing logic and headline correlation
- [ ] `backend-hono/src/services/lounge/report-generator.ts` [NEW] — Fileroom report generation
- [ ] `backend-hono/src/services/lounge/headline-matcher.ts` [NEW] — Research-to-headline correlation
- [ ] `backend-hono/src/routes/lounge/reports.ts` [NEW] — Report API endpoints
- [ ] `backend-hono/src/services/documents/` — Wire report storage into fileroom

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/lounge/deliberation.ts` — owned by T5, read-only dependency
- `backend-hono/src/services/lounge/gatherer.ts` — owned by T4, read-only dependency
- `backend-hono/src/services/riskflow/central-scorer.ts` — existing risk scoring, don't modify
- `backend-hono/src/services/narrative/cluster-summarizer.ts` — existing narrative logic, don't modify

## Reuse Inventory

- `backend-hono/src/services/riskflow/feed-service.ts` — live headline feed for correlation
- `backend-hono/src/services/riskflow/sse-broadcaster.ts` — SSE broadcast pattern for pushing to humans
- `backend-hono/src/services/narrative/catalyst-promoter.ts` — narrative promotion pattern
- `backend-hono/src/services/documents/doc-store.ts` — fileroom document storage
- `backend-hono/src/services/agent-bus/surface-router.ts` — SSE routing to surfaces
- `backend-hono/src/services/riskflow/central-scorer.ts` — scoring pipeline (reference for narrative gate)

## Known Issues to Preserve

- Headline correlation threshold: research must match a live headline within a time window (30 min)
- Only push to humans when BOTH research findings AND live headline align
- Reports stored via documents API with author="lounge" and tags=["lounge-report", sessionId]
- Follow Solvys constraints: no emojis, no banned ornaments
- Backend is launchd-managed on port 8080

## Implementation Steps

1. Create `backend-hono/src/services/lounge/headline-matcher.ts`:
   - `matchResearchToHeadlines(researchTopics, timeWindow)`: correlates lounge research with live RiskFlow headlines
   - Fetch recent RiskFlow items (last 30 min) from feed service
   - Use fuzzy text matching + keyword overlap to find correlations
   - Return: matches (array of {researchTopic, headline, confidence, timeDelta})
   - Threshold: confidence >= 0.6 AND timeDelta <= 30 min = valid match

2. Create `backend-hono/src/services/lounge/output-router.ts`:
   - `routeDeliberationOutput(sessionId)`: main routing function
   - Steps:
     1. Get deliberations and consensus from session
     2. Extract research topics/narrative proposals from deliberations
     3. Run headline matching
     4. IF matches found:
        - Create narrative proposal or risk signal
        - Push to RiskFlow pipeline (via catalyst promoter or direct SSE)
        - Broadcast to human-facing surfaces (narrative, sidebar)
     5. ELSE:
        - Store deliberations in lounge for continued agent access
        - Mark session as "lounge-only"
   - `pushToHumans(proposal)`: creates narrative/risk signal, broadcasts via SSE
   - `storeInLounge(sessionId)`: marks session as lounge-only, keeps accessible

3. Create `backend-hono/src/services/lounge/report-generator.ts`:
   - `generateReport(sessionId)`: creates structured report from session data
   - Report sections:
     - Executive summary (Harper's synthesis)
     - Source materials (YouTube transcripts, X posts, model findings)
     - Agent deliberations (Oracle, Feucht, Consul reflections)
     - Consensus assessment
     - Routing decision (pushed to humans vs lounge-only)
     - Actionable recommendations
   - Format: TipTap JSON (compatible with documents API)
   - Store via `doc-store.ts` with author="lounge-agent", tags=["lounge-report", sessionId, date]

4. Create `backend-hono/src/routes/lounge/reports.ts`:
   - `GET /api/lounge/reports` — List all lounge reports
   - `GET /api/lounge/reports/:id` — Get specific report
   - `GET /api/lounge/reports/latest` — Get most recent report
   - `POST /api/lounge/reports/generate?sessionId=...` — Generate report for session

5. Wire into deliberation flow:
   - After T5's consensus detection, trigger `routeDeliberationOutput()`
   - Generate report regardless of routing decision
   - Store report in fileroom

6. Add to cron or AgentBus event chain:
   - Trigger after deliberation phase completes
   - Or as part of the session end flow in T4's session manager

## Acceptance Criteria

- [ ] Headline matching correlates research topics with live RiskFlow headlines
- [ ] Research + headline match triggers push to human-facing surfaces
- [ ] No match keeps output in lounge for agent deliberation
- [ ] Reports generated with all required sections
- [ ] Reports stored in fileroom via documents API
- [ ] Reports accessible via API endpoints
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Report generation smoke test
curl -s -X POST http://localhost:8080/api/lounge/reports/generate?sessionId=test | head -c 500
```

## Commit Format

```
[v6.5.0] feat: S69-T6 output router and headline correlation
```
