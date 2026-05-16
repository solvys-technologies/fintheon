# Sprint Brief: T4 — Lounge Gatherer + Brief Pipeline

## Context

Herald's wake-cycle logic that orchestrates T1 (YouTube transcripts), T2 (X posts), and T3 (model scout) into a unified structured brief, then pushes it to the Agent Lounge via AgentBus. This is the critical pipeline that turns raw data into actionable intelligence for agent deliberation. Depends on T1, T2, T3 being complete.

## Branch Target

`sprint/S69`

## Scope — Included

- [ ] `backend-hono/src/services/lounge/gatherer.ts` [NEW] — Herald's gathering orchestration
- [ ] `backend-hono/src/services/lounge/brief-formatter.ts` [NEW] — Structured brief generation
- [ ] `backend-hono/src/services/lounge/session-manager.ts` [NEW] — Lounge session lifecycle
- [ ] `backend-hono/src/services/lounge/types.ts` [NEW] — LoungeSession, LoungeBrief, LoungeTopic types
- [ ] `backend-hono/src/services/lounge/index.ts` [NEW] — Service export
- [ ] `backend-hono/src/services/agent-bus/bus.ts` — Add lounge topics
- [ ] `backend-hono/src/routes/lounge/` [NEW] — Lounge API routes
- [ ] `backend-hono/src/routes/lounge/sessions.ts` [NEW] — Session management API
- [ ] `backend-hono/src/routes/lounge/briefs.ts` [NEW] — Brief CRUD API
- [ ] `backend-hono/src/services/cron/` — Add lounge wake cycle cron job

## Scope — Excluded (DO NOT TOUCH)

- `backend-hono/src/services/youtube-transcripts/` — owned by T1, read-only dependency
- `backend-hono/src/services/x-monitor/` — owned by T2, read-only dependency
- `backend-hono/src/services/lounge/model-scout.ts` — owned by T3, read-only dependency
- `backend-hono/src/services/lounge/deliberation.ts` — owned by T5
- `backend-hono/src/services/lounge/output-router.ts` — owned by T6

## Reuse Inventory

- `backend-hono/src/services/agent-bus/bus.ts` — AgentBus pub/sub, add lounge topics
- `backend-hono/src/services/agent-bus/surface-router.ts` — SSE routing pattern
- `backend-hono/src/services/riskflow/catalyst-promoter.ts` — promotion pipeline pattern
- `backend-hono/src/services/cron/` — existing cron job patterns (node-cron, America/New_York)
- `backend-hono/src/services/herald/` — Herald agent service, understand Herald's role
- `backend-hono/src/services/agent-bus/dreams.ts` — existing dreams API, to be replaced/augmented

## Known Issues to Preserve

- AgentBus topics follow pattern: `lounge.brief`, `lounge.reflection`, `lounge.consensus`
- Lounge sessions should be scheduled for afterhours (16:30 ET weekdays) initially
- Herald is the designated gatherer — other agents are deliberators
- Follow Solvys constraints: no emojis, no banned ornaments
- Backend is launchd-managed on port 8080

## Implementation Steps

1. Create `backend-hono/src/services/lounge/types.ts`:
   - `LoungeSession`: id, startedAt, endedAt, gathererAgent, status (gathering/deliberating/complete), briefs (array), deliberations (array)
   - `LoungeBrief`: id, sessionId, source (youtube/x/model-scout), content, extractedAt, digest
   - `LoungeTopic`: id, sessionId, title, category, urgency, relatedNarratives, relatedRiskSignals

2. Create `backend-hono/src/services/lounge/session-manager.ts`:
   - `createSession()`: starts a new lounge session, assigns Herald as gatherer
   - `endSession(sessionId)`: marks session complete, triggers output routing (T6)
   - `getSession(sessionId)`: returns session state
   - `getActiveSessions()`: returns currently active sessions
   - In-memory store with Supabase persistence

3. Create `backend-hono/src/services/lounge/brief-formatter.ts`:
   - `formatYouTubeBrief(transcripts)`: summarizes transcripts into key themes, notable quotes, market implications
   - `formatXBrief(posts, imageAnalyses)`: summarizes posts with chart insights, sentiment, key levels
   - `formatModelScoutBrief(assessments)`: summarizes new model findings
   - `compileBrief(sources)`: merges all sources into unified LoungeBrief

4. Create `backend-hono/src/services/lounge/gatherer.ts`:
   - `runGatherCycle()`: main orchestration function
     1. Create new lounge session
     2. Fetch YouTube transcripts (T1 service)
     3. Fetch X posts + image analysis (T2 service)
     4. Run model scout (T3 service)
     5. Format each source into briefs
     6. Compile unified brief
     7. Push to AgentBus with topic `lounge.brief`
     8. Broadcast via SSE to lounge surface
     9. Return session ID for deliberation phase

5. Add lounge topics to `backend-hono/src/services/agent-bus/bus.ts`:
   - `lounge.brief` — gatherer pushes compiled brief
   - `lounge.reflection` — agents post reflections
   - `lounge.consensus` — consensus detection result

6. Create `backend-hono/src/routes/lounge/index.ts`:
   - Register sessions and briefs routes

7. Create `backend-hono/src/routes/lounge/sessions.ts`:
   - `POST /api/lounge/sessions/start` — Start new lounge session (triggers gather cycle)
   - `GET /api/lounge/sessions/active` — Get active sessions
   - `GET /api/lounge/sessions/:id` — Get session detail

8. Create `backend-hono/src/routes/lounge/briefs.ts`:
   - `GET /api/lounge/briefs?sessionId=...` — Get briefs for a session
   - `GET /api/lounge/briefs/latest` — Get most recent brief

9. Add cron job to `backend-hono/src/services/cron/`:
   - Schedule: 16:30 ET weekdays (afterhours lounge)
   - Also add a manual trigger endpoint for testing
   - Call `runGatherCycle()` on schedule

## Acceptance Criteria

- [ ] Lounge session created with Herald as gatherer
- [ ] YouTube transcripts fetched and formatted into brief
- [ ] X posts with image analysis fetched and formatted into brief
- [ ] Model scout results included in brief
- [ ] Unified brief pushed to AgentBus with `lounge.brief` topic
- [ ] SSE broadcast to lounge surface works
- [ ] Cron job triggers gather cycle at 16:30 ET weekdays
- [ ] Manual trigger endpoint works for testing
- [ ] `cd backend-hono && bun run build` passes
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes

## Validation Commands

```bash
# Backend build
cd backend-hono && bun run build

# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Manual trigger smoke test
curl -s -X POST http://localhost:8080/api/lounge/sessions/start | head -c 500
```

## Commit Format

```
[v6.5.0] feat: S69-T4 lounge gatherer and brief pipeline
```
