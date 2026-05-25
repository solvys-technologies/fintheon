# Sprint Brief: S57 — Arbitrum chamber + dashboard UI refinement (single-agent)

## Intent

TP sees Sanctum’s Arbitrum surface and the executive dashboard briefing column behave as one coherent desk read: the five-seat chamber fits on a typical viewport without scrolling inside the chamber stack; agent tiles show only name, score, and confidence fuse—no duplicated rationales under each seat; consensus reads as the wide summary card immediately under the seat row; Volatility Read lists **every** canonical next-session scenario including explicit **0%** rows; desk plan loses inner chrome on Sanctum while matching dashboard typography; dashboard drops faux “chamber risk signals” in favor of the **same volatility scenario strip** as Volatility Read; Economic Intelligence Pulse shows **three fuses per row** while staying collapsible; inner squares lose box borders in favor of **fading horizontal/vertical rulers**, reserving strokes for outer panel shells.

## Branch Target

`v.{MONTH}.{DATE}.{PATCH}-arbitrum-ui-refinement` (executor fills `{MONTH}.{DATE}.{PATCH}` per branching rules).

## Scope — Included

- [ ] **Chamber layout**: Reorder `ArbitrumChamber` → seats → consensus `VerdictCard` → digest paragraph; compact seats (remove `seat.rationale` UI); shrink padding/type; consensus card spans chamber column width with embedded styling (no inner heavy border—use fading rulers).
- [ ] **No chamber scroll**: Replace Sanctum Page 0 fixed `h-[520px]` + inner `overflow-y-auto` with flex/`min-h-0` chain so Volatility Read + chamber share viewport height responsibly on ~1440×900.
- [ ] **Seat row separators**: Prefer `flex` + `FadingRuler orientation="vertical"` between seats vs bordered grid cells (Solvys-native separation).
- [ ] **Sanctum desk plan**: `<DayCard bare hideStreak />` under Volatility Read (no inner surface bg; no streak footer).
- [ ] **Dashboard desk plan**: `DayCard bare` + streak moved into header row beside “Desk Plan” (`showStreakInHeader` or equivalent); footer streak hidden when header streak shown.
- [ ] **Canonical IV scenarios**: Backend normalizes heuristic + AgentDesk cached scenarios into a **fixed slot list** with explicit **0%** probability for empty slots; frontend shares one presentation component between `BlendedIVForecastCard` and dashboard.
- [ ] **Dashboard risk panel**: Remove `ArbitrumRiskSignals` usage; replace collapsible section with IV-based scenario strip + rename title (e.g. “Next-session volatility”); keep loading/empty/error parity.
- [ ] **Econ Pulse**: `EconKpiFuses` lays out three pulses **side-by-side** (grid `grid-cols-3`), preserve `SanctumEconIntel` collapse.
- [ ] **Border pass (scoped)**: Update touched surfaces only—replace inner `border` boxes with `FadingRuler` patterns; swap solid inter-column `w-px` in Sanctum split for vertical fading ruler; maintain subtle outer panel rounding consistent with MainLayout chrome. **No** repo-wide border grep in this sprint unless time allows a second pass.

## Scope — Excluded (OUT OF BOUNDS)

- Mobile PWA parity (unless regressions block build).
- Strategium `DeskThemeWidget` overhaul (already transparent; no streak there).
- Replacing Sanctum “Risk Signals” page (`RiskSignalCards` / RiskFlow bulletin path)—this brief targets **dashboard chamber panel + Arbitrum column** alignment only.
- Global removal of every `border` class in the frontend—explicitly phased for a follow-up if needed.

## Known Issues to Preserve

- Recent `changelog` entries through **2026-05-01**: S56 shipped (settings, Sanctum restructure, dashboard signals, mobile drawer)—do **not** revert Arbitrum settings overlay, seat overrides migration, or health routes while editing chamber UI.
- **File line budget**: Keep modules `<300` lines—split helpers (`canonicalIvScenarios.ts`, `NextSessionScenariosRow.tsx`) rather than ballooning `ArbitrumChamber.tsx`.
- Harper CAO chat path remains distinct from Arbitrum Hermes routing—no prompt edits here.

## Design Pass

### Layout / Interaction

- **Sanctum Page 0 (non-chart)**: Left stack = Volatility Read header → `BlendedIVForecastCard` → bare desk plan (no streak). Right stack top = chamber header + round fuse → compact seat row with vertical fading separators → **full-width consensus card** → digest lines → loading/error unchanged (gear opens settings overlay).
- **Dashboard briefing split**: Left markdown NTN unchanged behavior-wise; right column weekday title row stays, desk plan card flush (bare), streak visually anchored **top-right of Desk Plan header row** inside `DayCard` when dashboard variant is active.
- **Scenarios strip**: Fixed columns or rows showing label / probability / projected IV score; **zeros visible**; separators = fading rulers, not boxed tiles.
- **Econ Pulse**: Collapsed vs expanded unchanged; expanded shows **one row × three fuses** on desktop, graceful stack on narrow inner widths.

