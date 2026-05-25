# Sprint Brief: S67 -- UI Polish Wave 1 (single-agent)

## Intent

A comprehensive visual and interaction polish pass across the heading toolbar, widgets, desk plan, risk signals, microphone, bulletin, and sidebar. Every surface that felt "almost perfect" gets tightened to Solvys standard: consistent theming, aligned proportions, reorderable toolbars with empty-slot rulers, a smarter lockout dropdown, agentic scoring reframed as fuses, risk signal narratives replacing scores, and streak grading that actually compares agent predictions to econ outcomes.

## Branch Target

`sprint/S67`

## Scope -- Included

- [ ] **Toolbar buttons** -- All highlight/hover/enabled colors → user primary theme color (Trading browser stays green `#34d399`)
- [ ] **Pill icon groups** -- Remove `bg-[rgba(5,4,2,0.55)]` backing from `TOOLBAR_PILL_CLASS`; make all individual icon buttons reorderable via DnD (finish the remaining 90%)
- [ ] **Empty drop-zone rulers** -- During reorder edit mode, swap braille icons for blinking, faded vertical rulers marking empty drop slots
- [ ] **Lock button dropdown** -- Clicking lock in header toolbar opens a dropdown modal (Morning/Afternoon/Afterhours/Next Desk Plan) instead of instantly locking. No borders, fading horizontal `FadingRuler` separators between rows. Time values derived from briefing generation times (MDB/ADB/PMDB)
- [ ] **Lockout timer format** -- Add days + hours to header timer display (e.g. "1d 5h 15m left")
- [ ] **IV scoring widget height** -- Slim down by 10% (border + content padding)
- [ ] **Nametag widget height** -- Match reduced IV scoring widget height
- [ ] **VIX widget height** -- Match reduced IV scoring widget height
- [ ] **Agentic Scoring Breakdown** -- Rename "Blended IV Score" popup title to "Agentic Scoring Breakdown". Remove Rationale text section and Chamber Reading text. Leave 5 fuses at bottom: 4 agent confidence fuses + 1 CAO synthesis confidence fuse
- [ ] **IV Score popup alignment** -- Right-side vertical border of expanded Agentic Scoring Breakdown window MUST align with right-side vertical border of the IV scoring widget in the main header, at all times
- [ ] **Color matrix** -- Swap colored dots for row backgrounds that cover the text row and fade toward the right, starting from the middle of the row. Invisible thin ruler lines between rows. Colors driven by user-themed severity colors (not unlinked hardcoded values)
- [ ] **Desk Plan duplicate lock** -- Remove duplicate lock button from `WindowControlRow` in DayCard (line ~398). Keep only the header toolbar lock button
- [ ] **Desk Plan lock logic** -- Lock button ONLY locks trading terminals UNTIL 30 minutes before that trading window. ALL Desk Plan widgets unlock trading terminals 30 minutes before window by default
- [ ] **Blocker settings toggle** -- Give users ability to switch between 30-minute and 15-minute auto-release in Blocker settings tab
- [ ] **Data hiding → redeliberation** -- Instead of hiding data 30 minutes before release, swap this step with a redeliberation against current riskflow items that could impact the event
- [ ] **Desk Plan streak popup** -- Streak based on Agentic Desk's analysis outcome vs econ data's actual print. Mini popup widget on hover over streak number showing each day with bullish/bearish-colored iOS rounded square (right=green, wrong=red). Agentic Desk must "grade its analysis" against econ actuals
- [ ] **Streak position** -- Move streak and streak number to the row above (same row as day-of-week), right justified. Day-of-week text left-nudged to align start with "Desk Plan" header text below
- [ ] **Streak grading backend** -- New backend service + endpoint that compares `EconForecast` predictions against actual econ print data, produces a daily right/wrong grade
- [ ] **Risk Signals collapsed** -- Remove IV score display from collapsed cards, replace with the related primary narrative
- [ ] **Estimated Drift KPI** -- New backend endpoint computing volatility persistence duration from decay taxonomy half-life data. Displayed in expanded Risk Signal cards as "Estimated Drift: 1 session / 2 sessions / 1 day / 2 days / 1 week"
- [ ] **Microphone button** -- Remove round border (`rounded-full` + border). Add brighter shimmer
- [ ] **Mic leaking glow** -- Add "leaking glow" effect that pulses along the corners of the mic button, more noticeable than current
- [ ] **VoiceModePixelOverlay replacement** -- Strip the full-screen pixelated sweep overlay. Replace with a soft, visible glow from the app viewport borders fading inward to ~80% from center, always linked to user's primary theme color
- [ ] **Bulletin tabs** -- Remove background color from around the user-selected tab. Leave only highlighted text to indicate which tab is selected
- [ ] **Sidebar rulers** -- Strip `FadingRuler` horizontal rulers rendered to the left of each expanded sidebar tab. Restore sidebar to how it once was (no rulers between tab entries)
- [ ] **Cursor pointer on hover** -- All interactive buttons across the toolbar, sidebar, desk plan, bulletin, and risk signal cards must show `cursor: pointer` on hover

