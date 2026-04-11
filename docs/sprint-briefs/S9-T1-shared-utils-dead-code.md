# S9-T1: Foundation — Shared Utilities + Dead Code Purge

## Context

Sprint 9, Track 1. This is the **foundation track** — T2, T3, and T4 depend on the shared modules you create here. You are extracting duplicated utility functions (timeAgo, SVG logo icons) into shared files, then updating all consumers. You also delete confirmed dead code and remove unused imports.

**Why:** `timeAgo()` is defined identically in 7 files. SVG source logos (XLogo, NotionLogo) are copy-pasted across 4 files. `SubScoreBar.tsx` has zero imports anywhere (replaced by `DetailFooter` months ago). Cleaning this up before T2-T4 prevents merge conflicts.

## Files to Read First

Read these to understand what you're extracting:

- `frontend/components/feed/RiskFlowDetailCard.tsx` — Has the canonical versions of XLogo, NotionLogo, YouTubeLogo, SourceIcon, and timeAgo
- `frontend/components/RiskFlowMini.tsx` — Has XLogo, NotionLogo, MarketWatchLogo, SourceIcon, timeAgo (slightly different versions)
- `frontend/components/executive/ExpandableTapeItem.tsx` — Has XLogo, NotionLogo, SourceIcon, timeAgo
- `frontend/types/team.ts` — Has the only EXPORTED timeAgo (others are file-local)
- `frontend/components/mission-control/RiskFlowMiniWidget.tsx` — Has inline timeAgo
- `frontend/components/narrative/NarrativeMiniCard.tsx` — Has inline timeAgo
- `frontend/components/layout/FooterToolbar.tsx` — Line 28: unused `useHarperOps` import
- `frontend/components/layout/MainLayout.tsx` — Lines ~980+: commented-out TeamOnboarding block

## Files to Create

### 1. `frontend/lib/shared-icons.tsx` (~80 lines)

All SVG source logos extracted into one shared file.

```typescript
// [claude-code 2026-04-10] S9-T1: Shared SVG source logos — extracted from RiskFlowDetailCard, RiskFlowMini, ExpandableTapeItem

export function XLogo({ className }: { className?: string }) {
  // The X (Twitter) bird logo — use the version from RiskFlowDetailCard.tsx
}

export function NotionLogo({ className }: { className?: string }) {
  // Notion logo — use the version from RiskFlowDetailCard.tsx
}

export function YouTubeLogo({ className }: { className?: string }) {
  // YouTube play button — use the version from RiskFlowDetailCard.tsx
}

export function MarketWatchLogo({ className }: { className?: string }) {
  // MarketWatch logo — use the version from RiskFlowMini.tsx (it's the only file that has this)
}

export function SourceIcon({ source, className }: { source: string; className?: string }) {
  // Dispatches to the correct logo based on source string
  // Use the version from RiskFlowDetailCard.tsx as canonical
  const s = source.toLowerCase();
  if (s === "notion-trade-idea" || s.includes("notion")) return <NotionLogo className={className} />;
  if (s.includes("marketwatch")) return <MarketWatchLogo className={className} />;
  return <XLogo className={className} />;
}
```

### 2. `frontend/lib/time-utils.ts` (~30 lines)

```typescript
// [claude-code 2026-04-10] S9-T1: Shared time utilities — extracted from 7 files

/** Human-readable relative time from ISO string ("just now", "5m ago", "2h ago", "3d ago") */
export function timeAgo(iso: string): string {
  // Use the version from RiskFlowDetailCard.tsx as canonical
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

/** Format Date to locale time string */
export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
```

**Note on NotificationCenter.tsx:** Its version of timeAgo takes a `Date` instead of `string`. Convert to: `timeAgo(date.toISOString())` when updating its call site.

## Files to Delete

| File                                       | Lines | Reason                                                                                                              |
| ------------------------------------------ | ----- | ------------------------------------------------------------------------------------------------------------------- |
| `frontend/components/feed/SubScoreBar.tsx` | 77    | Zero imports anywhere. Replaced by DetailFooter in S3 sprint. Verify with `grep -rn "SubScoreBar" frontend/` first. |

## Files to Modify

For each file below, remove the inline definition of the duplicated function/component and replace with an import from the shared file.

### 1. `frontend/components/feed/RiskFlowDetailCard.tsx`

- Remove: `function XLogo`, `function NotionLogo`, `function YouTubeLogo`, `function SourceIcon`, `function timeAgo`
- Add import: `import { XLogo, NotionLogo, YouTubeLogo, SourceIcon } from "../../lib/shared-icons";`
- Add import: `import { timeAgo } from "../../lib/time-utils";`
- Lines saved: ~80

### 2. `frontend/components/executive/ExpandableTapeItem.tsx`

