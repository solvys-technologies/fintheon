# Sprint Brief: S101 -- Desk Command Center Prototype (single-agent)

## Intent

Turn the current Desk/Dashboard prototype into a repo-owned command-center surface that TP can use and annotate without fighting placeholders. Page one should read like the live daily operating desk: real MDB/ADB/PMDB brief, current Desk Plan, and Risk Signals. Page two should become the planning surface: Sprint Map, Calendar, and queued Desk Briefing views powered by actual Desk Plan windows.

## Branch Target

`sprint/S101`

## Scope -- Included

- [ ] Harden page-one daily briefing so MDB/ADB/PMDB load from `/api/data/briefs/today`, default to the newest usable brief, keep failed AI-generation rows selectable but visually marked, and never replace the brief with queued Desk Plan events.
- [ ] Promote the Desk Plan widget into the canonical repo-owned component for the Dashboard/Desk surface: compact chrome, Eastern date row, no duplicate embedded title, stable loading/empty/error states, and advance/refetch controls.
- [ ] Complete page-two planning view with `Map`, `Calendar`, and `Briefing` modes over the same queued Desk Plan data, including visible counts, next-window focus, delete handling, and clear empty states.
- [ ] Add a shared Desk data boundary so daily briefs, multi-week desk plans, and queued-event derived views avoid duplicate fetch logic and expose consistent loading/error metadata.
- [ ] Browser-polish the prototype at the active Desk route so it is ready for TP annotation and later conversion into smaller tracked tasks.

## Scope -- Excluded (OUT OF BOUNDS)

- Mobile PWA parity.
- New AI brief generation, model billing fixes, or prompt rewrites.
- New backend schemas unless an existing endpoint response is proven unusable.
- Trading execution, lockout policy changes, and RiskFlow scoring changes.

## Known Issues to Preserve

- The existing `/api/data/briefs/today` route can return an ADB row whose content is an AI billing failure; do not hardcode around it. The UI should default to usable content and mark failed rows plainly.
- Keep the Desk tab ID/dashboard route compatibility wrappers intact; visible copy can say Desk, but route contracts should not churn.
- Preserve recent changelog intent around queued Desk Plan windows, app-init retry recovery, and the compatibility export for the executive dashboard.

## Design Pass

### Layout / Interaction

Page one uses a two-column working layout. The left column is the daily brief reader with a compact brief selector, refresh control, scrollable brief body, and local loading/error text. The right column stacks Desk Plan above Risk Signals. The Desk Plan chrome remains right-aligned with the current Eastern date beneath it, while the embedded DayCard presents only the plan content rows.

Page two is a full planning surface with a restrained segmented view switcher: `Map`, `Calendar`, `Briefing`. `Map` stays default. `Briefing` lists queued Desk Plan events grouped by plan date, with forecast, miss/beat, prediction, and next-window summary. The scrubber is visible for map/calendar only.

### API / Service Shape

Use existing endpoints first:

- `GET /api/data/briefs/today` for daily brief rows.
- `GET /api/data/brief` as legacy daily brief fallback.
- `GET /api/day-plan/multi-week` for queued Desk Plan windows.
- Existing Risk Signals fetch path remains owned by the current Risk Signals component.

If endpoint shape problems appear, add only frontend normalization helpers unless a live route returns missing required data.

### Data / Agent Shape

No new agent or Supabase ownership is planned. Derived queued-event data should stay frontend-side unless later briefs need persistence or annotations. Daily brief failure rows should be represented as degraded data, not regenerated automatically.

### Aesthetic Rules

- Warm near-black canvas, Solvys Gold accents, warm off-white text.
- Flat rows, thin low-opacity gold borders, and subtle frosted surfaces only where grouping is necessary.
- No gradients, emojis, Kanban side-stripe borders, generic box-shadows, or decorative loading screens.
- Compact local loading states such as `[LOADING...]` or muted text, never a full-screen blocker.

## Development Flow

1. Inventory current Desk prototype components and confirm all call sites for `DayCard`, `DeskBriefingPanel`, and `DeskSprintMapCalendar`.
2. Extract frontend data helpers/hooks for daily briefs and queued Desk events, keeping response normalization typed and local.
3. Finish the page-one daily brief panel: selector behavior, fallback handling, failed-row treatment, refresh state, and readable markdown-style rendering.
4. Finish the Desk Plan widget: header chrome, date formatting in `America/New_York`, duplicate title suppression, loading/empty/error spacing, and advance/refetch wiring.
5. Finish the page-two planning surface: view switcher, queued Briefing view, map/calendar empty states, next-window default focus, delete status, and scrubber visibility.
6. Polish responsive and browser details at desktop and narrower widths: no overlapping labels, no nested cards, stable control dimensions, and clear local errors.
7. Validate, update `src/lib/changelog.ts`, and add concise file headers only to substantially new/rewritten files.

## Acceptance Criteria

- [ ] Page one shows the real daily brief reader and does not render queued Desk Plan event cards there.
- [ ] Brief selector exposes MDB/ADB/PMDB rows when present and defaults away from failed generation rows when a usable brief exists.
- [ ] Desk Plan widget keeps its top-right chrome, shows the current Eastern date as `Tue, May 26, 2026`, and does not repeat the embedded `Desk Plan` title.
- [ ] Page two offers `Map`, `Calendar`, and `Briefing`; `Briefing` shows queued Desk Plan windows from the live multi-week plan data.
- [ ] Map/calendar controls keep their current delete and scrubber behavior.
- [ ] Loading, empty, and endpoint-error states are visible locally and do not trap the whole dashboard.
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes.
- [ ] `rm -rf dist && npx vite build` passes.
- [ ] Browser verification confirms the Desk route at `http://127.0.0.1:7777/?tab=dashboard` or the active local preview route.
- [ ] Changelog entry added to `src/lib/changelog.ts`.

## Validation Commands

```bash
npx tsc --noEmit --project frontend/tsconfig.json
rm -rf dist && npx vite build
curl -s http://localhost:8080/api/data/briefs/today | head -c 300
curl -s http://localhost:8080/api/day-plan/multi-week | head -c 300
git diff --check
```

## Commit Format

```text
[v7.0.x] feat: S101 desk command center prototype
```
