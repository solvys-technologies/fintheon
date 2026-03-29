# S8-T9: Component Rename — Names Match What They Are

**Branch**: `v.8.28.1`
**Context**: Internal component names are completely disconnected from what the user sees. This causes massive miscommunication between agents, briefs, and the human. Fix it.

## RENAME TABLE

| Current Name | New Name | File Rename | Tab ID Change |
|---|---|---|---|
| `ExecutiveDashboard` | `MainDashboard` | `ExecutiveDashboard.tsx` → `MainDashboard.tsx` | `executive` → `dashboard` |
| `NewsSection` | `RiskFlowMain` | `feed/NewsSection.tsx` → `feed/RiskFlowMain.tsx` | `news` → `riskflow` |
| `RiskFlowPanel` | `RiskFlowMini` | `RiskFlowPanel.tsx` → `RiskFlowMini.tsx` | N/A (not a tab) |
| `AskHarpChatPanel` | `AskHarpSidebar` | `chat/AskHarpChatPanel.tsx` → `chat/AskHarpSidebar.tsx` | N/A |
| `TopStepXBrowser` | `TradingBrowser` | `TopStepXBrowser.tsx` → `TradingBrowser.tsx` | N/A |
| `TradingJournal` | `PerformanceJournal` | `journal/TradingJournal.tsx` → `journal/PerformanceJournal.tsx` | `earnings` → `performance` |
| `ResearchDepartment` | `Scriptorium` | `executive/ResearchDepartment.tsx` → `executive/Scriptorium.tsx` | `notion` → `scriptorium` |
| `ApparatusPage` | `ApparatusMap` | `apparatus/ApparatusPage.tsx` → `apparatus/ApparatusMap.tsx` | stays `apparatus` |
| `NarrativeFlow` | `NarrativeMap` | `narrative/NarrativeFlow.tsx` → `narrative/NarrativeMap.tsx` | stays `narrative` |

## PROCEDURE (for each rename)

### Step 1: Rename the file
```bash
git mv frontend/components/[old].tsx frontend/components/[new].tsx
```

### Step 2: Update the export inside the file
```typescript
// Old: export function ExecutiveDashboard() {
// New: export function MainDashboard() {
```

### Step 3: Update ALL imports across the codebase
```bash
grep -rn "OldName" frontend/ --include="*.tsx" --include="*.ts" | grep -v node_modules
```
Replace every import path and component reference.

### Step 4: Update tab IDs (where applicable)
Files that reference tab IDs:
- `frontend/components/layout/NavSidebar.tsx` — `NAV_ITEMS_MAP`, `NavTab` type
- `frontend/components/layout/MainLayout.tsx` — `NavTab` type, `activeTab` comparisons, keyboard shortcuts `TAB_MAP`
- `frontend/components/layout/SectionBreadcrumb.tsx` — breadcrumb labels
- `frontend/components/layout/FooterToolbar.tsx` — tab references
- `frontend/components/executive/ExecutiveDashboard.tsx` — `onNavigateTab` calls

### Step 5: Build check after EACH rename
```bash
npx vite build 2>&1 | grep -E "error|Error"
```
Fix any broken imports before moving to next rename.

## ORDER OF OPERATIONS
Do them one at a time, build-check between each:
1. `ExecutiveDashboard` → `MainDashboard` + tab `executive` → `dashboard`
2. `NewsSection` → `RiskFlowMain` + tab `news` → `riskflow`
3. `RiskFlowPanel` → `RiskFlowMini`
4. `AskHarpChatPanel` → `AskHarpSidebar`
5. `TopStepXBrowser` → `TradingBrowser`
6. `TradingJournal` → `PerformanceJournal` + tab `earnings` → `performance`
7. `ResearchDepartment` → `Scriptorium` + tab `notion` → `scriptorium`
8. `ApparatusPage` → `ApparatusMap`
9. `NarrativeFlow` → `NarrativeMap`

## ALSO UPDATE
- `src/lib/changelog.ts` — add entry for rename sprint
- Any sprint briefs that reference old names (future briefs only — don't rewrite history)
- `frontend/components/layout/NavSidebar.tsx` — update labels if they reference old internal names
- localStorage keys that use old tab IDs (e.g. `fintheon:panel:*`) — add migration in `data-migration.ts`

## VERIFICATION
1. `npx vite build` — clean, zero errors
2. Every sidebar nav item still works
3. Keyboard shortcuts (Cmd+Shift+1-5) still navigate to correct tabs
4. No console errors about missing components
5. `grep -rn "ExecutiveDashboard\|NewsSection\|RiskFlowPanel\|AskHarpChatPanel\|TopStepXBrowser\|TradingJournal\|ResearchDepartment\|ApparatusPage\|NarrativeFlow" frontend/ --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v AMEND | grep -v changelog` — returns 0 results (all old names gone)

## DO NOT
- Do NOT rename Consilium, Sanctum, or Aquarium (those are fine)
- Do NOT rename backend files (this is frontend only)
- Do NOT change component behavior — rename ONLY
- Do NOT rename shared UI components (Button, Card, etc.)
- Do NOT rename contexts or hooks (RiskFlowContext stays RiskFlowContext)
