// [codex 2026-05-17] Agent learning intake + velocity summaries.
import { Hono } from "hono";
import { z } from "zod";
import { getSupabaseClient } from "../../config/supabase.js";
import { addMemory } from "../../services/agent-memory/memory-store.js";
import type { AgentId, MemoryType } from "../../services/agent-memory/types.js";
import { recordAgentReflection } from "../../services/ai/agent-instructions/fileroom-prompt-vault.js";
import { clearAgentSystemPromptCache } from "../../services/ai/agent-instructions/index.js";

const agentIds = ["harper", "oracle", "feucht", "consul", "herald"] as const;
const memoryTypes = [
  "deliberation_output",
  "accuracy_feedback",
  "reflect_finding",
  "learned_pattern",
] as const;

const learningInput = z.object({
  agentId: z.enum(agentIds),
  topic: z.string().trim().min(1).max(160).optional(),
  insight: z.string().trim().min(1).max(4000),
  confidence: z.number().min(0).max(1).optional(),
  memoryType: z.enum(memoryTypes).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  ttlHours: z
    .number()
    .positive()
    .max(24 * 365)
    .nullable()
    .optional(),
});

function clampLimit(raw: string | undefined, fallback = 50): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(250, Math.max(1, parsed));
}

function parseDays(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(90, Math.max(1, parsed));
}

export function createAgentLearningRoutes(): Hono {
  const router = new Hono();

  router.post("/learning", async (c) => {
    const parsed = learningInput.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return c.json(
        {
          ok: false,
          error: "Invalid learning payload",
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const input = parsed.data;
    const memory = await addMemory({
      agentId: input.agentId,
      memoryType: input.memoryType ?? "learned_pattern",
      content: input.topic ? `${input.topic}: ${input.insight}` : input.insight,
      metadata: {
        source: "api.agent.learning",
        confidence: input.confidence ?? null,
        topic: input.topic ?? null,
        ...(input.metadata ?? {}),
      },
      ttlHours: input.ttlHours ?? null,
    });

    if (!memory) {
      return c.json({ ok: false, error: "Learning was not stored" }, 500);
    }

    await recordAgentReflection({
      agentId: input.agentId,
      topic: input.topic ?? input.memoryType ?? "agent-learning",
      insight: input.insight,
      confidence: input.confidence ?? null,
      metadata: {
        memoryType: input.memoryType ?? "learned_pattern",
        ...(input.metadata ?? {}),
      },
    }).catch(() => null);
    clearAgentSystemPromptCache();

    return c.json({ ok: true, memory });
  });

  router.get("/learning/summary", async (c) => {
    const days = parseDays(c.req.query("days"));
    const since = new Date(Date.now() - days * 24 * 3600_000).toISOString();
    const sb = getSupabaseClient();

    if (!sb) {
      return c.json({
        days,
        since,
        totals: [],
        recent: [],
        warning:
          "Supabase unavailable; only in-process fallback memories exist.",
      });
    }

    const [
      { data: allRows, error: allError },
      { data: recentRows, error: recentError },
    ] = await Promise.all([
      sb
        .from("agent_memory")
        .select("agent_id,memory_type,created_at")
        .gte("created_at", since),
      sb
        .from("agent_memory")
        .select("agent_id,memory_type,content,metadata,created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(clampLimit(c.req.query("limit"), 25)),
    ]);

    if (allError || recentError) {
      return c.json(
        {
          days,
          since,
          error:
            allError?.message ??
            recentError?.message ??
            "Failed to load memories",
        },
        500,
      );
    }

    const totals = new Map<
      string,
      {
        agentId: AgentId;
        memoryType: MemoryType;
        count: number;
        latest: string | null;
      }
    >();

    for (const row of allRows ?? []) {
      const agentId = row.agent_id as AgentId;
      const memoryType = row.memory_type as MemoryType;
      const key = `${agentId}:${memoryType}`;
      const existing = totals.get(key) ?? {
        agentId,
        memoryType,
        count: 0,
        latest: null,
      };
      existing.count += 1;
      if (!existing.latest || String(row.created_at) > existing.latest) {
        existing.latest = String(row.created_at);
      }
      totals.set(key, existing);
    }

    return c.json({
      days,
      since,
      totals: [...totals.values()].sort((a, b) =>
        `${a.agentId}:${a.memoryType}`.localeCompare(
          `${b.agentId}:${b.memoryType}`,
        ),
      ),
      recent: recentRows ?? [],
    });
  });

  return router;
}
