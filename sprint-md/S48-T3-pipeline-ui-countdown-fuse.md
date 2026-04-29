# Sprint Brief: T3 — Pipeline UI + CountdownFuse + Econ Filter Editor

## Context

The Refinement Engine currently renders 5 NotchedFuse sensitivity dials (Macro, Geopolitical, Corporate, Technical, Speaker) in a collapsible "Group Sensitivity" section. Per TP directive, these are removed entirely and replaced with a Pipeline Health table showing per-pipeline browser headline stats. Pipeline on/off toggles are added. A new CountdownFuse component wraps the existing NothingFuse with a beat/miss/par/X-close state machine and floating mode. An econ event filter editor lets TP observe and edit emoji/word classification for ASAP events. The web URL source section is added to the existing CatalystStatsDrawer.

This track is frontend-only. T1 provides the backend APIs this track consumes (`GET /api/admin/pipelines`, `GET /api/admin/pipeline-stats`, `GET /api/admin/riskflow/source-stats?type=web`). Use the API shapes documented in T1. If the backend APIs aren't ready during development, implement with mock data and a degraded-mode banner.

## Branch Target

`s48-t3-pipeline-ui-countdown` from `main` at `23129632`

## Scope — Included

- [ ] `PipelineHealth.tsx` — stats table (pipeline name, status dot, headline count, error count, last seen, uptime %)
- [ ] `PipelineToggles.tsx` — per-pipeline on/off toggle switches
- [ ] Remove NotchedFuse + GroupSensitivityDial imports from `RefinementEngine.tsx`
- [ ] Remove Group Sensitivity collapsible section from `RefinementEngine.tsx` (lines 463-525)
- [ ] Replace with PipelineHealth + PipelineToggles components
- [ ] `CountdownFuse.tsx` — NothingFuse wrapper with beat/miss/par/blink/X-close state machine + floating mode
- [ ] Dev countdown test button in `DeveloperSettings.tsx`
- [ ] `EconFilterEditor.tsx` — emoji/word filter table for ASAP econ classification
- [ ] Web URL source section in `CatalystStatsDrawer.tsx` (filtered to `polling_type: "web"`)
- [ ] Better error handling: replace silent `catch {}` blocks with inline error states

## Scope — Excluded (DO NOT TOUCH)

- `content-guard.ts`, `central-scorer.ts`, `econ-bridge.ts` — T1 owns all backend files
- `kalshi-service.ts`, `speculation-filter.ts` — T2 owns source integrations
- `MainLayout.tsx`, `Sanctum.tsx`, `TopHeader.tsx`, `NavSidebar.tsx` — T4 owns layout fixes
- `FintheonComposer.tsx`, `RiskFlowDetailCard.tsx` — T4 owns S47 deferred UI
- `MobileBulletin.tsx` — T4 owns bulletin drag fix
- Mobile PWA — not in scope for S48
- Electron shell — not in scope

## Reuse Inventory (existing code to call, not reinvent)

