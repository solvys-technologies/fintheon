# S8-T3: MiroShark DAG Template + Boardroom Backend

## Context

Sprint 8, Track 3. You are converting the existing MiroShark deliberation pipeline (4-phase sequential) into a **DAG template** that executes on the new DAG scheduler, and rewiring the Boardroom backend routes to use DAG dispatch instead of polling.

**Depends on T1:** You import types from `agent-bus/types.ts` and use `agentBus` from `agent-bus/bus.ts`.

**Codes against T2's interface:** You call `executeDag()` from T2's dag-scheduler. Code against the function signature from T1 types. If T2 isn't complete yet, your code will compile because you're importing the typed interface.

**What this preserves:** The deliberation intelligence — convergence detection, anti-groupthink (contrarian triggers), consensus scoring, user injection mid-deliberation. These are valuable and must NOT be lost. They just execute differently (as DAG tasks instead of a manual phase loop).

## Files to Read First

- `backend-hono/src/services/miroshark/miroshark-deliberation.ts` — **Read this thoroughly.** This is the 512-line file you're refactoring. Understand every phase, the convergence detection, contrarian trigger logic, consensus scoring formula, and the `injectUserTake()` mechanism.
- `backend-hono/src/routes/miroshark/index.ts` — Current MiroShark routes (simulate, poll, inject).
- `backend-hono/src/routes/boardroom/index.ts` — Current boardroom message routes (30s polling pattern).
- `backend-hono/src/services/agent-bus/types.ts` — All shared types (T1)
- `backend-hono/src/services/agent-bus/bus.ts` — AgentBus (T1)
- `backend-hono/src/services/agent-bus/dag-scheduler.ts` — DAG execution (T2 creates this). Read the interface/exports.
- `backend-hono/src/services/strands/agents/oracle.ts` — Agent config for reference
- `backend-hono/src/services/strands/agents/harper.ts` — Harper agent config

## Files to Create

### 1. `backend-hono/src/services/agent-bus/templates/miroshark-template.ts` (~180 lines)

Converts the 4-phase MiroShark deliberation into a DAG definition.

**Phase → DAG mapping:**

```
Phase 1 (Analysts) → Wave 0: Oracle + Feucht + Consul + Herald (parallel analysis tasks)
Phase 1.5 (Gov)    → Wave 0: Optional additional task (if geopolitical content detected)
Phase 2 (Hermes)   → Wave 1: 4 deliberation tasks (each reviews Wave 0 outputs)
Phase 3 (Harper)   → Wave 2: Harper synthesis (reviews Wave 0 + Wave 1 outputs)
```

