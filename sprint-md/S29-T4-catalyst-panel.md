# Sprint Brief: S29-T4 — RiskFlow Catalyst Slide-Out Panel

## Context

T2 is building a Trading Calendar on the Performance tab. When a user clicks a day or week on that calendar, they want to see **what RiskFlow catalysts (headlines) fired on that trading day** — so they can correlate their P&L with market news. This track builds a right-side slide-out panel that duplicates the existing Timelines panel UI, but auto-filters headlines to the calendar selection.

You are working in **parallel** with three other Claude Desktop windows (T1 data layer, T2 calendar UI, T3 chat modernize). You do NOT touch T2's calendar code — you build your panel as a standalone component that accepts a `CalendarSelection` prop (contract defined by T2). Unification in Wave 2 will wire them together.

## Branch Target

`feat/s29-t4-catalyst-panel-W`

Create from `main`:

```bash
cd /Users/freethefranks/Documents/Fintheon
git checkout main && git pull
git checkout -b feat/s29-t4-catalyst-panel-W
```

## Scope — Included

- [ ] Locate the existing **Timelines panel** component (search `frontend/components/` for `Timelines`, `timeline`, or similar) — study its structure
- [ ] New directory: `frontend/components/journal/CatalystSlideOut/` with:
  - `index.tsx` — slide-out drawer, accepts `selection: CalendarSelection | null` + `onClose`
  - `CatalystList.tsx` — renders headlines sorted by timestamp
  - `CatalystListItem.tsx` — single headline row (date, source, title, urgency tag)
  - `EmptyState.tsx` — "No catalysts for this trading day"
  - `hooks/useCatalystsByDate.ts` — fetches `/api/catalysts/by-date?from&to`
- [ ] New backend route: `backend-hono/src/routes/catalysts/by-date.ts` (GET `/api/catalysts/by-date?from&to`)
- [ ] Register route in `backend-hono/src/routes/index.ts` (append, don't touch T1's additions)
- [ ] Append changelog entry

## Scope — Excluded (DO NOT TOUCH)

- `frontend/components/journal/TradingCalendar/` (T2 owns — you read the exported types only)
- `frontend/components/journal/AgentPerformanceTab.tsx` or `PerformanceJournal.tsx` (T2 owns)
- `frontend/components/chat/` (T3 owns)
- `backend-hono/src/services/projectx-*` (T1 owns)
- `backend-hono/src/services/riskflow/catalyst-promoter.ts` (read-only — do not modify, just query its data)
- `backend-hono/src/services/autopilot/` (T1 owns)

**Rule:** your backend route is ADDITIVE. You READ from existing tables/services, never modify them.

## Known Issues to Preserve

- **RiskFlow feed** and **catalyst-promoter** populate data tables already — query them read-only
- **Supabase pool cap (15 clients)** — use the existing `query()` helper, release clients
- **Graceful fallback** — if DB is unavailable, return `{ catalysts: [] }` not a 500
- **`BYPASS_AUTH=true`** — your route must work when auth is bypassed
- **Solvys design principles** — flat OKLCH, Solvys Gold accent, no gradients/shadows/blur/emojis
- **T2 is building in parallel** — their `CalendarSelection` type lives at `frontend/components/journal/TradingCalendar/types.ts`. At unification, you import it:
  ```typescript
  import type { CalendarSelection } from "../TradingCalendar/types.js";
  ```
  But while T2 isn't merged, define the type INLINE in your component so you can build in isolation:
  ```typescript
  // TEMP — replace with import from TradingCalendar/types at unification
  export interface CalendarSelection {
    kind: "day" | "week" | "month";
    from: Date;
    to: Date;
  }
  ```
  Mark this with a `// [unification] replace with import` comment so Wave 2 knows where to edit.

## Implementation Steps

### 1. Locate the existing Timelines panel

Run:

```bash
grep -rln -iE "timelines?|timeline-panel" frontend/components --include="*.tsx" | head -20
```

Read it. Note its layout, drawer behavior (how it opens/closes), list rendering pattern, styling. Your component should feel like a sibling of it, not a stranger.

### 2. Design the slide-out

Behavior:

- Mounted always, hidden off-screen by default (translate-x-full)
- When `selection` becomes non-null → slide in from the right (transform transition, ~200ms, ease-out)
- When `onClose()` → slide back out
- ESC key or click outside the panel → closes
- Width: 400px on desktop, fills screen on narrow (but Fintheon is desktop-only so 400px is fine)
- Header: selection summary — e.g. "Apr 15, 2026 · 11 trades" or "Week of Apr 13, 2026"
- Body: scrollable list of catalysts
- Close button: top-right X

Styling: flat, `#050402` bg, 1px border `#1a1a1a` on left edge, `#f0ead6` text, Solvys Gold accents for urgency tags.

### 3. Backend route

Create `backend-hono/src/routes/catalysts/by-date.ts`:

```typescript
import { Hono } from "hono";
import { z } from "zod";
import { query } from "../../services/db/optimized.js";

const QuerySchema = z.object({
  from: z.string(), // ISO datetime
  to: z.string(), // ISO datetime
});

export function createCatalystsByDateRoute() {
  const app = new Hono();

  app.get("/by-date", async (c) => {
    const parsed = QuerySchema.safeParse(c.req.query());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const { from, to } = parsed.data;

    try {
      // Adjust table name to match actual RiskFlow catalysts table.
      // Likely `scored_items` or `promoted_catalysts` — check backend-hono/src/services/riskflow/catalyst-promoter.ts
      const result = await query(
        `SELECT id, headline, source, url, published_at, urgency, symbols, score
         FROM scored_items
         WHERE published_at >= $1 AND published_at <= $2
           AND promoted = true
         ORDER BY published_at DESC
         LIMIT 200`,
        [from, to],
      );

      return c.json({
        catalysts: result.rows.map((r) => ({
          id: r.id,
          headline: r.headline,
          source: r.source,
          url: r.url,
          publishedAt: r.published_at,
          urgency: r.urgency,
          symbols: r.symbols ?? [],
          score: parseFloat(r.score ?? "0"),
        })),
        from,
        to,
      });
    } catch (err) {
      console.error("[Catalysts] by-date failed:", err);
      return c.json({ catalysts: [], from, to, error: "db-unavailable" });
    }
  });

  return app;
}
```

Register in `backend-hono/src/routes/index.ts`:

```typescript
import { createCatalystsByDateRoute } from "./catalysts/by-date.js";
// ...
app.route("/api/catalysts", createCatalystsByDateRoute());
```

### 4. `useCatalystsByDate` hook

```typescript
export function useCatalystsByDate(selection: CalendarSelection | null) {
  // when selection is null → no fetch, empty result
  // when selection changes → fetch /api/catalysts/by-date?from=...&to=...
  // return { catalysts, loading, error }
}
```

### 5. Component structure

- `index.tsx` → ~150 lines (drawer shell + selection header)
- `CatalystList.tsx` → ~100 lines (list rendering + empty state dispatch)
- `CatalystListItem.tsx` → ~80 lines (row)
- `EmptyState.tsx` → ~40 lines
- `hooks/useCatalystsByDate.ts` → ~80 lines

Every file ≤300 lines.

### 6. Visual fidelity to Solvys

Pull tokens from `.claude/skills/solvys-feels/reference/css-tokens.md`. Urgency colors:

- `immediate` → Solvys Gold `#c79f4a` (most prominent)
- `high` → muted gold `#a0845f`
- `normal` → dim beige `rgba(240, 234, 214, 0.5)`

### 7. Changelog

Append to `src/lib/changelog.ts`:

```typescript
{
  date: "2026-04-22T<HH:MM>:00",
  agent: "T4/Wealth",
  summary: "S29-T4: Added CatalystSlideOut panel + /api/catalysts/by-date route — shows RiskFlow headlines filtered to calendar selection",
  files: [
    "frontend/components/journal/CatalystSlideOut/*",
    "backend-hono/src/routes/catalysts/by-date.ts",
    "backend-hono/src/routes/index.ts",
  ],
},
```

## Acceptance Criteria

- [ ] Backend: `curl 'http://localhost:8080/api/catalysts/by-date?from=2026-04-15T00:00:00Z&to=2026-04-15T23:59:59Z'` returns valid JSON
- [ ] Backend: works when DB is missing/unreachable (returns empty array, no 500)
- [ ] Frontend: component mounts in isolation with a mock `selection` prop
- [ ] Frontend: slide-in/slide-out animation under 250ms
- [ ] Frontend: ESC and click-outside close the panel
- [ ] Empty state renders when no catalysts match
- [ ] Urgency tags use Solvys Gold variations, no bright red/blue
- [ ] Every file ≤300 lines
- [ ] `CalendarSelection` type is defined INLINE with a `// [unification]` comment (Wave 2 will swap it for the import)
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` clean
- [ ] `cd backend-hono && npm run build` clean

## Validation Commands

```bash
# Backend
cd /Users/freethefranks/Documents/Fintheon/backend-hono
npm install --legacy-peer-deps
npm run build

# Smoke test after backend is running
curl -s 'http://localhost:8080/api/catalysts/by-date?from=2026-04-15T00:00:00Z&to=2026-04-15T23:59:59Z' | python3 -m json.tool | head -20

# Frontend
cd /Users/freethefranks/Documents/Fintheon/frontend
npx tsc --noEmit
rm -R dist
npx vite build
```

## Commit Format

```
[T4] feat: add /api/catalysts/by-date endpoint
[T4] feat: add CatalystSlideOut panel with date-filtered list
[T4] style: apply solvys tokens to urgency tags
```

No version stamps on branch commits. Final unification will tag `v.5.22.9W`.
