# Task Brief: X CLI Killswitch + Theme Sensitivity + Exa Replacement + Memory Fix

**Date:** 2026-04-10
**Scope:** Per-user X CLI feed killswitch on Team Cards, theme/font sensitivity for Team Cards + footer panels, replace Exa with Rettiwt-API + Agent-Reach, fix /api/memory/shared 500
**Estimated files:** 14 (3 new, 11 modified)

## Context

Team X CLI polling runs autonomously on the backend, rotating through 11+ Twitter accounts every 60-180s. Users need the ability to opt their device out of the rotation directly from their Team Card. The footer panels and Team Cards use hardcoded Tailwind colors that don't respond to the theme system. The Exa neural search fallback (used when twitter-cli hits 429) returns poor results and needs replacing with Rettiwt-API (Twitter) + Agent-Reach (web scraping). The `/api/memory/shared` endpoint throws 500 due to missing error handling.

## Files to Read First

- `frontend/components/team/TeamMemberCard.tsx` — Current card layout, ServiceLight component, status dropdown
- `frontend/components/team/TeamPanel.tsx` — Team grid, header, font usage
- `frontend/components/layout/FooterToolbar.tsx` — 948-line footer with 5 tabs + toolbar strip
- `frontend/types/team.ts` — ServiceStatus, DeviceStatus, PresencePayload interfaces
- `frontend/contexts/TeamPresenceContext.tsx` — Presence broadcast, heartbeat payload building
- `frontend/contexts/ThemeContext.tsx` — CSS variable application, font theme system
- `frontend/lib/theme.ts` — Theme presets, ThemeConfig interface
- `frontend/lib/font-theme.ts` — Font theme presets (default/solvys/classic/imperial)
- `backend-hono/src/services/riskflow/feed-poller.ts` — runExaFallback(), isPollingAllowed(), manual toggle
- `backend-hono/src/services/twitter-cli/econ-triggered-poller.ts` — Account rotation, priority/rotating lists
- `backend-hono/src/services/exa-service.ts` — Current Exa client (graceful, never throws)
- `backend-hono/src/services/riskflow/commentary-scraper.ts` — Uses Exa for commentary Phase 1
- `backend-hono/src/services/peers/shared-memory.ts` — DB + in-memory fallback for shared memory
- `backend-hono/src/routes/memory/index.ts` — Memory route handlers (no try/catch currently)

## What to Build/Change

### Phase 1: Fix /api/memory/shared 500

#### backend-hono/src/routes/memory/index.ts

- **Action:** Modify
- **Spec:** Wrap every handler in try/catch. On failure, return graceful JSON: `{ entries: [], error: "shared memory unavailable" }` with status 200 (degraded, not broken). Use `createLogger("MemoryRoutes")` for error logging.
- **Max lines:** 100

#### backend-hono/src/services/peers/shared-memory.ts

- **Action:** Modify
- **Spec:** Add module-level `let dbFallbackActive = false`. When any DB query fails with table-not-found, set flag true so subsequent calls skip DB and use in-memory store directly. Wrap DB paths in `listSharedMemory`, `getSharedMemory`, `setSharedMemory`, `deleteSharedMemory` with try/catch falling back to in-memory.
- **Max lines:** 250

---

### Phase 2: Theme/font sensitivity (frontend only)

#### frontend/components/team/TeamMemberCard.tsx

- **Action:** Modify
- **Spec:** Replace all hardcoded Tailwind colors with CSS variable references:
  - ServiceLight: `bg-emerald-400` → inline style `var(--fintheon-low)`, `bg-amber-400` → `var(--fintheon-neutral-severe)`, `bg-red-400` → `var(--fintheon-severe)`. Switch from className to `style={{ backgroundColor }}` on the dot span.
  - STATUS_OPTIONS colors: online=`var(--fintheon-low)`, away=`var(--fintheon-neutral-severe)`, busy=`var(--fintheon-severe)`, dnd=`var(--fintheon-severe)`, offline=`var(--fintheon-muted)`. `statusDotColor()` returns a CSS value, rendered via inline style.
  - Card bg: `bg-[#0b0b08]` → `bg-[var(--fintheon-surface)]`
  - Text: `text-zinc-400` → `text-[var(--fintheon-muted)]`
  - Ping dot: `bg-emerald-400` → inline `var(--fintheon-low)`
  - In-call: `text-emerald-400` → `text-[var(--fintheon-low)]`