## Scope -- Excluded (OUT OF BOUNDS)

- Mobile PWA equivalents (mobile parity is a separate track)
- Electron shell changes
- Backend API not directly needed by the above items (no new agent instructions, no Supabase migrations beyond what streak grading + drift KPI require)
- Performance/loading optimization unrelated to the visual changes above
- Any other widget not explicitly listed (e.g. FluxerCallWidget, EconCountdownWidget)

## Known Issues to Preserve

- S66 lockout toggle/instrument IV streaming (2026-05-15) -- must not regress lockout endpoints
- Toolbar DnD order persistence via `getToolbarOrder/setToolbarOrder` -- preserve localStorage keys
- `FadingRuler` vertical separators between toolbar pill icons -- keep these
- VIX pulse border keyframes (`vix-pulse`, `vix-direction-pulse`, `vix-value-flash`) -- preserve theming
- ER emotional pulse on TraderNametag (`nametag-pulse-stable`, `nametag-pulse-tilt`) -- preserve
- `VOICE_MODE_PIXEL_OVERLAY` removal must not break `HeaderVoiceControl`'s rendering path

## Design Pass

### Layout / Interaction

**Header Toolbar (TopHeader.tsx)**

The toolbar's right-side pill group currently wraps buttons in `bg-[rgba(5,4,2,0.55)] px-1 rounded-md`. Remove this backing -- icons float directly on the toolbar surface, separated only by `FadingRuler` vertical dividers. The individual buttons stay at 28x28 with the existing `.toolbar-icon-btn` class (no border, transparent bg, 4px radius).

Hover/enabled state: replace all hardcoded icon colors (e.g. `#6366f1` for chat, `#34d399` for power) with `var(--fintheon-accent)` -- the user's primary theme color. Exception: Trading browser platform button retains green `#34d399` when active.

**Lock Button Dropdown**

Clicking the lock icon (line ~553 in TopHeader) opens a portaled dropdown modal, anchored to the lock button's position. The dropdown lists 4 options separated by horizontal `FadingRuler` lines:

- **Morning** -- locks until MDB briefing time
- **Afternoon** -- locks until ADB briefing time
- **Afterhours** -- locks until PMDB briefing time
- **Next Desk Plan** -- locks until the next scheduled desk plan window starts

No borders on the dropdown container. No background on individual rows by default. Hover reveals a subtle `bg-[var(--fintheon-accent)]/5` highlight. Selected state shows accent-colored text. Clicking an option triggers the lock and closes the dropdown.

Briefing times (MDB/ADB/PMDB) are generated by the brief-generator service (`backend-hono/src/services/brief-generator.ts`). The frontend will pass a time anchor string like `"mdb"` / `"adb"` / `"pmdb"` to the lockout endpoint and let the backend resolve the actual timestamp.