### API / Service Shape

- Extend **[backend-hono/src/services/market-data/iv-prediction.ts](backend-hono/src/services/market-data/iv-prediction.ts)** (and AgentDesk read path feeding `prediction.scenarios`) so responses always include **canonical slots** after normalization helper (pure function module, e.g. `canonical-iv-scenarios.ts`).
- IV aggregate endpoint contract stays backward-compatible: still returns `prediction.scenarios[]`, but length and ordering become deterministic.

### Data / Agent Shape

- No new Supabase tables. AgentDesk merge logic continues to produce scenarios; normalization maps/freezes labels into canonical buckets (Continuation, Risk-on rally, Escalation bucket for spike/headline labels—executor documents exact matcher).

### Aesthetic Rules

- Warm canvas `#050402`, accent `#c79f4a`, text `#f0ead6`; **no gradients** in scenario strips (existing `linear-gradient` fades on rulers only—acceptable as separator primitives per established `fading-ruler.css`).
- **No Kanban card frames**, no decorative box-shadows; thin accent strokes limited to **outer** shells where already established (MainLayout / panel chrome).
- Typography: tabular nums for scores; respect existing Doto usage on numerals.

## Development Flow

1. **Service layer**: Implement `normalizeCanonicalIvScenarios()` (+ unit-friendly pure tests optional via bun test only if harness exists—otherwise validate via curl JSON snapshot).
2. **Backend wiring**: Apply normalization in heuristic path post-`buildHeuristicScenarios` and when wrapping AgentDesk cached predictions before JSON serialization on `/api/market-data/iv-score` (or whichever handler feeds `IVScoreResponse`).
3. **Frontend types**: Ensure `IVScoreResponse.prediction.scenarios` reflects deterministic ordering (document in comment).
4. **Shared UI primitive**: Add `NextSessionScenariosStrip` (named export) consumed by `BlendedIVForecastCard` and new dashboard widget.
5. **Arbitrum UI**: Edit `ChamberSeats`, `ArbitrumChamber`, `VerdictCard` props for embedded mode; adjust `Sanctum.tsx` layout constraints + dividers + `DayCard` props.
6. **Dashboard**: Swap `ArbitrumRiskSignals` import for new strip + IV fetch reuse (`useIVScoreData` pattern); extend `DayCard` streak placement props.
7. **Econ**: `EconKpiFuses` grid layout only (no behavior change to pulse computation).
8. **Validation**: `tsc`, `rm -rf dist && vite build`, `bun run build` backend if touched.
9. **Changelog + headers**: `src/lib/changelog.ts` entry + `// [claude-code YYYY-MM-DD]` on touched files.

## Acceptance Criteria

- [ ] Sanctum chamber column: **no inner vertical scroll** at ~1440×900 with typical verdict+digest content (minor viewport extremes may scroll entire Sanctum page—that’s acceptable if chamber pane itself doesn’t scroll).
- [ ] Seat tiles show **only** agent display name, score, fuse—**no** rationale paragraph.
- [ ] Consensus card sits **directly under** seat row; digest text follows consensus.
- [ ] IV prediction UI lists **all canonical scenarios**, including **0%** rows, on both Sanctum Volatility Read and dashboard replacement panel.
- [ ] Dashboard **does not** render seat-level “Chamber Risk Signals”; new panel copies Volatility Read scenario semantics.
- [ ] Sanctum desk plan = **bare**, **no streak**; dashboard desk plan keeps streak **in header row**.
- [ ] Econ Pulse expanded view shows **three-across** fuses at desktop widths.
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes.
- [ ] `rm -rf dist && npx vite build` passes.
- [ ] `cd backend-hono && bun run build` passes (if backend touched).
- [ ] `curl -s http://localhost:8080/api/market-data/iv-score | head -c 400` shows normalized scenarios array (spot-check locally).
- [ ] Changelog entry added to `src/lib/changelog.ts`.
- [ ] File headers on substantially edited files.

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build (mandatory before vite build)
rm -rf dist && npx vite build

# Backend build (if backend touched)
cd backend-hono && bun run build

# IV endpoint smoke (adjust symbol/query if route requires)
curl -s "http://localhost:8080/api/market-data/iv-score" | head -c 600
```

## Commit Format

```
[v.{MONTH}.{DATE}.{PATCH}] feat: S57 Arbitrum + dashboard UI refinement
```
