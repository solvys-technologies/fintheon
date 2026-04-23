# Sprint S29 — Trading Calendar + Chat Modernize

**Driver:** Wealth (W)
**Date opened:** 2026-04-22
**Target version on ship:** `v.5.22.9W` (continues from shipped `v5.22.8`)
**Branch strategy:** Option B — one branch per track, unified via dedicated final wave

## Goal

Add a **Trading Calendar heatmap** to the Performance tab (bottom-right of Fintheon) — inspired by ProjectX's monthly P&L calendar — with:

1. Two visual variants: a ProjectX-clone view and a Solvys-aesthetic view (toggle)
2. An Agentic-vs-Human filter (requires new `origin` column on trades table)
3. Click-through on a day/week → existing KPI cards re-render for that window + shadcn line-chart drawer for equity curve
4. A RiskFlow catalyst slide-out panel that auto-populates with headlines filtered to the selected trading day

Also: **modernize the chat interface** in the same aesthetic, because Performance and Chat are both under-touched and should level up together.

## Track Map

| Track  | Title                                  | Branch                         | Complexity | Owns                                                     |
| ------ | -------------------------------------- | ------------------------------ | ---------- | -------------------------------------------------------- |
| **T1** | Data Layer + ProjectX Trades Sync      | `feat/s29-t1-data-W`           | M          | backend-hono/\*, supabase migration                      |
| **T2** | Calendar UI + Performance Tab Refactor | `feat/s29-t2-calendar-W`       | H          | journal/AgentPerformanceTab split + new TradingCalendar/ |
| **T3** | Chat Interface Modernize               | `feat/s29-t3-chat-modernize-W` | M          | frontend/components/chat/ (visual only)                  |
| **T4** | RiskFlow Catalyst Slide-Out            | `feat/s29-t4-catalyst-panel-W` | M          | journal/CatalystSlideOut/ + one backend route            |

## Dependency Graph (runtime)

- **T1 → T2** — T2 fetches from `/api/projectx/trades` that T1 creates. Mitigation: T2 mocks until T1 ships.
- **T2 → T4** — T4 receives `selectedDate`/`selectedRange` props from T2's calendar. Mitigation: T4 defines its own prop contract; T2 integrates at unification.
- **T3 independent** — no dependency on other tracks.

All four tracks can run **in parallel (Wave 1)**. Interface contracts are published below so no track waits on another.

## Wave Sequence

### Wave 1 — four Claude Desktop windows in parallel

```
/Users/freethefranks/Documents/Fintheon/sprint-md/S29-T1-data-layer.md
```

```
/Users/freethefranks/Documents/Fintheon/sprint-md/S29-T2-calendar-ui.md
```

```
/Users/freethefranks/Documents/Fintheon/sprint-md/S29-T3-chat-modernize.md
```

```
/Users/freethefranks/Documents/Fintheon/sprint-md/S29-T4-catalyst-panel.md
```

### Wave 2 — unification (orchestrator, not parallel)

