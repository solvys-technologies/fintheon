# Sprint 2: Bulletin Board + Voting + Research + Editor

> **Sprint:** S12 | **Depends on:** Sprint 1 (S11) complete | **Branch:** `v.8.28.1`

## Context

Sprint 1 delivered peer infrastructure (registry, desks, voice, auth, boardroom evolution). Sprint 2 adds the collaboration layer — a bulletin board where peers post trade ideas and vote on them (✓/✗/↑/↓), with voted proposals auto-promoting into the existing `proposal-service.ts` lifecycle. Plus a standalone TipTap document editor (Solvys Gold themed, replaces Notion for internal docs) and research task boards tied to NarrativeFlow narratives.

**Key decisions:**
- Voted proposals flow into existing `proposal-service.ts` → autopilot scheduler
- TipTap editor is a standalone doc system (create/edit/list/search), NOT just inline
- Research tasks optionally link to NarrativeFlow narratives — new narratives born from research memos
- Vote threshold: fixed (default 3 ✓ votes), admin-configurable via `BULLETIN_VOTE_THRESHOLD` env
- Doc editor includes catalyst/headline `@mention` system (same as boardroom chat)
- Toast placement audit: trading/market → top-right, system → bottom-left

---

## Files to Read First

- `backend-hono/src/services/autopilot/proposal-service.ts` — Existing proposal lifecycle. `createProposal()` needs `AgentPipelineResult`; voted bulletins need a simpler `createProposalFromBulletin()` path
- `backend-hono/src/types/agents.ts` — `StoredProposal`, `TradingProposal`, `AgentPipelineResult` types
- `backend-hono/src/types/peers.ts` — User, ClaudePeer, Desk types from Sprint 1
- `backend-hono/src/types/boardroom-db.ts` — `ContentPart`, `ContentPartType` to reuse in bulletin posts
- `backend-hono/src/services/peers/peer-registry.ts` — `listPeers()`, `getUserById()` for vote counting
- `backend-hono/src/services/boardroom-store.ts` — Pattern for DB + in-memory fallback, `isLegacyBoardroomSchema()`
- `backend-hono/src/config/database.ts` — `sql`, `isDatabaseAvailable()` imports
- `backend-hono/src/routes/index.ts` — Route mounting pattern (authMiddleware + requireAuth)
- `frontend/components/peers/PeerCard.tsx` — Solvys Gold card pattern
- `frontend/components/peers/PeerCarousel.tsx` — Supabase Realtime subscription pattern
- `frontend/lib/services.ts` — `PeersService` class pattern for API clients
- `frontend/components/layout/MainLayout.tsx` — Tab/panel integration pattern
- `frontend/contexts/SettingsContext.tsx` — Settings persistence pattern
- `frontend/components/NotificationToast.tsx` — Current toast implementation (audit for placement fix)

---

## Backend: New Files to Create

### 1. `backend-hono/src/types/bulletin.ts` (~60 lines)

```typescript
type VoteType = 'up' | 'down' | 'check' | 'x'

interface BulletinPost {
  id: string
  authorId: string
  authorAgent: string | null       // null for human posts, 'oracle' for agent posts
  deskId: string | null
  content: string
  contentParts: ContentPart[] | null  // reuse from boardroom-db.ts
  parentId: string | null            // threading
  voteUp: number
  voteDown: number
  voteCheck: number
  voteX: number
  promotedToProposal: boolean
  createdAt: string
}

interface BulletinVote {
  id: string
  bulletinId: string
  userId: string
  voteType: VoteType
  createdAt: string
}

interface BulletinPostInput { ... }  // creation payload

interface ResearchTask {
  id: string
  title: string
  narrative: string | null           // optional NarrativeFlow link (freeform text)
  assignedTo: string | null          // userId
  assignedAgent: string | null       // agent persona name
  deskId: string | null
  status: 'pending' | 'active' | 'deep-dive' | 'complete'
  findings: Record<string, unknown> | null  // JSONB
  dueDate: string | null
  createdBy: string
  createdAt: string
}

interface ResearchTaskInput { ... }  // creation payload

interface Document {
  id: string
  title: string
  content: Record<string, unknown>   // TipTap JSON doc format
  authorId: string
  deskId: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}
```

