// [claude-code 2026-04-10] S8-T2: DAG scheduler — wave-based dependency resolution, per-task streaming dispatch

import { agentBus } from "./bus.js";
import type {
  DAGDefinition,
  TaskDefinition,
  DAGRecord,
  TaskRecord,
  DAGProgressEvent,
  AgentStreamEvent,
} from "./types.js";
import {
  MAX_CONCURRENT_AGENTS,
  MAX_TASKS_PER_DAG,
  TASK_TIMEOUT_MS,
  DAG_TIMEOUT_MS,
} from "./types.js";
import { getSupabaseClient } from "../../config/supabase.js";
import { createAgentForTask } from "../strands/agent-factory.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("DAGScheduler");

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Execute a DAG: persist to DB, compute waves, dispatch tasks in order.
 * Returns the DAGRecord when all tasks are complete (or failed).
 */
export async function executeDag(dagDef: DAGDefinition): Promise<DAGRecord> {
  if (dagDef.tasks.length > MAX_TASKS_PER_DAG) {
    throw new Error(
      `DAG exceeds max tasks limit (${dagDef.tasks.length} > ${MAX_TASKS_PER_DAG})`,
    );
  }

  const waves = computeWaves(dagDef.tasks);
  const dagId = crypto.randomUUID();
  const now = new Date().toISOString();

  const dagRecord: DAGRecord = {
    id: dagId,
    conversationId: dagDef.conversationId ?? null,
    userId: dagDef.userId ?? null,
    surface: dagDef.surface,
    status: "running",
    template: dagDef.template ?? null,
    input: dagDef.input,
    output: null,
    createdAt: now,
    completedAt: null,
  };

  // Persist DAG row
  const sb = getSupabaseClient();
  if (sb) {
    const { error } = await sb.from("agent_dags").insert({
      id: dagRecord.id,
      conversation_id: dagRecord.conversationId,
      user_id: dagRecord.userId,
      surface: dagRecord.surface,
      status: dagRecord.status,
      template: dagRecord.template,
      input: dagRecord.input,
      output: null,
      created_at: dagRecord.createdAt,
      completed_at: null,
    });
    if (error)
      log.warn("Failed to persist DAG", { dagId, error: error.message });
  }

  // Build task records — assign UUIDs and resolve dep keys → UUIDs
  const keyToId = new Map<string, string>();
  const taskRecordsByKey = new Map<string, TaskRecord>();

  for (const [wave, tasks] of waves) {
    for (const taskDef of tasks) {
      const taskId = crypto.randomUUID();
      keyToId.set(taskDef.key, taskId);
      taskRecordsByKey.set(taskDef.key, {
        id: taskId,
        dagId,
        agentId: taskDef.agentId,
        taskType: taskDef.taskType,
        status: "pending",
        wave,
        input: taskDef.input,
        output: null,
        deps: [], // resolved below
        startedAt: null,
        completedAt: null,
        durationMs: null,
        error: null,
      });
    }
  }

  // Resolve dep keys to IDs now that all IDs are assigned
  for (const [key, record] of taskRecordsByKey) {
    const def = dagDef.tasks.find((t) => t.key === key)!;
    record.deps = def.depKeys.map((dk) => keyToId.get(dk)!);
  }

  // Persist all task rows
  if (sb) {
    const rows = Array.from(taskRecordsByKey.values()).map((t) => ({
      id: t.id,
      dag_id: t.dagId,
      agent_id: t.agentId,
      task_type: t.taskType,
      status: t.status,
      wave: t.wave,
      input: t.input,
      output: null,
      deps: t.deps,
      started_at: null,
      completed_at: null,
      duration_ms: null,
      error: null,
    }));
    const { error } = await sb.from("agent_tasks").insert(rows);
    if (error)
      log.warn("Failed to persist tasks", { dagId, error: error.message });
  }

  // DAG-level timeout — cancel remaining if exceeded
  let dagTimedOut = false;
  const dagTimeoutHandle = setTimeout(() => {
    dagTimedOut = true;
    log.error("DAG global timeout", { dagId });
    for (const record of taskRecordsByKey.values()) {
      if (record.status === "pending" || record.status === "running") {
        record.status = "cancelled";
      }
    }
  }, DAG_TIMEOUT_MS);

  try {
    // Publish dag-start
    _publishProgress(dagId, {
      type: "dag-start",
      dagId,
      wave: 0,
      tasks: _taskSummary(taskRecordsByKey),
    });

    // Execute waves in order
    for (const [wave, waveTasks] of waves) {
      if (dagTimedOut) break;

      const waveRecords = waveTasks.map((t) => taskRecordsByKey.get(t.key)!);

      _publishProgress(dagId, {
        type: "dag-wave",
        dagId,
        wave,
        tasks: waveRecords.map((t) => ({
          id: t.id,
          agentId: t.agentId,
          status: t.status,
        })),
      });

      // Dispatch in chunks of MAX_CONCURRENT_AGENTS
      for (let i = 0; i < waveRecords.length; i += MAX_CONCURRENT_AGENTS) {
        if (dagTimedOut) break;
        const chunk = waveRecords.slice(i, i + MAX_CONCURRENT_AGENTS);
        await Promise.all(chunk.map((task) => dispatchTask(task, dagRecord)));
      }
    }

    // Mark DAG complete
    dagRecord.status = dagTimedOut ? "failed" : "complete";
    dagRecord.completedAt = new Date().toISOString();

    if (sb) {
      await sb
        .from("agent_dags")
        .update({
          status: dagRecord.status,
          completed_at: dagRecord.completedAt,
        })
        .eq("id", dagId);
    }

    _publishProgress(dagId, {
      type: dagTimedOut ? "dag-error" : "dag-complete",
      dagId,
      wave: waves.size - 1,
      tasks: _taskSummary(taskRecordsByKey),
    });

    log.info("DAG finished", {
      dagId,
      status: dagRecord.status,
      tasks: taskRecordsByKey.size,
    });
    return dagRecord;
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    log.error("DAG execution error", { dagId, error: errorMsg });

    dagRecord.status = "failed";
    dagRecord.completedAt = new Date().toISOString();

    if (sb) {
      await sb
        .from("agent_dags")
        .update({ status: "failed", completed_at: dagRecord.completedAt })
        .eq("id", dagId);
    }

    _publishProgress(dagId, {
      type: "dag-error",
      dagId,
      wave: 0,
      tasks: _taskSummary(taskRecordsByKey),
    });

    throw err;
  } finally {
    clearTimeout(dagTimeoutHandle);
  }
}

