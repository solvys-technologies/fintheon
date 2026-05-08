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

function pairKey(filter: Pick<EconWatchFilter, "country" | "category" | "user_id">): string {
  return `${String(filter.user_id ?? "global")}:${String(filter.country).toUpperCase()}:${filter.category}`;
}

function normalizeCountry(country: EconWatchCountry | string): string {
  return String(country).trim().toUpperCase();
}

function normalizeFilters(filters: EconWatchFilter[]): EconWatchFilter[] {
  const byPair = new Map<string, EconWatchFilter>();
  for (const filter of filters) {
    const normalized = {
      ...filter,
      country: normalizeCountry(filter.country),
    };
    const key = pairKey(normalized);
    const existing = byPair.get(key);
    if (!existing) {
      byPair.set(key, normalized);
      continue;
    }
    const existingTs = Date.parse(existing.updated_at ?? existing.created_at ?? "");
    const nextTs = Date.parse(normalized.updated_at ?? normalized.created_at ?? "");
    if (!Number.isFinite(existingTs) || nextTs >= existingTs) {
      byPair.set(key, normalized);
    }
  }
  return [...byPair.values()];
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
    cache = normalizeFilters((seeded ?? []) as EconWatchFilter[]);
    cacheLoadedAt = Date.now();
    return cache;
  }

  cache = normalizeFilters(data as EconWatchFilter[]);
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

  const normalizedCountry = normalizeCountry(country);
  const { data: existing, error: readError } = await sb
    .from("econ_watch_filters")
    .select("*")
    .eq("country", normalizedCountry)
    .eq("category", category)
    .is("user_id", null)
    .order("updated_at", { ascending: false });

  if (readError) {
    log.warn("Failed to read existing econ-watch filter", {
      error: readError.message,
    });
  }

  if (existing && existing.length > 0) {
    const ids = existing.map((row) => row.id).filter(Boolean);
    const { data, error } = await sb
      .from("econ_watch_filters")
      .update({ active, updated_at: new Date().toISOString() })
      .in("id", ids)
      .select()
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      log.warn("Failed to reactivate econ-watch filter", {
        error: error.message,
      });
      return null;
    }

    clearCache();
    return data as EconWatchFilter;
  }

  const { data, error } = await sb
    .from("econ_watch_filters")
    .insert({ country: normalizedCountry, category, active, user_id: null })
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

  const { data: existing, error: readError } = await sb
    .from("econ_watch_filters")
    .select("id,country,category,user_id")
    .eq("id", id)
    .maybeSingle();

  if (readError || !existing) {
    log.warn("Failed to read econ-watch filter before update", {
      error: readError?.message ?? "not found",
      id,
    });
    return;
  }

  const nextCountry =
    fields.country !== undefined ? normalizeCountry(fields.country) : undefined;
  const updateFields = {
    ...fields,
    ...(nextCountry ? { country: nextCountry } : {}),
    updated_at: new Date().toISOString(),
  };

  const targetCountry = normalizeCountry(
    nextCountry ?? String(existing.country),
  );
  const targetCategory = String(fields.category ?? existing.category);
  const query = sb
    .from("econ_watch_filters")
    .update(updateFields)
    .eq("country", String(existing.country))
    .eq("category", String(existing.category));
  const scopedQuery =
    existing.user_id == null
      ? query.is("user_id", null)
      : query.eq("user_id", existing.user_id);

  const { error } = await scopedQuery;

  if (!error && (nextCountry || fields.category)) {
    await collapseDuplicatePair(targetCountry, targetCategory);
  }

  if (error) {
    log.warn("Failed to update econ-watch filter", { error: error.message });
  }
  clearCache();
}

export async function removeFilter(id: string): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;

  const { data: existing, error: readError } = await sb
    .from("econ_watch_filters")
    .select("country,category,user_id")
    .eq("id", id)
    .maybeSingle();

  if (readError || !existing) {
    log.warn("Failed to read econ-watch filter before delete", {
      error: readError?.message ?? "not found",
      id,
    });
    return;
  }

  const query = sb
    .from("econ_watch_filters")
    .delete()
    .eq("country", existing.country)
    .eq("category", existing.category);
  const scopedQuery =
    existing.user_id == null
      ? query.is("user_id", null)
      : query.eq("user_id", existing.user_id);
  const { error } = await scopedQuery;

  if (error) {
    log.warn("Failed to remove econ-watch filter", { error: error.message });
  }
  clearCache();
}

async function collapseDuplicatePair(
  country: string,
  category: string,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const { data } = await sb
    .from("econ_watch_filters")
    .select("id,updated_at,created_at")
    .eq("country", country)
    .eq("category", category)
    .is("user_id", null)
    .order("updated_at", { ascending: false });
  const ids = (data ?? []).map((row) => row.id).filter(Boolean);
  if (ids.length <= 1) return;
  await sb.from("econ_watch_filters").delete().in("id", ids.slice(1));
}