### 2. `backend-hono/src/services/bulletin/bulletin-store.ts` (~200 lines)

- `createPost(input: BulletinPostInput): Promise<BulletinPost>` — insert into `peer_bulletin`
- `listPosts(filter?: { deskId?, limit?, offset? }): Promise<BulletinPost[]>` — newest first, with vote counts
- `getPost(id): Promise<BulletinPost | null>` — single post
- `getPostReplies(parentId): Promise<BulletinPost[]>` — threaded comments
- `deletePost(id, userId): Promise<boolean>` — only author can delete
- In-memory fallback (same pattern as `boardroom-store.ts`: `memoryStore` Map, cap at 500)

### 3. `backend-hono/src/services/bulletin/vote-counter.ts` (~120 lines)

- `castVote(bulletinId, userId, voteType: VoteType): Promise<BulletinVote>` — upsert into `bulletin_votes` (one vote per user per bulletin, overwrites previous). After insert, call `checkAndPromote()`.
- `getVotes(bulletinId): Promise<BulletinVote[]>` — all votes with user info
- `getUserVote(bulletinId, userId): Promise<VoteType | null>` — what did this user vote?
- `checkAndPromote(bulletinId): Promise<boolean>` — if ✓ count >= threshold (env `BULLETIN_VOTE_THRESHOLD`, default 3), call `promoteBulletinToProposal()`
- `promoteBulletinToProposal(bulletin): Promise<StoredProposal>` — creates a `StoredProposal` via the new `createProposalFromBulletin()` in proposal-service. Extracts instrument from bulletin content (regex for ticker symbols like $SPY, /NQ, AAPL). Sets `promotedToProposal = true` on the bulletin.
- In-memory fallback

### 4. `backend-hono/src/services/research/task-board.ts` (~150 lines)

- `createTask(input: ResearchTaskInput): Promise<ResearchTask>`
- `listTasks(filter?: { deskId?, status?, assignedTo? }): Promise<ResearchTask[]>`
- `getTask(id): Promise<ResearchTask | null>`
- `updateTaskStatus(id, status, findings?): Promise<ResearchTask | null>` — lifecycle transitions
- `assignTask(id, userId, agentName?): Promise<ResearchTask | null>`
- `deleteTask(id, userId): Promise<boolean>` — only creator can delete
- In-memory fallback

### 5. `backend-hono/src/services/documents/doc-store.ts` (~150 lines)

- `createDocument(title, authorId, deskId?, tags?): Promise<Document>` — creates with empty TipTap doc `{}`
- `getDocument(id): Promise<Document | null>`
- `listDocuments(filter?: { authorId?, deskId?, search?, tags? }): Promise<Document[]>` — title search, tag filter
- `updateDocument(id, updates: { title?, content?, tags? }): Promise<Document | null>` — partial update, bumps updatedAt
- `deleteDocument(id, userId): Promise<boolean>` — only author can delete
- In-memory fallback

### 6. `backend-hono/src/routes/bulletin/index.ts` (~100 lines)

```
POST   /api/bulletin              — create post (body: BulletinPostInput)
GET    /api/bulletin              — list posts (query: deskId, limit, offset)
GET    /api/bulletin/:id          — get single post
GET    /api/bulletin/:id/replies  — get threaded replies
DELETE /api/bulletin/:id          — delete post (author only)
POST   /api/bulletin/:id/vote     — cast vote (body: { voteType: VoteType })
GET    /api/bulletin/:id/votes    — get all votes on a post
```

### 7. `backend-hono/src/routes/research/index.ts` (~80 lines)

