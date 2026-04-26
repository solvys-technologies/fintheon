# Sprint Brief: S38 — Refinement Engine + Voice Orb Design Patches (single-agent)

## Intent

A set of visual and interaction fixes across the Refinement Engine, the app header/footer, the RiskFlow expanded card's note generator, and the voice-chat orb. No net-new features — every item is a correction to something that already ships but reads wrong. After this sprint the Refinement Engine opens to a properly-titled "Active Market Environment" block with breathing room, Group Sensitivity collapses cleanly as a header row, the preset dropdown sits inside the locked Advanced pane, Event Weight sliders feel deliberate (Nothing-inspired), list text is legible, Regime Approvals shows _why_ the agent filed for a change instead of raw enum strings, RiskFlow notes include the source link + directional read, and the voice orb sweeps a brief pixel-ring animation in theme color before settling into an ambient corner flicker.

## Branch Target

Continue on `s35-unified` (current active branch; no WIP blocking).

## Scope — Included

- [ ] **Active Market Environment header**: rename "Active Regime" → "Active Market Environment" (UI only; `regime` stays in backend), right-justify, bigger type, larger override dropdown, +10–12.5% min-height on header toolbar row
- [ ] **Remove "Priced In Capital" from TopHeader**; relocate to `FooterToolbar` as the desk-name slot (left side); shift status message left of where the desk name sits
- [ ] **Group Sensitivity** becomes a collapsible header row (chevron toggles), flat styling preserved (no card bg/border), fuses are view-only
- [ ] **Preset dropdown** (Neutral / Default / Save As) moves INSIDE the locked Advanced pane; inherits S37 password-gate lock
- [ ] **Event Weights sliders**: Nothing-style revamp — keep dot endpoints, add tick increments along the track, more visual character. Drag-value label uses Inter Mono (data = monospace). Reuse the same bumped list-text token across Source Accounts / Persons of Interest / Econ Watch — don't introduce a 4th type tier on the screen.
- [ ] **Font size bump** on Source Accounts, Persons of Interest rankings, and Econ Watch filters lists (feed preview stays)
- [ ] **Regime Approvals** card rebuild: filter out same-state transitions (`current === target` → skip at write-time), remove the blank fuse, surface the summary + RiskFlow headlines that drove the agent's decision
- [ ] **RiskFlow `Generate Note` CTA**: generated note must statically include (a) link to original headline, (b) ≤200-char summary, (c) bullish/bearish directional read for the user's currently selected instrument
- [ ] **Voice orb pixelation**: ring color bound to `var(--accent-primary)` (Solvys Gold `#c79f4a` default, theme-swappable); static/deterministic pixel pattern sweeps in from 4 corners → converges into a ~60%-screen circle → dissolves back to corners → lingering low-amplitude corner flicker while orb is active
- [ ] **Sanctum Econ tab — kill "Instrument Fuses" card**: remove `EconInstrumentFuses.tsx` (the vertical-fuse block) entirely; replace its slot, sitting below the agent analysis section, with the same horizontal `InstrumentCardsRow` used at the bottom of the Sanctum Command tab
- [ ] **Heat-gauge height bump**: increase the height of the horizontal heat bar inside `InstrumentCardsRow` (~25–35%) so the gauge reads at a glance — surrounding text rows stay the same
- [ ] **Econ Pulse collapsible**: clicking the "ECON PULSE" header row (or any of its pulse rows) toggles the whole pulse block (Inflation / Labor / Supply pulses) so the Econ Events comparison section below reclaims the space
- [ ] **Aquarium → Arbitrum (UI surface rename)**: in `SanctumHeader.tsx` rename "AQUARIUM" → "ARBITRUM", bump its size, drop the "shark tank" subtitle entirely; in the Sanctum tab/dropdown menu rename the "Aquarium" destination to "Arbitrum"
- [ ] **Persistent 50/50 chart split**: when chart mode is active inside Arbitrum, the TradingView iframe locks to 50% viewport width and stays pinned through scroll; the left half (Arbitrum content) reflows into ~6 paginated views so every section (volatility read, next session forecast, chamber seats, instrument cards, econ tab content) remains reachable beside the chart instead of scrolling out from under it
- [ ] **Sanctum Econ tab — kill "Instrument Fuses" card**: remove `EconInstrumentFuses.tsx` (the vertical-fuse block) entirely; replace its slot, sitting below the agent analysis section, with the same horizontal `InstrumentCardsRow` used at the bottom of the Sanctum Command tab
- [ ] **Heat-gauge height bump**: increase the height of the horizontal heat bar inside `InstrumentCardsRow` instrument cards (~25–35%) so the gauge reads at a glance — text rows around it stay the same
- [ ] **Econ Pulse becomes collapsible**: clicking the "ECON PULSE" header row (or any of its rows) toggles the whole pulse block (Inflation / Labor / Supply pulses) so the Econ Events comparison section below reclaims the space
- [ ] **Aquarium → Arbitrum rename (UI surface)**: in `SanctumHeader.tsx` rename the "AQUARIUM" label to "ARBITRUM", bump its size (the header-left lockup is currently too small), drop the "shark tank" subtitle entirely; in the Sanctum tab/dropdown menu where "Aquarium" appears as a destination, rename to "Arbitrum"
- [ ] **Persistent 50/50 chart split**: when chart mode is active inside Arbitrum, the TradingView iframe locks to 50% viewport width and stays pinned through scroll; the left half (Arbitrum content) reflows into ~6 paginated views so every section (volatility read, next session forecast, chamber seats, instrument cards, econ tab content) remains reachable beside the chart instead of scrolling out from under it

