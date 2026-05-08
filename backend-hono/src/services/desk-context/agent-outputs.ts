// [codex 2026-05-07] S61-T3: Recent per-agent output reader for desk context preflight.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import type { AgentId } from "../hermes/types.js";
import { getRecentEntries } from "../harper-autonomous/journal-store.js";
import { getOpsFeed } from "../harper-autonomous/ops-store.js";

const log = createLogger("desk-context");

type AgentOutputRow = {
  agent_id?: string | null;
  memory_type?: string | null;
  content?: string | null;
  created_at?: string | null;
};

type OpsLikeEntry = {
  title?: string;
  detail?: string;
  content?: string;
  metadata?: Record<string, unknown>;
  tags?: string[];
  createdAt?: string;
};

const AGENT_LABELS: Record<AgentId, string[]> = {
  harper: ["harper", "cao", "harper-cao"],
  oracle: ["oracle", "pma-merged"],
  feucht: ["feucht", "futures-desk"],
  consul: ["consul", "fundamentals-desk"],
  herald: ["herald"],
};

export async function getRecentOutputs(
  agentId: AgentId,
  hoursBack = 24,
): Promise<string[]> {
  const sinceMs = Date.now() - hoursBack * 60 * 60_000;
  const outputs: string[] = [];

  try {
    outputs.push(...(await readAgentMemoryOutputs(agentId, sinceMs)));
  } catch (err) {
    log.warn("agent_memory output read failed", {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    outputs.push(...(await readOpsOutputs(agentId, sinceMs)));
  } catch (err) {
    log.warn("ops/journal output read failed", {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return dedupe(outputs).slice(0, 8);
}

async function readAgentMemoryOutputs(
  agentId: AgentId,
  sinceMs: number,
): Promise<string[]> {
  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("agent_memory")
    .select("agent_id,memory_type,content,created_at")
    .eq("agent_id", agentId)
    .eq("memory_type", "deliberation_output")
    .gte("created_at", new Date(sinceMs).toISOString())
    .order("created_at", { ascending: false })
    .limit(6);

  if (error) {
    log.warn("agent_memory query failed", { agentId, error: error.message });
    return [];
  }

  return ((data ?? []) as AgentOutputRow[])
    .map((row) => formatOutput(agentId, row.created_at, row.content))
    .filter((line): line is string => Boolean(line));
}

async function readOpsOutputs(
  agentId: AgentId,
  sinceMs: number,
): Promise<string[]> {
  const [opsResult, journalEntries] = await Promise.all([
    getOpsFeed(60, 0).catch(() => ({ entries: [], total: 0 })),
    getRecentEntries(40).catch(() => []),
  ]);

  const opsLines = opsResult.entries
    .filter((entry) => matchesAgent(entry, agentId))
    .filter((entry) => isRecent(entry.createdAt, sinceMs))
    .map((entry) =>
      formatOutput(
        agentId,
        entry.createdAt,
        [entry.title, entry.detail].filter(Boolean).join(" -- "),
      ),
    );

  const journalLines = journalEntries
    .filter((entry) => matchesAgent(entry, agentId))
    .filter((entry) => isRecent(entry.createdAt, sinceMs))
    .map((entry) => formatOutput(agentId, entry.createdAt, entry.content));

  return [...opsLines, ...journalLines].filter(
    (line): line is string => Boolean(line),
  );
}

function matchesAgent(entry: OpsLikeEntry, agentId: AgentId): boolean {
  const labels = AGENT_LABELS[agentId];
  const metadata = entry.metadata ?? {};
  const metadataAgent = String(
    metadata.agentId ?? metadata.agent_id ?? metadata.agent ?? "",
  ).toLowerCase();
  if (labels.includes(metadataAgent)) return true;

  if (entry.tags?.some((tag) => labels.includes(tag.toLowerCase()))) {
    return true;
  }

  const text = [entry.title, entry.detail, entry.content]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return labels.some((label) => text.includes(label));
}

function isRecent(timestamp: string | undefined, sinceMs: number): boolean {
  if (!timestamp) return true;
  const parsed = Date.parse(timestamp);
  return Number.isFinite(parsed) && parsed >= sinceMs;
}

function formatOutput(
  agentId: AgentId,
  timestamp: string | null | undefined,
  content: string | null | undefined,
): string | null {
  const clean = normalizeLine(content ?? "");
  if (!clean) return null;
  const ts = timestamp ?? new Date().toISOString();
  return `[${ts}] ${agentId}: ${clean}`;
}

function normalizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 260);
}

function dedupe(lines: string[]): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const key = line.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
