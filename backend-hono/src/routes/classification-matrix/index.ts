// [claude-code 2026-04-19] S24-T1: classification_matrix routes — read rubric for all regimes, patch rubric per regime (super admin only).
import { Hono } from "hono";
import { sql, isDatabaseAvailable } from "../../config/database.js";
import { createLogger } from "../../lib/logger.js";
import {
  MARKET_REGIMES,
  type MarketRegime,
} from "../../types/regime.js";

const log = createLogger("ClassificationMatrix");

export function createClassificationMatrixRoutes(): Hono {
  const app = new Hono();

  // GET /api/classification-matrix
  app.get("/", async (c) => {
    if (!isDatabaseAvailable()) return c.json({ matrix: [], count: 0 });
    const rows = await sql`
      SELECT id, regime_type, rubric, active, updated_by, updated_at, created_at
      FROM classification_matrix
      WHERE active = TRUE
      ORDER BY regime_type ASC
    `;
    return c.json({ matrix: rows, count: rows.length });
  });

  // GET /api/classification-matrix/:regime — single rubric
  app.get("/:regime", async (c) => {
    if (!isDatabaseAvailable())
      return c.json({ error: "DB unavailable" }, 503);
    const regime = c.req.param("regime");
    if (!MARKET_REGIMES.includes(regime as MarketRegime)) {
      return c.json({ error: "Invalid regime" }, 400);
    }
    const rows = await sql`
      SELECT id, regime_type, rubric, active, updated_by, updated_at, created_at
      FROM classification_matrix WHERE regime_type = ${regime} LIMIT 1
    `;
    if (rows.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json(rows[0]);
  });

  // PATCH /api/classification-matrix/:regime — replace rubric (super admin only)
  // Body: { rubric: {...} }
  app.patch("/:regime", async (c) => {
    if (!isDatabaseAvailable())
      return c.json({ error: "DB unavailable" }, 503);
    const regime = c.req.param("regime");
    if (!MARKET_REGIMES.includes(regime as MarketRegime)) {
      return c.json({ error: "Invalid regime" }, 400);
    }
    const body = await c.req.json().catch(() => null);
    if (!body?.rubric || typeof body.rubric !== "object") {
      return c.json({ error: "Missing rubric object" }, 400);
    }
    const updatedBy = ((c.get as (k: string) => unknown)("email") as string | undefined) ?? "api";
    const rows = await sql`
      UPDATE classification_matrix
      SET rubric = ${JSON.stringify(body.rubric)}::jsonb,
          updated_by = ${updatedBy},
          updated_at = now()
      WHERE regime_type = ${regime}
      RETURNING id, regime_type, rubric, updated_by, updated_at
    `;
    if (rows.length === 0) return c.json({ error: "Not found" }, 404);
    log.info("Rubric updated", { regime, updatedBy });
    return c.json(rows[0]);
  });

  return app;
}
