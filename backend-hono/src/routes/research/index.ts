// [claude-code 2026-03-31] S12-T3: Research task board routes

import { Hono } from "hono";
import type { Context } from "hono";
import {
  createTask,
  listTasks,
  getTask,
  updateTaskStatus,
  assignTask,
  deleteTask,
} from "../../services/research/task-board.js";

function getUserId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  if (!userId || userId === "anon") return null;
  return userId;
}

export function createResearchRoutes(): Hono {
  const router = new Hono();

  // POST /tasks — create a new research task
  router.post("/tasks", async (c) => {
    const body = await c.req.json();
    const userId = getUserId(c);

    if (!body.title) {
      return c.json({ error: "title is required" }, 400);
    }

    const task = await createTask({
      title: body.title,
      narrative: body.narrative ?? null,
      assignedTo: body.assignedTo ?? null,
      assignedAgent: body.assignedAgent ?? null,
      deskId: body.deskId ?? null,
      dueDate: body.dueDate ?? null,
      createdBy: body.createdBy || userId || "anonymous",
    });

    return c.json({ task }, 201);
  });

  // GET /tasks — list tasks with optional filters
  router.get("/tasks", async (c) => {
    const deskId = c.req.query("deskId") || undefined;
    const status = c.req.query("status") || undefined;
    const assignedTo = c.req.query("assignedTo") || undefined;

    const tasks = await listTasks({ deskId, status, assignedTo });
    return c.json({ tasks });
  });

  // GET /tasks/:id — get a single task
  router.get("/tasks/:id", async (c) => {
    const task = await getTask(c.req.param("id"));
    if (!task) return c.json({ error: "Task not found" }, 404);
    return c.json({ task });
  });

  // PUT /tasks/:id — update status and/or findings
  router.put("/tasks/:id", async (c) => {
    const body = await c.req.json();
    const { status, findings } = body;

    if (!status && findings === undefined) {
      return c.json({ error: "status or findings required" }, 400);
    }

    try {
      const task = await updateTaskStatus(c.req.param("id"), status, findings);
      if (!task) return c.json({ error: "Task not found" }, 404);
      return c.json({ task });
    } catch (err) {
      return c.json({ error: (err as Error).message }, 400);
    }
  });

  // POST /tasks/:id/assign — assign to peer
  router.post("/tasks/:id/assign", async (c) => {
    const body = await c.req.json();
    if (!body.userId) {
      return c.json({ error: "userId is required" }, 400);
    }

    const task = await assignTask(
      c.req.param("id"),
      body.userId,
      body.agentName,
    );
    if (!task) return c.json({ error: "Task not found" }, 404);
    return c.json({ task });
  });

  // DELETE /tasks/:id — delete task (creator only)
  router.delete("/tasks/:id", async (c) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const deleted = await deleteTask(c.req.param("id"), userId);
    if (!deleted) {
      return c.json({ error: "Task not found or not authorized" }, 404);
    }
    return c.json({ ok: true });
  });

  return router;
}
