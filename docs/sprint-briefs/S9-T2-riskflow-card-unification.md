# S9-T2: RiskFlow Card Unification

## Context

Sprint 9, Track 2. Depends on **T1 being merged first** (shared icons + timeAgo). You are deduplicating the RiskFlow card anatomy that is copy-pasted across `RiskFlowDetailCard.tsx` (388 lines) and `ExpandableTapeItem.tsx` (454 lines). You also extract filter logic from the 1,109-line `RiskFlowMini.tsx`.

**Why:** These two card components render nearly identical UI — same severity coloring, same source icons, same expansion animation, same footer bar. They diverged because they were built for different surfaces (feed vs executive dashboard) but share 80% of their anatomy. A shared `AlertCardBase` with a `variant` prop eliminates ~400 lines of duplication.

## Files to Read First

Read these thoroughly before writing any code:

- `frontend/components/feed/RiskFlowDetailCard.tsx` — The "detail" card variant. After T1, it will import shared icons/timeAgo. Read the post-T1 version.
- `frontend/components/executive/ExpandableTapeItem.tsx` — The "tape" card variant. Nearly identical structure to RiskFlowDetailCard.
- `frontend/components/feed/DetailFooter.tsx` — Shared footer already extracted (176 lines). Both cards import this.
- `frontend/components/RiskFlowMini.tsx` — 1,109 lines. Contains filter state (severity filter, source filter, search, sort) that should be extracted.
- `frontend/lib/riskflow-feed.ts` — `RiskFlowAlert` type definition and `inferDirection()` utility
- `frontend/lib/severity-config.ts` — `SEVERITY_CONFIG` used by both cards
- `frontend/types/miroshark.ts` — `ivHeatColor()` used by both cards

## Files to Create

### 1. `frontend/components/feed/AlertCardBase.tsx` (~200 lines)

Shared card anatomy component. Both RiskFlowDetailCard and ExpandableTapeItem become thin wrappers around this.

**Props interface:**

```typescript
interface AlertCardBaseProps {
  alert: RiskFlowAlert;
  variant: "detail" | "tape";
  seen?: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Render expanded content (agent notes, econ data, tags, etc.) */
  expandedContent?: React.ReactNode;
  /** Optional action buttons for the collapsed header row */
  headerActions?: React.ReactNode;
}
```

**What AlertCardBase renders (shared anatomy):**

1. **Collapsed header row** — headline text with severity-based coloring, source icon (top right), summary line if exists
2. **Footer bar** — timeAgo, direction chevron (bull/bear), IV score with heat color, severity badge, risk type tag, expand chevron
3. **Expansion container** — smooth grid-template-rows transition (300ms), renders `expandedContent` children
4. **Fuse shimmer bar** — IV-heat colored gradient bar at bottom when expanded
5. **CSS classes** — `riskflow-fintheon-row` for high severity, `riskflow-severe-shimmer` for critical, `riskflow-expand-pulse` when expanded

**What AlertCardBase does NOT render (variant-specific):**

- Agent notes / "Generate Note" CTA → passed as `expandedContent` by the variant
- Econ data (beat/miss, A/F/P) → passed as `expandedContent`
- Tags, author handle, source/YouTube links → passed as `expandedContent`
- DetailFooter → passed as `expandedContent`
- Trade idea buttons → variant-specific

**Implementation approach:**

