# S9-T3: MainLayout Extraction

## Context

Sprint 9, Track 3. Depends on **T1 being merged first** (T1 removes the commented-out TeamOnboarding block from MainLayout). You are extracting hooks and configuration from the 989-line `MainLayout.tsx` to bring it under 700 lines.

**Why:** MainLayout is a god component with 30+ useState calls, keyboard shortcuts, layout state, browser transitions, data fetching, widget registry, and panel rendering all in one file. Extracting self-contained concerns into hooks makes the file navigable and testable.

## Files to Read First

Read the FULL file before planning extractions:

- `frontend/components/layout/MainLayout.tsx` — The entire file. You need to understand every useState, useEffect, useCallback, and their dependencies.
- `frontend/components/layout/TopHeader.tsx` — Receives callbacks from MainLayout (tab navigation, search toggle)
- `frontend/components/layout/TabRenderer.tsx` — Receives activeTab from MainLayout
- `frontend/contexts/SettingsContext.tsx` — Provides settings that MainLayout reads (topStepXEnabled, layoutOption, etc.)

## Files to Create

### 1. `frontend/hooks/useKeyboardShortcuts.ts` (~70 lines)

Extract the keyboard event listener from MainLayout.

```typescript
// [claude-code 2026-04-10] S9-T3: Extracted keyboard shortcuts from MainLayout

interface KeyboardShortcutHandlers {
  navigateTab: (tab: string) => void;
  setShowSearchModal: (open: boolean) => void;
  toggleManualDnd: () => void;
  setShowYouTubeMiniplayer: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useKeyboardShortcuts(handlers: KeyboardShortcutHandlers): void {
  // Extract the useEffect from MainLayout that adds keydown listener
  // Contains: TAB_MAP for Cmd+Shift+1-5, Cmd+K for search, Cmd+Shift+Y for YouTube, Escape handler
  // Note: preserve the eslint-disable comment if the deps array is intentionally sparse
}
```

**Source location in MainLayout:** Look for the `useEffect` that calls `addEventListener("keydown", ...)` — it's around lines 260-330.

### 2. `frontend/hooks/useLayoutState.ts` (~100 lines)

Extract layout state management — the collection of useState calls related to panel positions, collapse states, and layout modes.

```typescript
// [claude-code 2026-04-10] S9-T3: Extracted layout state from MainLayout

export interface LayoutState {
  missionControlCollapsed: boolean;
  setMissionControlCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  missionControlPosition: "right" | "left";
  setMissionControlPosition: React.Dispatch<React.SetStateAction<string>>;
  tapePosition: "right" | "left";
  setTapePosition: React.Dispatch<React.SetStateAction<string>>;
  combinedPanelCollapsed: boolean;
  setCombinedPanelCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  // ... other layout-related state
}

export function useLayoutState(): LayoutState {
  // Extract all layout-related useState calls
  // Include the TopStepX reset effect (when topStepXEnabled changes, reset panel positions)
  // Include the auto-DND effect
}
```

**Source location in MainLayout:** The useState block is around lines 114-206. The TopStepX reset effect is around lines 341-354.

**Be careful:** Only extract state that is PURELY about layout (panel positions, collapse states). Do NOT extract state that relates to data (IV scores, account data, feed alerts) or modals (search, settings).

### 3. `frontend/hooks/useBrowserTransition.ts` (~35 lines)

Extract the browser page transition / View Transitions API logic.

```typescript
// [claude-code 2026-04-10] S9-T3: Extracted browser transition from MainLayout

export function useBrowserTransition(
  topStepXEnabled: boolean,
  browserVisible: boolean,
): { transitioning: boolean } {
  // Extract the useEffect that handles fade-in/fade-out when switching to/from trading browser
  // Returns transitioning state for the parent to use in className
}
```

**Source location in MainLayout:** Look for the effect that manages `browserVisible` / `transitioning` state — around lines 417-445.

### 4. `frontend/lib/mission-widget-config.ts` (~45 lines)

Extract the widget ordering/registry configuration.

```typescript
// [claude-code 2026-04-10] S9-T3: Extracted mission widget config from MainLayout

export type MissionWidgetId =
  | "er"
  | "autopilot"
  | "regime"
  | "account"
  | "blindspots"
  | "calendar";

export interface MissionWidget {
  id: MissionWidgetId;
  label: string;
  defaultVisible: boolean;
}

export const MISSION_WIDGETS: MissionWidget[] = [
  // Extract the widget list from MainLayout
];

export const DEFAULT_WIDGET_ORDER: MissionWidgetId[] = [
  // Extract the default ordering
];
```

**Source location in MainLayout:** Look for the widget ordering array/config — around lines 499-542.

## Files to Modify

### 1. `frontend/components/layout/MainLayout.tsx` (989 → ~650 lines)

- Import all four extracted modules
- Replace inline useState calls for layout state with `useLayoutState()` destructure
- Replace inline keyboard useEffect with `useKeyboardShortcuts({ navigateTab, setShowSearchModal, ... })`
- Replace inline browser transition effect with `useBrowserTransition(topStepXEnabled, browserVisible)`
- Replace inline widget config with import from `mission-widget-config.ts`
- All JSX stays in MainLayout — you're only extracting hooks and config, not rendering

## Key Rules

- **Do NOT change any visual output.** MainLayout must render identically before and after.
- **Do NOT extract modal state** (showSearchModal, showSettings, etc.) — these are too tightly coupled to the JSX.
- **Do NOT extract data fetching effects** (IV polling, account polling) — these could be hooks but are out of scope for this track.
- **Do NOT touch the JSX return block** except to update references from inline state to hook returns.
- **Preserve all TypeScript types.** If MainLayout has inline type definitions, move them to the hook file or keep them.
- **Test keyboard shortcuts after extraction.** Stale closures are the #1 risk — if the shortcuts useEffect has intentionally sparse deps, preserve that behavior.

## Verification

```bash
# 1. Type check
npx tsc --noEmit -p frontend/tsconfig.json

# 2. Build
npx vite build

# 3. Functional test (manual):
# - Cmd+K → search modal opens
# - Cmd+Shift+1 through Cmd+Shift+5 → navigates to correct tabs
# - Cmd+Shift+Y → YouTube miniplayer toggles
# - Escape → closes open modals
# - Toggle TopStepX trading mode → browser fades in/out smoothly
# - Mission Control widgets appear in correct order
```

## Changelog Entry

```typescript
{ date: '2026-04-10T23:00:00', agent: 'claude-code', summary: 'S9-T3: Extract useKeyboardShortcuts, useLayoutState, useBrowserTransition, mission-widget-config from MainLayout (989→650 lines)', files: ['frontend/hooks/useKeyboardShortcuts.ts', 'frontend/hooks/useLayoutState.ts', 'frontend/hooks/useBrowserTransition.ts', 'frontend/lib/mission-widget-config.ts', 'frontend/components/layout/MainLayout.tsx'] }
```

## DO NOT

- Do NOT modify shared-icons.tsx or time-utils.ts — T1 owns those
- Do NOT modify RiskFlowDetailCard, ExpandableTapeItem, or RiskFlowMini — T2 owns those
- Do NOT modify FintheonThread or any chat component — T4 owns those
- Do NOT modify FooterToolbar.tsx — T1 already cleaned the dead import
- Do NOT extract rendering logic into separate components — only extract hooks and config