- **Max lines:** 200

#### frontend/components/team/TeamPanel.tsx

- **Action:** Modify
- **Spec:** Replace `text-zinc-600` with `text-[var(--fintheon-muted)]` (3 instances: "connecting...", empty states). Add `style={{ fontFamily: 'var(--font-heading)' }}` to the `<h3>` header tag.
- **Max lines:** 65

#### frontend/components/layout/FooterToolbar.tsx

- **Action:** Modify
- **Spec:** Theme the tab bar + panel content for changelog/errors/team/harper-ops tabs. **DO NOT touch** terminal tab (lines 565-636) or toolbar strip (line 665+).
  - Tab bar (line 500): `bg-[#080806]` → `bg-[var(--fintheon-surface)]`
  - Inactive tabs: `text-zinc-500 hover:text-zinc-300` → `text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]`
  - Errors active: `border-red-400 text-red-400 bg-red-500/5` → `border-[var(--fintheon-severe)] text-[var(--fintheon-severe)] bg-[var(--fintheon-severe)]/5`
  - Error badge: `bg-red-500/20 text-red-400` → `bg-[var(--fintheon-severe)]/20 text-[var(--fintheon-severe)]`
  - Changelog: `text-zinc-400` → `text-[var(--fintheon-muted)]`, `text-zinc-500` → `text-[var(--fintheon-text)]/60`
  - Panel content container (line 564): add `style={{ fontFamily: 'var(--font-body)' }}`
- **Max lines:** 300 (file is 948 lines, only editing specific lines)

---

### Phase 3: Per-user X CLI killswitch

#### backend-hono/src/services/riskflow/user-polling-registry.ts

- **Path:** `backend-hono/src/services/riskflow/user-polling-registry.ts`
- **Action:** Create
- **Spec:** In-memory `Map<string, { killed: boolean, lastSeen: number }>`. Exports:
  - `setUserPollingState(userId: string, killed: boolean)` — updates map + lastSeen
  - `getUserPollingState(userId: string): boolean` — returns killed state
  - `getActivePollingUsers(): string[]` — users not killed, seen within 5 min
  - `areAllUsersKilled(): boolean` — true when every registered user has killed=true
  - `cleanupStaleUsers()` — removes entries older than 10 min
- **Max lines:** 60

#### frontend/types/team.ts

- **Action:** Modify
- **Spec:** Add `twitterFeedKilled: boolean` to `ServiceStatus`, `DeviceStatus`, and `PresencePayload` interfaces.
- **Max lines:** 55

#### frontend/contexts/TeamPresenceContext.tsx

- **Action:** Modify
- **Spec:**
  - Add state: `const [twitterFeedKilled, setTwitterFeedKilled] = useState(() => localStorage.getItem('fintheon:twitter-feed-killed') === 'true')`
  - Add `toggleTwitterFeed` callback: flips boolean, persists to localStorage, POSTs to `${API_BASE}/api/riskflow/user-polling-toggle` with `{ userId, killed }`
  - In `buildPayload()`: include `twitterFeedKilled` in payload. When killed, set `services.twitterCli: false`
  - Expose `twitterFeedKilled` and `toggleTwitterFeed` from context value
- **Max lines:** 250

#### frontend/components/team/TeamMemberCard.tsx

- **Action:** Modify (same file as Phase 2 — do both phases in one pass)
- **Spec:** Add killswitch toggle for `isSelf` cards:
  - Destructure `twitterFeedKilled, toggleTwitterFeed` from `useTeamPresence()`
  - Below service lights row, add: `{isSelf && (<button onClick={toggleTwitterFeed}>...</button>)}`
  - Style: 9px mono, full-width, border-top, themed colors. Killed: `text-[var(--fintheon-severe)]` "Resume X Feed". Active: `text-[var(--fintheon-muted)]` "Kill X Feed"
  - Update Twitter ServiceLight for isSelf: when killed, pass `active={false}` with warning label "Killed"
  - For other users: their `twitterFeedKilled` state arrives via presence, so their Twitter light naturally shows down
