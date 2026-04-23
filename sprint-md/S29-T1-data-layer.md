# Sprint Brief: S29-T1 — Data Layer + ProjectX Trades Sync

## Context

Fintheon's Performance tab is getting a Trading Calendar heatmap (à la ProjectX's monthly P&L view). The calendar needs **historical trade data** — and right now, `projectx-service.ts` only exposes live order placement, not history. This track builds the data layer: a new ProjectX `/trades` endpoint, a cadence sync that writes to Supabase, an `origin` column to distinguish agent-placed trades from user-placed trades, and a public API route the UI (T2) will consume.

You are working in **parallel** with three other Claude Desktop windows (T2 calendar UI, T3 chat modernize, T4 catalyst panel). **Do NOT touch any frontend files.** Your lane is strictly backend + migration.

## Branch Target

`feat/s29-t1-data-W`

Create it from `main`:

```bash
cd /Users/freethefranks/Documents/Fintheon
git checkout main && git pull
git checkout -b feat/s29-t1-data-W
```

## Scope — Included

- [ ] New Supabase migration: `supabase/migrations/20260422_trades_origin.sql` — adds `origin` column to `trades` table
- [ ] Extend `backend-hono/src/types/projectx.ts` with `ProjectXTrade` interface + Zod schema for validation at the ProjectX-response boundary
- [ ] Extend `backend-hono/src/services/projectx-service.ts` with `getTrades(accountId, from, to)` function that calls ProjectX `/trades` endpoint
- [ ] New file: `backend-hono/src/services/projectx-sync.ts` — cadence worker that polls ProjectX every 15 min, upserts into Supabase `trades` table
- [ ] Register sync worker in `backend-hono/src/boot/services.ts`
- [ ] New route: `backend-hono/src/routes/projectx/trades.ts` — `GET /api/projectx/trades?from&to&origin`
- [ ] Register new route in `backend-hono/src/routes/index.ts`
- [ ] Modify `backend-hono/src/services/autopilot/autopilot-scheduler.ts` — when autopilot places an order that fills, insert the trade with `origin='autopilot'`
- [ ] Append changelog entry to `src/lib/changelog.ts`

## Scope — Excluded (DO NOT TOUCH)

- Anything under `frontend/` (T2, T3, T4 own that)
- `backend-hono/src/services/riskflow/` (T4 owns catalyst routing)
- `backend-hono/src/routes/catalysts/` (T4 owns)
- `frontend/components/journal/` (T2 owns)
- `frontend/components/chat/` (T3 owns)

## Known Issues to Preserve

- **`BYPASS_AUTH=true` + `FINTHEON_DESKTOP=true`** in desktop mode — your routes must work when auth is bypassed
- **Graceful degradation rule:** if ProjectX env vars (`PROJECTX_API_KEY` / `PROJECTX_ACCOUNT_ID`) are missing, the sync worker must log a warning and return early — **never crash the backend**
- **Supabase pool cap (15 clients)** — the pooler has exhausted before. Release clients, don't hold connections across awaits. Use the existing `query()` helper from `backend-hono/src/services/db/optimized.ts`
- **`@modelcontextprotocol/sdk`** must be installed — if your build fails with module-not-found, run `cd backend-hono && npm install @modelcontextprotocol/sdk --legacy-peer-deps`

## Implementation Steps

### 1. Migration (write first, it defines the contract)

Create `supabase/migrations/20260422_trades_origin.sql`:

```sql
-- Add origin column to trades table to distinguish agent-placed vs user-placed trades
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'user'
    CHECK (origin IN ('user', 'autopilot'));

CREATE INDEX IF NOT EXISTS idx_trades_origin_entry_at
  ON trades(origin, entry_at);

-- Backfill existing rows: assume all pre-S29 trades are user-placed
UPDATE trades SET origin = 'user' WHERE origin IS NULL;
```

Apply this to the Supabase `DATABASE_URL` (the production one, NOT local `pulse_dev` — backend reads from Supabase in desktop mode).

### 2. Type definitions

In `backend-hono/src/types/projectx.ts`, add:

```typescript
import { z } from "zod";

export const ProjectXTradeSchema = z.object({
  id: z.string(),
  contract: z.string(),
  entryAt: z.string().datetime(),
  exitAt: z.string().datetime().nullable(),
  side: z.enum(["long", "short"]),
  qty: z.number().int().positive(),
  entryPrice: z.number(),
  exitPrice: z.number().nullable(),
  realizedPnL: z.number(),
});

export type ProjectXTrade = z.infer<typeof ProjectXTradeSchema>;

export const ProjectXTradesResponseSchema = z.object({
  trades: z.array(ProjectXTradeSchema),
});
```

### 3. Service function

In `backend-hono/src/services/projectx-service.ts`, add:

```typescript
export async function getTrades(
  accountId: string,
  from: string,
  to: string,
): Promise<ProjectXTrade[]> {
  if (!hasCredentials(accountId)) {
    console.warn("[ProjectX] getTrades: no credentials — returning []");
    return [];
  }

  try {
    const raw = await bridgeFetch<unknown>(
      `/accounts/${accountId}/trades?from=${from}&to=${to}`,
    );
    const parsed = ProjectXTradesResponseSchema.parse(raw);
    return parsed.trades;
  } catch (err) {
    console.error("[ProjectX] getTrades failed:", err);
    return [];
  }
}
```

### 4. Sync worker

Create `backend-hono/src/services/projectx-sync.ts` (NEW, ≤200 lines). It should:

- Export `startTradesSync()` that spawns an interval (every 15 min)
- On each tick, call `getTrades()` for the last 48h
- Upsert into Supabase `trades` table with `origin='user'` (the default — autopilot writes its own rows directly via autopilot-scheduler)
- Respect env flags — if `PROJECTX_SYNC_DISABLED=true`, skip
- Log cycle results (items synced, errors) at INFO level
- Expose `getLastSyncStatus()` for diagnostics

Follow the pattern of `backend-hono/src/services/riskflow/aquarium-scheduler.ts` for worker structure.

### 5. Boot registration

In `backend-hono/src/boot/services.ts`, add after the other service boots:

```typescript
import { startTradesSync } from "../services/projectx-sync.js";
// ... inside the boot function:
startTradesSync();
```

### 6. Route

Create `backend-hono/src/routes/projectx/trades.ts` (NEW):

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { query } from "../../services/db/optimized.js";

const QuerySchema = z.object({
  from: z.string(),
  to: z.string(),
  origin: z.enum(["all", "user", "autopilot"]).optional().default("all"),
});

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

    const result = await query(
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
```

Register in `backend-hono/src/routes/index.ts`:

```typescript
import { createProjectXTradesRoute } from "./projectx/trades.js";
// ...
app.route("/api/projectx", createProjectXTradesRoute());
```

### 7. Autopilot tagging

In `backend-hono/src/services/autopilot/autopilot-scheduler.ts`, find where autopilot inserts trade records into the DB. Add `origin: 'autopilot'` to the insert. If autopilot doesn't currently persist trades, it should — otherwise the calendar will never show agentic trades.

### 8. Changelog

Append to `src/lib/changelog.ts`:

```typescript
{
  date: "2026-04-22T<HH:MM>:00",
  agent: "T1/Wealth",
  summary: "S29-T1: Added trades origin column + ProjectX trades sync + /api/projectx/trades endpoint",
  files: [
    "supabase/migrations/20260422_trades_origin.sql",
    "backend-hono/src/services/projectx-service.ts",
    "backend-hono/src/services/projectx-sync.ts",
    "backend-hono/src/routes/projectx/trades.ts",
    "backend-hono/src/services/autopilot/autopilot-scheduler.ts",
    "backend-hono/src/boot/services.ts",
    "backend-hono/src/types/projectx.ts",
  ],
},
```

## Acceptance Criteria

- [ ] Migration applies cleanly against Supabase `DATABASE_URL`
- [ ] `cd backend-hono && npm run build` completes with no errors
- [ ] Backend boots without crashing when `PROJECTX_API_KEY` is missing
- [ ] `curl 'http://localhost:8080/api/projectx/trades?from=2026-04-01&to=2026-04-30'` returns a valid JSON `{trades: [...]}` response (empty array OK if no data)
- [ ] `curl '...?origin=autopilot'` filters correctly
- [ ] `curl '...?origin=user'` filters correctly
- [ ] Sync worker logs one "cycle complete" message within 15 min of boot (or 0s if interval=0 in dev)
- [ ] Zod schema rejects malformed ProjectX responses (test with a mock)
- [ ] No file in this branch exceeds 300 lines

## Validation Commands

```bash
# From repo root
cd /Users/freethefranks/Documents/Fintheon/backend-hono
npm install --legacy-peer-deps
npm run build

# Manual smoke test (requires backend running)
curl -s 'http://localhost:8080/api/projectx/trades?from=2026-04-01&to=2026-04-30' | python3 -m json.tool | head -20
curl -s 'http://localhost:8080/api/projectx/trades?from=2026-04-01&to=2026-04-30&origin=autopilot' | python3 -m json.tool | head -10
```

## Commit Format

Don't stamp versions inside track branches. Use:

```
[T1] feat: add trades origin column + ProjectX trades sync
[T1] feat: expose /api/projectx/trades endpoint
[T1] fix: <any fixes>
```

Final unification commit on main will tag `v.5.22.9W`.
