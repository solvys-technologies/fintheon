# S12-T3: Research Task Board + Toast Audit + Maintenance Toast

> **Sprint:** S12 | **Track:** T3 of 3 | **Depends on:** S11 (Sprint 1) complete | **Branch:** `v.8.28.1`

## Objective

Build research task boards (kanban-style) where agents are assigned to deep-dive into narratives. Tasks optionally link to NarrativeFlow narratives — new narratives are born from research memos. Also: global toast placement audit (trading=top-right, system=bottom-left) and new maintenance toast for app updates via Ask Harp.

---

## Files to Read First

- `backend-hono/src/services/boardroom-store.ts` — DB + in-memory fallback pattern
- `backend-hono/src/config/database.ts` — `sql`, `isDatabaseAvailable()`
- `backend-hono/src/routes/index.ts` — Route mounting pattern
- `backend-hono/src/types/peers.ts` — User, ClaudePeer types
- `backend-hono/src/services/peers/peer-registry.ts` — `listPeers()` for agent assignment dropdown
- `frontend/lib/services.ts` — `PeersService` class pattern
- `frontend/components/NotificationToast.tsx` — Current toast implementation (AUDIT THIS)
- `frontend/components/layout/FloatingWidget.tsx` — Has toast notification logic
- `frontend/components/layout/MainLayout.tsx` — Tab/panel integration + toast rendering
- `frontend/contexts/SettingsContext.tsx` — Settings persistence pattern

---

## Backend: New Files

### `backend-hono/src/services/research/task-board.ts` (~150 lines)

Types (define here):
```typescript
interface ResearchTask {
  id: string
  title: string
  narrative: string | null        // freeform text, optional NarrativeFlow link
  assignedTo: string | null       // userId
  assignedAgent: string | null    // agent persona name
  deskId: string | null
  status: 'pending' | 'active' | 'deep-dive' | 'complete'
  findings: Record<string, unknown> | null
  dueDate: string | null
  createdBy: string
  createdAt: string
}

interface ResearchTaskInput {
  title: string
  narrative?: string | null
  assignedTo?: string | null
  assignedAgent?: string | null
  deskId?: string | null
  dueDate?: string | null
  createdBy: string
}
```

Exports:
- `createTask(input: ResearchTaskInput): Promise<ResearchTask>`
- `listTasks(filter?: { deskId?: string; status?: string; assignedTo?: string }): Promise<ResearchTask[]>` — newest first
- `getTask(id: string): Promise<ResearchTask | null>`
- `updateTaskStatus(id: string, status: string, findings?: Record<string, unknown>): Promise<ResearchTask | null>` — validates status enum
- `assignTask(id: string, userId: string, agentName?: string): Promise<ResearchTask | null>`
- `deleteTask(id: string, userId: string): Promise<boolean>` — creator only

Pattern: DB + in-memory fallback Map.

### `backend-hono/src/routes/research/index.ts` (~80 lines)

```
POST   /tasks            — create task (body: ResearchTaskInput)
GET    /tasks            — list tasks (query: deskId, status, assignedTo)
GET    /tasks/:id        — get task
PUT    /tasks/:id        — update status/findings (body: { status?, findings? })
POST   /tasks/:id/assign — assign to peer (body: { userId, agentName? })
DELETE /tasks/:id        — delete task (creator only)
```

All endpoints require auth.

---

## Backend: Files to Modify

### `backend-hono/src/routes/index.ts`

Mount research routes:
```typescript
import { createResearchRoutes } from './research/index.js'
app.route('/api/research', createResearchRoutes())
```

---

## Frontend: New Files

### `frontend/components/research/ResearchTaskCard.tsx` (~80 lines)

Props: `{ task: ResearchTask; onStatusChange: (id, status) => void; onExpand: (id) => void }`

- Compact card for kanban column
- Title (bold, truncated to 2 lines)
- Assigned agent badge with emoji (if set)
- Narrative tag as gold chip (if set, shows narrative text truncated)
- Status indicator dot: pending=gray, active=blue, deep-dive=gold, complete=green
- Due date text — red if overdue, dim if future
- Click → calls `onExpand` to show detail view
- Solvys Gold accent, BG #0a0a08 card

### `frontend/components/research/ResearchBoard.tsx` (~180 lines)

- **Kanban layout:** 4 columns — Pending | Active | Deep Dive | Complete
- Each column header shows count badge
- Columns render filtered ResearchTaskCard components
- Click card status dropdown to move between columns (no drag library needed — just a status dropdown on each card)
- **"New Task" button** at top → inline form:
  - Title (required text input)
  - Narrative (optional text input — freeform, links to NarrativeFlow theme)
  - Assign to (dropdown of peers from `PeersService.list()`)
  - Agent (dropdown: Harper-Opus, Oracle, Feucht, Consul, Herald)
  - Due date (date input)
