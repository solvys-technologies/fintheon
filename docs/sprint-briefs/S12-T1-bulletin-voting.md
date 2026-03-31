# S12-T1: Bulletin Board + Voting + Proposal Promotion

> **Sprint:** S12 | **Track:** T1 of 3 | **Depends on:** S11 (Sprint 1) complete | **Branch:** `v.8.28.1`

## Objective

Build the bulletin board feed where peers post trade ideas and vote on them (✓/✗/↑/↓). When a post reaches 3 ✓ votes, it auto-promotes into the existing proposal system (`proposal-service.ts`). Includes backend services, routes, migration tables, and frontend components.

---

## Files to Read First

- `backend-hono/src/services/autopilot/proposal-service.ts` — Existing `createProposal()` and `StoredProposal` type. You will ADD `createProposalFromBulletin()` here.
- `backend-hono/src/types/agents.ts` — `StoredProposal`, `TradingProposal` types
- `backend-hono/src/types/boardroom-db.ts` — `ContentPart`, `ContentPartType` — reuse for bulletin content_parts
- `backend-hono/src/services/boardroom-store.ts` — Pattern for DB + in-memory fallback with `isDatabaseAvailable()`
- `backend-hono/src/config/database.ts` — `sql`, `isDatabaseAvailable()` imports
- `backend-hono/src/routes/index.ts` — Route mounting pattern (authMiddleware + requireAuth)
- `backend-hono/src/services/peers/peer-registry.ts` — `getUserById()` for author info
- `frontend/components/peers/PeerCard.tsx` — Solvys Gold card styling pattern
- `frontend/components/peers/PeerCarousel.tsx` — Supabase Realtime subscription pattern
- `frontend/lib/services.ts` — `PeersService` class pattern for API clients
- `frontend/components/NotificationToast.tsx` — Toast implementation (for proposal promotion toast)

---

## Backend: New Files

### `backend-hono/src/types/bulletin.ts` (~50 lines)

```typescript
import type { ContentPart } from './boardroom-db.js'

export type VoteType = 'up' | 'down' | 'check' | 'x'

export interface BulletinPost {
  id: string
  authorId: string
  authorAgent: string | null
  deskId: string | null
  content: string
  contentParts: ContentPart[] | null
  parentId: string | null
  voteUp: number
  voteDown: number
  voteCheck: number
  voteX: number
  promotedToProposal: boolean
  createdAt: string
}

export interface BulletinVote {
  id: string
  bulletinId: string
  userId: string
  voteType: VoteType
  createdAt: string
}

export interface BulletinPostInput {
  authorId: string
  authorAgent?: string | null
  deskId?: string | null
  content: string
  contentParts?: ContentPart[] | null
  parentId?: string | null
}
```

### `backend-hono/src/services/bulletin/bulletin-store.ts` (~200 lines)

Exports:
- `createPost(input: BulletinPostInput): Promise<BulletinPost>`
- `listPosts(filter?: { deskId?: string; limit?: number; offset?: number }): Promise<BulletinPost[]>` — newest first
- `getPost(id: string): Promise<BulletinPost | null>`
- `getPostReplies(parentId: string): Promise<BulletinPost[]>` — sorted by created_at ASC
- `deletePost(id: string, userId: string): Promise<boolean>` — author only

Pattern: DB with `sql` tagged template + in-memory fallback Map (cap 500). Same as `boardroom-store.ts`.

### `backend-hono/src/services/bulletin/vote-counter.ts` (~120 lines)

Exports:
- `castVote(bulletinId: string, userId: string, voteType: VoteType): Promise<BulletinVote>` — upsert (UNIQUE on bulletin_id + user_id). After insert, update vote count columns on `peer_bulletin`, then call `checkAndPromote()`.
- `getVotes(bulletinId: string): Promise<BulletinVote[]>`
- `getUserVote(bulletinId: string, userId: string): Promise<VoteType | null>`
- `checkAndPromote(bulletinId: string): Promise<boolean>` — reads `BULLETIN_VOTE_THRESHOLD` env (default 3). If voteCheck >= threshold AND not already promoted, call `promoteBulletinToProposal()`.
- `promoteBulletinToProposal(bulletin: BulletinPost): Promise<void>` — calls `createProposalFromBulletin()` from proposal-service, sets `promoted_to_proposal = true` on the bulletin row.

### `backend-hono/src/routes/bulletin/index.ts` (~100 lines)

```
POST   /              — create post (body: BulletinPostInput)
GET    /              — list posts (query: deskId, limit, offset)
GET    /:id           — get single post
GET    /:id/replies   — get threaded replies
DELETE /:id           — delete post (author only)
POST   /:id/vote      — cast vote (body: { voteType: VoteType })
GET    /:id/votes     — get all votes
```

All endpoints require auth. Extract userId from request context (same as peers routes).

---

## Backend: Files to Modify

### `backend-hono/src/services/autopilot/proposal-service.ts`

ADD this new export (do NOT modify existing `createProposal()`):

```typescript
export async function createProposalFromBulletin(
  bulletin: BulletinPost,
  promotedBy: string
): Promise<StoredProposal>
```

Implementation:
- Extract instrument from content: regex `/\$([A-Z]{1,5})/` for stocks, `/\/([A-Z]{2,4})/` for futures. Default to 'UNKNOWN' if no match.
- Direction: more ↑ than ↓ votes = 'long', more ↓ = 'short', else 'neutral'
- Rationale = bulletin.content
- ConfidenceScore = voteCheck / (voteCheck + voteX) or 0.5 if no x votes
- Status = 'pending', expiresAt = now + 5min (same as existing TTL)
- No riskAssessmentId, no debateId
- Store via same DB insert pattern as existing `createProposal()`

