# Sprint Brief: S49 -- Desk Plan Prices + Read Expansion (single-agent)

## Context

TP reports two adjacent bugs and one design ask on the Desk Plan surfaces:

1. Prices are not appearing on the Desk Plan card (Sanctum's `DayCard`).
2. The Strategium "Desk Plan" widget (`DeskThemeWidget`) does not show prices at all, and its **Read** button only reveals a copy of the MDB/ADB/PMDB brief body.
3. The Desk Plan text on both surfaces is currently a long catalyst-recap sentence -- TP wants a brief (<160 char) **actionable plan** that does not duplicate the MDB/ADB/PMDB body.

Live verification (`curl /api/day-plan/today`) confirms the backend already returns `pricesOfInterest`, `invalidation`, `profitTarget`, `expectedMovePct`. The DayCard prices vanish because `useDayPlan` consumes the wrapper `{ plan }` as if it were `DayPlan` itself, so `data.windows` is always `undefined`. The DeskThemeWidget bug is by omission -- it only renders `themeText` and never the price rows.

## Intent

When the user opens Sanctum, the Desk Plan card shows the actionable plan (one tight line, <=160 char), then the trading window, prices of interest in neutral text, invalidation in the user theme's bearish color, and profit target in the bullish color. When the user opens Strategium, the **Desk Plan** widget shows the same compact read; tapping **Read** expands the widget to fill its top-half slot inside the Strategium drawer with the full Desk Plan layout (matching the DayCard content), with the same color semantics applied.

## Branch Target

`s48-unified` (current branch -- continue here, no new branch).

## Scope -- Included

- [ ] Fix `useDayPlan` to unwrap `{ plan }` so DayCard receives a real `DayPlan` (root cause for prices not popping up).
- [ ] Tighten `desk-theme-generator.ts` SYSTEM_PROMPT to produce a brief (<=160 character) actionable plan that is distinct from the MDB/ADB/PMDB body. Sanitizer must enforce the length cap and the single-sentence rule.
- [ ] DayCard: apply color tokens to the three price rows -- `Prices of Interest` and `Trading Window` stay neutral, `Invalidation Point` rendered in `var(--fintheon-bearish)`, `Profit Target` rendered in `var(--fintheon-bullish)`. Expected Move stays neutral.
- [ ] DeskThemeWidget compact mode: render the actionable plan, then a small price block below (event/window/prices of interest/invalidation/profit target) using the same color semantics. Drop the brief body fetch and the inline `<pre>` -- the widget no longer mirrors the MDB/ADB/PMDB body.
- [ ] DeskThemeWidget Read mode: when `Read` is toggled open, the widget expands to fill the full available height of its Strategium slot (the parent's `grid-rows-2` row -- the "top half" of the Strategium drawer when pinned first) and renders the same full layout the DayCard renders, with the same color semantics. `Read` toggles to `Collapse` when open. Expansion uses the existing `t-panel-slide` transition tokens with a `requestAnimationFrame` first-paint reveal (per the existing pattern in this file).
- [ ] Changelog entry + file header comments per project rules.

## Scope -- Excluded (OUT OF BOUNDS)

- Reordering Strategium widgets so DeskThemeWidget is forced into the top slot. (User pins it themselves via edit mode.)
- Mobile parity for the Read expansion (mobile DayCard already shows prices; out of scope here).
- Brief generator rewrite. The MDB/ADB/PMDB brief body is unchanged -- we only stop mirroring it inside the widget.
- Streak / Drift footer changes.
- Adding new Supabase columns. The existing `desk_theme` column will hold the shorter string; old rows naturally roll forward at the next 00:00 ET cron tick.

## Known Issues to Preserve

- Backend day-plan cron (`day-plan-cron`) writes `desk_theme` daily at 00:00 ET. Today's row will stay long until the next regen -- do **not** force a one-time backfill from this brief.
- `useDayPlan` is consumed by both DayCard and other surfaces -- audit downstream callers when changing the return shape (ChangeRow / WeekStrip / DayCard / DeskThemeWidget all use `/api/day-plan/today`). Prefer fixing the hook (single source of truth) over patching DayCard alone.
- Solvys aesthetic is locked: no gradients, no emoji, no Kanban borders, no glass shadows, no AI sparkles. Frosted-glass surface or flat translucent panel only, with thin `var(--fintheon-accent)` border.
- `DRIFT_COLORS` `tilt_stop` already uses an absolute red (`rgba(220, 80, 80, 0.95)`); do not introduce a separate red for invalidation -- bind to the theme variable `var(--fintheon-bearish)` instead.

## Design Pass

### Layout / Interaction

**DayCard (Sanctum, unchanged shape, color-only):**

```
DESK PLAN  brief
[<=160 char actionable plan, body font, neutral]

·············································  (FadingRuler)
Event ............................. <name>      neutral
Trading Window .................... 08:00-09:15 neutral
Prices of Interest ................ 27040, 27120 neutral, Doto, tabular-nums
Invalidation Point ................ 27060        bearish, Doto
Profit Target ..................... 27680        bullish, Doto
Expected Move ..................... ± 1.55%     neutral, Doto
·············································

[Streak]                       Drift  • in-window
```

**DeskThemeWidget compact (Strategium, default closed):**

```
BOOK Desk Plan  MDB                                          Read >
[<=160 char actionable plan -- 12px, leading-snug]

Event .................. <name>
08:00-09:15 ET
Entry  27040, 27120                       (neutral, Doto)
Invalid  27060                            (bearish, Doto)
Target  27680                             (bullish, Doto)
```

**DeskThemeWidget expanded (Read open -- fills its slot):**

When `Read` is tapped, the widget container grows to `height: 100%` of the slot (the Strategium page row -- a clean "top half" of the parent drawer when the widget is pinned first). The expanded body renders the DayCard layout in full (event / window / prices of interest / invalidation / profit target / expected move). The `Read` chip flips to `Collapse v`. Use the existing `t-panel-slide` class for the entry/exit transition with the rAF reveal pattern already in this file.

If the widget happens to be the second widget on its Strategium page, the same expansion still fills its slot -- it just happens to be the bottom half rather than the top half. (TP pins via edit mode if they want it locked to top.)

### Aesthetic Rules

- Translucent surface with thin `var(--fintheon-accent)` border at 14-20% opacity in expanded mode -- never a solid card, never a Kanban frame, no box shadow.
- Numerals use Doto (`'Doto', 'Readable Digits', var(--font-data, monospace)`) and `tabular-nums`, matching the DayCard `Row` primitive.
- Color binding via CSS vars only -- `var(--fintheon-bullish)`, `var(--fintheon-bearish)`, `var(--fintheon-text)`. Never hardcoded hex. This guarantees the user-applied theme drives semantics.
- Do not change the FadingRuler placement on DayCard -- preserve the two-ruler sandwich around the data table.

### API / Service Shape

No new endpoints. `GET /api/day-plan/today` continues to return `{ plan: DayPlan | null }`.

`generateDeskTheme` SYSTEM_PROMPT update:

- Voice: convicted, declarative, action-oriented. The output is a _plan_, not a recap.
- Output rules: exactly one sentence, <=160 characters total (whitespace included), no emojis, no quotes, no headers, no fabricated numbers.
- It must reference behavior at the levels (e.g. "fade <px>, target <px>, abandon below <px>") rather than restating the catalyst. Catalyst can be named in 1-3 words for context but must not dominate.
- Do **not** include phrasing copied from the MDB/ADB/PMDB body. The widget no longer mirrors the brief.

`sanitizeTheme` update:

- Hard-cap at 160 characters after first-sentence extraction. If the model returns longer, truncate at the last whole word boundary at <=160 and append a period if the cut left it without terminal punctuation.
- Keep existing emoji/decoration stripping.

`fallbackTheme` update:

- Compose a plan-shaped fallback under the cap. Example shape:
  `${windowLabel} ET ${instrument}: fade ${entry}, target ${target}, abandon below ${invalidation}.`
  Trim if instrument/levels missing.

### Data / Agent Shape

No Supabase migration. `day_plans.desk_theme` already accepts a string of any length; we just write shorter ones from now on. No RLS changes.

## Development Flow

1. **Hook fix (data layer / single source of truth).**
   - `frontend/hooks/useDayPlan.ts`: parse response as `{ plan: DayPlan | null }` and `setData(json.plan)`. Add a defensive guard so a missing/null `plan` keeps `data` as `null`. Audit callers with `rg "useDayPlan\\(" frontend mobile` and confirm none expected the wrapper.
2. **Backend prompt + sanitizer.**
   - `backend-hono/src/services/day-plan/desk-theme-generator.ts`: rewrite SYSTEM_PROMPT per the spec, update `sanitizeTheme` to cap at 160 chars on word boundary, update `fallbackTheme` to plan-shaped sentence, keep the export shape and the `invokeAgent` wiring unchanged.
3. **DayCard color binding.**
   - `frontend/components/narrative/DayCard.tsx`: thread an optional `valueColor` (or `tone: 'neutral' | 'bullish' | 'bearish'`) into the `Row` primitive, applied via inline `style.color` so the user-applied theme variable wins. Wire `Invalidation Point` to bearish, `Profit Target` to bullish, leave the other rows on neutral.
4. **DeskThemeWidget compact + expanded states.**
   - `frontend/components/mission-control/DeskThemeWidget.tsx`:
     - Drop the `brief` fetch + `<pre>` body. Keep the day-plan fetch.
     - Render compact form: BookOpen + label + briefType chip on the left, `Read v` / `Collapse ^` on the right, then the actionable plan, then a tight 3-row price block.
     - On `Read` open: replace the compact body with the full DayCard-shaped layout (Event / Trading Window / Prices of Interest / Invalidation / Profit Target / Expected Move) using the same `Row` primitive (or copy its shape so we do not couple Sanctum and Strategium files). Set the wrapper to `height: 100%` so it fills the Strategium grid slot.
     - Keep the rAF reveal pattern for the expansion transition. Preserve `t-panel-slide` class usage.
   - Optional refactor (call out before doing it): extract the shared `Row` primitive from DayCard into `frontend/components/narrative/DeskPlanRow.tsx` so DayCard and DeskThemeWidget share one definition. Only do this if it stays under 80 lines and removes more code than it adds.
5. **Type + build validation.**
   - `npx tsc --noEmit --project frontend/tsconfig.json`
   - `cd backend-hono && bun run build`
   - `rm -rf dist && npx vite build`
6. **Live smoke tests.**
   - Restart launchd backend, then:
     - `curl -s http://localhost:8080/api/day-plan/today | jq '.plan.deskTheme | length'` -- must be <=160.
     - Manually verify: open Consilium > Sanctum -> DayCard shows three numbers correctly colored. Open Strategium -> DeskThemeWidget shows compact price block; tap Read -> widget expands to fill its slot with full DayCard-shaped content.
7. **Changelog + headers.**
   - Append entry to `src/lib/changelog.ts` describing the four-file change.
   - Add `// [claude-code 2026-04-29]` header lines to each modified file.

## Acceptance Criteria

- [ ] `data.plan.windows[0].pricesOfInterest`, `invalidation`, `profitTarget` render in DayCard with the correct theme colors (bearish/bullish/neutral).
- [ ] `data.plan.deskTheme` length <=160 chars on a freshly-generated plan (verify by triggering a regen via `regenerateDayPlan` from a smoke route or by waiting for the next 00:00 ET tick on a dev backend).
- [ ] DeskThemeWidget compact view shows the actionable plan + 3-row price block; no brief body, no `<pre>`.
- [ ] DeskThemeWidget Read button expands the widget to fill its Strategium slot and renders the full DayCard-shaped layout. Collapse returns it to compact.
- [ ] No gradients, no emojis, no Kanban borders, no box-shadows on either surface.
- [ ] Bearish/bullish colors track the user-applied theme (verify by switching themes via the theme picker -- numbers shift accordingly).
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes.
- [ ] `rm -rf dist && npx vite build` passes.
- [ ] `cd backend-hono && bun run build` passes.
- [ ] `curl -s http://localhost:8080/api/day-plan/today | jq` returns a plan; smoke test render in Consilium + Strategium passes.
- [ ] Changelog entry added; modified files carry the header date stamp.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Restart local backend (post backend change)
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Live smoke -- desk theme length
curl -s http://localhost:8080/api/day-plan/today | jq '.plan.deskTheme | length'

# Live smoke -- full payload sanity
curl -s http://localhost:8080/api/day-plan/today | jq '.plan.windows[0]'
```

## Commit Format

```
[v5.36.0] feat: S49 deskplan prices, color theming, read-expansion
```
