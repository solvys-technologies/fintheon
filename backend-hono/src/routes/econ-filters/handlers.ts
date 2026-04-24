// [claude-code 2026-04-24] S34-T1: /api/econ-filters handlers — list / create /
// toggle+patch / delete. Country+category validated against the narrowed
// unions to keep the UI dropdowns and the populator (T3) aligned.

import type { Context } from "hono";
import {
  getFilters,
  addFilter,
  updateFilter,
  removeFilter,
} from "../../services/econ-watch-filters/econ-watch-filters-service.js";
import {
  ECON_WATCH_CATEGORIES,
  ECON_WATCH_COUNTRIES,
  type EconWatchCategory,
  type EconWatchCountry,
} from "../../types/econ-watch-filter.js";

// GET /api/econ-filters
export async function handleGetFilters(c: Context) {
  const filters = await getFilters();
  return c.json({ filters });
}

// POST /api/econ-filters
export async function handleAddFilter(c: Context) {
  const body = await c.req.json<{
    country?: string;
    category?: string;
    active?: boolean;
  }>();

  const country = (body.country ?? "").trim();
  const category = (body.category ?? "").trim();

  if (!country || !category) {
    return c.json({ error: "country and category are required" }, 400);
  }

  if (!ECON_WATCH_COUNTRIES.includes(country as EconWatchCountry)) {
    return c.json(
      {
        error: `Invalid country. Must be one of: ${ECON_WATCH_COUNTRIES.join(", ")}`,
      },
      400,
    );
  }
  if (!ECON_WATCH_CATEGORIES.includes(category as EconWatchCategory)) {
    return c.json(
      {
        error: `Invalid category. Must be one of: ${ECON_WATCH_CATEGORIES.join(", ")}`,
      },
      400,
    );
  }

  const filter = await addFilter(country, category, body.active ?? true);
  if (!filter) {
    return c.json({ error: "Failed to add econ-watch filter" }, 500);
  }
  return c.json({ filter }, 201);
}

// PATCH /api/econ-filters/:id  (used for toggle)
// PUT  /api/econ-filters/:id   (full update alias)
export async function handleUpdateFilter(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  const body = await c.req
    .json<Record<string, unknown>>()
    .catch(() => ({}) as Record<string, unknown>);
  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (typeof body.country === "string") {
    if (!ECON_WATCH_COUNTRIES.includes(body.country as EconWatchCountry)) {
      return c.json({ error: "Invalid country" }, 400);
    }
    patch.country = body.country;
  }
  if (typeof body.category === "string") {
    if (!ECON_WATCH_CATEGORIES.includes(body.category as EconWatchCategory)) {
      return c.json({ error: "Invalid category" }, 400);
    }
    patch.category = body.category;
  }
  if (Object.keys(patch).length === 0) {
    return c.json({ error: "No valid fields to update" }, 400);
  }

  await updateFilter(id, patch);
  return c.json({ ok: true });
}

// DELETE /api/econ-filters/:id
export async function handleDeleteFilter(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  await removeFilter(id);
  return c.json({ ok: true });
}