```
POST   /api/research/tasks            — create task
GET    /api/research/tasks            — list tasks (query: deskId, status, assignedTo)
GET    /api/research/tasks/:id        — get task
PUT    /api/research/tasks/:id        — update status/findings
POST   /api/research/tasks/:id/assign — assign to peer
DELETE /api/research/tasks/:id        — delete task (creator only)
```

### 8. `backend-hono/src/routes/documents/index.ts` (~80 lines)

```
POST   /api/documents       — create document
GET    /api/documents       — list documents (query: search, tags, deskId)
GET    /api/documents/:id   — get document with content
PUT    /api/documents/:id   — update document (title, content, tags)
DELETE /api/documents/:id   — delete document (author only)
```

---

## Backend: Files to Modify

### 9. `backend-hono/src/routes/index.ts`

Mount new routes (same pattern as peers — authMiddleware + requireAuth):
```typescript
app.route('/api/bulletin', createBulletinRoutes())
app.route('/api/research', createResearchRoutes())
app.route('/api/documents', createDocumentRoutes())
```

### 10. `backend-hono/src/services/autopilot/proposal-service.ts`

Add new export:
```typescript
export async function createProposalFromBulletin(
  bulletin: BulletinPost,
  promotedBy: string
): Promise<StoredProposal>
```

This creates a simplified `StoredProposal` WITHOUT requiring a full `AgentPipelineResult`:
- Extract instrument from bulletin content via regex (`/\$([A-Z]{1,5})/` for stocks, `/\/([A-Z]{2,4})/` for futures)
- Direction: 'long' if more ↑ than ↓ votes, 'short' if more ↓, 'neutral' otherwise
- Rationale = bulletin content
- Status = 'pending'
- ConfidenceScore = voteCheck / (voteCheck + voteX) or 0.5 if no x votes
- No riskAssessmentId, no debateId (those come from the full pipeline)

---

## Frontend: New Files to Create

### 11. `frontend/components/bulletin/BulletinFeed.tsx` (~200 lines)

