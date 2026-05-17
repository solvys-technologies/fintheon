import { sql, isDatabaseAvailable } from "../../config/database.js";
import {
  createTask,
  listTasks,
  updateTaskStatus,
  type ResearchTask,
} from "../research/task-board.js";
import type {
  NarrativeHypothesis,
  NarrativeRoutingDecision,
  NarrativeRoutingStatus,
} from "./types.js";

export type NarrativeReviewAction =
  | "accept"
  | "research"
  | "reject"
  | "pin"
  | "task";

export interface NarrativeReviewInput {
  action: NarrativeReviewAction;
  hypothesis: NarrativeHypothesis;
  reason: string;
  actorId: string;
  note?: string | null;
}

export interface NarrativeReviewRecord {
  id: string;
  hypothesisId: string;
  action: NarrativeReviewAction;
  reason: string;
  note: string | null;
  actorId: string;
  taskId: string | null;
  createdAt: string;
}

const memoryReviews = new Map<string, NarrativeReviewRecord[]>();
let hasEnsuredTable = false;

const ACTION_STATUS: Record<NarrativeReviewAction, NarrativeRoutingStatus> = {
  accept: "promoted",
  research: "needs_research",
  reject: "rejected",
  pin: "pinned",
  task: "needs_research",
};

const ACTION_NEXT: Record<NarrativeReviewAction, string> = {
  accept: "active_narrative",
  research: "research_task",
  reject: "audited_rejection",
  pin: "sanctum_pin",
  task: "research_task",
};

export async function applyReviewAction(
  input: NarrativeReviewInput,
): Promise<{ review: NarrativeReviewRecord; task: ResearchTask | null }> {
  const task = ["research", "task"].includes(input.action)
    ? await upsertResearchTask(input)
    : null;
  const review = await persistReview(input, task?.id ?? null);
  return { review, task };
}

export async function attachReviewDecisions(
  hypotheses: NarrativeHypothesis[],
): Promise<NarrativeHypothesis[]> {
  const latest = await getLatestReviews(hypotheses.map((item) => item.id));
  return hypotheses.map((hypothesis) => {
    const review = latest.get(hypothesis.id);
    if (!review) return hypothesis;
    return {
      ...hypothesis,
      routingDecision: toRoutingDecision(review),
    };
  });
}

async function upsertResearchTask(
  input: NarrativeReviewInput,
): Promise<ResearchTask> {
  const existing = (await listTasks()).find(
    (task) =>
      task.narrative?.includes(input.hypothesis.id) &&
      task.status !== "complete",
  );
  const findings = {
    hypothesisId: input.hypothesis.id,
    reason: input.reason,
    note: input.note ?? null,
    requestedAt: new Date().toISOString(),
  };

  if (existing) {
    const updated = await updateTaskStatus(existing.id, "active", findings);
    if (updated) return updated;
  }

  return createTask({
    title: `Research: ${input.hypothesis.title}`,
    narrative: `${input.hypothesis.id} — ${input.hypothesis.thesis}`,
    assignedAgent: "Oracle",
    createdBy: input.actorId,
  });
}

async function persistReview(
  input: NarrativeReviewInput,
  taskId: string | null,
): Promise<NarrativeReviewRecord> {
  if (!isDatabaseAvailable()) return persistMemoryReview(input, taskId);

  await ensureReviewTable();
  const rows = await sql`
    INSERT INTO narrative_review_actions (
      hypothesis_id, action, reason, note, actor_id, task_id, hypothesis
    )
    VALUES (
      ${input.hypothesis.id},
      ${input.action},
      ${input.reason},
      ${input.note ?? null},
      ${input.actorId},
      ${taskId},
      ${JSON.stringify(input.hypothesis)}::jsonb
    )
    RETURNING id, hypothesis_id, action, reason, note, actor_id, task_id, created_at
  `;
  return mapReviewRow(rows[0]);
}

async function getLatestReviews(
  hypothesisIds: string[],
): Promise<Map<string, NarrativeReviewRecord>> {
  if (hypothesisIds.length === 0) return new Map();
  if (!isDatabaseAvailable()) return getLatestMemoryReviews(hypothesisIds);

  await ensureReviewTable();
  const rows = await sql`
    SELECT DISTINCT ON (hypothesis_id)
      id, hypothesis_id, action, reason, note, actor_id, task_id, created_at
    FROM narrative_review_actions
    WHERE hypothesis_id = ANY(${hypothesisIds})
    ORDER BY hypothesis_id, created_at DESC
  `;
  return new Map(rows.map((row) => [row.hypothesis_id, mapReviewRow(row)]));
}

async function ensureReviewTable(): Promise<void> {
  if (hasEnsuredTable) return;
  await sql`
    CREATE TABLE IF NOT EXISTS narrative_review_actions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      hypothesis_id TEXT NOT NULL,
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      note TEXT,
      actor_id TEXT NOT NULL,
      task_id TEXT,
      hypothesis JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS idx_narrative_review_actions_latest
    ON narrative_review_actions (hypothesis_id, created_at DESC)
  `;
  hasEnsuredTable = true;
}

function persistMemoryReview(
  input: NarrativeReviewInput,
  taskId: string | null,
): NarrativeReviewRecord {
  const review: NarrativeReviewRecord = {
    id: crypto.randomUUID(),
    hypothesisId: input.hypothesis.id,
    action: input.action,
    reason: input.reason,
    note: input.note ?? null,
    actorId: input.actorId,
    taskId,
    createdAt: new Date().toISOString(),
  };
  memoryReviews.set(input.hypothesis.id, [
    ...(memoryReviews.get(input.hypothesis.id) ?? []),
    review,
  ]);
  return review;
}

function getLatestMemoryReviews(
  hypothesisIds: string[],
): Map<string, NarrativeReviewRecord> {
  return new Map(
    hypothesisIds.flatMap((id) => {
      const reviews = memoryReviews.get(id) ?? [];
      const latest = [...reviews].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )[0];
      return latest ? [[id, latest] as const] : [];
    }),
  );
}

function toRoutingDecision(
  review: NarrativeReviewRecord,
): NarrativeRoutingDecision {
  return {
    status: ACTION_STATUS[review.action],
    rationale: review.reason,
    nextAction: ACTION_NEXT[review.action],
    decidedBy: review.actorId,
    decidedAt: review.createdAt,
  };
}

function mapReviewRow(row: Record<string, unknown>): NarrativeReviewRecord {
  return {
    id: String(row.id),
    hypothesisId: String(row.hypothesis_id),
    action: row.action as NarrativeReviewAction,
    reason: String(row.reason),
    note: row.note ? String(row.note) : null,
    actorId: String(row.actor_id),
    taskId: row.task_id ? String(row.task_id) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
  };
}