## Scope — Excluded (OUT OF BOUNDS)

- No changes to the S37 lock behavior itself (password flow, dev-settings-auth helpers, unlock persistence) — only moving surfaces under its umbrella
- No refactor of `TopHeader.tsx` or `FooterToolbar.tsx` beyond what this brief requires (both exceed the 300-line cap; split is a separate concern)
- No changes to the RiskFlow scoring pipeline, feed query, or card layout outside the Generate Note response
- No visual changes to the orb's idle/listening/speaking color states beyond the ring-variable rebind
- No new desk-name data model — the footer slot is a static placeholder reading "Priced In Capital"; the future desk-name feature is a separate sprint
- No changes to Harper/Oracle/Feucht/Consul/Herald agent instruction files beyond the regime-approval summary prompt and the note-generation prompt

## Known Issues to Preserve

- **S37 Refinement Engine edit lock**: Advanced pane is view-only by default; password gate via `dev-settings-auth` helpers. Any Group Sensitivity / preset move must sit behind this same lock, not a new one.
- **Nothing-fuse + spinner sanctity**: memory flag — never touch fuses or adjacent spinners _as a pattern_. Event Weight visual revamp is explicitly greenlit by TP in the S38 request; do not extend the treatment to other NotchedFuse instances.
- **No box-shadow, no glass blur, no gradients, no Kanban borders, no emojis** — flat surfaces + thin `#c79f4a` border only.
- **SVG runtime-animated attributes use WAAPI** (`element.animate()`), never CSS keyframes with `cx`/`cy` (Safari regression).
- **Changelog entries must be clean** — `src/lib/changelog.ts` ships in the frontend bundle. No secrets, URLs, or customer data in entry strings.
- **Launchd backend reads from `~/Desktop/Codebases/fintheon/backend-hono/dist`**, not Documents. Backend changes must be built AND synced to the Desktop checkout before localhost smoke tests.

## Design Pass

### Refinement Engine header — Active Market Environment

- **File**: `frontend/components/refinement/RegimeControl.tsx` + surrounding layout in `RefinementEngine.tsx` (line ~400).
- Label text: `"Active Market Environment"` (title-cased, single-line).
- Alignment: right-justified within its header cell; override dropdown sits flush-right of the label.
- Typography: bump label to ~1.25–1.4× current size; override dropdown trigger scales proportionally (control height ≥40px).
- Container row: increase `min-height` by 10–12.5% over current value. Apply to the top header row of the Refinement Engine shell, not to `RegimeControl` internals.
- Accent: keep thin `#c79f4a` rule where a separator is already in place; do not add new chrome.

### Group Sensitivity collapsible + preset relocation

