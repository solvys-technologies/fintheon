# S13-T1: Scoring Carousel + Twitter CLI Rotation

> **Sprint:** S13 | **Track:** T1 of 3 | **Depends on:** S12 (Sprint 2) complete | **Branch:** `v.8.28.1`

## Objective

Distribute scoring responsibility across peers by sector and time window. Implement round-robin Twitter CLI polling where all devices poll the same feeds but take turns in 15-minute windows to avoid rate limits. Add admin toggle in Refinement tab to enable/disable individual peer polling.

---

## Files to Read First

- `backend-hono/src/services/riskflow/central-scorer.ts` — Current scorer (30s interval, scores all unscored items). Must become assignment-aware.
- `backend-hono/src/services/twitter-cli/twitter-cli-service.ts` — `searchTweets()`, `fetchUserTimeline()` — the actual polling functions
- `backend-hono/src/services/twitter-cli/econ-triggered-poller.ts` — `startEconTwitterPoller()` — 60s interval with 5s burst. Must check rotation before executing.
- `backend-hono/src/services/peers/peer-registry.ts` — `listPeers()`, `sendHeartbeat()`, peer status
- `backend-hono/src/services/peers/desk-manager.ts` — `getDeskPeers()` for desk-scoped rotation
- `backend-hono/src/types/peers.ts` — ClaudePeer, Desk types
- `backend-hono/src/config/database.ts` — `sql`, `isDatabaseAvailable()`
- `backend-hono/src/boot/index.ts` — Boot sequence where rotation coordinators start
- `frontend/components/layout/MainLayout.tsx` — Tab integration for Refinement tab

---

## Backend: New Files

### `backend-hono/src/services/peers/scoring-carousel.ts` (~180 lines)

Types:
```typescript
interface ScoringAssignment {
  id: string
  peerId: string
  sector: string              // 'macro' | 'equities' | 'crypto' | 'futures' | 'sentiment'
  windowStart: string         // ISO timestamp
  windowEnd: string
  status: 'active' | 'completed' | 'reassigned'
  createdAt: string
}
```

Exports:
- `getCurrentAssignment(peerId: string): Promise<ScoringAssignment | null>` — what is this peer assigned to score right now?
- `listAssignments(filter?: { sector?, status? }): Promise<ScoringAssignment[]>`
- `createRotation(sectors: string[]): Promise<ScoringAssignment[]>` — round-robin across online peers. Each assignment = 1-hour window per sector.
- `reassignOfflinePeers(): Promise<number>` — checks for assignments held by offline peers, reassigns to next available online peer
- `startScoringCoordinator(): void` — cron every 5 minutes: check assignments, reassign offline, create new rotation if current window expired
- `isMyTurnToScore(peerId: string, sector: string): Promise<boolean>` — quick check before scoring

DB + in-memory fallback.

### `backend-hono/src/services/peers/twitter-rotation.ts` (~150 lines)

Types:
```typescript
interface TwitterPollSlot {
  id: string
  peerId: string
  deskId: string | null
  slotStart: string
  slotEnd: string
  status: 'claimed' | 'active' | 'completed'
  createdAt: string
}
```

Exports:
- `claimSlot(peerId: string): Promise<TwitterPollSlot | null>` — try to claim the current 15-minute window. Uses `FOR UPDATE SKIP LOCKED` to prevent double-claims. Returns null if slot already taken.
- `getCurrentSlotOwner(): Promise<{ peerId: string; slot: TwitterPollSlot } | null>` — who owns the current window?
- `listSlots(limit?: number): Promise<TwitterPollSlot[]>` — recent slots
- `isPollingEnabled(peerId: string): Promise<boolean>` — checks `peer_polling_config` for enabled flag (admin toggle)
- `setPollingEnabled(peerId: string, enabled: boolean): Promise<void>` — admin sets per-peer toggle
- `listPollingConfig(): Promise<Array<{ peerId: string; enabled: boolean }>>` — all peers' polling status
- `startTwitterRotationCoordinator(): void` — cron every 60s: if no active slot, assign to next enabled online peer in round-robin order

DB + in-memory fallback.

### `backend-hono/src/routes/peers/scoring.ts` (~60 lines)

```
GET    /api/peers/scoring/assignments     — list current assignments
GET    /api/peers/scoring/my-assignment   — what am I assigned to?
POST   /api/peers/scoring/rotate          — force new rotation (admin only)
```

### `backend-hono/src/routes/peers/twitter.ts` (~60 lines)

```
GET    /api/peers/twitter/current-slot    — who's polling right now?
GET    /api/peers/twitter/slots           — recent slot history
GET    /api/peers/twitter/config          — list all peers' polling enabled/disabled
POST   /api/peers/twitter/config/:peerId  — toggle polling for a peer (admin only, body: { enabled })
```

---

## Backend: Files to Modify

### `backend-hono/src/services/riskflow/central-scorer.ts`