**Widget Height Reduction (10%)**

Starting point for measurement: IV scoring widget uses `h-8` (32px) with `px-3` padding. Reduce to `h-7` (28px → ~12.5% reduction, closest Tailwind class). Match Nametag `h-8` → `h-7`, VIX container `h-8` → `h-7`. Font sizes scale proportionally: `text-[10px]` → `text-[9px]`, `text-sm` → `text-xs`.

**Agentic Scoring Breakdown (IVScoreCard expanded)**

The popup (currently ~300-595 in IVScoreCard.tsx) gets restructured:
- Title: "Agentic Scoring Breakdown" (was "Blended IV Score")
- Remove: "Rationale" section (lines 416-427) and the Arbitrum chamber reading text
- Keep: Component fuse bars (VIX, Headlines, AgentDesk), points range, systemic risk overlay, prediction
- Bottom: 5 fuses -- Harper confidence, Oracle confidence, Feucht confidence, Consul confidence, + CAO overall synthesis confidence score

Each fuse is a NothingFuse-style shimmer bar with agent label and percentage under it.

**Right-edge alignment**: The expanded popup's right edge must match the IVScoreCard widget's right edge. Currently positioned at `left = Math.max(8, rect.left)`. Change to anchor on the right: `left = rect.right - popupW`.

**Desk Plan Streak + Grading**

StreakBadge moves from `footer` (line 296) to the header row, right-justified, same line as the day-of-week. The day-of-week text gets a slight left nudge to align its starting point with the "Desk Plan" header text's starting point.

Hovering the streak number shows a mini popup listing each day with an iOS-style rounded square colored green (Agentic Desk was RIGHT about econ) or red (WRONG). This requires the new grading service to compare the AI's econ forecast (miss/beat probabilities, `aiPrediction` text) against the actual econ print outcome.

**Risk Signals**

Collapsed state: the score badge (`.toFixed(1)` + score color, line 190-195) and `SOURCE_LABEL` tag are replaced with the signal's primary narrative text. The chevron + title stay. Expanded state: adds "Estimated Drift" below the analysis text, shown as a labeled span. Drift duration comes from a new backend endpoint that maps the risk signal's event type to the volatility taxonomy's `decayBaseMinutes` and buckets it: ≤180min = "1 session", ≤540min = "2 sessions", ≤1440min = "1 day", ≤2880min = "2 days", >2880min = "1 week".

**Microphone**

Dormant state (HeaderVoiceControl): remove `rounded-full`, remove the `border: 1px solid rgba(199,159,74,0.14)`. Just a bare icon button with a brighter shimmer keyframe (higher opacity peaks, faster cycle).

Active state: add a "leaking glow" effect -- a CSS animation that pulses along the corners of the button with a soft glow in the user's theme color, using `box-shadow` transitions on pseudo-elements or a wrapping div.

**VoiceModePixelOverlay → Soft Border Glow**

Strip the `<VoiceModePixelOverlay active={enabled} />` from HeaderVoiceControl (remove the JSX at line 219 and the import). Replace with a new component `VoiceBorderGlow` that renders when voice is enabled: a `position:fixed, inset:0, pointer-events:none` overlay using multiple `radial-gradient` layers from the four corners + four edges, fading to transparent at ~80% distance from each edge toward center. The glow color is `var(--accent-primary, --fintheon-accent)` at low opacity (0.08-0.15). No canvas, no pixel cells -- pure CSS radial gradients with CSS animation.

**Bulletin Tabs**

Selected tab styling (StickyBulletin.tsx, line 170-172): remove `background: "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)"`. Just the accent-colored text + icon indicates selection. Inactive tabs remain muted.

**Sidebar Rulers**

In NavSidebar.tsx, line 273: remove `<FadingRuler className="mx-1.5" />` rendered between sidebar entries when expanded. This element was pushing content outside margins.

