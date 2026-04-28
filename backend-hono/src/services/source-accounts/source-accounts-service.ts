// [claude-code 2026-04-12] Source accounts CRUD service — curated X accounts for timeline polling
// [claude-code 2026-04-24] S34-T5: TTL tightened to 30s so Refinement Engine edits take effect
// by the next tier tick without a backend restart. Added getWireHandles / getMacroHandles for
// news-worker DB-driven handle wiring.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import {
  DEFAULT_SOURCE_ACCOUNTS,
  type SourceAccount,
  type SourceAccountCategory,
  type SourceAccountMethod,
} from "../../types/source-account.js";

const log = createLogger("SourceAccountsService");

let cache: SourceAccount[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL = 30_000; // 30s — UI edits reflect in the next tier tick

function clearCache(): void {
  cache = [];
  cacheLoadedAt = 0;
}

export async function getAccounts(): Promise<SourceAccount[]> {
  if (Date.now() - cacheLoadedAt < CACHE_TTL && cache.length > 0) {
    return cache;
  }

  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("riskflow_source_accounts")
    .select("*")
    .order("category")
    .order("handle");

  if (error) {
    log.warn("Failed to read source accounts", { error: error.message });
    return [];
  }

  // Seed defaults if table is empty
  if (!data || data.length === 0) {
    log.info("Source accounts table empty — seeding defaults");
    for (const account of DEFAULT_SOURCE_ACCOUNTS) {
      await sb.from("riskflow_source_accounts").upsert(
        {
          handle: account.handle,
          display_name: account.display_name,
          category: account.category,
          method: account.method,
          active: account.active,
        },
        { onConflict: "handle" },
      );
    }
    const { data: seeded } = await sb
      .from("riskflow_source_accounts")
      .select("*")
      .order("category")
      .order("handle");
    cache = (seeded ?? []) as SourceAccount[];
    cacheLoadedAt = Date.now();
    return cache;
  }

  cache = data as SourceAccount[];
  cacheLoadedAt = Date.now();
  return cache;
}

export async function getActiveAccounts(): Promise<SourceAccount[]> {
  const all = await getAccounts();
  return all.filter((a) => a.active);
}

export async function getAccountHandles(): Promise<string[]> {
  const active = await getActiveAccounts();
  return active.map((a) => a.handle);
}

export async function getWireHandles(): Promise<string[]> {
  const active = await getActiveAccounts();
  return active.filter((a) => a.category === "Wire").map((a) => a.handle);
}

export async function getMacroHandles(): Promise<string[]> {
  const active = await getActiveAccounts();
  return active.filter((a) => a.category === "Macro").map((a) => a.handle);
}

export async function addAccount(
  handle: string,
  displayName: string | null,
  category: SourceAccountCategory,
  method: SourceAccountMethod = "rettiwt",
): Promise<SourceAccount | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("riskflow_source_accounts")
    .insert({
      handle: handle.replace(/^@/, ""),
      display_name: displayName,
      category,
      method,
    })
    .select()
    .single();

  if (error) {
    log.warn("Failed to add source account", { error: error.message });
    return null;
  }

  clearCache();
  return data as SourceAccount;
}

export async function updateAccount(
  id: string,
  fields: Partial<
    Pick<SourceAccount, "handle" | "display_name" | "category" | "method" | "active">
  >,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb
    .from("riskflow_source_accounts")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    log.warn("Failed to update source account", { error: error.message });
  }
  clearCache();
}

export async function removeAccount(id: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb
    .from("riskflow_source_accounts")
    .delete()
    .eq("id", id);

  if (error) {
    log.warn("Failed to remove source account", { error: error.message });
  }
  clearCache();
}

/**
 * Fire-and-forget mandatory rescore when scoring-affecting config changes.
 * Uses the lightweight in-memory feed rescore; does NOT block the caller.
 */
export function triggerMandatoryRescore(reason: string): void {
  Promise.resolve().then(async () => {
    try {
      const { rescoreInMemoryFeed } = await import(
        "../riskflow/feed-service.js"
      );
      const count = await rescoreInMemoryFeed();
      log.info("Mandatory rescore completed", { reason, count });
    } catch (err) {
      log.warn("Mandatory rescore failed", {
        reason,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
