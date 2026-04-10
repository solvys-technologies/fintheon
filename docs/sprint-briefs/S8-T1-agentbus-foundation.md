# S8-T1: AgentBus Foundation — Types + Bus + DB Migration

## Context

Sprint 8, Track 1. This is the **foundation track** — all other tracks (T2, T3, T4) depend on the types and infrastructure you create here. You are building the central message bus, all shared TypeScript types, the surface router skeleton, and the Supabase migration for DAG persistence.

**What this enables:** A typed pub/sub event bus that replaces scattered EventEmitters across the Fintheon backend, plus database tables for persistent DAG state. Other tracks will build the DAG scheduler, MiroShark template, and frontend integrations on top of your foundation.

## Files to Read First

Read these to understand existing patterns:

- `backend-hono/src/services/harper-autonomous/ops-store.ts` — Current EventEmitter pattern (opsEmitter). Your AgentBus replaces this pattern.
- `backend-hono/src/services/riskflow/sse-broadcaster.ts` — Current SSE client management. Your SurfaceRouter generalizes this.
- `backend-hono/src/services/cognition-emitter.ts` — Request-scoped event pattern. Shows how events flow today.
- `backend-hono/src/services/chat-queue.ts` — Current chat queue. Shows the bounded FIFO pattern.
- `backend-hono/src/services/strands/agent-factory.ts` — Agent creation. Shows agent ID types.
- `backend-hono/src/services/miroshark/miroshark-deliberation.ts` — MiroShark types (MarketAnalystAssessment, HarperOpusScoring, etc.). T3 will convert this to a DAG template using your types.

## Files to Create

### 1. `backend-hono/src/services/agent-bus/types.ts` (~120 lines)

All shared types for the AgentBus system. Every other track imports from this file.

```typescript
// --- Agent IDs ---
export type HermesAgentId =
  | "oracle"
  | "feucht"
  | "consul"
  | "herald"
  | "harper";

// --- DAG Types ---
export type DAGStatus =
  | "pending"
  | "running"
  | "complete"
  | "failed"
  | "cancelled";
export type TaskStatus =
  | "pending"
  | "running"
  | "complete"
  | "failed"
  | "cancelled"
  | "timeout";
export type TaskType =
  | "analysis"
  | "scoring"
  | "synthesis"
  | "discovery"
  | "deliberation";
export type SurfaceId = "chat" | "sidebar" | "narrative" | "boardroom";

export interface DAGDefinition {
  conversationId?: string;
  userId?: string;
  surface: SurfaceId;
  template?: string; // 'miroshark-deliberation' | 'ad-hoc'
  input: Record<string, unknown>;
  tasks: TaskDefinition[];
}

export interface TaskDefinition {
  /** Client-provided key for referencing in deps (e.g., 'oracle-analysis') */
  key: string;
  agentId: HermesAgentId;
  taskType: TaskType;
  input: Record<string, unknown>;
  /** Keys of tasks this depends on (resolved to UUIDs on persist) */
  depKeys: string[];
}

export interface DAGRecord {
  id: string;
  conversationId: string | null;
  userId: string | null;
  surface: SurfaceId;
  status: DAGStatus;
  template: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  createdAt: string;
  completedAt: string | null;
}

export interface TaskRecord {
  id: string;
  dagId: string;
  agentId: HermesAgentId;
  taskType: TaskType;
  status: TaskStatus;
  wave: number;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  deps: string[]; // task IDs
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

// --- Bus Message Types ---
export type BusTopic =
  | "dag.task.dispatch"
  | "dag.task.result"
  | "dag.task.error"
  | "dag.status"
  | "surface.narrative"
  | "surface.sidebar"
  | "surface.boardroom"
  | "harper.synthesis";

export interface BusMessage<T = unknown> {
  topic: BusTopic;
  dagId: string;
  taskId?: string;
  agentId?: HermesAgentId;
  surface?: SurfaceId;
  payload: T;
  timestamp: number;
}

// --- Surface Event Types (SSE payloads) ---
export interface AgentStreamEvent {
  type: "agent-start" | "agent-delta" | "agent-complete" | "agent-error";
  dagId: string;
  taskId: string;
  agentId: HermesAgentId;
  data: string | Record<string, unknown>;
}

export interface DAGProgressEvent {
  type: "dag-start" | "dag-wave" | "dag-complete" | "dag-error";
  dagId: string;
  wave: number;
  tasks: Array<{ id: string; agentId: HermesAgentId; status: TaskStatus }>;
}

export interface NarrativePushEvent {
  type: "catalyst-discovered";
  dagId: string;
  agentId: HermesAgentId;
  catalyst: {
    headline: string;
    body: string;
    symbols: string[];
    sentiment: number;
    severity: number;
    source: string;
  };
}

export interface SidebarNotifyEvent {
  type: "agent-finding";
  dagId: string;
  agentId: HermesAgentId;
  summary: string;
  surface: SurfaceId;
}

// --- Constants ---
export const MAX_CONCURRENT_AGENTS = 5;
export const MAX_TASKS_PER_DAG = 10;
export const TASK_TIMEOUT_MS = 90_000;
export const DAG_TIMEOUT_MS = 300_000; // 5 minutes
```

