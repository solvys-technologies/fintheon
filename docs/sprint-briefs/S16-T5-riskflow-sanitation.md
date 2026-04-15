# Task Brief: S16-T5 — RiskFlow Feed Sanitation + Filter Refinement

**Date:** 2026-04-15
**Scope:** Auto-purge zero-IV items, expand source/priority filters, enhance dismissal feedback loop, and research Claude Code Routines for hook migration.
**Estimated files:** 6
**Repo root:** `~/Documents/Codebases/fintheon`
**Working directory:** `~/Documents/Codebases/fintheon`

## Prerequisites

- Read `~/Documents/Codebases/fintheon/CLAUDE.md` for project rules (changelog protocol, no gradients/colored emojis).
- Build frontend: `cd ~/Documents/Codebases/fintheon && bun run build`
- Build backend: `cd ~/Documents/Codebases/fintheon/backend-hono && bun run build`
- Backend is launchd-managed: restart with `launchctl unload/load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist`
- CRITICAL MEMORY RULES:
  - Never bulk-delete scored items — DELETE must scope to specific conditions, never blanket macroLevel
  - Unified Pipeline Mandate: ONE DB, never delete items without specific scope, never bypass filters

## Context

The RiskFlow pipeline now intakes 5x more headlines from expanded sources (Financial Juice, DeItaOne, OSINT, Twitter/Rettiwt, Econ Calendar, Polymarket, Kalshi). Current sanitation is insufficient: zero-IV items linger, low-priority noise clutters the feed, dismissed items may resurface, source filters are limited to "All | X / FJ", and Claude Hooks don't actively police feed quality. We need automated purging, expanded filters, smarter feedback loops, and research into migrating hooks to the new Claude Code Routines feature.

## Files to Read First

- `backend-hono/src/services/riskflow/central-scorer.ts` — The scoring cycle: `scoringCycle()` processes unscored items, writes to `scored_riskflow_items`. Lines 54-91: dismissed headline cache + similarity check. This is where auto-purge and batch tagging get added.
- `backend-hono/src/routes/riskflow/handlers.ts` — Lines 842-932: manual refresh handler. Lines 982-1050: `handleNotRelevant` — dismissal flow (logs to `riskflow_dismissed_items`, enqueues Harper task, deletes from scored + raw).
- `frontend/components/feed/RiskFlowMain.tsx` — Lines 13-14: `PriorityFilter` and `SourceFilter` types (currently "all"|"critical"|"high"|"medium"|"low" and "all"|"notion"|"twitter"). Lines 107-133: filter logic in useMemo.
- `frontend/hooks/useRiskFlowFilters.ts` — Filter hook used by both RiskFlowMain and RiskFlowMini (Strategium sidebar).
- `frontend/contexts/RiskFlowContext.tsx` — Lines 77-86: source mapping from backend names to frontend types.
- `frontend/components/feed/RiskFlowDetailCard.tsx` — The card component where "Not Relevant" action lives.
- `backend-hono/src/config/catalyst-levels.ts` — Catalyst level definitions: Level 4 (Critical, IV>=90), Level 3 (High, IV>=70), Level 2 (Medium, IV>=40), Level 1 (Low, IV>=0).
- `.claude/settings.json` — Current Claude Hooks configuration.

## What to Build/Change

### 1. Auto-Purge IV 0.0 Items

- **Path:** `backend-hono/src/services/riskflow/central-scorer.ts`
- **Action:** Modify
- **Spec:**
  - After `writeScoredItems()` completes in the scoring cycle, add a purge step:
    ```typescript
    // Purge zero-IV items older than 1 hour from both tables
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: purgedScored } = await sb
      .from("scored_riskflow_items")
      .delete()
      .eq("iv_score", 0)
      .lt("published_at", oneHourAgo);
    // Mirror purge from raw table — match by headline for items that scored 0
    ```
  - Log: `log.info("Purged zero-IV items", { scored: purgedScored })`
  - This runs on every scoring cycle (every ~30s)

### 2. Low-Priority Batch Tagging for Harper

- **Path:** `backend-hono/src/services/riskflow/central-scorer.ts`
- **Action:** Modify
- **Spec:**
  - After scoring cycle, collect IDs of all newly scored items with `macro_level = 1`
  - If any exist, enqueue a single Harper task:
    ```typescript
    import { enqueueTask } from "../harper-autonomous/loop-manager.js";
    // ...
    if (lowPriorityIds.length > 0) {
      await enqueueTask({
        type: "batch-review-low-priority",
        payload: { itemIds: lowPriorityIds, count: lowPriorityIds.length },
      });
    }
    ```
  - Harper's autonomous loop reviews these items and can: keep, delete, or refine filters
  - Check how `enqueueTask` works in the codebase before using it — read `harper-autonomous/loop-manager.ts`

### 3. Enhanced Not-Relevant Feedback

- **Path:** `backend-hono/src/routes/riskflow/handlers.ts` — `handleNotRelevant`
- **Action:** Modify
- **Spec:**
  - Accept optional `reason` field from request body:
    ```typescript
    const reason = body.reason as string | undefined; // "redundant" | "irrelevant-topic" | "stale" | "spam" | "other"
    ```
  - Store reason in the `riskflow_dismissed_items` insert (add `reason` column if needed, or store in existing metadata/JSONB field)
  - Pass reason to Harper's `feed-quality-feedback` enqueued task so she annotates WHY
  - Verify: after dismissal + manual refresh, the dismissed item does NOT reappear. Trace the path: `handleRefresh` (line 842) → scorer runs → `isSimilarToDismissed()` check. Ensure the dismissed cache is loaded before scoring in refresh path.

