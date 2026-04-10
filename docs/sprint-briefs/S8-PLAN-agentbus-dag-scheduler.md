# S8 Plan: AgentBus + DAG Scheduler

## Context

Harper and the Hermes agents (Oracle, Feucht, Consul, Herald) are currently isolated — each runs as a single Strands agent per request with no inter-agent communication. The Boardroom (MiroShark) simulates multi-agent deliberation as a sequential 4-phase pipeline using a single LLM pretending to be multiple agents. NarrativeFlow uses manual refresh. The Sidebar has no cross-agent awareness.

This sprint introduces an **in-process message bus** (AgentBus) with **DAG-based task orchestration** that enables real parallel multi-agent dispatch. Inspired by [llm-agent-x](https://github.com/llm-agent-x/llm-agent-x)'s DAG pattern, adapted for our single-instance Bun + Hono stack.

## Decisions (from interview)

| Decision           | Answer                                                                                                                      |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| DAG trigger scope  | **Boardroom only.** Main Chat + Sidebar stay single-agent.                                                                  |
| MiroShark fate     | **Becomes a DAG template.** Keep deliberation logic (convergence, contrarian, consensus scoring), execute on new scheduler. |
| Boardroom UX       | **Live per-agent panels.** Each agent streams in its own panel. Harper synthesis appears last.                              |
| Cross-surface push | **Auto-push cards.** Agent discoveries during DAGs auto-create NarrativeFlow catalyst cards.                                |
| Subtask routing    | **Hermes agents always.** DAG subtasks dispatch to existing Strands agents (Oracle, Feucht, Consul, Herald, Harper).        |

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  AgentBus (in-process typed pub/sub)                             │
│                                                                  │
│  Topics:                                                         │
│    dag.task.dispatch   → DAG Scheduler picks up, creates agent   │
│    dag.task.result     → Scheduler resolves deps, fires next wave│
│    dag.task.error      → Failure handler, partial degradation    │
│    surface.narrative   → NarrativeFlow auto-push cards           │
│    surface.sidebar     → Sidebar cross-agent notifications       │
│    surface.boardroom   → Boardroom per-agent panel streams       │
│    harper.synthesis    → Final merged synthesis stream           │
│                                                                  │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │ DAG          │  │ Multi-Stream     │  │ Surface          │   │
│  │ Scheduler    │  │ Merger           │  │ Router           │   │
│  │              │  │                  │  │                  │   │
│  │ Resolves     │  │ N agent streams  │  │ Routes agent     │   │
│  │ deps, fires  │  │ → 1 merged SSE  │  │ results to       │   │
│  │ waves        │  │ with agent IDs   │  │ subscribed       │   │
│  │              │  │                  │  │ surfaces         │   │
│  └─────────────┘  └──────────────────┘  └──────────────────┘   │
│                                                                  │
│  Persistence: Supabase agent_dags + agent_tasks tables           │
└──────────────────────────────────────────────────────────────────┘
```

## Data Model

### agent_dags table

```sql
CREATE TABLE agent_dags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  surface TEXT NOT NULL CHECK (surface IN ('chat','sidebar','narrative','boardroom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed','cancelled')),
  template TEXT,  -- 'miroshark-deliberation' | 'ad-hoc' | etc.
  input JSONB NOT NULL,  -- original user query + context
  output JSONB,  -- final synthesis result
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
```

### agent_tasks table

```sql
CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dag_id UUID NOT NULL REFERENCES agent_dags(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,  -- 'oracle' | 'feucht' | 'consul' | 'herald' | 'harper'
  task_type TEXT NOT NULL CHECK (task_type IN ('analysis','scoring','synthesis','discovery','deliberation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed','cancelled','timeout')),
  wave INTEGER NOT NULL DEFAULT 0,  -- execution wave (0 = first, higher = later)
  input JSONB NOT NULL,
  output JSONB,
  deps UUID[],  -- task IDs this depends on
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error TEXT
);

CREATE INDEX idx_agent_tasks_dag ON agent_tasks(dag_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status) WHERE status IN ('pending','running');
```

## Execution Flow (Boardroom)

```
1. User sends message in Boardroom
2. POST /api/boardroom/dag — creates DAG
3. Boardroom route detects multi-agent query, calls Harper to plan
4. Harper returns task decomposition (which agents, what inputs, dependencies)
5. DAG persisted to Supabase, tasks created
6. DAG Scheduler resolves Wave 0 (no deps) → dispatches parallel agents
7. Each agent: createAgent() → agent.stream(input) → results published to bus
8. Surface Router: streams per-agent results to Boardroom SSE (live panels)
9. Surface Router: if agent discovers catalyst → auto-push to NarrativeFlow SSE
10. When Wave 0 complete → Scheduler fires Wave 1 (Harper synthesis)
11. Harper synthesis consumes all Wave 0 outputs → streams final response
12. DAG marked complete, all results persisted
```

## Track Split (4 tracks)

### T1: Foundation — AgentBus + Types + DB Migration

**Runs first. All other tracks depend on T1 types.**

New files:

- `backend-hono/src/services/agent-bus/bus.ts` — Central pub/sub engine
- `backend-hono/src/services/agent-bus/types.ts` — All shared types (topics, messages, DAG, tasks)
- `backend-hono/src/services/agent-bus/surface-router.ts` — Surface subscription manager (SSE client sets per surface)
- `supabase/migrations/XXXX_agent_bus.sql` — agent_dags + agent_tasks tables

Modified files:

- None (pure foundation, no wiring yet)

### T2: DAG Scheduler + Multi-Stream Merger

**Parallel after T1. Core execution engine.**

New files:

- `backend-hono/src/services/agent-bus/dag-scheduler.ts` — Dependency resolution, wave dispatch, timeout handling
- `backend-hono/src/services/agent-bus/multi-stream-merger.ts` — N concurrent Strands streams → 1 SSE stream with agent labels
- `backend-hono/src/routes/dag/index.ts` — DAG status/control API endpoints

Modified files:

- `backend-hono/src/services/strands/agent-factory.ts` — Add `createAgentsForDAG()` concurrent factory
- `backend-hono/src/services/strands/stream-adapter.ts` — Add agent identity field to UIEvents

### T3: MiroShark DAG Template + Boardroom Backend

**Parallel after T1. Codes against T2's DAG scheduler interface (from T1 types).**

New files:

- `backend-hono/src/services/agent-bus/templates/miroshark-template.ts` — 4-phase deliberation as a DAG definition

Modified files:

- `backend-hono/src/services/miroshark/miroshark-deliberation.ts` — Refactor to use DAG scheduler instead of manual phase loop
- `backend-hono/src/routes/boardroom/index.ts` — Replace polling with SSE subscription + DAG dispatch
- `backend-hono/src/routes/harper/index.ts` — Add Boardroom DAG creation path

### T4: Frontend — Boardroom Panels + Surface Subscriptions

**Parallel after T1. Codes against SSE event shapes from T1 types.**

New files:

- `frontend/components/consilium/BoardroomAgentPanel.tsx` — Per-agent streaming panel
- `frontend/components/consilium/DAGProgressBar.tsx` — Visual wave/task progress
- `frontend/hooks/useBoardroomDAG.ts` — SSE subscription for DAG events + per-agent streams
- `frontend/hooks/useAgentBusSSE.ts` — Generic SSE subscription hook for surface topics

Modified files:

- `frontend/components/consilium/AgentChattr.tsx` — Wire up live agent panels instead of 30s polling
- `frontend/components/consilium/ConsiliumHub.tsx` — Integrate DAG progress bar
- `frontend/contexts/NarrativeContext.tsx` — Subscribe to surface.narrative SSE for auto-push cards
- `frontend/components/chat/ChatSidebar.tsx` — Subscribe to surface.sidebar for cross-agent toasts

## Dependency Order

```
T1 (Foundation) ──────► T2 (DAG Scheduler)    ─┐
                  ├───► T3 (MiroShark Template) ├──► Unification
                  └───► T4 (Frontend)          ─┘
```

T1 runs first. T2/T3/T4 run in parallel after T1 completes.

## Shared File Conflicts (Unification)

| File                        | Tracks       | Resolution                       |
| --------------------------- | ------------ | -------------------------------- |
| `agent-factory.ts`          | T2 modifies  | No conflict (only T2 touches it) |
| `stream-adapter.ts`         | T2 modifies  | No conflict (only T2 touches it) |
| `miroshark-deliberation.ts` | T3 refactors | No conflict (only T3 touches it) |
| `boardroom/index.ts`        | T3 modifies  | No conflict (only T3 touches it) |
| `AgentChattr.tsx`           | T4 modifies  | No conflict (only T4 touches it) |
| `NarrativeContext.tsx`      | T4 modifies  | No conflict (only T4 touches it) |

No cross-track file conflicts. Clean split.

## Verification Checklist

- [ ] `bun run build` passes (frontend)
- [ ] `npx tsc --noEmit` passes (backend)
- [ ] Supabase migration applies cleanly
- [ ] `POST /api/boardroom/dag` creates DAG + tasks in DB
- [ ] Boardroom SSE streams per-agent results (test with curl)
- [ ] MiroShark deliberation runs as DAG template (4-phase, convergence detection preserved)
- [ ] NarrativeFlow receives auto-push cards from agent discoveries
- [ ] Sidebar receives cross-agent notification toasts
- [ ] DAG progress bar renders wave execution in Boardroom UI

## Cost Constraints

- Each Boardroom DAG = N parallel Opus calls (typically 3-4 agents + 1 synthesis)
- Per-agent timeout: 90 seconds (prevent runaway costs)
- Max concurrent agents per DAG: 5
- Max tasks per DAG: 10
- DAG auto-cancel after 5 minutes total

## Git Strategy

- Branch: `v.8.5.1-agentbus-dag-scheduler`
- Each track commits to same branch (sequential execution: T1 first, then T2/T3/T4 parallel)
- Merge target: `main`
