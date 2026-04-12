# Task Brief: Lock RiskFlow to Curated X Sources Only + Source Manager UI

**Date:** 2026-04-12
**Scope:** Kill open X search / Exa scraping, consolidate to curated account timelines, add UI to manage source accounts, purge garbage, harden content guard.
**Estimated files:** 12-15

## Context

The commentary-scraper uses `rettiwtSearch()` to do open keyword searches across ALL of X, pulling in random political rants, conspiracy content, and opinion posts from nobodies. The econ-rettiwt-poller already does it right — it uses `rettiwtUserTimeline()` on a curated account list. We need to kill the open search approach entirely, consolidate to curated accounts, and give the user a UI to manage the source list from the Refinement Engine.

Additionally: emdash `—` and sarcastic `"genius"` need to be added to the content guard, and all existing garbage items from the commentary-scraper need to be purged from both `raw_riskflow_items` and `scored_riskflow_items`. After purging, re-pull from curated sources to repopulate.

## Files to Read First

- `backend-hono/src/services/riskflow/commentary-scraper.ts` — THE PROBLEM. Open `rettiwtSearch()` across all of X. Must be gutted or replaced.
- `backend-hono/src/services/riskflow/rettiwt-poller-accounts.ts` — Current hardcoded account lists (FJ_ACCOUNTS, WIRE_ACCOUNTS, OSINT_ACCOUNTS, GEOPOLITICAL_ACCOUNTS). This is what needs to move to DB.
- `backend-hono/src/services/riskflow/econ-rettiwt-poller.ts` — The GOOD pattern. Uses `rettiwtUserTimeline()` on curated accounts. The commentary-scraper should follow this pattern.
- `backend-hono/src/services/riskflow/feed-poller.ts` — Also has `rettiwtSearch()` in `runScrapeFallback()` (line ~177). This fallback must be removed or converted to timeline pulls.
- `backend-hono/src/services/rettiwt-service.ts` — `rettiwtSearch()` (line 183) and `rettiwtUserTimeline()` (line 234). The search function should no longer be called by any poller.
- `backend-hono/src/services/riskflow/content-guard.ts` — Add emdash and "genius" filter patterns.
- `frontend/components/refinement/RefinementEngine.tsx` — Left panel layout. New SourceAccountsManager goes here alongside CommentatorManager.
- `frontend/components/refinement/CommentatorManager.tsx` — PATTERN TO FOLLOW for the new SourceAccountsManager component. Drag-and-drop list with add/delete/edit.
- `backend-hono/src/routes/commentator/handlers.ts` — PATTERN TO FOLLOW for new source-accounts CRUD handlers.
- `backend-hono/src/types/commentator.ts` — PATTERN TO FOLLOW for the new source account type definition.
- `backend-hono/src/services/riskflow/feed-service.ts` — Line ~429-445, where IV cap was added. No changes needed but understand the scoring flow.
- `backend-hono/migrations/025_commentator_registry.sql` — PATTERN TO FOLLOW for the new migration.

## What to Build/Change

### 1. Content Guard Additions

- **Path:** `backend-hono/src/services/riskflow/content-guard.ts`
- **Action:** Modify
- **Spec:**
  - Add emdash `—` (U+2014) to JUNK_LANGUAGE_PATTERNS or a new section. Block headlines that are just opinion takes separated by emdashes (common X rant pattern). Only block when no market keywords present.
  - Add `"genius"` in sarcastic political context: `/\b"?genius"?\b/i` when combined with political figures (Trump, Biden, etc.) and no market keywords. This catches sarcastic opinion posts like `"So now it's 'genius' to choke Hormuz"`.

### 2. Supabase Migration — Source Accounts Table

- **Path:** `backend-hono/migrations/028_source_accounts.sql`
- **Action:** Create
- **Spec:**

  ```sql
  CREATE TABLE IF NOT EXISTS riskflow_source_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handle TEXT NOT NULL UNIQUE,          -- X handle (no @)
    display_name TEXT,                     -- Human-readable name
    category TEXT NOT NULL DEFAULT 'Custom', -- Wire, OSINT, Geopolitical, Macro, Custom
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
  ```

  - Seed with existing accounts from `rettiwt-poller-accounts.ts`:
    - financialjuice (Wire), DeItaone (Wire), NickTimiraos (Macro), OSINTDefender (OSINT)
    - SecBessent25 (Geopolitical), realDonaldTrump (Geopolitical), ABORNEOFFICIAL (Geopolitical)
    - TheSpectatorIndex (Geopolitical), SchizoIntel (OSINT), MenchOSINT (OSINT), ClashReport (OSINT)

