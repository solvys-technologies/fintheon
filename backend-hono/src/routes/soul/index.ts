// [claude-code 2026-05-07] Fileroom soul card editor — read/write agent SOUL.md files from the Apparatus Fileroom.
import { Hono } from "hono";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("SoulRoutes");

const VALID_AGENTS = [
  "harper",
  "oracle",
  "feucht",
  "consul",
  "herald",
] as const;
const SOUL_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../services/ai/soul",
);

interface SoulMeta {
  agent_id: string;
  name: string;
  role: string;
  model_prefer?: string;
}

export function createSoulRoutes(): Hono {
  const app = new Hono();

  // GET /api/souls — list all agent souls with metadata
  app.get("/", async (c) => {
    try {
      const souls: SoulMeta[] = [];
      for (const agentId of VALID_AGENTS) {
        const filePath = join(SOUL_DIR, `${agentId}.md`);
        try {
          const raw = await readFile(filePath, "utf-8");
          const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---/);
          if (!frontmatterMatch) continue;
          const fm = frontmatterMatch[1];
          const nameMatch = fm.match(/name:\s*(.+)/);
          const roleMatch = fm.match(/role:\s*(.+)/);
          const modelMatch = fm.match(/prefer:\s*(.+)/);
          souls.push({
            agent_id: agentId,
            name: nameMatch?.[1]?.trim() ?? agentId,
            role: roleMatch?.[1]?.trim() ?? "Agent",
            model_prefer: modelMatch?.[1]?.trim() ?? undefined,
          });
        } catch {
          continue;
        }
      }
      return c.json({ souls });
    } catch (err) {
      log.error("Failed to list souls", { error: String(err) });
      return c.json({ souls: [], error: "soul listing unavailable" }, 500);
    }
  });

  // GET /api/soul/:agentId — get raw content of a soul file
  app.get("/:agentId", async (c) => {
    try {
      const agentId = c.req.param("agentId");
      if (!VALID_AGENTS.includes(agentId as (typeof VALID_AGENTS)[number])) {
        return c.json({ error: `Unknown agent: ${agentId}` }, 404);
      }
      const filePath = join(SOUL_DIR, `${agentId}.md`);
      const raw = await readFile(filePath, "utf-8");
      return c.json({ agent_id: agentId, content: raw });
    } catch (err) {
      log.error("Failed to read soul file", { error: String(err) });
      return c.json({ error: "soul file unavailable" }, 500);
    }
  });

  // PUT /api/soul/:agentId — update a soul file (auth-gated at route level)
  app.put("/:agentId", async (c) => {
    try {
      const agentId = c.req.param("agentId");
      if (!VALID_AGENTS.includes(agentId as (typeof VALID_AGENTS)[number])) {
        return c.json({ error: `Unknown agent: ${agentId}` }, 404);
      }
      const body = await c.req.json<{ content: string }>();
      if (!body.content || typeof body.content !== "string") {
        return c.json({ error: "content is required" }, 400);
      }
      const filePath = join(SOUL_DIR, `${agentId}.md`);
      await writeFile(filePath, body.content, "utf-8");
      log.info(`Soul file updated: ${agentId}`);
      return c.json({ ok: true, agent_id: agentId });
    } catch (err) {
      log.error("Failed to write soul file", { error: String(err) });
      return c.json({ error: "soul file write failed" }, 500);
    }
  });

  return app;
}
