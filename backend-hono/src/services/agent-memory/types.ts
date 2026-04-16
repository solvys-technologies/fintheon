// [claude-code 2026-04-16] T4: Agent memory + outcome tracking interfaces

export type AgentId = "oracle" | "feucht" | "consul" | "herald" | "harper";

export type MemoryType =
  | "deliberation_output"
  | "accuracy_feedback"
  | "reflect_finding"
  | "learned_pattern";

export interface AgentMemory {
  id: string;
  agentId: AgentId;
  memoryType: MemoryType;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  expiresAt: string | null;
}

export interface AddMemoryInput {
  agentId: AgentId;
  memoryType: MemoryType;
  content: string;
  metadata?: Record<string, unknown>;
  /** TTL in hours. Null = permanent. */
  ttlHours?: number | null;
}

export interface DeliberationOutcome {
  id: string;
  deliberationId: string;
  agentId: string;
  predictedIvScore: number | null;
  predictedRegimeShift: number | null;
  predictedCategoryScores: Record<string, unknown> | null;
  actualVix24h: number | null;
  actualVix48h: number | null;
  actualVix72h: number | null;
  directionCorrect24h: boolean | null;
  directionCorrect48h: boolean | null;
  directionCorrect72h: boolean | null;
  magnitudeError24h: number | null;
  magnitudeError48h: number | null;
  magnitudeError72h: number | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface AccuracyFeedback {
  agentId: AgentId;
  predictions: PredictionResult[];
  overallDirectionAccuracy: number;
  overallMagnitudeError: number;
  summary: string;
}

export interface PredictionResult {
  date: string;
  predictedIV: number;
  actualVixChange: number;
  directionCorrect: boolean;
  magnitudeError: number;
}