- **Path:** `frontend/components/feed/RiskFlowDetailCard.tsx`
- **Action:** Modify
- **Spec:**
  - On "Not Relevant" action, show a quick-select dropdown/popover BEFORE dismissing:
    - Options: "Redundant", "Irrelevant Topic", "Stale/Outdated", "Spam/Noise", "Other"
    - Send selected reason in the `POST /api/riskflow/:id/not-relevant` request body
    - If user clicks away without selecting, default to no reason (backward compatible)

### 4. Expanded Source Filters

- **Path:** `frontend/components/feed/RiskFlowMain.tsx`
- **Action:** Modify
- **Spec:**
  - Change `SourceFilter` type:
    ```typescript
    type SourceFilter =
      | "all"
      | "twitter"
      | "financial-juice"
      | "deitaone"
      | "osint"
      | "econ-calendar"
      | "polymarket-kalshi"
      | "hermes";
    ```
  - Update the source filter dropdown options with labels:
    - "All Sources" | "X (Twitter)" | "Financial Juice" | "DeItaOne" | "OSINT" | "Econ Calendar" | "Prediction Markets" | "Hermes (Agent)"
  - Update the `useMemo` filter logic to match items by their `source` field. Use the mapping from `RiskFlowContext.tsx` lines 77-86:
    - "twitter" matches sources "TwitterCli" and "Rettiwt"
    - "financial-juice" matches "FinancialJuice"
    - "deitaone" matches "DeItaOne"
    - "osint" matches "OSINTSources"
    - "econ-calendar" matches "EconomicCalendar"
    - "polymarket-kalshi" matches "Polymarket" and "Kalshi"
    - "hermes" matches "Hermes"

- **Path:** `frontend/hooks/useRiskFlowFilters.ts`
- **Action:** Modify
- **Spec:** Mirror the expanded `SourceFilter` type. Update `filterAlerts` logic if it has its own source matching.

### 5. Verify Priority Level Mapping

- **Path:** `frontend/components/feed/RiskFlowMain.tsx`
- **Action:** Verify + Fix
- **Spec:**
  - `PriorityFilter` already has "all" | "critical" | "high" | "medium" | "low"
  - Verify the filter logic in `useMemo` correctly maps: critical→macroLevel 4, high→3, medium→2, low→1
  - If any level is silently dropped or miscounted, fix the mapping
  - Verify the count badges next to each filter option show correct numbers

### 6. Claude Hooks → Routines Research

- **Action:** Research
- **Spec:**
  - Search the web for "Claude Code Routines" feature documentation
  - Understand the API: how Routines differ from hooks, how they're configured, what events they support
  - Document findings in a new file: `docs/sprint-briefs/RESEARCH-claude-routines.md`
  - If the feature is documented and ready:
    - Convert each hook from `.claude/settings.json` to Routine equivalent
    - Priority: `harper-feed-health.sh` (Stop hook) — this is the most important for feed sanitation
  - If the feature is NOT yet documented or shipped:
    - Document what you found
    - Keep existing hooks active
    - Flag to TP that Routines migration should wait

## Key Rules

- NEVER bulk-delete scored items without specific scoping conditions (see memory: `feedback_never_nuke_scored_items.md`)
- The zero-IV purge must scope to `iv_score = 0 AND published_at < 1 hour ago` — don't delete fresh items that haven't been scored yet
- Source filter changes must propagate to both RiskFlowMain (full view) and RiskFlowMini (Strategium sidebar) via the shared hook
- The dismissed items cache in central-scorer must be loaded during refresh-triggered scoring cycles

## DO NOT

- Delete items with non-zero IV scores in the auto-purge
- Change the scoring algorithm in central-scorer
- Modify the SSE broadcaster or breaking news detection
- Touch Sanctum.tsx or any Aquarium components
- Add new npm dependencies

## Verification

```bash
# Backend
cd ~/Documents/Codebases/fintheon/backend-hono && bun run build
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist 2>/dev/null; launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Check scorer logs for zero-IV purge
tail -50 ~/.claude/feed-health.log | grep -i purge

# Test dismissal with reason
curl -X POST http://localhost:8080/api/riskflow/test-item-id/not-relevant \
  -H "Content-Type: application/json" \
  -d '{"reason":"redundant"}'

# Frontend
cd ~/Documents/Codebases/fintheon && bun run build
# Open RiskFlow → verify all source options in dropdown
# Verify all priority levels filter correctly
# Dismiss an item with reason → refresh → verify it doesn't return
```

## Changelog Entry

```typescript
{
  date: '2026-04-15T00:00:00',
  agent: 'claude-code',
  summary: 'S16-T5: RiskFlow sanitation — auto-purge zero-IV items, low-priority batch tagging for Harper review, dismissal reason feedback loop, expanded source filters (FJ/DeItaOne/OSINT/EconCal/PredMkts/Hermes), verified priority level mapping. Routines research documented.',
  files: [
    'backend-hono/src/services/riskflow/central-scorer.ts',
    'backend-hono/src/routes/riskflow/handlers.ts',
    'frontend/components/feed/RiskFlowMain.tsx',
    'frontend/components/feed/RiskFlowDetailCard.tsx',
    'frontend/hooks/useRiskFlowFilters.ts'
  ]
}
```

## Post-Push Memory Update

After committing, log any bugs or broken patterns to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md` and add pointer to `MEMORY.md`. Skip if no bugs found.