### 2. `backend-hono/src/services/agent-bus/bus.ts` (~150 lines)

The central pub/sub engine. In-process, typed, with wildcard topic matching.

```typescript
import { EventEmitter } from "events";
import type { BusTopic, BusMessage } from "./types";

/**
 * AgentBus — typed in-process pub/sub for inter-agent communication.
 *
 * Singleton. All agent results, DAG events, and surface pushes flow through here.
 * NOT a distributed queue — this is single-instance, designed for our Bun server.
 */
class AgentBus {
  private emitter = new EventEmitter();
  private messageCount = 0;

  constructor() {
    // High listener ceiling — each active DAG + each SSE client = 1 listener
    this.emitter.setMaxListeners(200);
  }

  /** Publish a typed message to a topic */
  publish<T>(
    topic: BusTopic,
    message: Omit<BusMessage<T>, "topic" | "timestamp">,
  ): void {
    const full: BusMessage<T> = {
      ...message,
      topic,
      timestamp: Date.now(),
    };
    this.messageCount++;
    this.emitter.emit(topic, full);
    // Also emit to wildcard subscribers (e.g., 'dag.*' listens to all dag topics)
    const prefix = topic.split(".").slice(0, -1).join(".");
    if (prefix) {
      this.emitter.emit(`${prefix}.*`, full);
    }
  }

  /** Subscribe to a specific topic */
  subscribe<T>(
    topic: BusTopic | `${string}.*`,
    handler: (msg: BusMessage<T>) => void,
  ): () => void {
    this.emitter.on(topic, handler);
    return () => this.emitter.off(topic, handler);
  }

  /** Subscribe to a topic, auto-unsubscribe after first message */
  once<T>(topic: BusTopic, handler: (msg: BusMessage<T>) => void): void {
    this.emitter.once(topic, handler);
  }

  /** Get total messages published (for monitoring) */
  get stats() {
    return {
      messageCount: this.messageCount,
      listenerCount:
        this.emitter.listenerCount("dag.task.dispatch") +
        this.emitter.listenerCount("dag.task.result") +
        this.emitter.listenerCount("surface.boardroom"),
    };
  }

  /** Remove all listeners (for testing/shutdown) */
  reset(): void {
    this.emitter.removeAllListeners();
    this.messageCount = 0;
  }
}

// Singleton export
export const agentBus = new AgentBus();
```

### 3. `backend-hono/src/services/agent-bus/surface-router.ts` (~130 lines)

Manages SSE client subscriptions per surface. Generalizes the pattern from `sse-broadcaster.ts`.

```typescript
import type { ReadableStreamDefaultController } from "stream/web";
import type {
  SurfaceId,
  AgentStreamEvent,
  DAGProgressEvent,
  NarrativePushEvent,
  SidebarNotifyEvent,
} from "./types";
import { agentBus } from "./bus";

interface SSEClient {
  controller: ReadableStreamDefaultController<Uint8Array>;
  userId: string;
  surface: SurfaceId;
  connectedAt: number;
}

/**
 * SurfaceRouter — manages SSE subscriptions per surface.
 *
 * Each surface (narrative, sidebar, boardroom) gets its own SSE endpoint.
 * Clients register via addClient(), receive typed events from the AgentBus.
 */
class SurfaceRouter {
  private clients = new Set<SSEClient>();
  private unsubscribers: Array<() => void> = [];

  /** Start listening to AgentBus topics and routing to surfaces */
  start(): void {
    // Route boardroom events
    this.unsubscribers.push(
      agentBus.subscribe<AgentStreamEvent>("surface.boardroom", (msg) => {
        this.broadcastToSurface("boardroom", msg.payload);
      }),
    );

    // Route narrative push events
    this.unsubscribers.push(
      agentBus.subscribe<NarrativePushEvent>("surface.narrative", (msg) => {
        this.broadcastToSurface("narrative", msg.payload);
      }),
    );

    // Route sidebar notifications
    this.unsubscribers.push(
      agentBus.subscribe<SidebarNotifyEvent>("surface.sidebar", (msg) => {
        this.broadcastToSurface("sidebar", msg.payload);
      }),
    );
  }

  /** Stop all subscriptions */
  stop(): void {
    this.unsubscribers.forEach((unsub) => unsub());
    this.unsubscribers = [];
  }

  /** Register an SSE client for a surface */
  addClient(
    controller: ReadableStreamDefaultController<Uint8Array>,
    userId: string,
    surface: SurfaceId,
  ): void {
    this.clients.add({ controller, userId, surface, connectedAt: Date.now() });
  }

  /** Remove an SSE client on disconnect */
  removeClient(controller: ReadableStreamDefaultController<Uint8Array>): void {
    for (const client of this.clients) {
      if (client.controller === controller) {
        this.clients.delete(client);
        break;
      }
    }
  }

  /** Broadcast a payload to all clients subscribed to a surface */
  private broadcastToSurface(surface: SurfaceId, payload: unknown): void {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    const bytes = new TextEncoder().encode(data);

    for (const client of this.clients) {
      if (client.surface === surface) {
        try {
          client.controller.enqueue(bytes);
        } catch {
          // Client disconnected, remove silently
          this.clients.delete(client);
        }
      }
    }
  }

  /** Get connected client count per surface */
  get stats() {
    const counts: Record<string, number> = {};
    for (const client of this.clients) {
      counts[client.surface] = (counts[client.surface] || 0) + 1;
    }
    return { clients: this.clients.size, bySurface: counts };
  }
}

// Singleton export
export const surfaceRouter = new SurfaceRouter();
```

