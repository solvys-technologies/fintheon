// [claude-code 2026-04-10] S8-T1: AgentBus foundation — all shared types for the AgentBus system

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
  template?: string; // 'agent-desk-deliberation' | 'ad-hoc'
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
  | "lounge.brief"
  | "lounge.reflection"
  | "lounge.consensus"
  | "lounge.routing"
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

export interface NarrativeCatalystDiscoveredEvent {
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

export interface NarrativeDeliberationEntryPayload {
  id: string;
  hypothesisId: string;
  agentId: string;
  agentName: string;
  stance: "supports" | "contradicts" | "neutral";
  summary: string;
  confidence: number;
  createdAt: string;
  sourceSessionId: string | null;
}

export interface NarrativeHypothesisUpdatedEvent {
  type: "hypothesis-updated";
  dagId: string;
  hypothesisId: string;
  updatedAt: string;
  sourceSessionId: string | null;
  deliberationEntry: NarrativeDeliberationEntryPayload;
  consensus?: string | null;
  routingStatus?:
    | "candidate"
    | "needs_research"
    | "promoted"
    | "rejected"
    | "pinned";
}

export type NarrativePushEvent =
  | NarrativeCatalystDiscoveredEvent
  | NarrativeHypothesisUpdatedEvent;

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
