// [claude-code 2026-03-10] Bounded message queue for AI chat requests
// Producer-consumer pattern with max 2 slots per conversation (1 active + 1 pending).
// Inspired by Cursor's async message queue architecture — adapted for trading context.

export type QueueJobStatus =
  | "pending"
  | "processing"
  | "done"
  | "failed"
  | "cancelled";

export interface QueueJob {
  jobId: string;
  conversationId: string;
  userId: string;
  message: string;
  agentOverride?: string;
  thinkHarder?: boolean;
  status: QueueJobStatus;
  position: number; // 0 = active, 1 = pending
  enqueuedAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
}

interface ConvQueue {
  active: QueueJob | null;
  pending: QueueJob | null;
}

// Per-conversation queue state — in-memory, single-process
const queues = new Map<string, ConvQueue>();

function getOrCreateQueue(conversationId: string): ConvQueue {
  if (!queues.has(conversationId)) {
    queues.set(conversationId, { active: null, pending: null });
  }
  return queues.get(conversationId)!;
}

function slotCount(q: ConvQueue): number {
  return (q.active ? 1 : 0) + (q.pending ? 1 : 0);
}

/**
 * Enqueue a message for a conversation.
 * Returns the job if accepted, or null if queue is full (max 2 slots).
 */
export function enqueue(params: {
  conversationId: string;
  userId: string;
  message: string;
  agentOverride?: string;
  thinkHarder?: boolean;
}): { job: QueueJob } | { error: "queue_full"; depth: number } {
  const q = getOrCreateQueue(params.conversationId);

  if (slotCount(q) >= 2) {
    return { error: "queue_full", depth: slotCount(q) };
  }

  const job: QueueJob = {
    jobId: `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    conversationId: params.conversationId,
    userId: params.userId,
    message: params.message,
    agentOverride: params.agentOverride,
    thinkHarder: params.thinkHarder,
    status: q.active ? "pending" : "processing",
    position: q.active ? 1 : 0,
    enqueuedAt: Date.now(),
  };

  if (!q.active) {
    job.startedAt = Date.now();
    q.active = job;
  } else {
    q.pending = job;
  }

  return { job };
}

/**
 * Mark active job complete and promote pending to active.
 */
export function completeJob(
  conversationId: string,
  jobId: string,
  error?: string,
): QueueJob | null {
  const q = queues.get(conversationId);
  if (!q) return null;

  const job = q.active;
  if (!job || job.jobId !== jobId) return null;

  job.status = error ? "failed" : "done";
  job.finishedAt = Date.now();
  job.error = error;

  // Promote pending → active
  if (q.pending) {
    const next = q.pending;
    next.status = "processing";
    next.position = 0;
    next.startedAt = Date.now();
    q.active = next;
    q.pending = null;
  } else {
    q.active = null;
  }

  return job;
}

/**
 * Cancel a job by ID. Can cancel pending; cancelling active just marks it.
 */
export function cancelJob(conversationId: string, jobId: string): boolean {
  const q = queues.get(conversationId);
  if (!q) return false;

  if (q.pending?.jobId === jobId) {
    q.pending.status = "cancelled";
    q.pending.finishedAt = Date.now();
    q.pending = null;
    return true;
  }

  if (q.active?.jobId === jobId) {
    q.active.status = "cancelled";
    q.active.finishedAt = Date.now();
    // No promote — slot clears next completeJob call
    return true;
  }

  return false;
}

/**
 * Get queue status for a conversation.
 */
export function getQueueStatus(conversationId: string): {
  depth: number;
  active: Pick<
    QueueJob,
    "jobId" | "status" | "enqueuedAt" | "startedAt"
  > | null;
  pending: Pick<QueueJob, "jobId" | "status" | "enqueuedAt"> | null;
} {
  const q = queues.get(conversationId);
  if (!q) return { depth: 0, active: null, pending: null };

  return {
    depth: slotCount(q),
    active: q.active
      ? {
          jobId: q.active.jobId,
          status: q.active.status,
          enqueuedAt: q.active.enqueuedAt,
          startedAt: q.active.startedAt,
        }
      : null,
    pending: q.pending
      ? {
          jobId: q.pending.jobId,
          status: q.pending.status,
          enqueuedAt: q.pending.enqueuedAt,
        }
      : null,
  };
}

/**
 * Get a specific job (active or pending) by jobId.
 */
export function getJob(jobId: string): QueueJob | null {
  for (const q of queues.values()) {
    if (q.active?.jobId === jobId) return q.active;
    if (q.pending?.jobId === jobId) return q.pending;
  }
  return null;
}

/**
 * Purge finished jobs for conversations idle > ttlMs (default 10 min).
 * Call periodically to prevent memory growth.
 */
export function purgeStale(ttlMs = 10 * 60 * 1000): number {
  let removed = 0;
  const cutoff = Date.now() - ttlMs;

  for (const [convId, q] of queues.entries()) {
    if (!q.active && !q.pending) {
      queues.delete(convId);
      removed++;
    } else if (
      q.active &&
      q.active.finishedAt &&
      q.active.finishedAt < cutoff
    ) {
      queues.delete(convId);
      removed++;
    }
  }

  return removed;
}

// Auto-purge every 5 minutes
setInterval(
  () => {
    const n = purgeStale();
    if (n > 0) console.log(`[ChatQueue] Purged ${n} stale queues`);
  },
  5 * 60 * 1000,
);