- **Max lines:** 50

### 3. Source Account Type Definition

- **Path:** `backend-hono/src/types/source-account.ts`
- **Action:** Create
- **Spec:** Interface matching the DB schema. Include category union type: `'Wire' | 'OSINT' | 'Geopolitical' | 'Macro' | 'Custom'`. Export `DEFAULT_SOURCE_ACCOUNTS` array for seeding.
- **Max lines:** 60

### 4. Source Account Service

- **Path:** `backend-hono/src/services/source-accounts/source-accounts-service.ts`
- **Action:** Create
- **Spec:** Follow `commentator-service.ts` pattern exactly.
  - `getAccounts()` — returns all accounts from DB, seeds defaults if empty
  - `getActiveAccounts()` — returns only active accounts (this is what the pollers use)
  - `addAccount(handle, displayName, category)` — insert
  - `updateAccount(id, fields)` — partial update
  - `removeAccount(id)` — delete
  - `getAccountHandles()` — returns just the handle strings for poller consumption
- **Max lines:** 120

### 5. Source Account API Routes

- **Path:** `backend-hono/src/routes/source-accounts/handlers.ts`
- **Action:** Create
- **Spec:** Follow `commentator/handlers.ts` pattern.
  - `GET /api/source-accounts` — list all
  - `POST /api/source-accounts` — add new (body: handle, displayName, category)
  - `PUT /api/source-accounts/:id` — update (toggle active, change category)
  - `DELETE /api/source-accounts/:id` — remove
- **Max lines:** 80

- **Path:** `backend-hono/src/routes/source-accounts/index.ts`
- **Action:** Create
- **Spec:** Hono router wiring. Follow `commentator/index.ts` pattern.
- **Max lines:** 20

- **Path:** `backend-hono/src/routes/index.ts`
- **Action:** Modify
- **Spec:** Add `import sourceAccountsRoutes` and mount at `/api/source-accounts`.

### 6. Kill Commentary Scraper Open Search

- **Path:** `backend-hono/src/services/riskflow/commentary-scraper.ts`
- **Action:** Major rewrite
- **Spec:**
  - Remove ALL `rettiwtSearch()` calls
  - Remove ALL Exa search logic (`exaSearch`, `SEARCH_GROUPS`, `exaToRawItem`)
  - Replace with `rettiwtUserTimeline()` calls on accounts from `getActiveAccounts()`
  - Each account timeline result goes through `filterWithContentGuard()` before writing to `raw_riskflow_items`
  - Keep the `submittedBy` as `commentary-scraper:{handle}` for traceability
  - Store author handle from Rettiwt results in the raw item
  - Keep the interval logic (30min hot, 60min off-peak)
  - The commentary-scraper now supplements the econ-rettiwt-poller by pulling from the SAME curated account list, but on a slower cadence and with different dedup
- **Max lines:** 200

### 7. Kill Feed Poller Open Search Fallback

- **Path:** `backend-hono/src/services/riskflow/feed-poller.ts`
- **Action:** Modify
- **Spec:**
  - Remove or gut `runScrapeFallback()` — it uses `rettiwtSearch()` with open queries
  - If keeping it, convert to `rettiwtUserTimeline()` on curated accounts from DB
  - Remove `EXA_FALLBACK_QUERIES` and `EXA_FALLBACK_DOMAINS` constants
  - Remove Exa imports if no longer needed
- **Max lines:** Keep existing length, just remove the open search paths

### 8. Update rettiwt-poller-accounts.ts to Read from DB

- **Path:** `backend-hono/src/services/riskflow/rettiwt-poller-accounts.ts`
- **Action:** Modify
- **Spec:**
  - Keep hardcoded arrays as FALLBACK only (in case DB is unreachable)
  - Add `async function getAccountsFromDB()` that reads from `riskflow_source_accounts`
  - Export `async function getActiveAccountHandles()` that tries DB first, falls back to hardcoded
  - `getAccountsForCycle()` should call `getActiveAccountHandles()` instead of using hardcoded arrays
  - Priority accounts (FJ, Wire) still get polled every cycle; others rotate
- **Max lines:** 100

### 9. Source Accounts Manager UI Component

