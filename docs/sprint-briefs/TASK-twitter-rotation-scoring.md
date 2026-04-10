# Task Brief: Twitter CLI Round-Robin + Scoring Carousel

**Date:** 2026-04-01
**Scope:** Distribute Twitter polling and scoring responsibility across peers with time-based rotation and admin toggle
**Estimated files:** 8

## Context

Sprint 3 T1 was briefed but never built. The scoring-carousel and twitter-rotation services don't exist. Currently one device polls all Twitter feeds and scores all items. With multiple peers (2-3 Macs), polling and scoring should rotate in 15-minute windows so no single device gets rate-limited and work is distributed. Admin (TP) can toggle individual peer polling on/off from the Refinement tab.

## Files to Read First

- `backend-hono/src/services/riskflow/central-scorer.ts` — Current scorer runs every 30s, batch of 20. Needs assignment check before scoring.
- `backend-hono/src/services/twitter-cli/econ-triggered-poller.ts` — 60s polling with 5s burst on econ releases. `startEconTwitterPoller()`. Needs rotation check before executing.
- `backend-hono/src/services/peers/peer-registry.ts` — `listPeers()`, `getPeer()`, `isMemoryMode()`, heartbeat status.
- `backend-hono/src/services/peers/desk-manager.ts` — `getDeskPeers()` for desk-scoped rotation.
- `backend-hono/src/config/database.ts` — `sql`, `isDatabaseAvailable()` for raw SQL queries.
- `backend-hono/src/boot/index.ts` — Boot sequence where rotation coordinators start.
- `backend-hono/src/routes/peers/index.ts` — Where to mount scoring/twitter sub-routes.
- `frontend/components/refinement/RefinementEngine.tsx` — Refinement tab where polling toggle goes.

## What to Build/Change

### 1. Twitter Rotation Service

- **Path:** `backend-hono/src/services/peers/twitter-rotation.ts` — Create
- Types: `TwitterPollSlot` (id, peerId, deskId, slotStart, slotEnd, status: 'claimed'|'active'|'completed')
- `claimSlot(peerId)` — claim current 15-min window. Uses DB advisory lock (`FOR UPDATE SKIP LOCKED`) to prevent double-claims. Returns null if slot already taken.
- `getCurrentSlotOwner()` — who owns the current window
- `listSlots(limit?)` — recent slot history
- `isPollingEnabled(peerId)` — checks `peer_polling_config` table for enabled flag
- `setPollingEnabled(peerId, enabled)` — admin sets per-peer toggle
- `listPollingConfig()` — all peers' polling status
- `startTwitterRotationCoordinator()` — cron every 60s: if no active slot, assign to next enabled online peer round-robin
- DB + in-memory fallback (same pattern as boardroom-store.ts)
- **Max lines:** 200

### 2. Scoring Carousel Service

- **Path:** `backend-hono/src/services/peers/scoring-carousel.ts` — Create
- Types: `ScoringAssignment` (id, peerId, sector, windowStart, windowEnd, status: 'active'|'completed'|'reassigned')
- Sectors: `'macro' | 'equities' | 'crypto' | 'futures' | 'sentiment'`
- `getCurrentAssignment(peerId)` — what is this peer assigned to score right now
- `listAssignments(filter?)` — all current assignments
- `createRotation(sectors)` — round-robin across online peers, 1-hour windows per sector
- `reassignOfflinePeers()` — reassign from offline peers to next available
- `startScoringCoordinator()` — cron every 5 minutes: check assignments, reassign offline, create new rotation if expired
- `isMyTurnToScore(peerId, sector)` — quick check before scoring an item
- DB + in-memory fallback
- **Max lines:** 200

### 3. Scoring/Twitter Routes

- **Path:** `backend-hono/src/routes/peers/scoring.ts` — Create
- `GET /api/peers/scoring/assignments` — list current assignments
- `GET /api/peers/scoring/my-assignment` — what am I assigned to
- `POST /api/peers/scoring/rotate` — force new rotation (admin only)
- **Max lines:** 60

- **Path:** `backend-hono/src/routes/peers/twitter.ts` — Create
- `GET /api/peers/twitter/current-slot` — who's polling right now
- `GET /api/peers/twitter/slots` — recent slot history
- `GET /api/peers/twitter/config` — all peers' polling enabled/disabled
- `POST /api/peers/twitter/config/:peerId` — toggle polling (admin only, body: `{ enabled }`)
- **Max lines:** 60

### 4. Wire Into Existing Systems