- **Max lines:** 220

#### backend-hono/src/routes/riskflow/handlers.ts

- **Action:** Modify
- **Spec:** Add two handler functions:
  - `handleUserPollingToggle(c)` — validates `{ userId, killed }` body, calls `setUserPollingState()`, returns `{ ok: true, killed }`
  - `handleUserPollingStatus(c)` — returns `{ users: getActivePollingUsers(), allKilled: areAllUsersKilled() }`
- **Max lines:** 30 added

#### backend-hono/src/routes/riskflow/index.ts

- **Action:** Modify
- **Spec:** Register `POST /user-polling-toggle` and `GET /user-polling-status` routes pointing to new handlers.
- **Max lines:** 5 added

#### backend-hono/src/services/riskflow/feed-poller.ts

- **Action:** Modify
- **Spec:** Import `areAllUsersKilled` from user-polling-registry. In `isPollingAllowed()` (line 87), add: if `areAllUsersKilled()` returns true AND no users are active, trigger `runScrapeFallback()` (Phase 4 name) instead of blocking. The polling still runs but switches to scrape-only mode when all users killed their feeds.
- **Max lines:** 10 added

---

### Phase 4: Replace Exa with Rettiwt-API + Agent-Reach

#### Install dependency

```bash
cd backend-hono && bun add rettiwt-api
```

#### backend-hono/src/services/rettiwt-service.ts

- **Path:** `backend-hono/src/services/rettiwt-service.ts`
- **Action:** Create
- **Spec:** Graceful wrapper (never throws, returns empty on failure). Auth via `RETTIWT_AUTH_TOKEN` env var. Exports:
  - `isRettiwtAvailable(): boolean`
  - `rettiwtSearch(query: string, opts?: { count?: number }): Promise<RettiwtSearchResult[]>`
  - `rettiwtUserTimeline(username: string, opts?: { count?: number }): Promise<RettiwtSearchResult[]>`
  - `RettiwtSearchResult` interface: `{ id, text, author, publishedDate, url }`
  - 8-second timeout on all calls. Wrap in try/catch returning `[]` on failure.
- **Max lines:** 120

#### backend-hono/src/services/agent-reach-service.ts

- **Path:** `backend-hono/src/services/agent-reach-service.ts`
- **Action:** Create
- **Spec:** TypeScript fetch-based web scraper. No external deps. Exports:
  - `scrapeUrl(url: string): Promise<ScrapedArticle | null>` — fetches HTML, strips script/style/nav/footer/header tags, extracts article/main/body content, grabs title from `<title>` or `<meta>`, published date from `<time>` or `<meta property="article:published_time">`. Limits text to 1200 chars. 8-second timeout.
  - `scrapeMultiple(urls: string[]): Promise<ScrapedArticle[]>` — parallel scrape with `Promise.allSettled`
  - `ScrapedArticle` interface: `{ title, text, url, publishedDate? }`
- **Max lines:** 150

#### backend-hono/src/services/riskflow/feed-poller.ts

- **Action:** Modify
- **Spec:** Rename `runExaFallback()` → `runScrapeFallback()`. New fallback chain:
  1. Try Rettiwt: search same `EXA_FALLBACK_QUERIES` keywords + fetch priority account timelines
  2. If Rettiwt unavailable/empty, try Agent-Reach: scrape `EXA_FALLBACK_DOMAINS` RSS/article pages
  3. If both fail, fall back to existing `exaSearch()` code (dead-letter)
  - Update all call sites from `runExaFallback` to `runScrapeFallback`
- **Max lines:** 280

#### backend-hono/src/services/riskflow/commentary-scraper.ts

- **Action:** Modify
- **Spec:** In `pollCommentary()` Phase 1: replace `exaSearch()` calls with `rettiwtSearch()` using same query groups. Add `rettiwtToRawItem()` function mirroring `exaToRawItem()`. Keep Exa as fallback if `isRettiwtAvailable()` is false.
- **Max lines:** 300

