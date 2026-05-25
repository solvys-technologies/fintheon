// [codex 2026-05-17] Export agent learning rows into an Obsidian-friendly vault.
import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import pg from "pg";

const { Client } = pg;

const agentLabels: Record<string, string> = {
  harper: "Harper",
  oracle: "Oracle",
  feucht: "Feucht",
  consul: "Consul",
  herald: "Herald",
};

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function vaultPath(): string {
  return resolve(
    arg("vault") ??
      process.env.OBSIDIAN_VAULT_PATH ??
      join(homedir(), "Documents", "Obsidian", "Fintheon-Agent-Learning"),
  );
}

function daysBack(): number {
  const parsed = Number.parseInt(arg("days") ?? "7", 10);
  return Number.isFinite(parsed) ? Math.min(90, Math.max(1, parsed)) : 7;
}

function dateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function safeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function frontmatter(data: Record<string, unknown>): string {
  const lines = Object.entries(data).map(([key, value]) => {
    if (Array.isArray(value)) return `${key}: [${value.join(", ")}]`;
    return `${key}: ${JSON.stringify(value)}`;
  });
  return `---\n${lines.join("\n")}\n---`;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.NEON_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL or NEON_DATABASE_URL is required");
  }

  const days = daysBack();
  const vault = vaultPath();
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const { rows } = await client.query<{
    agent_id: string;
    memory_type: string;
    content: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>(
    `SELECT agent_id, memory_type, content, metadata, created_at
       FROM agent_memory
      WHERE created_at >= NOW() - ($1::int * INTERVAL '1 day')
      ORDER BY created_at DESC`,
    [days],
  );

  const root = join(vault, "Fintheon Agents");
  await mkdir(join(root, "Daily"), { recursive: true });
  await mkdir(join(root, "Agents"), { recursive: true });

  const generatedAt = new Date();
  const byAgent = new Map<string, typeof rows>();
  for (const row of rows) {
    const list = byAgent.get(row.agent_id) ?? [];
    list.push(row);
    byAgent.set(row.agent_id, list);
  }

  const summary = [
    frontmatter({
      generated: generatedAt.toISOString(),
      project: "Fintheon",
      window_days: days,
      total_memories: rows.length,
      tags: ["fintheon", "agent-learning", "weekly-review"],
    }),
    "",
    `# Agent Learning Review — ${dateStamp(generatedAt)}`,
    "",
    `Window: last ${days} day(s)`,
    "",
    "## Velocity",
    "",
    "| Agent | Memories | Latest |",
    "| --- | ---: | --- |",
    ...Object.keys(agentLabels).map((agentId) => {
      const list = byAgent.get(agentId) ?? [];
      return `| [[${agentLabels[agentId]} Learning]] | ${list.length} | ${list[0]?.created_at ?? "none"} |`;
    }),
    "",
    "## Recent Memories",
    "",
    ...rows.map((row) =>
      [
        `### ${agentLabels[row.agent_id] ?? row.agent_id} · ${row.memory_type}`,
        "",
        `Created: ${row.created_at}`,
        "",
        safeText(row.content),
        "",
      ].join("\n"),
    ),
  ].join("\n");

  await writeFile(
    join(root, "Daily", `${dateStamp(generatedAt)} Agent Learning Review.md`),
    summary,
  );

  for (const [agentId, label] of Object.entries(agentLabels)) {
    const list = byAgent.get(agentId) ?? [];
    const body = [
      frontmatter({
        agent: agentId,
        generated: generatedAt.toISOString(),
        tags: ["fintheon", "agent-learning", agentId],
      }),
      "",
      `# ${label} Learning`,
      "",
      `Recent memories: ${list.length}`,
      "",
      ...list.map((row) =>
        [
          `## ${row.memory_type} · ${row.created_at}`,
          "",
          safeText(row.content),
          "",
        ].join("\n"),
      ),
    ].join("\n");
    await writeFile(join(root, "Agents", `${label} Learning.md`), body);
  }

  await client.end();
  console.log(`Exported ${rows.length} memories to ${root}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