### API / Service Shape

#### New: Estimated Drift for Risk Signals

```
GET /api/riskflow/risk-signals/estimated-drift?signalId={id}
```

**Response:**
```typescript
{
  signalId: string;
  persistenceCategory: "1_session" | "2_sessions" | "1_day" | "2_days" | "1_week";
  label: string; // "1 session" | "2 sessions" | "1 day" | "2 days" | "1 week"
  decayBaseMinutes: number;
}
```

Derived by mapping the risk signal's event type to `volatility-taxonomy.json` decay data. Fallback: returns `"1_session"` when taxonomy match fails.

#### New: Desk Plan Streak Grading

```
GET /api/day-plan/streak/graded
```

**Response (extends StreakResponse):**
```typescript
{
  streakAtClose: number;
  last30: Array<{
    date: string;
    color: DailyColor;
    analysisCorrect: boolean | null; // null = no econ data to grade against
    forecastSummary: string; // short summary of what the AI predicted
    actualOutcome: string; // what actually printed
  }>;
}
```

New service `econ-grading-service.ts`: for each day in the streak window, fetches the `EconForecast` (miss/beat probabilities + `aiPrediction`) and the day's actual econ print outcome. Compares the forecast direction against the actual, produces a binary correct/incorrect grade.

#### Modified: Lockout Toggle

`POST /api/lockout/toggle` now accepts `briefingAnchor: "mdb" | "adb" | "pmdb"` as an alternative to `durationMinutes`. The backend resolves the briefing anchor to the next scheduled briefing UTC time and locks until then (minus 30min auto-release).

### Data / Agent Shape

- **Estimated Drift**: Read-only lookup against `volatility-taxonomy.json`. No Supabase writes.
- **Streak Grading**: Reads from `day_plan_streaks`, `econ_forecasts` (if stored), and `econ_prints` (if stored via the econ data routes). New `analysis_correct` boolean column on `day_plan_streaks` via migration. RLS: standard user-scoped reads.
- **Lockout dropdown**: Briefing times resolved by `brief-generator.ts` (reads agent briefing schedules). No new tables.

### Aesthetic Rules

- Frosted-glass surfaces for dropdowns (translucent bg + backdrop-blur + thin low-opacity `#c79f4a` border)
- No gradients, no emojis, no Kanban borders, no AI sparkles, no box-shadows
- Accent: `#c79f4a` (Solvys Gold). Canvas: `#050402`. Text: `#f0ead6`
- Typography: Doto for numerals, system sans for labels
- Separators: `FadingRuler` only (gradient line, no solid borders)
- Severity colors: red (8-10), orange (6-8), yellow (4-6), emerald (2-4), green (0-2) -- now linked to user theme variables, not hardcoded

## Development Flow

1. **Backend: Estimated Drift endpoint** -- New route in `riskflow/` + service that reads volatility taxonomy, computes persistence category
2. **Backend: Streak grading service** -- New `econ-grading-service.ts`, migration for `analysis_correct` column, new `/api/day-plan/streak/graded` endpoint
3. **Backend: Lockout dropdown support** -- Accept `briefingAnchor` param, resolve briefing times via brief-generator
4. **Frontend: Toolbar button theming** -- Replace hardcoded icon colors with `var(--fintheon-accent)`, preserve green for Trading browser
5. **Frontend: Pill icon group + DnD** -- Remove bg from `TOOLBAR_PILL_CLASS`, extend ToolbarDnD to all icons, empty-slot blinking rulers
6. **Frontend: Lock button dropdown** -- New `LockDropdown` portal component, wire into TopHeader lock button click
7. **Frontend: Widget heights** -- Reduce h-8 → h-7 across IVScoreCard, TraderNametag, VIX widget
8. **Frontend: Agentic Scoring Breakdown** -- Rename title, remove Rationale/Chamber Reading, add 5-agent fuse bar
9. **Frontend: Color matrix** -- Swap dots for fading row backgrounds, invisible rulers, theme-linked severity colors
10. **Frontend: IV Score popup alignment** -- Anchor popup right edge to widget right edge
11. **Frontend: Desk Plan** -- Remove duplicate lock, streak grading popup, streak reposition, day-of-week alignment, data → redeliberation swap
12. **Frontend: Risk Signals** -- Replace collapsed score with narrative, add Estimated Drift expanded section
13. **Frontend: Microphone** -- Strip round border, add shimmer + corner leaking glow
14. **Frontend: VoiceBorderGlow** -- New component replacing VoiceModePixelOverlay with radial-gradient edge glow
15. **Frontend: Bulletin tabs** -- Remove selected tab background
16. **Frontend: Sidebar rulers** -- Strip FadingRuler from between expanded tab entries
17. **Validation** -- `tsc --noEmit`, `vite build`, curl smoke tests, Playwright visual verification
18. **Changelog + headers**

