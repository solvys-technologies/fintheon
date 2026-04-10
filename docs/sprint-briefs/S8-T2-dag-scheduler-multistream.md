# S8-T2: DAG Scheduler + Multi-Stream Merger

## Context

Sprint 8, Track 2. You are building the **core execution engine** — the DAG scheduler that resolves task dependencies and dispatches waves of parallel Hermes agents, plus the multi-stream merger that combines N concurrent Strands agent streams into a single SSE output with agent identity labels.

**Depends on T1:** You import all types from `backend-hono/src/services/agent-bus/types.ts` and use `agentBus` from `backend-hono/src/services/agent-bus/bus.ts`. These are created by T1 and must exist before you start.

**What this enables:** T3 (MiroShark template) and T4 (frontend) both depend on the scheduler being able to execute DAGs. This is the engine that makes multi-agent dispatch real.

## Files to Read First

- `backend-hono/src/services/agent-bus/types.ts` — All shared types (T1 creates this)
- `backend-hono/src/services/agent-bus/bus.ts` — AgentBus pub/sub (T1 creates this)
- `backend-hono/src/services/strands/agent-factory.ts` — Current single-agent factory. You will extend this.
- `backend-hono/src/services/strands/stream-adapter.ts` — Current Strands → UIMessageStream adapter. You will extend this.
- `backend-hono/src/services/strands/agents/oracle.ts` — Example agent creation (for understanding agent config shape)
- `backend-hono/src/services/strands/agents/harper.ts` — Harper agent creation
- `backend-hono/src/services/strands/provider.ts` — VProxy model creation
- `backend-hono/src/services/harper-autonomous/loop-manager.ts` — Existing priority queue pattern (for inspiration, NOT to modify)
- `backend-hono/src/services/chat-queue.ts` — Existing chat queue (for inspiration, NOT to modify)

## Files to Create

### 1. `backend-hono/src/services/agent-bus/dag-scheduler.ts` (~200 lines)

The DAG execution engine. Resolves dependencies, dispatches waves, handles timeouts and failures.

Core behavior:
- `executeDag(dagDef: DAGDefinition)`: Main entry point
  1. Persist DAG + tasks to Supabase (agent_dags + agent_tasks tables)
  2. Compute waves: tasks with no deps = wave 0, tasks whose deps are all wave N = wave N+1
  3. Execute wave 0: dispatch all wave-0 tasks in parallel
  4. On each task completion: check if all deps for any pending task are now complete → dispatch it
  5. When all tasks complete → mark DAG complete, publish `dag.status` event
  6. On any task failure: mark failed, check if dependent tasks should be cancelled or if DAG can partially complete

- `dispatchTask(task: TaskRecord, dagContext: DAGRecord)`: Per-task execution
  1. Update task status to 'running' in DB
  2. Resolve agent: call the appropriate agent creator (oracle, feucht, consul, herald, harper)
  3. Stream agent: call `agent.stream(task.input.prompt)` 
  4. Collect output text + publish `dag.task.result` to bus
  5. Publish per-delta events to `surface.boardroom` (for live streaming panels)
  6. On completion: update task in DB with output + duration
  7. On error/timeout: update task status, publish `dag.task.error`

- `computeWaves(tasks: TaskDefinition[])`: Topological sort
  1. Build adjacency from depKeys
  2. Tasks with no deps = wave 0
  3. Each subsequent wave = tasks whose deps are all in previous waves
  4. Detect cycles (throw if found)
  5. Return `Map<number, TaskDefinition[]>` (wave → tasks)

- Timeout handling:
  - Per-task: `TASK_TIMEOUT_MS` (90s). Use `AbortController` signal on the agent stream.
  - Per-DAG: `DAG_TIMEOUT_MS` (5 min). Cancel all running tasks if exceeded.

- Publish bus events throughout:
  - `dag.status` with DAGProgressEvent on wave transitions
  - `dag.task.dispatch` when starting a task
  - `dag.task.result` when task completes
  - `dag.task.error` when task fails
  - `surface.boardroom` with AgentStreamEvent for live streaming (text deltas per agent)

```typescript
import { agentBus } from './bus';
import type {
  DAGDefinition, TaskDefinition, DAGRecord, TaskRecord,
  DAGProgressEvent, AgentStreamEvent, TaskStatus,
  MAX_CONCURRENT_AGENTS, MAX_TASKS_PER_DAG, TASK_TIMEOUT_MS, DAG_TIMEOUT_MS,
} from './types';
import { supabase } from '../../lib/supabase';  // service role client
// Import agent creators from strands/agents/

export async function executeDag(dagDef: DAGDefinition): Promise<DAGRecord> { ... }
async function dispatchTask(task: TaskRecord, dagRecord: DAGRecord): Promise<void> { ... }
function computeWaves(tasks: TaskDefinition[]): Map<number, TaskDefinition[]> { ... }
```

### 2. `backend-hono/src/services/agent-bus/multi-stream-merger.ts` (~120 lines)

Merges N concurrent Strands agent streams into a single SSE-encoded ReadableStream, with agent identity on each event.