#### backend-hono/src/services/riskflow/exa-scheduled-monitor.ts

- **Action:** Modify
- **Spec:** In `checkForScheduledEvents()`: replace `exaSearch()` with `scrapeMultiple()` from agent-reach-service targeting known event calendar URLs (Fed, Treasury). Add Rettiwt search for keyword queries. Keep Exa as tertiary fallback.
- **Max lines:** 200

#### backend-hono/src/services/exa-service.ts

- **Action:** Modify (comment only)
- **Spec:** Add `// DEPRECATED: Prefer rettiwt-service.ts and agent-reach-service.ts. Kept as dead-letter fallback.` at top. No functional changes.

#### Environment

- Add `RETTIWT_AUTH_TOKEN` to `backend-hono/.env` and `backend-hono/.env.template`

## Key Rules

- No gradients, no colored emojis, no Kanban borders
- Terminal tab + toolbar strip in footer are EXCLUDED from theming
- Exa service kept as dead-letter fallback — do not delete
- ServiceLight colors must use severity CSS variables, not hardcoded Tailwind
- Rettiwt and Agent-Reach services must follow the graceful pattern: never throw, return empty on failure
- Backend is launchd-managed: `io.solvys.fintheon-backend` — must unload before restarting
- Package manager is bun, not npm

## DO NOT

- Touch terminal tab styling (lines 565-636 in FooterToolbar.tsx)
- Touch toolbar strip styling (line 665+ in FooterToolbar.tsx)
- Delete exa-service.ts or remove Exa imports
- Add Python dependencies (Agent-Reach is implemented in TypeScript)
- Modify the account lists in econ-triggered-poller.ts
- Touch files outside the listed scope

## Verification

```bash
# Frontend build
cd /Users/tifos/Documents/Codebases/fintheon && npx vite build

# Backend typecheck
cd backend-hono && bunx tsc --noEmit

# Restart backend
launchctl unload ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist
launchctl load ~/Library/LaunchAgents/io.solvys.fintheon-backend.plist

# Test memory endpoint (should return 200 with entries or empty, not 500)
curl http://localhost:8080/api/memory/shared

# Test user polling toggle
curl -X POST http://localhost:8080/api/riskflow/user-polling-toggle \
  -H 'Content-Type: application/json' -d '{"userId":"test","killed":true}'

# Visual: switch between themes (solvys-gold, ios, miami-heat, stone)
# Verify Team Card colors + footer panel tabs change with theme
# Verify Terminal tab + toolbar strip stay unchanged
# Click "Kill X Feed" on own Team Card, verify ServiceLight shows "Killed"
```

## Changelog Entry

```typescript
{ date: '2026-04-10T12:00:00', agent: 'claude-code', summary: 'Per-user X CLI killswitch on Team Cards, theme/font sensitivity for Team Cards + footer panels (excl. Terminal/toolbar), replaced Exa fallback with Rettiwt-API + Agent-Reach, fixed /api/memory/shared 500', files: ['frontend/components/team/TeamMemberCard.tsx', 'frontend/components/team/TeamPanel.tsx', 'frontend/components/layout/FooterToolbar.tsx', 'frontend/types/team.ts', 'frontend/contexts/TeamPresenceContext.tsx', 'backend-hono/src/services/riskflow/user-polling-registry.ts', 'backend-hono/src/services/rettiwt-service.ts', 'backend-hono/src/services/agent-reach-service.ts', 'backend-hono/src/services/riskflow/feed-poller.ts', 'backend-hono/src/services/riskflow/commentary-scraper.ts', 'backend-hono/src/routes/memory/index.ts', 'backend-hono/src/services/peers/shared-memory.ts'] }
```

## Post-Push Memory Update

After committing and pushing, log any bugs or broken patterns you discovered to memory so future agents don't repeat them:

1. Write to `/Users/tifos/.claude/projects/-Users-tifos-Documents-Codebases-fintheon/memory/feedback_<slug>.md`
2. Add pointer to `MEMORY.md` under "Feedback & Process"
3. Skip if no bugs were found.