## Acceptance Criteria

- [ ] All toolbar icon buttons show `var(--fintheon-accent)` on hover/active except Trading browser (green)
- [ ] Pill icon groups have no background, only icons + vertical FadingRuler separators
- [ ] All toolbar icons are draggable in edit mode; empty slots show blinking vertical rulers
- [ ] Clicking lock button opens dropdown with 4 options; selecting one triggers lock
- [ ] Lockout timer shows days/hours/minutes (e.g. "2d 3h 45m left")
- [ ] IV scoring, Nametag, and VIX widgets all use h-7 (28px) height
- [ ] Agentic Scoring Breakdown popup says "Agentic Scoring Breakdown", shows 5 fuses, no Rationale
- [ ] Expanded popup right edge aligns with IV scoring widget right edge at all positions
- [ ] Color matrix uses row backgrounds with rightward fade + theme severity colors
- [ ] No duplicate lock button in Desk Plan WindowControlRow
- [ ] Desk Plan lock locks until 30min before trading window; unlocks 30min before
- [ ] Blocker settings shows 15min/30min toggle for auto-release
- [ ] Data redeliberates against riskflow items instead of hiding 30min before release
- [ ] Streak hover popup shows daily right/wrong colored squares from Agentic Desk grading
- [ ] Streak number sits on same row as day-of-week, right justified
- [ ] Day-of-week text aligns with "Desk Plan" header text start
- [ ] Collapsed Risk Signal cards show primary narrative, not IV score
- [ ] Expanded Risk Signal cards show Estimated Drift KPI
- [ ] Mic button has no round border, has brighter shimmer + corner leaking glow
- [ ] VoiceModePixelOverlay is removed; soft border glow overlay replaces it
- [ ] Bulletin selected tab shows only highlighted text, no background
- [ ] Sidebar has no rulers between expanded tab entries; content stays within margins
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] `cd backend-hono && bun run build` passes
- [ ] `GET /api/riskflow/risk-signals/estimated-drift` returns valid JSON
- [ ] `GET /api/day-plan/streak/graded` returns graded streak array
- [ ] Changelog entry added to `src/lib/changelog.ts`
- [ ] File header comments added to substantially modified files

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Backend build
cd backend-hono && bun run build

# Estimated Drift smoke test
curl -s http://localhost:8080/api/riskflow/risk-signals/estimated-drift?signalId=test | head -c 200

# Graded streak smoke test
curl -s http://localhost:8080/api/day-plan/streak/graded | head -c 200

# Lockout with briefing anchor smoke test
curl -s -X POST http://localhost:8080/api/lockout/toggle \
  -H "Content-Type: application/json" \
  -d '{"locked":true,"briefingAnchor":"mdb"}' | head -c 200
```

## Commit Format

```
[v6.4.0] feat: S67 UI Polish Wave 1 -- toolbar theming, lockout dropdown, widget heights, agentic scoring fuses, drift KPI, streak grading, mic glow, sidebar rulers stripped
```