Runs in **this** (Wealth's primary) Claude Code session, not Claude Desktop.

1. Fetch all four track branches
2. Merge into `main` in order: **T1 → T2 → T4 → T3** (data first, UI that consumes it, panel that integrates with UI, independent visual-only last)
3. Resolve any interface mismatches between T2 and T4 (prop contract)
4. Run full validation:
   - `cd backend-hono && npm run build`
   - `cd frontend && rm -R dist && npx vite build`
   - `npx tsc --noEmit --project frontend/tsconfig.json`
5. Rebuild DMG: `npx electron-builder --mac dmg`
6. Install to `/Applications/`, launch, curl-verify all critical endpoints
7. Tag final build `v.5.22.9W`
8. Append sprint entry to `src/lib/changelog.ts`
9. Move this orchestration doc + 4 track briefs from `sprint-md/` to `sprint-changelog/`

## Interface Contracts (shared between tracks)

### T1 → T2 — trades API contract

```typescript
// GET /api/projectx/trades?from=2026-04-01&to=2026-04-30&origin=all|user|autopilot
// Returns:
interface TradesResponse {
  trades: Array<{
    id: string;
    contract: string; // e.g. "MNQM26"
    entryAt: string; // ISO
    exitAt: string | null; // ISO, null if open
    side: "long" | "short";
    qty: number;
    entryPrice: number;
    exitPrice: number | null;
    realizedPnL: number; // in dollars, post-commission
    origin: "user" | "autopilot";
  }>;
  from: string;
  to: string;
}
```

### T2 → T4 — calendar selection prop contract

```typescript
// T2's calendar emits:
interface CalendarSelection {
  kind: "day" | "week" | "month";
  from: Date; // inclusive
  to: Date; // inclusive
}

// T4's slide-out accepts:
interface CatalystSlideOutProps {
  selection: CalendarSelection | null; // null = panel closed
  onClose: () => void;
}
```

## File-Ownership Matrix (conflict prevention)

**No two tracks may edit the same file.** Shared integration happens at unification.

| File                                                         | Owner                                                                                                               | Other tracks |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------ |
| `backend-hono/src/services/projectx-service.ts`              | T1                                                                                                                  | —            |
| `backend-hono/src/services/projectx-sync.ts` (NEW)           | T1                                                                                                                  | —            |
| `backend-hono/src/services/autopilot/autopilot-scheduler.ts` | T1                                                                                                                  | —            |
| `backend-hono/src/types/projectx.ts`                         | T1                                                                                                                  | —            |
| `backend-hono/src/routes/projectx/trades.ts` (NEW)           | T1                                                                                                                  | —            |
| `backend-hono/src/routes/catalysts/by-date.ts` (NEW)         | T4                                                                                                                  | —            |
| `supabase/migrations/20260422_trades_origin.sql` (NEW)       | T1                                                                                                                  | —            |
| `backend-hono/src/boot/services.ts`                          | T1                                                                                                                  | —            |
| `backend-hono/src/routes/index.ts`                           | **split:** T1 appends ProjectX trades route; T4 appends catalysts route at different line. Resolved at unification. |
| `frontend/components/journal/AgentPerformanceTab.tsx`        | T2 (splits it)                                                                                                      | —            |
| `frontend/components/journal/PerformanceJournal.tsx`         | T2                                                                                                                  | —            |
| `frontend/components/journal/TradingCalendar/` (NEW dir)     | T2                                                                                                                  | —            |
| `frontend/components/journal/CatalystSlideOut/` (NEW dir)    | T4                                                                                                                  | —            |
| `frontend/components/chat/**`                                | T3                                                                                                                  | —            |
| `src/lib/changelog.ts`                                       | **each track appends its own entry** — merge order in unification resolves any conflict                             |

## Critical Rules (from CLAUDE.md + operational history)

- **No file exceeds 300 lines** — split on growth
- **No gradients, shadows, blur, emojis in UI chrome** — flat OKLCH only (Solvys Gold #c79f4a on BG #050402)
- **Electron desktop only** — do NOT use browser preview tools. Test via `curl` to `localhost:8080`, relaunch via `/Applications/Fintheon.app/Contents/MacOS/Fintheon`
- **Every service must work when its env var is missing** — in-memory fallback, degraded AI, bypass auth
- **Never bypass auth on cloud routes** (but desktop runs with `BYPASS_AUTH=true` + `FINTHEON_DESKTOP=true`)
- **Before any vite build:** `rm -R dist` (not `rm -rf` — safety hook blocks it)
- **Never start a vite dev server** — verify via `tsc --noEmit` + `vite build` only
- **Backend runs from `~/Documents/Fintheon/backend-hono` in packaged mode** — asar does not bundle it
- **`@modelcontextprotocol/sdk`** must be installed if missing: `npm install @modelcontextprotocol/sdk --legacy-peer-deps`
- **Changelog entry required** after every track — append to `src/lib/changelog.ts`
- **Commit messages** don't get version stamps inside branches. Only the final merged build on main gets tagged `v.5.22.9W`.

## How Wealth Runs This

See "Claude Desktop 4-Window Setup" instructions in the chat. Paste one track brief into each window. When all 4 say done, return to the primary (this) Claude Code session for Wave 2 unification.