- **Path:** `backend-hono/src/services/riskflow/central-scorer.ts` — Modify
- Before scoring an item, check `isMyTurnToScore(peerId, sector)`. If not my turn, skip.
- Get `peerId` from boot registration (`process.env.PEER_BOOT_ID` or similar)
- If no peer registered (single-device mode), score everything (backward compatible)

- **Path:** `backend-hono/src/services/twitter-cli/econ-triggered-poller.ts` — Modify
- Before polling, check `claimSlot(peerId)` and `isPollingEnabled(peerId)`
- If not enabled or slot already claimed, skip this poll cycle
- If no peer registered (single-device mode), poll normally (backward compatible)

- **Path:** `backend-hono/src/boot/index.ts` — Modify
- After peer heartbeat monitor starts, add:

  ```typescript
  startScoringCoordinator();
  startTwitterRotationCoordinator();
  ```

- **Path:** `backend-hono/src/routes/peers/index.ts` — Modify
- Mount scoring and twitter sub-routes

### 5. Frontend: Polling Toggle in Refinement Tab

- **Path:** `frontend/components/refinement/PeerPollingToggle.tsx` — Create
- Table of all peers: Name, Status, Desk, Polling Enabled (toggle switch)
- Admin-only toggle switches
- Shows current slot owner highlighted
- Recent slot history (last 10)
- "Force Rotation" button (admin)
- **Max lines:** 150

- **Path:** `frontend/components/refinement/ScoringCarousel.tsx` — Create
- Visual grid: rows = sectors, columns show assigned peer + time window
- Current window highlighted with Solvys Gold
- **Max lines:** 120

- **Path:** `frontend/components/refinement/RefinementEngine.tsx` — Modify
- Add PeerPollingToggle and ScoringCarousel as sections

### 6. Database Migration

- **Path:** `supabase/migrations/20260401_scoring_twitter_rotation.sql` — Create

```sql
CREATE TABLE IF NOT EXISTS scoring_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id UUID REFERENCES claude_peers(id),
  sector TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'reassigned')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS twitter_poll_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  peer_id UUID REFERENCES claude_peers(id),
  desk_id UUID REFERENCES desks(id),
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'claimed' CHECK (status IN ('claimed', 'active', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS peer_polling_config (
  peer_id UUID PRIMARY KEY REFERENCES claude_peers(id),
  enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scoring_assignments_peer ON scoring_assignments(peer_id);
CREATE INDEX IF NOT EXISTS idx_scoring_assignments_status ON scoring_assignments(status);
CREATE INDEX IF NOT EXISTS idx_twitter_poll_peer ON twitter_poll_schedule(peer_id);
CREATE INDEX IF NOT EXISTS idx_twitter_poll_status ON twitter_poll_schedule(status);
```

## Key Rules

- **Backward compatible:** If no peer registered (single-device mode), score and poll everything normally. Rotation only kicks in when multiple peers exist.
- Round-robin: same feeds, take turns in 15-min windows for Twitter. 1-hour windows for scoring sectors.
- `FOR UPDATE SKIP LOCKED` on slot claims to prevent double-polling.
- Admin-only toggle for per-peer polling enable/disable.
- DB + in-memory fallback for every store.
- Solvys Gold palette for frontend components.

## DO NOT

- Change what feeds are polled — only WHO polls WHEN
- Modify the actual scoring logic or AI enrichment pipeline
- Touch RiskFlow feed service, bulletin, documents, or editor
- Install any new Twitter/X packages
- Create voice, toast, or onboarding files (separate task)

## Verification

```bash
cd backend-hono && bun run build
npx vite build
# Verify: GET /api/peers/twitter/config returns config for all peers
# Verify: GET /api/peers/scoring/assignments returns rotation
# Verify: single-device mode still scores and polls normally
```

## Changelog Entry

```typescript
{
  date: '2026-04-01T...',
  agent: 'claude-code',
  summary: 'Twitter CLI round-robin (15-min slots) + scoring carousel (sector rotation) + admin polling toggle in Refinement tab',
  files: [
    'backend-hono/src/services/peers/twitter-rotation.ts',
    'backend-hono/src/services/peers/scoring-carousel.ts',
    'backend-hono/src/routes/peers/scoring.ts',
    'backend-hono/src/routes/peers/twitter.ts',
    'frontend/components/refinement/PeerPollingToggle.tsx',
    'frontend/components/refinement/ScoringCarousel.tsx',
    'supabase/migrations/20260401_scoring_twitter_rotation.sql'
  ]
}
```