Modify the scoring loop to check assignment before scoring:
```typescript
// Before scoring, check if this peer is assigned this sector
import { isMyTurnToScore } from '../peers/scoring-carousel.js'

// In the scoring tick:
const peerId = getLocalPeerId() // from boot registration
if (peerId) {
  const sector = classifySector(item) // determine item's sector
  const myTurn = await isMyTurnToScore(peerId, sector)
  if (!myTurn) continue // skip, another peer handles this sector
}
```

### `backend-hono/src/services/twitter-cli/econ-triggered-poller.ts`

Modify the poll tick to check rotation:
```typescript
import { claimSlot, isPollingEnabled } from '../peers/twitter-rotation.js'

// Before polling:
const peerId = getLocalPeerId()
if (peerId) {
  const enabled = await isPollingEnabled(peerId)
  if (!enabled) return // admin disabled this peer's polling
  
  const slot = await claimSlot(peerId)
  if (!slot) return // another peer owns this window
}
```

### `backend-hono/src/boot/index.ts`

Add after peer registration:
```typescript
import { startScoringCoordinator } from '../services/peers/scoring-carousel.js'
import { startTwitterRotationCoordinator } from '../services/peers/twitter-rotation.js'

// After peer heartbeat monitor:
startScoringCoordinator()
log.info('ScoringCoordinator started')
startTwitterRotationCoordinator()
log.info('TwitterRotationCoordinator started')
```

### `backend-hono/src/routes/peers/index.ts`

Mount scoring and twitter sub-routes:
```typescript
import { createScoringRoutes } from './scoring.js'
import { createTwitterRoutes } from './twitter.js'
router.route('/scoring', createScoringRoutes())
router.route('/twitter', createTwitterRoutes())
```

---

## Frontend: New Files

### `frontend/components/refinement/PeerPollingToggle.tsx` (~120 lines)

- Table/list of all peers with columns: Peer Name, Status, Desk, Polling Enabled (toggle switch)
- Admin-only toggle switches to enable/disable Twitter polling per peer
- Shows current slot owner highlighted
- Recent slot history (last 10 slots with times)
- "Force Rotation" button (admin) → POST `/api/peers/scoring/rotate`

### `frontend/components/refinement/ScoringCarousel.tsx` (~120 lines)

- Visual display of current scoring assignments
- Grid: rows = sectors (Macro, Equities, Crypto, Futures, Sentiment), columns = time windows
- Each cell shows assigned peer name + status
- Current window highlighted with Solvys Gold
- "Reassign" button per sector (admin)

---

## Frontend: Files to Modify

### Refinement Tab (wherever it lives in MainLayout)

Add PeerPollingToggle and ScoringCarousel as sections within the Refinement tab.

### `frontend/lib/services.ts` — Extend `PeersService`

Add methods:
```typescript
// Scoring
async getMyAssignment(): Promise<{ assignment: ScoringAssignment | null }>
async listAssignments(): Promise<{ assignments: ScoringAssignment[] }>
async forceRotation(): Promise<{ assignments: ScoringAssignment[] }>

// Twitter
async getCurrentSlot(): Promise<{ slot: TwitterPollSlot | null }>
async listSlots(): Promise<{ slots: TwitterPollSlot[] }>
async listPollingConfig(): Promise<{ config: Array<{ peerId: string; enabled: boolean }> }>
async setPollingEnabled(peerId: string, enabled: boolean): Promise<{ ok: boolean }>
```

---

## Database Tables

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

Put in `supabase/migrations/20260401_sprint3_scoring_twitter.sql`.

---

## Verification

1. `cd backend-hono && bun run build` passes
2. `cd frontend && bun run build` passes
3. GET `/api/peers/scoring/assignments` returns current rotation
4. GET `/api/peers/twitter/current-slot` shows active slot owner
5. POST `/api/peers/twitter/config/:peerId` with `{ enabled: false }` disables peer polling
6. Central scorer skips items when not assigned to this peer's sector
7. Twitter poller skips when another peer owns the current slot
8. PeerPollingToggle renders with working toggle switches
9. ScoringCarousel shows sector × time grid

## Changelog

```typescript
{ date: '2026-04-01T...', agent: 'claude-code', summary: 'S13-T1: Scoring carousel (sector rotation) + Twitter CLI round-robin (15-min slots) + admin polling toggle in Refinement tab', files: ['backend-hono/src/services/peers/scoring-carousel.ts', 'backend-hono/src/services/peers/twitter-rotation.ts', 'backend-hono/src/routes/peers/scoring.ts', 'backend-hono/src/routes/peers/twitter.ts', 'frontend/components/refinement/'] }
```

## DO NOT

- Do NOT modify existing scoring logic beyond adding assignment checks
- Do NOT modify Twitter CLI service itself — only gate polling with rotation checks
- Do NOT create doc editor, bulletin, or Computer Use files
- Do NOT change the feeds being polled — only WHO polls WHEN