- `NothingFuse` at `frontend/components/shared/NothingFuse.tsx` — CountdownFuse wraps this. Props: `value` (0-1), `color`, `severity`, `score`, `orientation`, `thickness` (default 4), `segments` (default 10), `animateIn`. Read the full component to understand mount-charge animation (lines 66-73).
- `colorForSeverity` / `colorForScore` at `frontend/lib/fuse-palette.ts` — theme-aware color resolution. CountdownFuse uses these for beat (bullish) / miss (bearish) / par (accent) colors.
- `DEFAULT_FUSE_PALETTE` at `frontend/lib/fuse-palette.ts` — default color palette object.
- CSS tokens at `frontend/index.css:46-56` — `--fintheon-accent`, `--fintheon-bullish` (#34d399), `--fintheon-bearish` (#ef4444), `--fintheon-glass-bg`, `--fintheon-glass-border`, `--ease-spring`, `--ease-bounce`.
- `CatalystStatsDrawer` at `frontend/components/refinement/CatalystStatsDrawer.tsx` — existing slide-in panel (420px). Add web URL source section below category aggregates. Uses `SourceStat` type at line 28 with `polling_type: "social" | "web"`.
- `useAuth` at `frontend/contexts/AuthContext.tsx` — provides `getAccessToken()` for admin API calls.
- `useToast` at `frontend/contexts/ToastContext.tsx` — `addToast()` for error/success feedback.
- `isRefinementEditUnlocked` at `frontend/lib/dev-settings-auth.ts` — gate for toggles/edits.
- `API_BASE` pattern at `RefinementEngine.tsx:62-64` — `import.meta.env.VITE_API_URL || "http://localhost:8080"`.
- `AdvancedPane` at `frontend/components/refinement/AdvancedPane.tsx` — collapsible container component. PipelineHealth + PipelineToggles render INSIDE AdvancedPane or above it.
- `RefinementEngine.tsx:463-525` — Group Sensitivity collapsible section (lines to REMOVE and replace).
- `RefinementEngine.tsx:73-79` — `GROUPS` constant (remove).
- `RefinementEngine.tsx:36-40` — `SENSITIVITY_DEFAULTS`, `SensitivityGroup`, `SensitivityValues` imports (remove).
- `RefinementEngine.tsx:107-118` — `groupSensOpen`/`groupSensRevealed` state (remove).
- `RefinementEngine.tsx:134-148` — `appliedSensitivities`, `pendingSensitivities`, `selectedPresetId`, `preview`, `v4Available` state — PRESERVE these if PresetSelector/AdvancedPane still uses them.
- `EconCountdownModal` at `frontend/components/feed/EconCountdownModal.tsx:114` — already mounted in `RiskFlowMain.tsx:168`. This track adds a test button; it does NOT modify this modal directly.
- `DeveloperSettings.tsx` — where the countdown test button goes.
- `SectionBreadcrumb.tsx` or similar — breadcrumb patterns for section headers.

## Known Issues to Preserve

- The AdvancedPane lock gate (password modal) must remain functional. Pipeline toggles should be gated behind the same edit lock.
- `EconCountdownModal.tsx` was built in S34-T8 and IS mounted at `RiskFlowMain.tsx:168`. It receives SSE events from `broadcastEconPrint`. Do NOT modify its rendering logic — only add a test trigger button in DeveloperSettings.
- PresetSelector and LexiconEditor are inside AdvancedPane and must not break. Removing NotchedFuse imports/section should not affect them.
- The `AnnotatableItem` import was commented out in S46.4 but the file still exists. Do not delete it.
- `Items` state at `RefinementEngine.tsx:96` is retained for rescore cache invalidation only (not rendered). Preserve it.

## Aesthetic Rules (Hard Bans)

- **No gradients** — flat surfaces only
- **No emojis** — not in UI, not in copy, not in push content
- **No Kanban borders** — no card-grid styling, no side-stripe borders
- **No AI sparkles** — no ✨, no animated gradient text, no decorative glyphs
- **No box-shadows** (except the T4 sidebar shadow — that's T4's domain)
- Thin `#c79f4a` accent borders where separation is needed
- Glassmorphic surfaces preferred over card grids: `background: var(--fintheon-glass-bg)`, `backdrop-filter: blur(Npx)`, border from `--fintheon-glass-border`
- Doto font for numerals, heading font for section titles per `/solvys-feels`
- Typography: `var(--font-heading)` for labels, `var(--font-data)` for numbers

## Implementation Steps

### Step 1: PipelineHealth Component

Create `frontend/components/refinement/PipelineHealth.tsx` (new file, <200 lines):

```typescript
// Stats table replacing the former Group Sensitivity NotchedFuse section
// Rows: pipeline name, status dot, headline count, error count, last seen, uptime %
// Columns sortable: click header to sort by count/errors/uptime

interface PipelineRow {
  pipeline_id: string;
  label: string; // Human-readable name
  enabled: boolean; // For status dot color
  headlineCount: number;
  errorCount: number;
  lastSuccessAt: string | null;
  uptimePct: number;
}

// Status dot colors: Green (#22c55e) = healthy (uptime > 95%),
// Amber (#c79f4a) = degraded (uptime 50-95%), Red (#ef4444) = broken (<50%),
// Grey (#52525b) = disabled
// Doto numerals for counts/uptime
// Alternating subtle bg on hover: color-mix(in srgb, var(--fintheon-accent) 4%, transparent)
// Loading: skeleton rows with shimmer
// Empty: "No pipeline data available — backends may not be reporting" + retry
// Error: "Pipeline stats unavailable" with error detail
```

### Step 2: PipelineToggles Component

Create `frontend/components/refinement/PipelineToggles.tsx` (new file, <150 lines):

```typescript
// Per-pipeline row: name + description + on/off toggle switch
// Optimistic toggle: flip switch immediately, revert on API failure + toast error
// Gated behind same edit lock as AdvancedPane (isRefinementEditUnlocked)
// Toggle off disables the pipeline; toggle on re-enables
// API: PATCH /api/admin/pipelines/:id { enabled: boolean }
// Auth: passes JWT via Authorization: Bearer header
// Error state: "Backend unreachable" with disabled switch
```

### Step 3: Modify RefinementEngine.tsx

**REMOVE:**

- Line 35: `import { NotchedFuse } from "./NotchedFuse";`
- Lines 36-40: `SENSITIVITY_DEFAULTS`, `SensitivityGroup`, `SensitivityValues` imports
- Line 41-45: `PresetSelector`, `BUILTIN_PRESETS`, `ScoringPreset` imports (if not used elsewhere)
- Line 49: `ScoreImpactPreview` import (if not used elsewhere)
- Lines 73-79: `GROUPS` constant
- Lines 107-118: `groupSensOpen`/`groupSensRevealed` state + useEffect
- Lines 134-148: `appliedSensitivities`, `pendingSensitivities`, `selectedPresetId`, `preview`, `v4Available` state (if no longer used — check PresetSelector usage)
- Lines 150-153: `isDirty` useMemo
- Lines 278-340: rescore preview useEffect (if no longer used)
- Lines 463-525: entire Group Sensitivity collapsible section + NotchedFuse map

**ADD:**

- Import `PipelineHealth` and `PipelineToggles`
- Import `usePipelineStats` hook (new — see Step 4)
- Import `usePipelineState` hook (new — see Step 4)
- After RegimeControl (line 461), add:
  ```tsx
  <PipelineHealth stats={pipelineStats} loading={statsLoading} error={statsError} />
  <PipelineToggles
    pipelines={pipelineStates}
    onToggle={handleTogglePipeline}
    disabled={!editUnlocked}
    loading={statesLoading}
    error={statesError}
  />
  ```

**PRESERVE:**

- RegimeControl section (line 461)
- AdvancedPane + all its children (MatrixEditor, LexiconEditor, QuickWeightEditor, CommentatorManager, SourceAccountsManager, EconFiltersManager)
- Edit lock gate logic
- Header toolbar (Apply/Discard/Re-Score All/Stats buttons)

### Step 4: Frontend Data Hooks

Create `frontend/hooks/usePipelineStats.ts` (new file, <60 lines):

- Fetches `GET /api/admin/pipeline-stats?hours=24` with JWT auth
- Returns `{ stats, loading, error, refetch }`
- Polls every 30s when tab visible
- Degrades gracefully: returns empty array on 401/404/network error

Create `frontend/hooks/usePipelineState.ts` (new file, <60 lines):

- Fetches `GET /api/admin/pipelines` with JWT auth
- Returns `{ pipelines, loading, error, togglePipeline(id, enabled) }`
- `togglePipeline`: optimistic update + PATCH + revert on failure + toast

### Step 5: CountdownFuse Component

Create `frontend/components/shared/CountdownFuse.tsx` (new file, <250 lines):

```
State machine:

IDLE → (T-5min event) → COUNTDOWN → (print arrives) → BLINK → BEAT|MISS|PAR → CLOSEABLE

COUNTDOWN: NothingFuse with value decrementing from 1→0 over event window
  Color: var(--fintheon-accent)
  animateIn from full, horizontal orientation, segments=10, thickness=6

BLINK: 3× rapid toggle (300ms × 6 = 1.8s total)
  CSS keyframe: opacity 1 → 0 → 1, alternated 3 times

BEAT (positive for instrument): settle at value=1.0
  Color: var(--fintheon-bullish) (#34d399, green)

MISS (negative for instrument): settle at value=0.0
  Color: var(--fintheon-bearish) (#ef4444, red)

PAR (on forecast): settle at value=1.0
  Color: var(--fintheon-accent) (user-applied theme primary)
  Full fuse → X icon starts pulsing

CLOSEABLE: after settle (500ms)
  X icon: scale 1→0.9→1 pulsate, 1s loop
  Tap X → fade-out → callback to parent
  Auto-close: 30s after print if not tapped → fade-out

FLOATING MODE:
  Drag on braille-pattern handle (matches PsychAssist fluidity: dragElastic 0.08)
  Glass pill surface: background var(--fintheon-glass-bg), blur(16px), thin accent border
  Position persists to localStorage: fintheon:countdown-position
  Double-tap handle to re-dock to header toolbar
```

Props interface:

```typescript
interface CountdownFuseProps {
  eventName: string;
  countdownSeconds: number; // seconds until print
  forecast: string;
  actual: string | null; // null during countdown
  previous: string;
  beatMiss: "beat" | "miss" | "par" | null; // null during countdown
  floating?: boolean;
  onClose?: () => void;
}
```

CSS keyframes (add to `frontend/index.css`):

```css
@keyframes countdown-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0;
  }
}
@keyframes x-pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(0.85);
  }
}
```

### Step 6: Dev Countdown Test Button

In `DeveloperSettings.tsx`, add a section:

```tsx
// New section: "Econ Countdown Test"
// Button: [Test 60s Countdown]
// On click: injects a synthetic broadcastEconPrint event into SSE:
//   eventName: "NFP (TEST)"
//   countdownSeconds: 60
//   forecast: "165K"
//   actual: "175K" (after 60s)
//   previous: "142K"
//   beatMiss: "beat"
// This fires the EconCountdownModal + CountdownFuse rendered in RiskFlowMain
```

The synthetic event should simulate the full lifecycle:

1. T-60s: CountdownFuse appears, starts draining
2. At 0s: "print" fires, beat/miss/par determined, X pulse starts
3. 30s later: auto-fade (or tap X to close earlier)

### Step 7: Econ Filter Editor

Create `frontend/components/refinement/EconFilterEditor.tsx` (new file, <200 lines):

```typescript
// Table of emoji/word filters that classify events as Econ/ASAP info
// Editable fields: emoji trigger, keyword pattern, macroLevel assignment
// Reuses existing lexcion-like CRUD pattern
// API: PATCH /api/lexicon/keywords (reuse existing lexicon routes for econ keywords)
// OR: new GET/PATCH /api/econ/filters endpoint

interface EconFilter {
  id: string;
  emoji: string; // e.g. "🔴" → critical, "⚠️" → high
  pattern: string; // regex pattern
  macroLevel: number; // 1-4
  category: string; // "Inflation" | "Job Market" | "Supply Chain" | "Fiscal"
}
```

### Step 8: Web URL Source Section in Stats Drawer

In `CatalystStatsDrawer.tsx`, after the category aggregates section (before bulk handling buttons), add:

```tsx
{/* WEB SOURCES — filtered to polling_type: "web" */}
<div style={{ marginTop: 24, paddingTop: 12, borderTop: RULER_STYLE }}>
  <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 11, ... }}>
    WEB SOURCES
  </h3>
  {webSources.length === 0 ? (
    <p style={{ fontSize: 10, color: "var(--fintheon-muted)" }}>
      No web sources ingested in this window
    </p>
  ) : (
    webSources.map((s) => (
      <div key={s.source}>{/* domain name + count */}</div>
    ))
  )}
</div>
```

Filter `sourceStats` (already fetched) by `polling_type === "web"`. The existing `SourceStat` interface at line 28 already has `polling_type: "social" | "web"`.

### Step 9: Better Error Handling

Throughout RefinementEngine.tsx, replace silent `catch {}` blocks with per-section error states:

```typescript
// Instead of:
catch { /* silent */ }

// Use:
const [pipelineError, setPipelineError] = useState<string | null>(null);
// ... in fetch:
catch (err) {
  setPipelineError(err instanceof Error ? err.message : "Failed to load pipeline stats");
}
// ... in render:
{pipelineError && (
  <div style={{ padding: 8, fontSize: 11, color: "var(--fintheon-bearish)" }}>
    {pipelineError}
    <button onClick={refetch}>Retry</button>
  </div>
)}
```

Apply to: `fetchPipelineStats`, `fetchPipelineStates`, `fetchSourceAccounts`, `fetchEconFilters`.

## Acceptance Criteria

- [ ] PipelineHealth table renders with 6 pipeline rows + status dots + 24h stats
- [ ] PipelineToggles can turn individual pipelines on/off with optimistic updates
- [ ] Group Sensitivity NotchedFuse section is removed from RefinementEngine
- [ ] CountdownFuse renders in all 5 states: countdown, blink, beat (green), miss (red), par (accent)
- [ ] CountdownFuse floating mode drags fluidly (PsychAssist parity, dragElastic 0.08)
- [ ] X icon pulses after print settle, tap closes, auto-close fires at 30s
- [ ] Dev countdown test button fires synthetic 60s countdown with full lifecycle
- [ ] Econ filter editor shows emoji/word table with inline edit
- [ ] Web URL source section appears in CatalystStatsDrawer
- [ ] Error states replace silent catch blocks in RefinementEngine
- [ ] No file exceeds 300 lines (split on growth)
- [ ] `npx tsc --noEmit --project frontend/tsconfig.json` passes
- [ ] `rm -rf dist && npx vite build` passes
- [ ] No emojis, gradients, Kanban borders, or AI sparkles in any new UI

## Validation Commands

```bash
# Type check
npx tsc --noEmit --project frontend/tsconfig.json

# Clean frontend build
rm -rf dist && npx vite build

# Check file sizes (all must be ≤300 lines)
wc -l frontend/components/refinement/PipelineHealth.tsx
wc -l frontend/components/refinement/PipelineToggles.tsx
wc -l frontend/components/shared/CountdownFuse.tsx
wc -l frontend/components/refinement/EconFilterEditor.tsx
wc -l frontend/components/refinement/RefinementEngine.tsx
```

## Commit Format

```
[v5.35.0] feat: T3 pipeline UI + CountdownFuse + econ filter editor — PipelineHealth table replacing NotchedFuse, PipelineToggles, CountdownFuse state machine (beat/miss/par/X-close), floating mode, dev test button, econ filter editor, web URL sources, error handling
```
