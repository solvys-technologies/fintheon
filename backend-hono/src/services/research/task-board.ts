// [claude-code 2026-03-31] S12-T3: Research task board service (DB + memory fallback)

import { sql, isDatabaseAvailable } from "../../config/database.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResearchTask {
  id: string;
  title: string;
  narrative: string | null;
  assignedTo: string | null;
  assignedAgent: string | null;
  deskId: string | null;
  status: "pending" | "active" | "deep-dive" | "complete";
  findings: Record<string, unknown> | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ResearchTaskInput {
  title: string;
  narrative?: string | null;
  assignedTo?: string | null;
  assignedAgent?: string | null;
  deskId?: string | null;
  dueDate?: string | null;
  createdBy: string;
}

type ResearchTaskStatus = ResearchTask["status"];

const VALID_STATUSES: ResearchTaskStatus[] = [
  "pending",
  "active",
  "deep-dive",
  "complete",
];

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

const memoryTasks = new Map<string, ResearchTask>();

function mapRow(row: Record<string, unknown>): ResearchTask {
  return {
    id: row.id as string,
    title: row.title as string,
    narrative: (row.narrative as string) ?? null,
    assignedTo: (row.assigned_to as string) ?? null,
    assignedAgent: (row.assigned_agent as string) ?? null,
    deskId: (row.desk_id as string) ?? null,
    status: (row.status as ResearchTaskStatus) ?? "pending",
    findings: (row.findings as Record<string, unknown>) ?? null,
    dueDate: row.due_date
      ? new Date(row.due_date as string).toISOString()
      : null,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createTask(
  input: ResearchTaskInput,
): Promise<ResearchTask> {
  if (!isDatabaseAvailable() || !sql) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const task: ResearchTask = {
      id,
      title: input.title,
      narrative: input.narrative ?? null,
      assignedTo: input.assignedTo ?? null,
      assignedAgent: input.assignedAgent ?? null,
      deskId: input.deskId ?? null,
      status: "pending",
      findings: null,
      dueDate: input.dueDate ?? null,
      createdBy: input.createdBy,
      createdAt: now,
    };
    memoryTasks.set(id, task);
    return task;
  }

  const rows = await sql`
    INSERT INTO research_tasks (title, narrative, assigned_to, assigned_agent, desk_id, due_date, created_by)
    VALUES (
      ${input.title},
      ${input.narrative ?? null},
      ${input.assignedTo ?? null},
      ${input.assignedAgent ?? null},
      ${input.deskId ?? null},
      ${input.dueDate ?? null},
      ${input.createdBy}
    )
    RETURNING *
  `;
  return mapRow(rows[0]);
}

export async function listTasks(filter?: {
  deskId?: string;
  status?: string;
  assignedTo?: string;
}): Promise<ResearchTask[]> {
  if (!isDatabaseAvailable() || !sql) {
    let tasks = Array.from(memoryTasks.values());
    if (filter?.deskId) tasks = tasks.filter((t) => t.deskId === filter.deskId);
    if (filter?.status) tasks = tasks.filter((t) => t.status === filter.status);
    if (filter?.assignedTo)
      tasks = tasks.filter((t) => t.assignedTo === filter.assignedTo);
    return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // Build dynamic WHERE clauses
  const conditions: string[] = [];
  const values: unknown[] = [];
  let paramIdx = 1;

  if (filter?.deskId) {
    conditions.push(`desk_id = $${paramIdx++}`);
    values.push(filter.deskId);
  }
  if (filter?.status) {
    conditions.push(`status = $${paramIdx++}`);
    values.push(filter.status);
  }
  if (filter?.assignedTo) {
    conditions.push(`assigned_to = $${paramIdx++}`);
    values.push(filter.assignedTo);
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Use tagged template for simple case, raw query for dynamic filters
  if (!where) {
    const rows =
      await sql`SELECT * FROM research_tasks ORDER BY created_at DESC`;
    return rows.map(mapRow);
  }

  // For filtered queries, build the full query
  const rows = await sql`
    SELECT * FROM research_tasks
    WHERE
      (${filter?.deskId ?? null}::uuid IS NULL OR desk_id = ${filter?.deskId ?? null}::uuid)
      AND (${filter?.status ?? null}::text IS NULL OR status = ${filter?.status ?? null})
      AND (${filter?.assignedTo ?? null}::uuid IS NULL OR assigned_to = ${filter?.assignedTo ?? null}::uuid)
    ORDER BY created_at DESC
  `;
  return rows.map(mapRow);
}

export async function getTask(id: string): Promise<ResearchTask | null> {
  if (!isDatabaseAvailable() || !sql) {
    return memoryTasks.get(id) ?? null;
  }

  const rows = await sql`SELECT * FROM research_tasks WHERE id = ${id}`;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateTaskStatus(
  id: string,
  status: string,
  findings?: Record<string, unknown>,
): Promise<ResearchTask | null> {
  if (!VALID_STATUSES.includes(status as ResearchTaskStatus)) {
    throw new Error(
      `Invalid status: ${status}. Must be one of: ${VALID_STATUSES.join(", ")}`,
    );
  }

  if (!isDatabaseAvailable() || !sql) {
    const task = memoryTasks.get(id);
    if (!task) return null;
    task.status = status as ResearchTaskStatus;
    if (findings !== undefined) task.findings = findings;
    return task;
  }

  const rows =
    findings !== undefined
      ? await sql`
        UPDATE research_tasks
        SET status = ${status}, findings = ${JSON.stringify(findings)}::jsonb
        WHERE id = ${id}
        RETURNING *
      `
      : await sql`
        UPDATE research_tasks
        SET status = ${status}
        WHERE id = ${id}
        RETURNING *
      `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function assignTask(
  id: string,
  userId: string,
  agentName?: string,
): Promise<ResearchTask | null> {
  if (!isDatabaseAvailable() || !sql) {
    const task = memoryTasks.get(id);
    if (!task) return null;
    task.assignedTo = userId;
    if (agentName) task.assignedAgent = agentName;
    return task;
  }

  const rows = await sql`
    UPDATE research_tasks
    SET assigned_to = ${userId}, assigned_agent = ${agentName ?? null}
    WHERE id = ${id}
    RETURNING *
  `;
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function deleteTask(id: string, userId: string): Promise<boolean> {
  if (!isDatabaseAvailable() || !sql) {
    const task = memoryTasks.get(id);
    if (!task || task.createdBy !== userId) return false;
    memoryTasks.delete(id);
    return true;
  }

  const rows = await sql`
    DELETE FROM research_tasks WHERE id = ${id} AND created_by = ${userId} RETURNING id
  `;
  return rows.length > 0;
}
