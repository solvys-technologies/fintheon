import { appendFile, mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { createLogger } from "../lib/logger.js";
import { getSupabaseClient } from "../config/supabase.js";
import type { MutationContract, AuditDecision, AuditRecord, AuditQueryFilters } from "../types/audit.js";

const log = createLogger("AuditLogger");

const FINTHEON_DIR = resolve(homedir(), ".fintheon");
const JSONL_PATH = resolve(FINTHEON_DIR, "audit-log.jsonl");

async function ensureDir(): Promise<void> {
  try {
    await mkdir(FINTHEON_DIR, { recursive: true });
  } catch {
    /* exists */
  }
}

async function appendToJsonl(record: MutationContract, decision: AuditDecision): Promise<void> {
  await ensureDir();
  const line = JSON.stringify({
    ...record,
    ...decision,
    logged_at: new Date().toISOString(),
  });
  await appendFile(JSONL_PATH, line + "\n", "utf8");
}

export async function logAuditDecision(
  record: MutationContract,
  decision: AuditDecision,
): Promise<void> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { error } = await supabase.from("agent_audit_log").insert({
      agent_id: record.agent_id,
      tool_name: record.tool_name,
      tool_input: record.tool_input,
      description: record.description,
      surface: record.surface,
      correlation_id: record.correlation_id,
      decision: decision.decision,
      reason: decision.reason,
    });

    if (!error) return;

    log.warn("Supabase audit write failed, falling back to JSONL", {
      error: error.message,
    });
  }

  try {
    await appendToJsonl(record, decision);
  } catch (err) {
    log.error("JSONL fallback write failed", { error: String(err) });
  }
}

async function scanJsonl(filters: AuditQueryFilters): Promise<AuditRecord[]> {
  const rows: AuditRecord[] = [];

  try {
    const rl = createInterface({
      input: createReadStream(JSONL_PATH, { encoding: "utf8" }),
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line) as AuditRecord;
        if (filters.agentId && row.agent_id !== filters.agentId) continue;
        if (filters.surface && row.surface !== filters.surface) continue;
        if (filters.decision && row.decision !== filters.decision) continue;
        rows.push(row);
      } catch {
        /* malformed line — skip */
      }
    }
  } catch {
    /* file may not exist yet */
  }

  return rows;
}

export async function queryAuditLog(
  filters: AuditQueryFilters,
): Promise<{ rows: AuditRecord[]; total: number }> {
  const supabase = getSupabaseClient();

  if (supabase) {
    let query = supabase
      .from("agent_audit_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(filters.offset, filters.offset + filters.limit - 1);

    if (filters.agentId) query = query.eq("agent_id", filters.agentId);
    if (filters.surface) query = query.eq("surface", filters.surface);
    if (filters.decision) query = query.eq("decision", filters.decision);

    const { data, count, error } = await query;

    if (!error) {
      return { rows: (data as AuditRecord[]) ?? [], total: count ?? 0 };
    }

    log.warn("Supabase audit query failed, falling back to JSONL", {
      error: error.message,
    });
  }

  const all = await scanJsonl(filters);
  const total = all.length;
  const rows = all.slice(filters.offset, filters.offset + filters.limit);
  return { rows, total };
}

export async function getAuditRecord(id: string): Promise<AuditRecord | null> {
  const supabase = getSupabaseClient();

  if (supabase) {
    const { data, error } = await supabase
      .from("agent_audit_log")
      .select("*")
      .eq("id", id)
      .single();

    if (!error && data) return data as AuditRecord;
    if (error) {
      log.warn("Supabase single record fetch failed, falling back to JSONL", {
        error: error.message,
      });
    }
  }

  const all = await scanJsonl({
    limit: 10_000,
    offset: 0,
  });
  return all.find((r) => r.id === id) ?? null;
}