- **Path:** `frontend/components/refinement/SourceAccountsManager.tsx`
- **Action:** Create
- **Spec:** Follow `CommentatorManager.tsx` pattern closely.
  - Shows list of source accounts grouped or badged by category (Wire/OSINT/Geopolitical/Macro/Custom)
  - Each row: handle, display name, category badge, active toggle, delete button
  - Add button opens inline form: handle input, display name input, category dropdown
  - No drag-and-drop needed (unlike commentators, order doesn't matter)
  - Category badge colors: Wire=gold, OSINT=cyan, Geopolitical=red, Macro=emerald, Custom=zinc
  - Uses Solvys Gold palette (no gradients, no colored emojis)
  - API calls to `/api/source-accounts`
- **Max lines:** 200

### 10. Wire Source Accounts Manager into Refinement Engine

- **Path:** `frontend/components/refinement/RefinementEngine.tsx`
- **Action:** Modify
- **Spec:**
  - Import `SourceAccountsManager`
  - Add it to the left panel below `CommentatorManager`, with a divider between them
  - Fetch source accounts on mount (add to `loadAll`)
  - Pass accounts and refresh callback to `SourceAccountsManager`

### 11. Purge Garbage + Re-Pull

- **Action:** Run one-time script or SQL
- **Spec:**
  - Delete ALL items from `raw_riskflow_items` where `submitted_by LIKE 'commentary-scraper:%'`
  - Delete ALL items from `scored_riskflow_items` where `submitted_by LIKE 'commentary-scraper:%'`
  - After purging, trigger a commentary-scraper poll cycle to re-pull from curated accounts
  - Log the purge count for audit

## Key Rules

- NO open `rettiwtSearch()` anywhere in the codebase after this task. Only `rettiwtUserTimeline()`.
- NO Exa scraping for feed content (Exa may still be used elsewhere for research/briefs — don't break those).
- Source accounts stored in Supabase, manageable from UI. Hardcoded lists are FALLBACK only.
- Follow existing patterns: CommentatorManager for UI, commentator-service for backend CRUD.
- Solvys Gold palette. No gradients, no colored emojis, no Kanban borders.
- Content guard runs on ALL items regardless of source.
- IV cap at 7 for non-X primary sources is ALREADY implemented — don't touch it.
- The political rant filter and non-financial agency filter are ALREADY implemented — don't touch them.
- Author handle from Rettiwt results MUST be stored in raw items (currently dropped by commentary-scraper).

## DO NOT

- Touch the econ-rettiwt-poller's core logic — it works. Only change it to read accounts from DB.
- Remove the Exa service itself (`exa-service.ts`) — it's used by other features.
- Touch the central-scorer, feed-service scoring logic, or IV score calculations.
- Add any features not specified above.
- Touch files outside the listed scope.
- Create new tabs or pages — this goes in the existing Refinement Engine left panel.

## Verification

```bash
# Type-check backend
cd backend-hono && npx tsc --noEmit

# Build frontend
cd /Users/tifos/Documents/Codebases/fintheon && npx vite build

# Verify no rettiwtSearch calls remain in pollers
grep -r "rettiwtSearch" backend-hono/src/services/riskflow/ --include="*.ts" | grep -v "node_modules"
# Expected: ZERO results (or only in files that don't call it, like re-exports)
```

## Changelog Entry

```typescript
{
  date: '2026-04-12T22:00:00',
  agent: 'claude-code',
  summary: 'Curated sources lockdown: killed open rettiwtSearch + Exa in commentary-scraper and feed-poller fallback. All feed content now from curated X account timelines only. New riskflow_source_accounts table + CRUD API + SourceAccountsManager UI in Refinement Engine. Added emdash + genius filters to content guard. Purged garbage commentary-scraper items from both tables.',
  files: [
    'backend-hono/src/services/riskflow/content-guard.ts',
    'backend-hono/src/services/riskflow/commentary-scraper.ts',
    'backend-hono/src/services/riskflow/feed-poller.ts',
    'backend-hono/src/services/riskflow/rettiwt-poller-accounts.ts',
    'backend-hono/migrations/028_source_accounts.sql',
    'backend-hono/src/types/source-account.ts',
    'backend-hono/src/services/source-accounts/source-accounts-service.ts',
    'backend-hono/src/routes/source-accounts/handlers.ts',
    'backend-hono/src/routes/source-accounts/index.ts',
    'backend-hono/src/routes/index.ts',
    'frontend/components/refinement/SourceAccountsManager.tsx',
    'frontend/components/refinement/RefinementEngine.tsx',
  ],
}
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