- Desk filter dropdown
- **Expanded task view:** when card clicked, show below the board:
  - Full title, narrative, assigned peer/agent
  - Findings textarea (JSONB displayed as formatted text, editable)
  - Status dropdown to change
  - Save button → calls `updateTaskStatus()`

### `frontend/lib/services.ts` — ADD `ResearchService`

```typescript
class ResearchService {
  async createTask(data: ResearchTaskInput): Promise<{ task: ResearchTask }>
  async listTasks(params?: { deskId?: string; status?: string; assignedTo?: string }): Promise<{ tasks: ResearchTask[] }>
  async getTask(id: string): Promise<{ task: ResearchTask }>
  async updateTask(id: string, data: { status?: string; findings?: Record<string, unknown> }): Promise<{ task: ResearchTask }>
  async assignTask(id: string, userId: string, agentName?: string): Promise<{ task: ResearchTask }>
  async deleteTask(id: string): Promise<{ ok: boolean }>
}
```

---

## Frontend: Files to Modify

### `frontend/components/layout/MainLayout.tsx`

Add **Research** tab/panel to navigation → renders ResearchBoard.

### `frontend/contexts/SettingsContext.tsx`

Add: `bulletinVoteThreshold: number` (default 3, admin-configurable). Persisted to localStorage + backend settings.

---

## Toast Placement Audit (GLOBAL FIX)

**This is a critical cross-cutting fix.** Audit ALL toast calls in the codebase and enforce placement rules.

### Rules:
- **Top-right:** ALL risk-related, trading-related, and market-related toasts
  - RiskFlow alerts, new catalysts, Level 4 detections
  - Proposal notifications (new, approved, expired)
  - VIX spikes, IV score changes
  - Trade executions, position updates
  - Market events, econ releases
- **Bottom-left:** ALL system messages
  - Backend connection status (connected, disconnected, reconnecting)
  - Service health (Hermes, Supabase, Twitter CLI status changes)
  - Peer online/offline notifications
  - Build/update notifications
  - Errors and warnings

### How to audit:
1. `grep -r "toast\|Toast\|notification\|Notification" frontend/ --include='*.tsx' --include='*.ts' -l` — find all files with toast calls
2. Read each file, categorize each toast as "trading/market" or "system"
3. Ensure position prop is set correctly: `position: 'top-right'` or `position: 'bottom-left'`
4. If using a custom toast component (NotificationToast.tsx), add a `category` prop that controls placement

### Maintenance Toast (NEW)

When the app is being updated via Ask Harp chat (AI agent prompt triggering code changes):
- Toast message: **"Fintheon is updating..."**
- CTA button: **"Update App"** — triggers the update flow (calls `fintheon update` or reloads)
- Placement: **bottom-left** (system category)
- Implementation: Add a `showMaintenanceToast()` function that can be called from the chat handler when an update is detected

---

## Database Table (this track owns)

```sql
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

CREATE INDEX IF NOT EXISTS idx_research_tasks_desk ON research_tasks(desk_id);
CREATE INDEX IF NOT EXISTS idx_research_tasks_status ON research_tasks(status);
```

Put this in `supabase/migrations/20260331_sprint2_research.sql`.

---

## Verification

1. `cd backend-hono && bun run build` passes
2. `cd frontend && bun run build` passes
3. POST `/api/research/tasks` creates a task
4. GET `/api/research/tasks?status=pending` returns filtered tasks
5. PUT `/api/research/tasks/:id` with `{ status: 'active' }` updates status
6. POST `/api/research/tasks/:id/assign` assigns peer + agent
7. ResearchBoard renders 4 kanban columns
8. New Task form creates task, appears in Pending column
9. Status dropdown moves card between columns
10. **Toast audit:** ALL trading/market toasts appear top-right, ALL system toasts appear bottom-left
11. Maintenance toast renders bottom-left with "Update App" CTA

## Changelog

```typescript
{ date: '2026-03-31T...', agent: 'claude-code', summary: 'S12-T3: Research task board (kanban) with narrative linking + global toast placement audit (trading=top-right, system=bottom-left) + maintenance toast', files: ['backend-hono/src/services/research/task-board.ts', 'backend-hono/src/routes/research/', 'frontend/components/research/', 'frontend/components/NotificationToast.tsx', 'supabase/migrations/20260331_sprint2_research.sql'] }
```

## DO NOT

- Do NOT create bulletin or document files — those are T1 and T2
- Do NOT modify boardroom-store.ts, peer-registry, proposal-service, or voice-room
- Do NOT touch RiskFlow scoring logic or Twitter CLI
- Do NOT add Computer Use, agentic sidebar, or scoring carousel — Sprint 3
- Do NOT remove any existing toast calls — only fix their placement