### 4. `backend-hono/src/services/agent-bus/index.ts` (~15 lines)

Barrel export for clean imports.

```typescript
export { agentBus } from "./bus";
export { surfaceRouter } from "./surface-router";
export * from "./types";
```

### 5. Supabase migration: `supabase/migrations/20260410_agent_bus.sql` (~50 lines)

```sql
-- AgentBus: DAG + Task persistence for multi-agent orchestration

CREATE TABLE IF NOT EXISTS agent_dags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT,
  user_id UUID REFERENCES auth.users(id),
  surface TEXT NOT NULL CHECK (surface IN ('chat','sidebar','narrative','boardroom')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed','cancelled')),
  template TEXT,
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dag_id UUID NOT NULL REFERENCES agent_dags(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  task_type TEXT NOT NULL CHECK (task_type IN ('analysis','scoring','synthesis','discovery','deliberation')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','complete','failed','cancelled','timeout')),
  wave INTEGER NOT NULL DEFAULT 0,
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB,
  deps UUID[] DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error TEXT
);

CREATE INDEX idx_agent_tasks_dag ON agent_tasks(dag_id);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status) WHERE status IN ('pending','running');
CREATE INDEX idx_agent_dags_status ON agent_dags(status) WHERE status IN ('pending','running');

-- RLS: users can only see their own DAGs
ALTER TABLE agent_dags ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own DAGs" ON agent_dags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to DAGs" ON agent_dags
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Users can view own tasks" ON agent_tasks
  FOR SELECT USING (
    dag_id IN (SELECT id FROM agent_dags WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access to tasks" ON agent_tasks
  FOR ALL USING (auth.role() = 'service_role');
```

## Verification

After completing this track:

1. `npx tsc --noEmit` — All types compile, no errors
2. `grep -r "from.*agent-bus" backend-hono/src/` — Confirm barrel export works
3. Apply migration: `supabase migration up` or manually run SQL in Supabase dashboard
4. Verify tables exist: `SELECT * FROM agent_dags LIMIT 0; SELECT * FROM agent_tasks LIMIT 0;`
5. Quick smoke test — in any backend file, import `{ agentBus }` and call `agentBus.publish(...)` / `agentBus.subscribe(...)` to confirm the bus works

## Changelog Entry

```typescript
{ date: '2026-04-05T__:__:__', agent: 'claude-code', summary: 'S8-T1: AgentBus foundation — typed pub/sub bus, DAG/task types, surface router, Supabase migration for agent_dags + agent_tasks tables', files: ['backend-hono/src/services/agent-bus/types.ts', 'backend-hono/src/services/agent-bus/bus.ts', 'backend-hono/src/services/agent-bus/surface-router.ts', 'backend-hono/src/services/agent-bus/index.ts', 'supabase/migrations/20260405_agent_bus.sql'] }
```

## DO NOT

- Do NOT modify any existing files. This track is pure foundation — no wiring.
- Do NOT implement the DAG scheduler logic. That is T2's scope.
- Do NOT touch MiroShark deliberation. That is T3's scope.
- Do NOT create any frontend components. That is T4's scope.
- Do NOT add bus subscriptions in routes. Other tracks will wire those up.
- Do NOT use Redis, RabbitMQ, or any external broker. The bus is in-process EventEmitter-based.