### `backend-hono/src/routes/index.ts`

Mount bulletin routes:
```typescript
import { createBulletinRoutes } from './bulletin/index.js'
// ... inside route registration, with authMiddleware + requireAuth:
app.route('/api/bulletin', createBulletinRoutes())
```

---

## Frontend: New Files

### `frontend/components/bulletin/VotingControls.tsx` (~80 lines)

Props: `{ bulletinId: string; votes: { up: number; down: number; check: number; x: number }; userVote: VoteType | null; onVote: (type: VoteType) => void }`

- Four buttons in horizontal row: ✓ ✗ ↑ ↓
- Each shows count next to icon
- Active vote highlighted with Solvys Gold (#c79f4a)
- Click same = remove (call onVote), click different = switch
- Use lucide-react icons: Check, X, ArrowUp, ArrowDown

### `frontend/components/bulletin/BulletinPost.tsx` (~100 lines)

Props: `{ post: BulletinPost; userVote: VoteType | null; onVote: (bulletinId, voteType) => void; onReply: (bulletinId) => void }`

- Card with author name, timestamp (relative), content
- Agent posts show agent emoji + name
- VotingControls embedded below content
- Reply button with reply count
- Gold badge "→ Proposal" when `promotedToProposal === true`
- Solvys Gold accent, no gradients, BG #0a0a08 card on #050402

### `frontend/components/bulletin/BulletinFeed.tsx` (~200 lines)

- Vertical list of BulletinPost components
- "New Post" textarea + submit at top
- Desk filter dropdown (fetch desks from PeersService)
- Click post reply button → expand inline thread below post
- Supabase Realtime subscription on `peer_bulletin` for live updates
- Loading/empty states
- Fetch user's votes on mount to show active states

### `frontend/lib/services.ts` — ADD `BulletinService`

```typescript
class BulletinService {
  async createPost(data: BulletinPostInput): Promise<{ post: BulletinPost }>
  async listPosts(params?: { deskId?, limit?, offset? }): Promise<{ posts: BulletinPost[] }>
  async getPost(id: string): Promise<{ post: BulletinPost }>
  async getPostReplies(id: string): Promise<{ replies: BulletinPost[] }>
  async deletePost(id: string): Promise<{ ok: boolean }>
  async castVote(bulletinId: string, voteType: VoteType): Promise<{ vote: BulletinVote }>
  async getVotes(bulletinId: string): Promise<{ votes: BulletinVote[] }>
}
```

---

## Toast: Proposal Promotion

When `checkAndPromote()` succeeds (bulletin promoted), the frontend should show:
- **Toast:** "New Proposal Available — [instrument]"
- **CTA button:** "View in Strategium" → navigates to Strategium tab
- **Placement:** top-right (trading/market category)

Implement this by having the Supabase Realtime subscription detect `promoted_to_proposal` flipping to `true` on a bulletin, then trigger the toast.

---

## Database Tables (this track owns)

```sql
CREATE TABLE IF NOT EXISTS peer_bulletin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES users(id),
  author_agent TEXT,
  desk_id UUID REFERENCES desks(id),
  content TEXT NOT NULL,
  content_parts JSONB,
  parent_id UUID REFERENCES peer_bulletin(id),
  vote_up INT DEFAULT 0,
  vote_down INT DEFAULT 0,
  vote_check INT DEFAULT 0,
  vote_x INT DEFAULT 0,
  promoted_to_proposal BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS bulletin_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bulletin_id UUID REFERENCES peer_bulletin(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  vote_type TEXT CHECK (vote_type IN ('up', 'down', 'check', 'x')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(bulletin_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_peer_bulletin_desk ON peer_bulletin(desk_id);
CREATE INDEX IF NOT EXISTS idx_peer_bulletin_parent ON peer_bulletin(parent_id);
CREATE INDEX IF NOT EXISTS idx_bulletin_votes_bulletin ON bulletin_votes(bulletin_id);

ALTER PUBLICATION supabase_realtime ADD TABLE peer_bulletin;
```

Put this in `supabase/migrations/20260331_sprint2_bulletin.sql`.

---

## Verification

1. `cd backend-hono && bun run build` passes
2. `cd frontend && bun run build` passes
3. POST `/api/bulletin` creates a post
4. POST `/api/bulletin/:id/vote` with `{ voteType: 'check' }` records vote, increments count
5. After 3 ✓ votes → `promoted_to_proposal` flips true + StoredProposal created
6. BulletinFeed renders posts with vote buttons
7. Toast appears on promotion with "View in Strategium" CTA

## Changelog

```typescript
{ date: '2026-03-31T...', agent: 'claude-code', summary: 'S12-T1: Bulletin board with ✓/✗/↑/↓ voting + auto-promotion to existing proposal system', files: ['backend-hono/src/types/bulletin.ts', 'backend-hono/src/services/bulletin/', 'backend-hono/src/routes/bulletin/', 'frontend/components/bulletin/', 'supabase/migrations/20260331_sprint2_bulletin.sql'] }
```

## DO NOT

- Do NOT modify existing `createProposal()` — only ADD `createProposalFromBulletin()`
- Do NOT create document or research task files — those are T2 and T3
- Do NOT modify boardroom-store.ts, peer-registry, or voice-room
- Do NOT touch RiskFlow, NarrativeFlow, or Twitter CLI
