// [claude-code 2026-05-07] S61-T1: Audit logger — writes to Supabase with JSONL fallback
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { homedir } from "node:os";
import { createLogger } from "../lib/logger.js";
import { getSupabaseClient } from "../config/supabase.js";
import type {
  AuditRecord,
  AuditQueryFilters,
  AuditLogInput,
} from "../types/audit.js";

const log = createLogger("AuditLogger");

const FINTHEON_DIR = resolve(homedir(), ".fintheon");
const AUDIT_LOG_FILE = resolve(FINTHEON_DIR, "audit-log.jsonl");

async function ensureAuditDir(): Promise<void> {
  try {
    await mkdir(FINTHEON_DIR, { recursive: true });
  } catch {
    /* exists */
  }
}

async function appendJsonlLine(data: Record<string, unknown>): Promise<void> {
  await ensureAuditDir();
  const line = JSON.stringify(data) + "\n";
  await appendFile(AUDIT_LOG_FILE, line, "utf8");
}

export async function logAuditDecision(record: AuditLogInput): Promise<void> {
  const entry = {
    ...record,
    logged_at: new Date().toISOString(),
  };

  const createdBy = (record as Record<string, unknown>).created_by ?? "system";

  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { error } = await sb.from("agent_audit_log").insert({
        agent_id: record.agent_id,
        tool_name: record.tool_name,
        tool_input: record.tool_input ?? {},
        description: record.description ?? null,
        decision: record.decision,
        reason: record.reason ?? null,
        surface: record.surface ?? "chat",
        correlation_id: record.correlation_id ?? null,
        created_by: createdBy as string,
      });

      if (error) {
        log.warn("Supabase audit write failed, falling back to JSONL", {
          error: error.message,
        });
        await appendJsonlLine(entry);
      }
    } else {
      log.info("Supabase unavailable, writing audit to JSONL fallback");
      await appendJsonlLine(entry);
    }
  } catch (err) {
    log.error("Audit log write error", { error: String(err) });
    try {
      await appendJsonlLine(entry);
    } catch {
      log.error("JSONL fallback write also failed");
    }
  }
}

export async function queryAuditLog(
  filters?: AuditQueryFilters,
): Promise<{ rows: AuditRecord[]; total: number }> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      let query = sb
        .from("agent_audit_log")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .limit(filters?.limit ?? 50)
        .range(
          filters?.offset ?? 0,
          (filters?.offset ?? 0) + (filters?.limit ?? 50) - 1,
        );

      if (filters?.agentId) query = query.eq("agent_id", filters.agentId);
      if (filters?.surface) query = query.eq("surface", filters.surface);
      if (filters?.decision) query = query.eq("decision", filters.decision);

      const { data, error, count } = await query;

      if (!error && data) {
        const rows: AuditRecord[] = (data as unknown[]).map((row: any) => ({
          id: row.id,
          agent_id: row.agent_id,
          tool_name: row.tool_name,
          tool_input: row.tool_input ?? {},
          description: row.description ?? null,
          decision: row.decision,
          reason: row.reason ?? null,
          surface: row.surface ?? "chat",
          correlation_id: row.correlation_id ?? null,
          created_at: row.created_at,
          created_by: row.created_by ?? "system",
        }));
        return { rows, total: count ?? rows.length };
      }

      log.warn("Supabase audit query failed, falling back to JSONL scan", {
        error: error?.message ?? "unknown",
      });
    }
  } catch (err) {
    log.warn("Supabase audit query error, falling back to JSONL scan", {
      error: String(err),
    });
  }

  // JSONL fallback scan
  const rows: AuditRecord[] = [];
  try {
    const raw = await readFile(AUDIT_LOG_FILE, "utf8");
    const lines = raw.trim().split("\n").filter(Boolean);
    for (const line of lines.reverse()) {
      try {
        const parsed = JSON.parse(line);
        // Apply client-side filters
        if (filters?.agentId && parsed.agent_id !== filters.agentId) continue;
        if (filters?.surface && parsed.surface !== filters.surface) continue;
        if (filters?.decision && parsed.decision !== filters.decision) continue;
        rows.push({
          agent_id: parsed.agent_id,
          tool_name: parsed.tool_name,
          tool_input: parsed.tool_input ?? {},
          description: parsed.description ?? null,
          decision: parsed.decision,
          reason: parsed.reason ?? null,
          surface: parsed.surface ?? "chat",
          correlation_id: parsed.correlation_id ?? null,
          created_at: parsed.logged_at ?? parsed.created_at,
          created_by: parsed.created_by ?? "system",
        });
      } catch {
        // skip malformed lines
      }
    }
  } catch {
    // file doesn't exist yet
  }

  const total = rows.length;
  const sliced = rows.slice(
    filters?.offset ?? 0,
    (filters?.offset ?? 0) + (filters?.limit ?? 50),
  );
  return { rows: sliced, total };
}

export async function getAuditRecordById(
  id: number,
): Promise<AuditRecord | null> {
  try {
    const sb = getSupabaseClient();
    if (sb) {
      const { data, error } = await sb
        .from("agent_audit_log")
        .select("*")
        .eq("id", id)
        .single();

      if (!error && data) {
        const row = data as Record<string, unknown>;
        return {
          id: row.id as number,
          agent_id: row.agent_id as string,
          tool_name: row.tool_name as string,
          tool_input: (row.tool_input as Record<string, unknown>) ?? {},
          description: (row.description as string) ?? null,
          decision: row.decision as AuditRecord["decision"],
          reason: (row.reason as string) ?? null,
          surface: (row.surface as string) ?? "chat",
          correlation_id: (row.correlation_id as string) ?? null,
          created_at: row.created_at as string,
          created_by: (row.created_by as string) ?? "system",
        };
      }
    }
  } catch {
    // fall through to JSONL
  }

  // JSONL fallback — scan for id (unlikely to find by auto-increment id in JSONL)
  return null;
}