- Copy the collapsed header + footer bar + expansion grid from `RiskFlowDetailCard.tsx` (it's the more complete version)
- Use `variant` prop for minor differences: "detail" cards have `border-b border-zinc-800/60`, "tape" cards may have different padding
- Import `SourceIcon` from `../../lib/shared-icons` and `timeAgo` from `../../lib/time-utils` (T1 dependency)
- Import `SEVERITY_CONFIG` from `../../lib/severity-config` and `ivHeatColor` from `../../types/miroshark`
- Import `inferDirection` from `../../lib/riskflow-feed`

### 2. `frontend/hooks/useRiskFlowFilters.ts` (~90 lines)

Extract filter state management from RiskFlowMini.tsx.

```typescript
// [claude-code 2026-04-10] S9-T2: Extracted filter state from RiskFlowMini

import type { RiskFlowAlert } from "../lib/riskflow-feed";

type SeverityFilter = "all" | "critical" | "high" | "medium" | "low";
type SourceFilter = "all" | "x-fj" | "notion";

interface UseRiskFlowFiltersReturn {
  severityFilter: SeverityFilter;
  setSeverityFilter: (f: SeverityFilter) => void;
  sourceFilter: SourceFilter;
  setSourceFilter: (f: SourceFilter) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterAlerts: (alerts: RiskFlowAlert[]) => RiskFlowAlert[];
}

export function useRiskFlowFilters(): UseRiskFlowFiltersReturn {
  // Extract the filter state and filtering logic from RiskFlowMini
  // The filterAlerts function applies severity + source + search filters
}
```

**Find the filter logic in RiskFlowMini.tsx** — look for:

- `useState` calls for severity/source/search filters
- The `useMemo` or filter function that produces the filtered list
- The dropdown components that set these filters

Extract ONLY the state + filter function. Leave the dropdown UI components in RiskFlowMini.

## Files to Modify

### 1. `frontend/components/feed/RiskFlowDetailCard.tsx` (388 → ~200 lines)

**Before:** Full card with inline collapsed header, footer bar, expansion grid, severity logic, SVG logos, timeAgo.

**After:** Thin wrapper around AlertCardBase. Only renders variant-specific expanded content.

```typescript
// [claude-code 2026-04-10] S9-T2: Refactored to use AlertCardBase — detail variant
import { useState, useCallback } from "react";
import { AlertCardBase } from "./AlertCardBase";
import { DetailFooter } from "./DetailFooter";
import { BeatMissBadge } from "./BeatMissBadge";
import { useToast } from "../../contexts/ToastContext";

export function RiskFlowDetailCard({ alert, seen, onGenerateNote }: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <AlertCardBase
      alert={alert}
      variant="detail"
      seen={seen}
      expanded={expanded}
      onToggle={() => setExpanded(!expanded)}
      expandedContent={
        <>
          {/* Agent Note or Generate CTA */}
          {/* Econ Data */}
          {/* Tags + Author + Source/YouTube links */}
          <DetailFooter alert={alert} />
        </>
      }
    />
  );
}
```

Keep all the expanded content JSX (agent notes, econ data, tags, YouTube Watch button). Just move the card shell to AlertCardBase.

### 2. `frontend/components/executive/ExpandableTapeItem.tsx` (454 → ~200 lines)

**Same approach.** Thin wrapper around AlertCardBase with tape-specific expanded content. This file has additional trade-idea-specific rendering that must be preserved.

Read the file carefully — it has:

- Trade idea proposal section (entry/stop/TP/confidence)
- Agent note with "Chat" CTA
- Delete button for proposals
- These are all variant-specific and go in `expandedContent`

### 3. `frontend/components/RiskFlowMini.tsx` (1,109 → ~900 lines)

- Import and use `useRiskFlowFilters` hook
- Remove the inline filter state (`useState` for severity/source/search) and the filtering `useMemo`
- Keep everything else: AlertRow, TradeIdeaRow, StatusDot, FilterDropdown components, drag-drop logic, infinite scroll

## Key Rules

- **Visual output must be pixel-identical.** The user should not notice any visual change. Same colors, same spacing, same animations.
- **Preserve all event handlers.** `onClick`, `onDragStart`, `onGenerateNote`, `e.stopPropagation()` — all must work exactly as before.
- **Preserve all CSS classes.** `riskflow-fintheon-row`, `riskflow-severe-shimmer`, `riskflow-expand-pulse` — these are defined in the global CSS and must be applied in the same conditions.
- **Don't touch DetailFooter.tsx** — it's already extracted and working.

## Verification

```bash
# 1. Type check
npx tsc --noEmit -p frontend/tsconfig.json

# 2. Build
npx vite build

# 3. Visual test (manual):
# - Open RiskFlow full page → expand a critical card → verify agent note, econ data, tags, YouTube Watch button all render
# - Open Executive Dashboard → expand a tape item → verify same expansion behavior
# - Open RiskFlow mini (Strategium sidebar) → filter by severity, source → verify filters work
# - Drag a card from RiskFlowMini → verify drag-drop still works
```

## Changelog Entry

```typescript
{ date: '2026-04-10T22:30:00', agent: 'claude-code', summary: 'S9-T2: AlertCardBase shared card component, RiskFlowDetailCard + ExpandableTapeItem unified, filter hook extracted from RiskFlowMini', files: ['frontend/components/feed/AlertCardBase.tsx', 'frontend/hooks/useRiskFlowFilters.ts', 'frontend/components/feed/RiskFlowDetailCard.tsx', 'frontend/components/executive/ExpandableTapeItem.tsx', 'frontend/components/RiskFlowMini.tsx'] }
```

## DO NOT

- Do NOT modify shared-icons.tsx or time-utils.ts — T1 owns those
- Do NOT modify MainLayout.tsx — T3 owns that
- Do NOT modify FintheonThread.tsx or any chat component — T4 owns those
- Do NOT modify DetailFooter.tsx, BeatMissBadge.tsx, or RiskFlowMain.tsx — they work fine as-is
- Do NOT change the RiskFlowAlert type or severity classification logic