- Remove: `function XLogo`, `function NotionLogo`, `function SourceIcon`, `function timeAgo`
- Add import: `import { XLogo, NotionLogo, SourceIcon } from "../../lib/shared-icons";`
- Add import: `import { timeAgo } from "../../lib/time-utils";`
- Lines saved: ~55

### 3. `frontend/components/RiskFlowMini.tsx`

- Remove: `function XLogo`, `function NotionLogo`, `function MarketWatchLogo`, `function SourceIcon`, `function timeAgo`
- Add import: `import { XLogo, NotionLogo, MarketWatchLogo, SourceIcon } from "../lib/shared-icons";`
- Add import: `import { timeAgo } from "../lib/time-utils";`
- Lines saved: ~90

### 4. `frontend/components/layout/FloatingWidget.tsx`

- Remove any inline XLogo/NotionLogo definitions
- Add import from shared-icons
- Lines saved: ~25

### 5. `frontend/components/mission-control/RiskFlowMiniWidget.tsx`

- Remove inline `timeAgo` function
- Add import: `import { timeAgo } from "../../lib/time-utils";`
- Lines saved: ~15

### 6. `frontend/components/narrative/NarrativeMiniCard.tsx`

- Remove inline `timeAgo` function
- Add import from time-utils
- Lines saved: ~15

### 7. `frontend/components/NotificationCenter.tsx`

- Remove inline `timeAgo` function (note: this version takes `Date` not `string`)
- Add import from time-utils
- Update call sites: `timeAgo(someDate)` → `timeAgo(someDate.toISOString())` if the input is a Date object
- Lines saved: ~15

### 8. `frontend/types/team.ts`

- Remove the exported `timeAgo` function
- Add: `export { timeAgo } from "../lib/time-utils";` (re-export so any consumers of team.ts don't break)
- Lines saved: ~15

### 9. `frontend/components/layout/FooterToolbar.tsx`

- Remove line 28: `import { useHarperOps } from "../../hooks/useHarperOps";`
- That's it. One line.

### 10. `frontend/components/layout/MainLayout.tsx`

- Remove the commented-out TeamOnboarding block (lines ~980+):
  ```jsx
  {
    /* TeamOnboarding permanently removed — security risk, exposes Supabase credentials
    <TeamOnboarding ... */
  }
  ```
- That's it. Don't touch any other part of MainLayout — T3 handles the hook extractions.

## Key Rules

- **The canonical versions** come from `RiskFlowDetailCard.tsx`. When in doubt, use that file's implementation.
- **Do NOT delete** `useRiskFlow.ts`, `MinimalTapeWidget.tsx`, `MinimalERMeter`, `SectionBreadcrumb`, or `NotificationCenter` — the audit incorrectly flagged these as dead but they are actively used.
- **Do NOT touch** MainLayout hook logic, keyboard shortcuts, or layout state — T3 owns those.
- **Do NOT touch** FintheonThread.tsx — T4 owns that.

## Verification

```bash
# 1. Confirm no duplicate definitions remain
grep -rn "function timeAgo" frontend/ --include="*.tsx" --include="*.ts" | grep -v "node_modules\|time-utils.ts"
# Should return ZERO results (only time-utils.ts should define it)

grep -rn "function XLogo\|function NotionLogo" frontend/ --include="*.tsx" | grep -v "node_modules\|shared-icons.tsx"
# Should return ZERO results

# 2. Confirm SubScoreBar is truly dead before deleting
grep -rn "SubScoreBar" frontend/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"
# Should return ZERO results (or only the file itself)

# 3. Build
npx tsc --noEmit -p frontend/tsconfig.json
npx vite build
```

## Changelog Entry

```typescript
{ date: '2026-04-10T22:00:00', agent: 'claude-code', summary: 'S9-T1: Extract shared timeAgo + SVG logos, delete SubScoreBar, purge dead imports from FooterToolbar/MainLayout', files: ['frontend/lib/shared-icons.tsx', 'frontend/lib/time-utils.ts', 'frontend/components/feed/SubScoreBar.tsx (deleted)', 'frontend/components/feed/RiskFlowDetailCard.tsx', 'frontend/components/executive/ExpandableTapeItem.tsx', 'frontend/components/RiskFlowMini.tsx', 'frontend/components/layout/FooterToolbar.tsx', 'frontend/components/layout/MainLayout.tsx'] }
```

## DO NOT

- Do NOT modify AlertCardBase, filter hooks, or card component structure — T2 owns that
- Do NOT extract hooks from MainLayout — T3 owns that
- Do NOT touch FintheonThread or MessageRenderer — T4 owns that
- Do NOT delete any file not explicitly listed in the "Files to Delete" section