Core behavior:
- `createMergedStream(agentStreams: AgentStream[])`: Returns a single `ReadableStream<Uint8Array>`
  1. Takes array of `{ agentId, stream: ReadableStream }` pairs
  2. Creates a merged ReadableStream that reads from all inputs concurrently
  3. Each text delta is wrapped with agentId: `{ type: 'agent-delta', agentId, taskId, data: delta }`
  4. Emits `agent-start` when each agent begins streaming
  5. Emits `agent-complete` when each agent finishes
  6. Emits `agent-error` if an agent fails (other agents continue)
  7. Stream completes when ALL agents are done
  8. Includes 8s heartbeat (shared across all agents)

- SSE encoding: Each event is `data: ${JSON.stringify(AgentStreamEvent)}\n\n`

```typescript
import type { AgentStreamEvent, HermesAgentId } from './types';

interface AgentStream {
  agentId: HermesAgentId;
  taskId: string;
  stream: ReadableStream<string>;  // text chunks from Strands agent
}

export function createMergedStream(agentStreams: AgentStream[]): ReadableStream<Uint8Array> { ... }
```

### 3. `backend-hono/src/routes/dag/index.ts` (~80 lines)

REST API for DAG status and control.

Endpoints:
- `GET /api/dag/:dagId` — Returns DAGRecord + all TaskRecords. Used by frontend to poll initial state.
- `GET /api/dag/:dagId/stream` — SSE stream of DAG events (progress, agent deltas). Frontend subscribes here.
- `POST /api/dag/:dagId/cancel` — Cancel a running DAG. Sets all pending/running tasks to cancelled.

The SSE stream endpoint:
1. Creates a ReadableStream
2. Subscribes to `dag.status` and `surface.boardroom` bus events filtered by dagId
3. Forwards events as SSE
4. Includes heartbeat
5. Closes when DAG completes or client disconnects

```typescript
import { Hono } from 'hono';
import { agentBus } from '../../services/agent-bus';
// ...
```

## Files to Modify

### 4. `backend-hono/src/services/strands/agent-factory.ts`

Add a new export `createAgentForTask(agentId, taskInput)` that:
1. Takes a HermesAgentId + task input object
2. Switches on agentId to call the right agent creator (createOracleAgent, createFeuchtAgent, etc.)
3. Returns the Agent instance ready for streaming
4. Used by dag-scheduler.ts to create agents for each task

Keep the existing `createAgent()` and `isStrandsAvailable()` exports unchanged.

### 5. `backend-hono/src/services/strands/stream-adapter.ts`

Add an optional `agentId` parameter to the UIEvent encoding:
1. `strandsToUIStream(agent, input, options)` gets a new optional field: `options.agentId?: HermesAgentId`
2. When agentId is present, each emitted event includes `agentId` in the JSON payload
3. This is used by the multi-stream merger to label which agent produced each delta

Minimal change — add one optional field to the options interface and include it in the SSE data if present.

## Verification

1. `npx tsc --noEmit` — No type errors
2. Write a quick test script or add a temp route:
   ```typescript
   // Create a simple 2-task DAG: Oracle (wave 0) → Harper synthesis (wave 1)
   const dag = await executeDag({
     surface: 'boardroom',
     input: { query: 'Test DAG' },
     tasks: [
       { key: 'oracle-test', agentId: 'oracle', taskType: 'analysis', input: { prompt: 'What is the VIX?' }, depKeys: [] },
       { key: 'harper-synth', agentId: 'harper', taskType: 'synthesis', input: { prompt: 'Summarize oracle findings' }, depKeys: ['oracle-test'] },
     ],
   });
   // Verify: oracle runs first, harper runs after oracle completes
   ```
3. Check Supabase: `SELECT * FROM agent_tasks WHERE dag_id = '...' ORDER BY wave;` — should show wave 0 (oracle) and wave 1 (harper)
4. `curl` the DAG stream endpoint and verify SSE events flow

## Changelog Entry

```typescript
{ date: '2026-04-05T__:__:__', agent: 'claude-code', summary: 'S8-T2: DAG scheduler with wave-based dependency resolution, multi-stream merger for concurrent agent output, DAG API routes, extended agent-factory + stream-adapter with agent identity', files: ['backend-hono/src/services/agent-bus/dag-scheduler.ts', 'backend-hono/src/services/agent-bus/multi-stream-merger.ts', 'backend-hono/src/routes/dag/index.ts', 'backend-hono/src/services/strands/agent-factory.ts', 'backend-hono/src/services/strands/stream-adapter.ts'] }
```

## DO NOT

- Do NOT modify the AgentBus or types files from T1. Import them as-is.
- Do NOT touch MiroShark deliberation or boardroom routes. That is T3's scope.
- Do NOT create any frontend components. That is T4's scope.
- Do NOT modify the chat-queue or loop-manager. Those stay as-is.
- Do NOT add external dependencies (Redis, RabbitMQ). The bus is in-process.
- Do NOT remove existing exports from agent-factory.ts or stream-adapter.ts. Only add new ones.
