// [claude-code 2026-04-24] S34-T1: Econ-watch filters CRUD + seed-on-empty.
// Mirrors source-accounts-service.ts (cache + seed + CRUD + clearCache). The
// populator (T3) reads getActiveFilters(); the UI hits /api/econ-filters.

import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import {
  DEFAULT_ECON_WATCH_FILTERS,
  type EconWatchCategory,
  type EconWatchCountry,
  type EconWatchFilter,
} from "../../types/econ-watch-filter.js";

const log = createLogger("EconWatchFiltersService");

let cache: EconWatchFilter[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL = 300_000; // 5 min

function clearCache(): void {
  cache = [];
  cacheLoadedAt = 0;
}

export async function getFilters(): Promise<EconWatchFilter[]> {
  if (Date.now() - cacheLoadedAt < CACHE_TTL && cache.length > 0) {
    return cache;
  }

  const sb = getSupabaseClient();
  if (!sb) return [];

  const { data, error } = await sb
    .from("econ_watch_filters")
    .select("*")
    .order("country")
    .order("category");

  if (error) {
    log.warn("Failed to read econ-watch filters", { error: error.message });
    return [];
  }

  if (!data || data.length === 0) {
    log.info("Econ-watch filters table empty — seeding defaults (28 rows)");
    for (const filter of DEFAULT_ECON_WATCH_FILTERS) {
      await sb.from("econ_watch_filters").upsert(
        {
          country: filter.country,
          category: filter.category,
          active: filter.active,
          user_id: filter.user_id,
        },
        { onConflict: "country,category,user_id" },
      );
    }
    const { data: seeded } = await sb
      .from("econ_watch_filters")
      .select("*")
      .order("country")
      .order("category");
    cache = (seeded ?? []) as EconWatchFilter[];
    cacheLoadedAt = Date.now();
    return cache;
  }

  cache = data as EconWatchFilter[];
  cacheLoadedAt = Date.now();
  return cache;
}

export async function getActiveFilters(): Promise<EconWatchFilter[]> {
  const all = await getFilters();
  return all.filter((f) => f.active);
}

export async function addFilter(
  country: EconWatchCountry | string,
  category: EconWatchCategory | string,
  active = true,
): Promise<EconWatchFilter | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;

  const { data, error } = await sb
    .from("econ_watch_filters")
    .insert({ country, category, active })
    .select()
    .single();

  if (error) {
    log.warn("Failed to add econ-watch filter", { error: error.message });
    return null;
  }

  clearCache();
  return data as EconWatchFilter;
}

export async function updateFilter(
  id: string,
  fields: Partial<Pick<EconWatchFilter, "country" | "category" | "active">>,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb
    .from("econ_watch_filters")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    log.warn("Failed to update econ-watch filter", { error: error.message });
  }
  clearCache();
}

export async function removeFilter(id: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { error } = await sb.from("econ_watch_filters").delete().eq("id", id);

  if (error) {
    log.warn("Failed to remove econ-watch filter", { error: error.message });
  }
  clearCache();
}
