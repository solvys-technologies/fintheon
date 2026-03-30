# S9-T1: Component Rename + Kanban Border Purge

**Sprint**: S9 — Fix Everything Right
**Track**: T1 (RUNS FIRST — all other tracks depend on this)
**Branch**: `v.8.28.1`

## Context
Internal component names are disconnected from what the user sees, causing massive miscommunication between agents, briefs, and humans. Additionally, kanban-style `border-l-2` left accent borders appear in 20 places across the app — they must all die. This track also renames "Harper-Hermes" → "Harper-Opus" and "Commentators" → "Persons of Interest" everywhere.

## Design Direction
- Solvys Gold palette: BG #050402, Accent #c79f4a, Text #f0ead6
- No gradients, no colored emojis
- No kanban left-borders anywhere — use full subtle borders or no borders at all

---

## PART 1: COMPONENT RENAMES

### Rename Table

| # | Old Name | New Name | Old File | New File | Tab ID Change |
|---|----------|----------|----------|----------|---------------|
| 1 | `ExecutiveDashboard` | `MainDashboard` | `executive/ExecutiveDashboard.tsx` | `executive/MainDashboard.tsx` | `executive` → `dashboard` |
| 2 | `NewsSection` | `RiskFlowMain` | `feed/NewsSection.tsx` | `feed/RiskFlowMain.tsx` | `news` → `riskflow` |
| 3 | `RiskFlowPanel` | `RiskFlowMini` | `RiskFlowPanel.tsx` | `RiskFlowMini.tsx` | N/A |
| 4 | `AskHarpChatPanel` | `AskHarpSidebar` | `chat/AskHarpChatPanel.tsx` | `chat/AskHarpSidebar.tsx` | N/A |
| 5 | `TopStepXBrowser` | `TradingBrowser` | `TopStepXBrowser.tsx` | `TradingBrowser.tsx` | N/A |
| 6 | `TradingJournal` | `PerformanceJournal` | `journal/TradingJournal.tsx` | `journal/PerformanceJournal.tsx` | `earnings` → `performance` |
| 7 | `ResearchDepartment` | `Scriptorium` | `executive/ResearchDepartment.tsx` | `executive/Scriptorium.tsx` | `notion` → `scriptorium` |
| 8 | `ApparatusPage` | `ApparatusMap` | `apparatus/ApparatusPage.tsx` | `apparatus/ApparatusMap.tsx` | stays `apparatus` |
| 9 | `NarrativeFlow` | `NarrativeMap` | `narrative/NarrativeFlow.tsx` | `narrative/NarrativeMap.tsx` | stays `narrative` |

### Procedure (for EACH rename, in order)

**Step 1**: Rename the file
```bash
git mv frontend/components/[old-path] frontend/components/[new-path]
```

**Step 2**: Update the export name inside the file
```typescript
// Old: export function ExecutiveDashboard() {
// New: export function MainDashboard() {
```

**Step 3**: Update ALL imports
```bash
grep -rn "OldName" frontend/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".md"
```
Fix every import path and component reference.

**Step 4**: Update tab IDs where applicable. Files that reference tab IDs:
- `frontend/components/layout/NavSidebar.tsx` — `NAV_ITEMS_MAP`, `NavTab` type union
- `frontend/components/layout/MainLayout.tsx` — `NavTab` type, `activeTab` comparisons, keyboard shortcuts `TAB_MAP`
- `frontend/components/layout/SectionBreadcrumb.tsx` — breadcrumb labels
- `frontend/components/layout/FooterToolbar.tsx` — tab references
- `frontend/components/executive/ExecutiveDashboard.tsx` → now `MainDashboard.tsx` — `onNavigateTab` calls

**Step 5**: Build check after EACH rename
```bash
npx vite build 2>&1 | grep -E "error|Error"
```

### Import Counts (from audit)
- `NewsSection` — 2 imports (MainLayout:14, MainLayout:759)
- `ExecutiveDashboard` — 2 imports (MainLayout:27, MainLayout:749)
- `RiskFlowPanel` — 3 imports (MainLayout:30, MainLayout:585, MainLayout:644) — **default export**, update accordingly
- `AskHarpChatPanel` — 2 imports (MainLayout:33, MainLayout:868)
- `TopStepXBrowser` — 4 imports (FooterToolbar:9 type, TopHeader:23 type, MainLayout:16, MainLayout:727)
- `TradingJournal` — 2 imports (MainLayout:44, MainLayout:793)
- `ResearchDepartment` — 2 imports (MainLayout:28, MainLayout:783)
- `ApparatusPage` — 2 imports (MainLayout:46, MainLayout:778)
- `NarrativeFlow` — **46 references** across many files — be thorough

---

## PART 2: KANBAN BORDER PURGE

Kill ALL `border-l-2` and `border-l-4` kanban-style left accent borders. Replace with appropriate alternatives.

### All 20 instances to fix:

| # | File | Line | Current | Replacement |
|---|------|------|---------|-------------|
| 1 | `chat/parts/ReasoningPart.tsx` | 23 | `border-l-2` | `border border-[var(--fintheon-accent)]/10 rounded` (subtle full border) |
| 2 | `chat/PersonaDropdown.tsx` | 79 | `border-l-2` (active) | `bg-[var(--fintheon-accent)]/10` (background highlight, no border) |
| 3 | `chat/PersonaDropdown.tsx` | 80 | `border-l-2` (hover) | `hover:bg-[var(--fintheon-accent)]/5` (background highlight) |
| 4 | `chat/FintheonThread.tsx` | 73 | `border-l-2` (blockquote) | `border-l border-[var(--fintheon-accent)]/20` (thinner, 1px) |
| 5 | `narrative/SanctumBriefing.tsx` | 27 | `border-l-2` (summary) | `border border-[var(--fintheon-accent)]/10 rounded` |
| 6 | `narrative/SanctumBriefing.tsx` | 59 | `border-l-2` (risk alerts) | `border border-red-500/15 rounded` |
| 7 | `apparatus/CommandmentsSidebar.tsx` | 48 | `border-l-2` | `border-l border-[var(--fintheon-accent)]/15` (1px thin) |
| 8 | `dashboard/RegimeCard.tsx` | 42 | `border-l-2` | `border border-[var(--fintheon-accent)]/15 rounded` |
| 9 | `RiskFlowPanel.tsx` | 211 | `border-l-2` (alert row hover) | Remove entirely — hover state uses `bg-[var(--fintheon-accent)]/5` instead |
| 10 | `feed/RiskFlowDetailCard.tsx` | 89 | `border-l-4` (expanded) | `border border-[var(--fintheon-accent)]/20 rounded` |
| 11 | `feed/RiskFlowDetailCard.tsx` | 90 | `border-l-2` (collapsed) | `border border-[var(--fintheon-border)]/10 rounded` |
| 12 | `feed/FeedItem.tsx` | 40 | `border-l-2` | `border border-[var(--fintheon-border)]/10 rounded` |
| 13 | `TradeIdeaModal.tsx` | 109 | `border-l-2` | `border border-[var(--fintheon-accent)]/10 rounded` |
| 14 | `mission-control/BriefMiniWidget.tsx` | 198 | `border-l-2` | Remove entirely |
| 15 | `mission-control/RiskFlowMiniWidget.tsx` | 63 | `border-l-2` | Remove entirely |
| 16 | `mission-control/BlindspotsWidget.tsx` | 104 | `border-l-2` | `border border-[var(--fintheon-accent)]/10 rounded` |
| 17 | `executive/ExpandableTapeItem.tsx` | 94 | `border-l-4`/`border-l-2` (dynamic) | `border border-[var(--fintheon-accent)]/20 rounded` (expanded) / `border border-[var(--fintheon-border)]/10 rounded` (collapsed) |
| 18 | `executive/ExecutiveDashboard.tsx` | 268 | `border-l-2` (brief textarea) | `border border-[var(--fintheon-accent)]/10 rounded` |
| 19 | `executive/ExecutiveDashboard.tsx` | 318 | `border-l-2` (KPI section) | `border border-[var(--fintheon-accent)]/10 rounded` |

**Rule**: Every replacement uses `rounded` (subtle border-radius) and CSS vars for color. No raw hex. No left-only borders.

---

## PART 3: NAME UPDATES

### "Harper-Hermes" → "Harper-Opus"
```bash
grep -rn "Harper-Hermes\|harper-hermes\|HarperHermes" frontend/ --include="*.tsx" --include="*.ts"
```
Replace every instance. This is the agent's new identity — Claude CLI Opus is the CAO, not Hermes.

### "Commentators" → "Persons of Interest"
```bash
grep -rn -i "commentator" frontend/ backend-hono/ --include="*.tsx" --include="*.ts"
```
Wherever the gov officials (Fed Chair, Trump, Bessent, Rubio, Lutnick, Witkoff, Greer, Navarro) are listed as "commentators" → rename to "Persons of Interest".

Also check:
- `backend-hono/src/services/miroshark/miroshark-client.ts` — agent definitions
- `backend-hono/src/types/commentator.ts` — type definitions
- `frontend/components/refinement/RefinementEngine.tsx` — UI labels

---

## PART 4: CLEANUP

### Remove debug console.logs (4 instances)
1. `frontend/components/feed/NewsFeed.tsx:30` — remove
2. `frontend/components/feed/MinimalTapeWidget.tsx:63` — remove
3. `frontend/components/feed/MinimalTapeWidget.tsx:69` — remove
4. `frontend/components/chat/FintheonThread.tsx:291` — remove

---

## VERIFICATION

Run these checks after all changes:
```bash
# 1. No old component names remain
grep -rn "NewsSection\|ExecutiveDashboard\|RiskFlowPanel\b\|AskHarpChatPanel\|TopStepXBrowser\|TradingJournal\|ResearchDepartment\|ApparatusPage\b\|NarrativeFlow\b" frontend/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v ".md" | grep -v changelog | grep -v AMEND

# 2. No kanban borders remain
grep -rn "border-l-2\|border-l-4" frontend/components/ --include="*.tsx"

# 3. No Harper-Hermes remains
grep -rn "Harper-Hermes\|harper-hermes" frontend/ --include="*.tsx" --include="*.ts"

# 4. Build passes
npx vite build
```

All 4 checks should return 0 results (except build which should succeed).

## Changelog Entry
```typescript
{ date: '2026-03-29T23:00:00', agent: 'claude-code', summary: 'S9-T1: Rename 9 components + 5 tab IDs, purge 20 kanban borders, Harper-Hermes→Harper-Opus, Commentators→Persons of Interest, remove debug console.logs', files: ['frontend/components/layout/MainLayout.tsx', 'frontend/components/layout/NavSidebar.tsx', 'frontend/components/layout/FooterToolbar.tsx', 'frontend/components/layout/SectionBreadcrumb.tsx', '+ 20 border-fixed files', '+ 9 renamed components'] }
```

## DO NOT
- Do NOT change any component behavior or logic — rename and restyle ONLY
- Do NOT touch backend service logic
- Do NOT modify NarrativeForceCanvas (T3 owns that)
- Do NOT modify RiskFlowContext (T2 owns that)
- Do NOT add new components
- Do NOT remove any features