// ---------------------------------------------------------------------------
// Task dispatch
// ---------------------------------------------------------------------------

async function dispatchTask(
  task: TaskRecord,
  dagRecord: DAGRecord,
): Promise<void> {
  const dagId = dagRecord.id;
  const sb = getSupabaseClient();

  task.status = "running";
  task.startedAt = new Date().toISOString();

  if (sb) {
    await sb
      .from("agent_tasks")
      .update({ status: "running", started_at: task.startedAt })
      .eq("id", task.id);
  }

  agentBus.publish("dag.task.dispatch", {
    dagId,
    taskId: task.id,
    agentId: task.agentId,
    payload: { taskId: task.id, agentId: task.agentId, wave: task.wave },
  });

  _publishStream(dagId, task.id, task.agentId, {
    type: "agent-start",
    dagId,
    taskId: task.id,
    agentId: task.agentId,
    data: "",
  });

  const startTime = Date.now();

  try {
    const prompt = String(task.input.prompt ?? JSON.stringify(task.input));
    const agent = createAgentForTask(task.agentId, dagId);

    let fullText = "";
    let timedOut = false;

    const taskTimeoutHandle = setTimeout(() => {
      timedOut = true;
    }, TASK_TIMEOUT_MS);

    try {
      for await (const event of agent.stream(prompt)) {
        if (timedOut) break;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ev = event as any;
        if (
          ev.type === "modelStreamUpdateEvent" &&
          ev.event?.type === "modelContentBlockDeltaEvent" &&
          ev.event?.delta?.type === "textDelta" &&
          ev.event?.delta?.text
        ) {
          const delta: string = ev.event.delta.text;
          fullText += delta;

          _publishStream(dagId, task.id, task.agentId, {
            type: "agent-delta",
            dagId,
            taskId: task.id,
            agentId: task.agentId,
            data: delta,
          });
        }
      }
    } finally {
      clearTimeout(taskTimeoutHandle);
    }

    if (timedOut) {
      throw new Error(`Task timed out after ${TASK_TIMEOUT_MS}ms`);
    }

    // Success path
    const durationMs = Date.now() - startTime;
    task.status = "complete";
    task.output = { text: fullText };
    task.completedAt = new Date().toISOString();
    task.durationMs = durationMs;

    if (sb) {
      await sb
        .from("agent_tasks")
        .update({
          status: "complete",
          output: { text: fullText },
          completed_at: task.completedAt,
          duration_ms: durationMs,
        })
        .eq("id", task.id);
    }

    agentBus.publish("dag.task.result", {
      dagId,
      taskId: task.id,
      agentId: task.agentId,
      payload: {
        taskId: task.id,
        agentId: task.agentId,
        output: fullText,
        durationMs,
      },
    });

    _publishStream(dagId, task.id, task.agentId, {
      type: "agent-complete",
      dagId,
      taskId: task.id,
      agentId: task.agentId,
      data: { text: fullText, durationMs },
    });

    log.info("Task complete", {
      taskId: task.id,
      agentId: task.agentId,
      durationMs,
      chars: fullText.length,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;
    task.status = errorMsg.includes("timed out") ? "timeout" : "failed";
    task.error = errorMsg;
    task.completedAt = new Date().toISOString();
    task.durationMs = durationMs;

    if (sb) {
      await sb
        .from("agent_tasks")
        .update({
          status: task.status,
          error: errorMsg,
          completed_at: task.completedAt,
          duration_ms: durationMs,
        })
        .eq("id", task.id);
    }

    agentBus.publish("dag.task.error", {
      dagId,
      taskId: task.id,
      agentId: task.agentId,
      payload: { taskId: task.id, agentId: task.agentId, error: errorMsg },
    });

    _publishStream(dagId, task.id, task.agentId, {
      type: "agent-error",
      dagId,
      taskId: task.id,
      agentId: task.agentId,
      data: errorMsg,
    });

    log.error("Task failed", {
      taskId: task.id,
      agentId: task.agentId,
      status: task.status,
      error: errorMsg,
    });
  }
}

// ---------------------------------------------------------------------------
// Wave computation (topological sort)
// ---------------------------------------------------------------------------

/**
 * Compute execution waves from a flat task list.
 * Tasks with no deps = wave 0. Tasks whose all deps are wave N = wave N+1.
 * Throws on unknown dep keys or cycles.
 */
export function computeWaves(
  tasks: TaskDefinition[],
): Map<number, TaskDefinition[]> {
  if (tasks.length === 0) return new Map();

  const taskMap = new Map<string, TaskDefinition>(tasks.map((t) => [t.key, t]));

  // Validate all dep keys exist
  for (const task of tasks) {
    for (const dep of task.depKeys) {
      if (!taskMap.has(dep)) {
        throw new Error(`Task "${task.key}" depends on unknown key "${dep}"`);
      }
    }
  }

  const assigned = new Map<string, number>();
  const visiting = new Set<string>();

  function getWave(key: string): number {
    if (assigned.has(key)) return assigned.get(key)!;
    if (visiting.has(key)) {
      throw new Error(`Cycle detected involving task "${key}"`);
    }

    visiting.add(key);
    const task = taskMap.get(key)!;
    let wave = 0;
    for (const dep of task.depKeys) {
      wave = Math.max(wave, getWave(dep) + 1);
    }
    visiting.delete(key);
    assigned.set(key, wave);
    return wave;
  }

  for (const task of tasks) {
    if (!assigned.has(task.key)) getWave(task.key);
  }

  const waves = new Map<number, TaskDefinition[]>();
  for (const [key, wave] of assigned) {
    if (!waves.has(wave)) waves.set(wave, []);
    waves.get(wave)!.push(taskMap.get(key)!);
  }

  return new Map([...waves.entries()].sort((a, b) => a[0] - b[0]));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _publishProgress(dagId: string, payload: DAGProgressEvent): void {
  agentBus.publish<DAGProgressEvent>("dag.status", { dagId, payload });
}

function _publishStream(
  dagId: string,
  taskId: string,
  agentId: TaskRecord["agentId"],
  payload: AgentStreamEvent,
): void {
  agentBus.publish<AgentStreamEvent>("surface.boardroom", {
    dagId,
    taskId,
    agentId,
    payload,
  });
}

function _taskSummary(taskRecordsByKey: Map<string, TaskRecord>): Array<{
  id: string;
  agentId: TaskRecord["agentId"];
  status: TaskRecord["status"];
}> {
  return Array.from(taskRecordsByKey.values()).map((t) => ({
    id: t.id,
    agentId: t.agentId,
    status: t.status,
  }));
}
