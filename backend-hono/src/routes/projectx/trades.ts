// [claude-code 2026-04-22] S29-T1: GET /api/projectx/trades — historical trade data for calendar heatmap

import { Hono } from "hono";
import { z } from "zod";
import { query } from "../../db/optimized.js";

const QuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  origin: z.enum(["all", "user", "autopilot"]).optional().default("all"),
});

interface TradeRow {
  id: string;
  contract: string;
  entry_at: string;
  exit_at: string | null;
  side: string;
  qty: number;
  entry_price: string;
  exit_price: string | null;
  realized_pnl: string;
  origin: string;
}

export function createProjectXTradesRoute() {
  const app = new Hono();

  app.get("/trades", async (c) => {
    const parsed = QuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const { from, to, origin } = parsed.data;
    const originClause = origin === "all" ? "" : "AND origin = $3";
    const params = origin === "all" ? [from, to] : [from, to, origin];

    const result = await query<TradeRow>(
      `SELECT id, contract, entry_at, exit_at, side, qty, entry_price, exit_price, realized_pnl, origin
       FROM trades
       WHERE entry_at >= $1 AND entry_at <= $2 ${originClause}
       ORDER BY entry_at DESC`,
      params,
    );

    return c.json({
      trades: result.rows.map((r) => ({
        id: r.id,
        contract: r.contract,
        entryAt: r.entry_at,
        exitAt: r.exit_at,
        side: r.side,
        qty: r.qty,
        entryPrice: parseFloat(r.entry_price),
        exitPrice: r.exit_price ? parseFloat(r.exit_price) : null,
        realizedPnL: parseFloat(r.realized_pnl),
        origin: r.origin,
      })),
      from,
      to,
    });
  });

  return app;
}