Core exports:
- `createMiroSharkDAG(params: MiroSharkParams): DAGDefinition`
  1. Takes: lanes (NarrativeLane[]), catalysts (CatalystCard[]), user injection (optional)
  2. Creates Wave 0 tasks: one per analyst agent
     - Each task input includes: the narrative context (lanes + catalysts relevant to that agent's sector)
     - System prompt for each task includes the agent's specialty + structured output format for `MarketAnalystAssessment`
  3. Creates Wave 1 tasks: deliberation tasks
     - Input: references Wave 0 task keys as deps
     - Prompt: "Review these analyst assessments. For each, state AGREE/DISAGREE/NUANCE with reasoning."
     - Output format: `HermesDeliberation` (verdict, confidence, reasoning)
  4. Creates Wave 2 task: Harper synthesis
     - Input: references ALL Wave 0 + Wave 1 task keys
     - Prompt: includes consensus scoring instructions, contrarian detection, thesis surfacing
     - Output format: `HarperOpusScoring`
  5. Returns DAGDefinition with template: 'miroshark-deliberation'

- `postProcessDeliberation(dagRecord: DAGRecord, tasks: TaskRecord[]): MiroSharkResult`
  1. Extract analyst assessments from Wave 0 task outputs
  2. Compute convergence: `1 - (stddev(ivScores) / mean(ivScores))`
  3. If convergence > 0.85: flag contrarian trigger
  4. Extract Hermes verdicts from Wave 1 task outputs
  5. Compute consensus score using existing formula:
     ```
     base = avgConfidence * 50
     + agreeRatio * 25
     - disagreeRatio * 20
     - (convergence > 0.9 ? 10 : 0)
     + (contrarianTriggered ? 5 : 0)
     = clipped [0-100]
     ```
  6. Extract Harper scoring from Wave 2 task output
  7. Return unified `MiroSharkResult` (preserves all existing fields)

- `shouldIncludeGovPhase(lanes: NarrativeLane[]): boolean`
  - Checks if any lane is geopolitical/regulatory
  - If yes, adds a gov official task to Wave 0

**Key preservation rules:**
- Convergence detection formula MUST match existing implementation exactly
- Contrarian trigger threshold MUST remain 0.85
- Consensus scoring MUST use the same weighted formula
- Anti-groupthink bonus/penalty values MUST match

## Files to Modify

### 2. `backend-hono/src/services/miroshark/miroshark-deliberation.ts`

Refactor to use the DAG template instead of manual phase execution.

Changes:
- Replace `runDeliberationPipeline(simId, report)` with a wrapper that:
  1. Calls `createMiroSharkDAG(params)` to build the DAG definition
  2. Calls `executeDag(dagDef)` from the scheduler
  3. Subscribes to `dag.status` events for this DAG to track progress
  4. When DAG completes: calls `postProcessDeliberation()` for convergence/consensus scoring
  5. Updates `activeDeliberations` map with final result (preserve API compatibility)

- Keep `getDeliberationState(simId)` working by reading from DAG status
- Keep `injectUserTake(simId, take)` working:
  - On user injection: modify the Wave 1 task inputs to include the user take
  - If Wave 1 hasn't started yet: update task input in DB
  - If Wave 1 is running: publish injection event to bus (agents can't be mid-stream modified, so log it for synthesis)

- Remove the manual `invokeAgent()` calls and phase loop. The DAG scheduler handles all execution.

- Keep all TypeScript interfaces (MarketAnalystAssessment, HermesDeliberation, HarperOpusScoring, etc.) exported for backward compatibility.

### 3. `backend-hono/src/routes/boardroom/index.ts`

Replace polling with DAG dispatch + SSE subscription.

Changes:
- Add `POST /api/boardroom/dag` route:
  1. Receives: `{ message, conversationId, userId, agents?: HermesAgentId[] }`
  2. Creates DAG: calls `createMiroSharkDAG()` if multi-agent, or single-task DAG for single-agent
  3. Executes DAG: calls `executeDag()`
  4. Returns: `{ dagId }` (frontend subscribes to SSE for results)

- Add `GET /api/boardroom/dag/:dagId/stream` route:
  1. Creates SSE ReadableStream
  2. Subscribes to `surface.boardroom` bus events filtered by dagId
  3. Streams AgentStreamEvent + DAGProgressEvent to client
  4. Closes on DAG completion or client disconnect
  5. Includes 8s heartbeat

- Keep existing `GET /api/boardroom/messages` for backward compatibility (legacy polling). Add deprecation comment.

### 4. `backend-hono/src/routes/harper/index.ts`

Add Boardroom mode detection.

Changes:
- In the `POST /api/harper/chat` handler, detect if the request is from Boardroom surface
- If `surface === 'boardroom'` and message warrants multi-agent analysis:
  - Create DAG instead of single-agent response
  - Return `X-DAG-Id` header so frontend can subscribe to DAG stream
- Detection heuristic: check for `activeConnectors` including 'boardroom', or explicit `boardroom: true` flag in request body

Minimal change — add one conditional branch at the top of the handler.

## Verification

1. `npx tsc --noEmit` — No type errors
2. Verify MiroShark template produces valid DAG:
   ```typescript
   const dag = createMiroSharkDAG({
     lanes: [{ id: '1', name: 'Macro', sentiment: 0.6 }],
     catalysts: [{ id: 'c1', headline: 'Fed holds rates', severity: 3 }],
   });
   console.log(dag.tasks.length);  // Should be 5-6 (4 analysts + 1 deliberation wave + 1 synthesis)
   console.log(dag.tasks.filter(t => t.depKeys.length === 0).length);  // Wave 0 count
   ```
3. Verify convergence scoring matches original:
   ```typescript
   // Given assessments with ivScores [72, 74, 73, 71]
   // stddev ≈ 1.12, mean ≈ 72.5
   // convergence = 1 - (1.12/72.5) ≈ 0.985
   // shouldTriggerContrarian: true (> 0.85)
   ```
4. Test boardroom DAG dispatch:
   ```bash
   curl -X POST http://localhost:8080/api/boardroom/dag \
     -H 'Content-Type: application/json' \
     -d '{"message":"Analyze /NQ risk","userId":"test"}'
   # Should return { dagId: "..." }
   ```
5. Test boardroom SSE stream:
   ```bash
   curl -N http://localhost:8080/api/boardroom/dag/<dagId>/stream
   # Should receive SSE events: dag-start, agent-start (x4), agent-delta..., dag-complete
   ```

## Changelog Entry

```typescript
{ date: '2026-04-05T__:__:__', agent: 'claude-code', summary: 'S8-T3: MiroShark converted to DAG template preserving convergence/contrarian/consensus logic, boardroom routes upgraded from polling to SSE+DAG dispatch, Harper boardroom mode detection', files: ['backend-hono/src/services/agent-bus/templates/miroshark-template.ts', 'backend-hono/src/services/miroshark/miroshark-deliberation.ts', 'backend-hono/src/routes/boardroom/index.ts', 'backend-hono/src/routes/harper/index.ts'] }
```

## DO NOT

- Do NOT change the convergence detection formula, contrarian threshold (0.85), or consensus scoring weights. These are calibrated.
- Do NOT delete the MiroShark TypeScript interfaces. Other code imports them.
- Do NOT remove the `activeDeliberations` map — keep it for backward compatibility with existing frontend polling until T4 replaces it.
- Do NOT modify the AgentBus, types, or surface-router files from T1.
- Do NOT modify agent-factory.ts or stream-adapter.ts — that is T2's scope.
- Do NOT create any frontend components. That is T4's scope.
- Do NOT modify the chat-queue.ts or loop-manager.ts.