- **Files**: `RefinementEngine.tsx` lines ~412–435, `PresetSelector.tsx`, `AdvancedPane` sub-region.
- Wrap the 5 `NotchedFuse` rows (macro / geopolitical / corporate / technical / speaker) in a collapsible region. Header row = `"Group Sensitivity"` left-aligned + right-aligned chevron. Click anywhere on the row toggles collapse. No card bg, no border — just the header row as a clickable target, with the existing thin rule separating it from neighbors.
- Default state: **expanded** (preserve current first-load visual).
- Fuses: render as view-only (disable drag / keyboard increment) unless the Advanced pane is unlocked. Reuse the existing lock predicate from `AdvancedPane`; do not introduce a new gate.
- `PresetSelector` moves out of its current location and into the `AdvancedPane` locked region. In the locked (view-only) state, it renders as a read-only label ("Preset: Neutral"); when unlocked it becomes the active dropdown with Save As.

### Event Weights — Nothing-style sliders

- **File**: `QuickWeightEditor` inside `AdvancedPane` (RefinementEngine.tsx ~lines 485–534).
- Keep endpoint dots. Add 5 visible tick increments along the track (0 / 0.25 / 0.5 / 0.75 / 1, or equivalent for the existing weight scale). Ticks are short orthogonal marks above the track in `#f0ead6` at 40% alpha; active segment fills in solid `#c79f4a` (no gradient).
- Handle: dot or disc (reuse whatever the existing primitive uses — don't re-invent). Snap-to-tick on release, free-drag in between.
- Drag-value label renders in Inter Mono (data = monospace rule); hide when idle.
- Aesthetic: monochrome + single accent, dot-driven, precise. Matches Solvys + Nothing overlap.

### List font sizes

- **Files**: `SourceAccountsManager.tsx`, `EconFiltersManager.tsx`, and the Persons of Interest surface (locate via grep — likely `PersonsOfInterestManager.tsx` or inline inside RefinementEngine; if not found, add a one-line note in the PR and check with TP before guessing).
- Bump body text one step (e.g., `text-sm` → `text-base`, or equivalent token). Preserve line-height ratio. Tighten row padding only if rows become cramped.
- **Feed preview**: no changes. Confirm by reading the right-sidebar JSX and leaving it untouched.

### Regime Approvals rebuild

- **Backend**: locate the writer that inserts into the approvals queue (likely in `backend-hono/src/services/regime/` or an arbitrum/approvals service). Add a guard: `if (currentRegime === targetRegime) return;` — do not enqueue no-op transitions. This is a data-quality fix; same-state rows already in the table can be filtered on read as a belt-and-suspenders step.
- The approval row payload must include:
  - `summary`: short paragraph (≤400 chars) of _why_ the agent proposed the change
  - `driving_headline_ids`: array of `scored_riskflow_items.id` the agent cited
  - Preserve existing `from_regime` / `to_regime` / `confidence` fields
- If the approvals table is missing `summary` / `driving_headline_ids` columns, write a 14-digit-timestamped migration in `supabase/migrations/` adding them as nullable text / uuid[]. Run `supabase db push` yourself from the linked main worktree — do not hand to TP and do not use MCP apply tools.
- **Frontend**: remove the blank fuse placeholder. Render:
  - Header: `"{FromEnvLabel} → {ToEnvLabel}"` using user-facing labels (the same mapping used elsewhere; "Macro Econ" etc. stays as the label _but it should never be same-to-same after the backend guard_).
  - Summary paragraph below the header, `#f0ead6` at 80% alpha.
  - Expandable list of driving headlines, 2–3 visible by default, "+N more" to expand. Each headline is a link to the source url.
  - CTA row: existing Approve / Reject buttons, unchanged.

### RiskFlow note generation — static fields

- **Backend**: `backend-hono/src/services/riskflow/agent-notes.ts` → `generateNoteForItem`.
  - Prompt contract: model must return a JSON object with fields `{ source_url: string, summary: string, direction: "bullish" | "bearish" | "neutral", instrument: string }`.
  - `source_url` = the `url` field on the RiskFlow item passed in (deterministic, not model-generated — inject server-side after the model call, overwriting whatever the model produces for that field).
  - `summary` ≤ 200 chars (validate via Zod at the boundary; reject + retry once if over, truncate with ellipsis on second failure).
  - `direction` is computed by the model conditioned on the user's currently selected instrument. The handler receives the user's selected instrument from the request body (or falls back to a pulled-from-preferences value — whichever is already wired; read the existing handler to confirm).
  - `instrument` echoes back the instrument string so the frontend can render "Bearish for NQ" etc.
- **Frontend**: `frontend/components/feed/RiskFlowDetailCard.tsx` lines ~93–100.
  - After note generation succeeds, render a 3-line block under the existing note body:
    - Line 1: source-url rendered as a linked headline (opens new tab, no referrer)
    - Line 2: the summary text
    - Line 3: directional badge — `"Bullish for {instrument}"` / `"Bearish for {instrument}"` / `"Neutral for {instrument}"`, accent foreground, no background fill.

### Voice orb pixelation

- **File**: `frontend/components/voice/VoiceAuroraOrb.tsx` (144 lines; single file).
- **Ring color**: replace the hardcoded gold in the `border` rule (line ~91) with `var(--accent-primary)`. If that CSS variable doesn't exist yet, add it to the root theme stylesheet with a default of `#c79f4a`. All five state colors (idle/listening/speaking/thinking/error/infraction) that currently hardcode the ring color route through the same variable, with state-specific alpha modifiers layered on top.
- **Pixel sweep animation**:
  - Render the pixel field as a fixed-position overlay (full viewport, `pointer-events: none`, z-index above chrome but below modals).
  - Pixel grid is deterministic: a fixed pattern (e.g., every 8×8 pixel cell either on or off based on a stable hash of its coordinates). Not random noise.
  - Animation timeline (use WAAPI `element.animate()`, NOT CSS keyframes — memory flag):
    1. `0ms`: pixels visible only at the four corners (masked to corner triangles ≈ 15% viewport radius each).
    2. `0 → 450ms`: corner regions expand inward, converging into a circular mask centered on the orb that covers ~60% of viewport.
    3. `450 → 600ms`: hold the full circle briefly.
    4. `600 → 1050ms`: circular mask shrinks outward, returning to the four corner triangles.
    5. `1050ms onward`: corner regions persist with a low-amplitude flicker — random opacity jitter between 0.3 and 0.6 on a ~120ms cadence, no spatial movement. Stops immediately when the orb deactivates.
  - Mask is an SVG `<mask>` or CSS `clip-path`; either is fine, prefer whatever keeps the overlay GPU-friendly.
  - Activation trigger: tied to the same voice-chat active state that lights up the orb ring today. Single boolean; no new state machine.

### Sanctum — Econ tab restructure

- **Files**: `frontend/components/narrative/SanctumEconIntel.tsx`, `frontend/components/narrative/econ/EconInstrumentFuses.tsx` (DELETE), `frontend/components/narrative/econ/EconKpiFuses.tsx`, `frontend/components/narrative/InstrumentCardsRow.tsx` (REUSE).
- **Kill the "INSTRUMENT FUSES" card**: remove `<EconInstrumentFuses />` from the Econ tab and delete the file. The vertical-fuse pattern was duplicating the horizontal heat-gauge cards already shown on the Command tab and taking up an entire row of dead-center real estate.
- **Reuse `InstrumentCardsRow`**: drop the same horizontal instrument-card row (the /NQ HEAT 3.3 / RANGE / CONVICTION cards from the Command tab) into the Econ tab, positioned directly below the agent analysis paragraph. Same component, same data source — no fork.
- **Heat bar height bump**: inside `InstrumentCardsRow`, increase the heat-bar element's height by ~25–35% (e.g. `h-1` → `h-1.5`, or whatever the existing token equivalent is). Bar only — keep the symbol label, RANGE row, CONVICTION row, and headline excerpt at their current sizes.
- **Econ Pulse → collapsible**: wrap the Econ Pulse block (header + Inflation Pulse / Labor Pulse / Supply Output rows) in a collapsible region. Header row "ECON PULSE" left-aligned + chevron right-aligned; click anywhere on the header row toggles. Default state: expanded. No card chrome added — keep current flat styling, just make the header clickable. When collapsed, the events-comparison section below slides up to fill the space.

### Sanctum — Aquarium → Arbitrum rename + header lockup

- **Files**: `frontend/components/narrative/SanctumHeader.tsx`, plus wherever the Sanctum tab dropdown/menu defines its destination labels (likely `Sanctum.tsx` or a tab config).
- The Aquarium UI surface label is being retired in favor of direct "Arbitrum" exposure. The earlier canonical-naming decision to keep "Aquarium" as a Sanctum surface label is overridden by this sprint.
- In `SanctumHeader.tsx`: rename "AQUARIUM" → "ARBITRUM". Bump the lockup size — current is too small relative to the rest of the header. Drop the "shark tank" subtitle string entirely. The "LIVE" pill and any next-session timer can stay.
- In the Sanctum tab dropdown: rename the "Aquarium" entry to "Arbitrum". Same icon, same destination route, just the label changes.
- Keep "Aquarium" terminology on the backend / route names / data fields for now — this is a UI-only rename. A future sprint can do the deeper backend rename.

### Sanctum — Persistent 50/50 chart split

- **Files**: `frontend/components/narrative/Sanctum.tsx` (chart-mode container), plus whatever currently controls the TradingView iframe layout.
- When the user clicks the chart toggle (the existing CHART button in the Sanctum header), the layout switches to a fixed 50/50 split: TradingView iframe pinned to the right half of the viewport, Sanctum content on the left half. Both halves scroll independently, OR the chart stays sticky while the left half scrolls — pick whichever is simpler given the existing layout primitive (sticky preferred so the chart is always in view).
- Because the left half is now half-width, single-scroll layout no longer works — content reflows into ~6 paginated views. Pagination control sits at the bottom of the left half (page dots + prev/next chevrons, accent-tinted). Each page is one logical section — proposed grouping:
  1. Volatility Read (Blended IV Score + Next Session Forecast)
  2. Arbitrum Chamber (5 seat cards + round status)
  3. Analysis paragraph + InstrumentCardsRow (heat gauges)
  4. Econ Pulse (collapsible) + Econ Events comparison section
  5. Whatever else currently lives further down the Sanctum scroll
  6. Spillover / future content
- Final page count is whatever the executor needs to fit everything legibly at half-width — 6 is a target, not a constraint. Keep pages roughly equal in vertical density.
- When chart mode is OFF, the layout returns to its current full-width single-scroll form; pagination disappears.

### Aesthetic Rules

- Flat surfaces, thin `#c79f4a` border where separation is already in place — do not add new chrome for its own sake.
- No gradients, no emojis, no glass blur, no Kanban borders, no box-shadows.
- Typography per Solvys scale (Halyard family, existing size tokens). When bumping list font size, step up one token — do not invent new sizes.
- Ring color flows through `var(--accent-primary)`; all other accent usage may continue to reference `#c79f4a` directly for now (variable migration is a separate sprint).

## Development Flow

1. **Data layer** — Check `regime_approvals` (or equivalent) for `summary` + `driving_headline_ids` columns. If missing, write migration, run `supabase db push` from the linked main worktree. Generate updated TS types if the project uses `supabase gen types`.
2. **Service layer**
   - Regime approval writer: add same-state guard and populate new fields.
   - `agent-notes.ts`: rewrite prompt + response schema, inject `source_url` server-side, validate summary length.
3. **API layer** — Update the Hono routes that serve regime approvals and the Generate Note endpoint. Zod schemas at the boundary. Fallback behavior: if the user's selected instrument isn't in the request, fall back to the stored preference; if that's missing, default direction to `"neutral"` and flag `instrument = "unknown"`.
4. **Frontend hooks** — Update `useRegimeApprovals` + `useGenerateNote` (or the existing query/mutation equivalents) to accept the new fields. No prop-drilling changes beyond the new fields.
5. **Frontend UI** — Implement in this order:
   - a. Active Market Environment header + TopHeader brand removal + FooterToolbar desk-name slot
   - b. Group Sensitivity collapsible + preset dropdown relocation into AdvancedPane
   - c. Event Weights slider revamp (ticks + handle + snap behavior + Inter Mono drag label)
   - d. List font-size bumps
   - e. Regime Approvals card rebuild
   - f. RiskFlow note block under the Generate Note CTA
   - g. Voice orb ring variable + pixel sweep overlay
   - h. Sanctum Econ tab — kill EconInstrumentFuses, drop in InstrumentCardsRow below analysis, bump heat-bar height
   - i. Sanctum Econ tab — Econ Pulse collapsible header
   - j. SanctumHeader — Aquarium → Arbitrum rename, bigger lockup, drop "shark tank"; rename dropdown entry
   - k. Sanctum chart-mode — persistent 50/50 split + ~6-page pagination of left half
6. **Validation** — tsc, clean vite build, backend build, launchd restart, Desktop checkout sync, live curl smoke tests, manual UI pass on every surface touched (including orb activation — click the ring, verify the sweep).
7. **Changelog + file headers** — Add one consolidated S38 entry in `src/lib/changelog.ts` summarizing all eight patches with the file list. Add `// [claude-code 2026-04-24] S38: {one-line}` to every substantially modified file (refinement components, VoiceAuroraOrb, TopHeader, FooterToolbar, RiskFlowDetailCard, agent-notes service, regime-approval service + route).

## Acceptance Criteria

- [ ] Refinement Engine opens with header reading "Active Market Environment", right-justified, visibly larger than before, with override dropdown enlarged and the toolbar row 10–12.5% taller
- [ ] "Priced In Capital" no longer appears in the top header; appears in the footer left of the status indicators
- [ ] Status message in the footer sits to the left of where the desk name now lives
- [ ] Clicking the "Group Sensitivity" row toggles its sub-content with a chevron; styling remains flat (no new card chrome)
- [ ] Group Sensitivity fuses are not interactive unless the Advanced pane is unlocked via the S37 password flow
- [ ] Preset dropdown renders inside the Advanced pane, read-only when locked, interactive when unlocked
- [ ] Event Weight sliders show tick marks, snap to increments on release, retain dot endpoints, and render the drag-value label in Inter Mono
- [ ] Source Accounts, Persons of Interest, and Econ Watch filter rows read at the new larger font size; feed preview font unchanged
- [ ] Regime Approvals cards never show same-regime transitions; each card shows a summary paragraph and at least one linked driving headline; no blank fuse remains
- [ ] A new note generated from a RiskFlow expanded card renders: original headline link, ≤200-char summary, and a directional badge referencing the user's selected instrument
- [ ] Voice orb ring color is driven by a `--accent-primary` CSS variable; changing the variable updates the ring
- [ ] Activating the orb triggers a pixel sweep that starts at the four corners, converges into a ~60%-viewport circle, and dissolves back to the corners, followed by low-amplitude corner flicker that stops when the orb deactivates
- [ ] Sanctum Econ tab no longer renders an "INSTRUMENT FUSES" card; the file `EconInstrumentFuses.tsx` is deleted; `InstrumentCardsRow` appears below the agent analysis section
- [ ] Heat bar inside `InstrumentCardsRow` reads visibly taller than before; surrounding rows unchanged
- [ ] Clicking the "ECON PULSE" header row toggles the pulse block; events-comparison section reclaims the space when collapsed
- [ ] `SanctumHeader.tsx` shows "ARBITRUM" (not "AQUARIUM"), at a larger size, with no "shark tank" subtitle
- [ ] The Sanctum tab dropdown lists the destination as "Arbitrum"
- [ ] In chart mode, TradingView occupies exactly 50% viewport width and stays in view as the left half scrolls/pages; left half paginates (~6 pages); chart-mode-off returns to current full-width single-scroll layout
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] `curl -s http://localhost:8080/api/diagnostics` returns healthy; regime approvals and generate-note endpoints return the new shape
- [ ] Changelog entry added to `src/lib/changelog.ts`
- [ ] `// [claude-code 2026-04-24] S38: …` headers added to every substantially modified file

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Backend build + launchd restart
cd backend-hono && bun run build
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Desktop checkout sync (launchd reads from Desktop)
rsync -a backend-hono/dist/ ~/Desktop/Codebases/fintheon/backend-hono/dist/

# Live smoke tests
curl -s http://localhost:8080/api/diagnostics | head -c 400
curl -s http://localhost:8080/api/regime/approvals | head -c 400
curl -s -X POST http://localhost:8080/api/riskflow/<id>/generate-note \
  -H 'content-type: application/json' \
  -d '{"instrument":"NQ"}' | head -c 400
```

## Commit Format

```
[v5.25.3] feat: S38 refinement engine + voice orb design patches
```