- Twitter-feed-like vertical list of BulletinPost components
- "New Post" textarea + submit button at top
- Desk filter dropdown (from Sprint 1 desk list)
- Click post → expand inline thread (replies)
- Supabase Realtime subscription on `peer_bulletin` table for live updates
- Promoted posts show gold badge "→ Proposal"
- Solvys Gold accent (#c79f4a), no gradients, BG #050402

### 12. `frontend/components/bulletin/VotingControls.tsx` (~80 lines)

- Four vote buttons in a horizontal row: ✓ (check), ✗ (x), ↑ (up), ↓ (down)
- Active state: user's current vote is highlighted with Solvys Gold
- Vote counts displayed next to each button
- Click same vote = remove vote, click different = switch
- Compact layout, works inline within BulletinPost

### 13. `frontend/components/bulletin/BulletinPost.tsx` (~100 lines)

- Single post card: author name/avatar, timestamp, content, agent emoji (if agent post)
- VotingControls embedded below content
- Reply button → expand inline reply thread with nested posts
- "Promoted to Proposal" gold badge when `promotedToProposal === true`
- Reply count indicator

### 14. `frontend/components/editor/DocumentEditor.tsx` (~280 lines)

TipTap block editor with full formatting:
- Bold, italic, underline, strikethrough
- Headings (H1-H3)
- Bullet lists, ordered lists
- Code blocks, blockquotes, horizontal rules
- **Catalyst/Headline `@mention` system** — type `@` to search and embed recent catalysts/headlines from RiskFlow as inline references. Reuse the existing mention/catalyst lookup pattern from the boardroom chat interface.
- **Headline attachment** — attach RiskFlow headlines to documents as linked references (stored in doc metadata JSONB)
- Toolbar with formatting buttons (same row, icon-based)
- Solvys Gold theme: BG #050402, text #f0ead6, accent #c79f4a, toolbar border #c79f4a/20
- Auto-save on debounced content change (1s delay) via `updateDocument()`
- Title input above editor
- Tags input (comma-separated)

**Dependencies:** `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-underline`, `@tiptap/extension-mention`

**Sprint 3 will add:** Agentic sidebar, Computer Use chart imports, AI content generation, visual representations

### 15. `frontend/components/editor/DocumentList.tsx` (~120 lines)

- List of documents: title, author, last updated relative time, tag chips
- Search input (filters by title, debounced)
- Tag filter chips (click to toggle)
- "New Document" button → creates blank doc, opens DocumentEditor
- Click existing doc → opens DocumentEditor in edit mode
- Desk filter dropdown (optional)

### 16. `frontend/components/research/ResearchBoard.tsx` (~180 lines)

- Kanban-style 4 columns: **Pending → Active → Deep Dive → Complete**
- Each column renders ResearchTaskCard components
- Drag-to-move between columns (or click status dropdown to change)
- "New Task" button → inline form: title, narrative (freeform text), assign to (peer dropdown from registry), due date
- Agent assignment: dropdown of available agents from peer registry
- Desk-scoped view (filter by desk)

### 17. `frontend/components/research/ResearchTaskCard.tsx` (~80 lines)

- Compact card for kanban column
- Title, assigned agent badge (with emoji), narrative tag (if linked, gold chip)
- Status indicator dot (color per status)
- Click → expand to show findings textarea, edit status dropdown
- Due date with overdue warning (red text if past due)

---

## Frontend: Files to Modify

### 18. `frontend/components/layout/MainLayout.tsx`

Add new tabs/panels to navigation:
- **Bulletin** tab → renders BulletinFeed
- **Docs** tab → renders DocumentList (with DocumentEditor as detail view)
- **Research** tab → renders ResearchBoard

### 19. `frontend/lib/services.ts`

Add three new service classes (same pattern as `PeersService`):

```typescript
class BulletinService {
  createPost(data), listPosts(params), getPost(id),
  getPostReplies(id), deletePost(id),
  castVote(bulletinId, voteType), getVotes(bulletinId)
}

class ResearchService {
  createTask(data), listTasks(params), getTask(id),
  updateTask(id, data), assignTask(id, userId, agent),
  deleteTask(id)
}

class DocumentService {
  createDocument(data), listDocuments(params), getDocument(id),
  updateDocument(id, data), deleteDocument(id)
}
```

### 20. `frontend/contexts/SettingsContext.tsx`

Add: `bulletinVoteThreshold: number` (default 3, admin-configurable)

---

## Toast Notification Rules (Sprint 2 + Global Fix)

### New toast: Proposal promotion
When a bulletin gets 3 ✓ votes and auto-promotes:
- Toast: **"New Proposal Available — [instrument]"**
- CTA button: **"View in Strategium"**
- Click → navigates to Strategium tab/panel at user's current view setting
- Placement: **top-right** (trading/market category)

### Toast placement audit (GLOBAL FIX)
Audit ALL existing `toast()` calls and `NotificationToast.tsx` to enforce:
- **Top-right:** All risk-related, trading-related, and market-related toasts (RiskFlow alerts, proposals, VIX spikes, trade executions, IV score changes, market events)
- **Bottom-left:** All system messages (backend status, connection state, service health, peer online/offline, build notifications, errors)

### Maintenance toast (new)
When the app is being updated via Ask Harp chat (AI agent prompt triggering code changes):
- Toast: **"Fintheon is updating..."** with CTA **"Update App"**
- Placement: **bottom-left** (system message category)
- Triggers the app update flow on click

---

## Database Migration

### `supabase/migrations/20260331_sprint2_bulletin_docs_research.sql`

```sql
-- Bulletin board
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

-- Research tasks
CREATE TABLE IF NOT EXISTS research_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  narrative TEXT,
  assigned_to UUID REFERENCES users(id),
  assigned_agent TEXT,
  desk_id UUID REFERENCES desks(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'deep-dive', 'complete')),
  findings JSONB,
  due_date TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Documents (TipTap)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content JSONB NOT NULL DEFAULT '{}',
  author_id UUID REFERENCES users(id),
  desk_id UUID REFERENCES desks(id),
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_peer_bulletin_desk ON peer_bulletin(desk_id);
CREATE INDEX IF NOT EXISTS idx_peer_bulletin_parent ON peer_bulletin(parent_id);
CREATE INDEX IF NOT EXISTS idx_bulletin_votes_bulletin ON bulletin_votes(bulletin_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_desk ON research_tasks(desk_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_status ON research_tasks(status);
CREATE INDEX IF NOT EXISTS idx_documents_author ON documents(author_id);
CREATE INDEX IF NOT EXISTS idx_documents_desk ON documents(desk_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE peer_bulletin;
ALTER PUBLICATION supabase_realtime ADD TABLE research_tasks;
```

---

## Dependencies to Install

```bash
cd frontend && bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-mention
```

---

## Key Rules

- All new DB columns NULLABLE where appropriate
- In-memory fallback for every store (same pattern as `boardroom-store.ts`)
- Solvys Gold palette: BG `#050402`, Accent `#c79f4a`, Text `#f0ead6`
- **No gradients, no colored emojis** in UI
- Every file under 300 lines
- Vote threshold from `BULLETIN_VOTE_THRESHOLD` env var (default `3`)
- `promoteBulletinToProposal()` creates a simplified `StoredProposal` — no full `AgentPipelineResult` needed
- TipTap content stored as JSONB (TipTap's native JSON format)
- Research tasks link to NarrativeFlow narratives via freeform `narrative` text field
- Reuse `ContentPart` type from `boardroom-db.ts` for bulletin content_parts
- Reuse catalyst/mention lookup from boardroom chat for the doc editor `@mention` system

---

## Verification

1. `cd backend-hono && bun run build` passes
2. `cd frontend && bun run build` passes (after installing TipTap deps)
3. POST `/api/bulletin` creates a post, appears in GET `/api/bulletin`
4. POST `/api/bulletin/:id/vote` with `{ voteType: 'check' }` records vote, increments count
5. After 3 ✓ votes on same bulletin → `promoted_to_proposal` flips true + `StoredProposal` created in existing proposal system
6. Proposal promotion triggers toast: "New Proposal Available" with "View in Strategium" CTA (top-right)
7. POST `/api/documents` creates a doc, PUT `/api/documents/:id` updates content
8. POST `/api/research/tasks` creates a task, PUT updates status
9. BulletinFeed renders with vote buttons, counts update on vote
10. DocumentEditor loads/saves TipTap content with `@mention` catalyst search
11. ResearchBoard shows kanban columns with drag-to-move
12. All trading/market toasts appear top-right, system toasts bottom-left

---

## Changelog Entry

```typescript
{
  date: '2026-03-31T...',
  agent: 'claude-code',
  summary: 'Sprint 2: Bulletin board with ✓/✗/↑/↓ voting + auto-promotion to proposals, TipTap document editor with catalyst @mention (Notion replacement), research task boards with narrative linking, toast placement audit (trading=top-right, system=bottom-left)',
  files: [
    'backend-hono/src/services/bulletin/',
    'backend-hono/src/services/documents/',
    'backend-hono/src/services/research/',
    'backend-hono/src/routes/bulletin/',
    'backend-hono/src/routes/documents/',
    'backend-hono/src/routes/research/',
    'frontend/components/bulletin/',
    'frontend/components/editor/',
    'frontend/components/research/',
    'supabase/migrations/'
  ]
}
```

---

## DO NOT

- Do NOT modify Sprint 1 peer files (peer-registry, desk-manager, voice-room)
- Do NOT modify existing `proposal-service.ts` logic — only ADD `createProposalFromBulletin()`
- Do NOT touch RiskFlow scoring, Twitter CLI polling, or NarrativeFlow rendering
- Do NOT create Sprint 3 files (scoring carousel, Twitter rotation, Computer Use, agentic sidebar)
- Do NOT add video/voice features — Sprint 1 already handles that
- Do NOT modify `boardroom-store.ts` — Sprint 1 already extended it
