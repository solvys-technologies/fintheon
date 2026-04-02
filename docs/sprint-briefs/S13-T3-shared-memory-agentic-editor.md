# S13-T3: Shared Memory Extension + Agentic Editor Sidebar

> **Sprint:** S13 | **Track:** T3 of 3 | **Depends on:** S12 (Sprint 2) complete | **Branch:** `v.8.28.1`

## Objective

Extend the thought bank into team-level shared memory with full-text search and cross-agent analysis history queries. Add the agentic sidebar to the TipTap document editor (Sprint 2 foundation) — agents can pull charts, visual representations, and data from the internet via Computer Use and inject them into documents.

---

## Files to Read First

- `backend-hono/src/services/thought-bank-store.ts` — Current thought bank: per-agent thoughts, 48hr TTL, Supabase-backed
- `backend-hono/src/types/thought-bank.ts` — `AgentThought` type with categories, metadata
- `backend-hono/src/services/ai/agent-instructions/thought-bank-awareness.ts` — `buildThoughtBankContext()` — how agents read each other's thoughts
- `backend-hono/src/services/context-bank/context-bank-service.ts` — Unified snapshot for all agents (120s tick)
- `backend-hono/src/services/claude-sdk/session-manager.ts` — `sendPromptSync()` for invoking Claude CLI
- `backend-hono/src/services/documents/doc-store.ts` — Document CRUD from Sprint 2
- `frontend/components/editor/DocumentEditor.tsx` — TipTap editor from Sprint 2 (add sidebar to this)
- `backend-hono/src/config/database.ts` — `sql`, `isDatabaseAvailable()`

---

## Backend: New Files

### `backend-hono/src/services/peers/shared-memory.ts` (~180 lines)

Team-level shared memory that persists longer than the thought bank's 48hr TTL.

Types:
```typescript
interface SharedMemoryEntry {
  id: string
  key: string                     // semantic key, e.g. 'market-regime-current', 'vix-regime-history'
  value: Record<string, unknown>  // JSONB
  peerId: string | null           // who wrote it
  agentName: string | null        // which agent
  category: string                // 'regime' | 'research' | 'narrative' | 'calibration' | 'custom'
  ttlHours: number | null         // null = permanent
  createdAt: string
  updatedAt: string
}
```

Exports:
- `setSharedMemory(key: string, value: Record<string, unknown>, opts?: { peerId?, agentName?, category?, ttlHours? }): Promise<SharedMemoryEntry>` — upsert by key
- `getSharedMemory(key: string): Promise<SharedMemoryEntry | null>`
- `listSharedMemory(filter?: { category?, agentName?, search? }): Promise<SharedMemoryEntry[]>` — search scans key + JSON value text
- `deleteSharedMemory(key: string): Promise<boolean>`
- `cleanupExpiredMemory(): Promise<number>` — deletes entries past TTL
- `startSharedMemoryCleanup(): void` — cron every 30 minutes

DB + in-memory fallback.

### `backend-hono/src/services/peers/analysis-history.ts` (~150 lines)

Cross-agent analysis history with full-text search.

Exports:
- `searchAnalysisHistory(query: string, opts?: { agent?, since?, limit? }): Promise<AgentThought[]>` — full-text search on `full_analysis` column of `agent_thought_bank`. Uses PostgreSQL `to_tsvector` + `to_tsquery` for proper FTS, falls back to ILIKE for in-memory.
- `getAgentAnalysisHistory(agentName: string, limit?: number): Promise<AgentThought[]>` — recent thoughts by agent, sorted newest first
- `getAnalysisByInstrument(instrument: string, limit?: number): Promise<AgentThought[]>` — searches instruments array field

### `backend-hono/src/services/editor/agentic-sidebar.ts` (~200 lines)

The AI-powered sidebar that enriches documents with external data.

Types:
```typescript
interface SidebarAction {
  type: 'fetch-chart' | 'fetch-data' | 'summarize' | 'analyze' | 'insert-image'
  prompt: string
  documentId: string
  result?: {
    content?: string              // text/markdown to insert
    imageBase64?: string          // chart screenshot
    data?: Record<string, unknown> // structured data
  }
}
```

Exports:
- `executeSidebarAction(action: SidebarAction): Promise<SidebarAction>` — dispatches to appropriate handler:
  - `fetch-chart`: Uses Claude Computer Use to open TradingView, screenshot the chart, return base64
  - `fetch-data`: Uses Claude CLI to search web and extract structured data
  - `summarize`: Summarizes the current document content
  - `analyze`: Analyzes document content against shared memory + thought bank context
  - `insert-image`: Uses Computer Use to find and screenshot a visual from the web
- `listAvailableActions(): string[]` — returns available action types based on capabilities (Computer Use available? Claude CLI available?)

Graceful degradation: if Computer Use not available, `fetch-chart` and `insert-image` return error messages instead of crashing.

### `backend-hono/src/routes/editor/index.ts` (~60 lines)

```
POST   /api/editor/sidebar/action    — execute sidebar action (body: SidebarAction)
GET    /api/editor/sidebar/actions   — list available actions
```

### `backend-hono/src/routes/memory/index.ts` (~80 lines)

```
GET    /api/memory/shared                    — list shared memory (query: category, search)
GET    /api/memory/shared/:key               — get by key
PUT    /api/memory/shared/:key               — set/update (body: { value, category?, ttlHours? })
DELETE /api/memory/shared/:key               — delete
GET    /api/memory/analysis/search           — FTS on analysis history (query: q, agent, limit)
GET    /api/memory/analysis/agent/:name      — agent's recent analysis
GET    /api/memory/analysis/instrument/:sym  — analysis by instrument
```

---

## Backend: Files to Modify

### `backend-hono/src/routes/index.ts`

Mount new routes:
```typescript
import { createMemoryRoutes } from './memory/index.js'
import { createEditorRoutes } from './editor/index.js'
app.route('/api/memory', createMemoryRoutes())
app.route('/api/editor', createEditorRoutes())
```

### `backend-hono/src/boot/index.ts`

Add shared memory cleanup:
```typescript
import { startSharedMemoryCleanup } from '../services/peers/shared-memory.js'
startSharedMemoryCleanup()
log.info('SharedMemoryCleanup started')
```

### `backend-hono/src/services/ai/agent-instructions/thought-bank-awareness.ts`

Extend `buildThoughtBankContext()` to also include relevant shared memory entries:
```typescript
import { listSharedMemory } from '../../peers/shared-memory.js'
// After existing thought bank context, append:
const sharedEntries = await listSharedMemory({ category: 'regime' })
// Format and append to context string
```

---

## Frontend: New Files

### `frontend/components/editor/AgenticSidebar.tsx` (~200 lines)

Sidebar panel that appears to the right of the DocumentEditor:

- **Action buttons** (vertical list):
  - "Fetch Chart" → prompts for instrument, fetches TradingView chart screenshot via Computer Use
  - "Analyze" → sends document content to Claude for analysis against shared memory
  - "Summarize" → generates summary of current document
  - "Search Web" → prompts for query, returns structured data
  - "Insert Visual" → prompts for description, uses Computer Use to find and screenshot

- **Results area** below buttons:
  - Shows action result (text, image, or data)
  - "Insert into Document" button → inserts result at cursor position in TipTap editor
  - Image results shown as preview with insert button

- **Shared Memory panel** (collapsible section):
  - Shows recent shared memory entries relevant to document tags/narrative
  - Click entry → inserts as reference block in document

- **Analysis History** (collapsible section):
  - Search box → FTS across agent analysis history
  - Results as compact cards with agent name, summary, timestamp
  - Click → inserts as quote block in document

- Solvys Gold theme, no gradients
- Graceful: shows "Computer Use not configured" for unavailable actions

### `frontend/components/memory/SharedMemoryPanel.tsx` (~100 lines)

Standalone panel for viewing/editing shared memory (accessible from a tab or settings):
- List all entries with key, category, last updated, agent
- Search/filter by category
- Click to view/edit value (JSON editor or formatted view)
- "Add Entry" form: key, value (textarea), category dropdown, TTL

### `frontend/lib/services.ts` — ADD services

```typescript
class MemoryService {
  async listShared(params?: { category?, search? }): Promise<{ entries: SharedMemoryEntry[] }>
  async getShared(key: string): Promise<{ entry: SharedMemoryEntry | null }>
  async setShared(key: string, data: { value, category?, ttlHours? }): Promise<{ entry: SharedMemoryEntry }>
  async deleteShared(key: string): Promise<{ ok: boolean }>
  async searchAnalysis(query: string, opts?: { agent?, limit? }): Promise<{ results: AgentThought[] }>
  async getAgentHistory(agent: string, limit?: number): Promise<{ thoughts: AgentThought[] }>
}

class EditorService {
  async executeSidebarAction(action: SidebarAction): Promise<{ action: SidebarAction }>
  async listAvailableActions(): Promise<{ actions: string[] }>
}
```

---

## Frontend: Files to Modify

### `frontend/components/editor/DocumentEditor.tsx` (Sprint 2 file)

Add AgenticSidebar:
- Import and render `<AgenticSidebar documentId={id} editorRef={editor} />` to the right of the editor
- Pass TipTap editor instance ref so sidebar can insert content at cursor
- Toggle sidebar visibility with a button in the toolbar

### `frontend/components/layout/MainLayout.tsx`

Add SharedMemoryPanel accessible from a nav item or within an existing tab.

---

## Database Tables

```sql
CREATE TABLE IF NOT EXISTS peer_shared_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL DEFAULT '{}',
  peer_id UUID REFERENCES claude_peers(id),
  agent_name TEXT,
  category TEXT DEFAULT 'custom',
  ttl_hours INT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- FTS index on thought bank (if not exists)
CREATE INDEX IF NOT EXISTS idx_thought_bank_fts ON agent_thought_bank 
  USING gin(to_tsvector('english', COALESCE(full_analysis, '') || ' ' || COALESCE(brief_summary, '')));

CREATE INDEX IF NOT EXISTS idx_shared_memory_key ON peer_shared_memory(key);
CREATE INDEX IF NOT EXISTS idx_shared_memory_category ON peer_shared_memory(category);
```

Put in `supabase/migrations/20260401_sprint3_shared_memory.sql`.

---

## Verification

1. `cd backend-hono && bun run build` passes
2. `cd frontend && bun run build` passes
3. PUT `/api/memory/shared/market-regime` sets a shared memory entry
4. GET `/api/memory/shared/market-regime` returns it
5. GET `/api/memory/analysis/search?q=VIX` returns FTS results from thought bank
6. POST `/api/editor/sidebar/action` with `{ type: 'summarize', documentId: '...' }` returns summary
7. AgenticSidebar renders action buttons, results area
8. "Insert into Document" inserts text/image at cursor in TipTap
9. SharedMemoryPanel lists entries with search
10. Shared memory entries appear in agent thought bank context

## Changelog

```typescript
{ date: '2026-04-01T...', agent: 'claude-code', summary: 'S13-T3: Team shared memory with FTS + agentic editor sidebar (charts, analysis, web data via Computer Use) + cross-agent analysis history', files: ['backend-hono/src/services/peers/shared-memory.ts', 'backend-hono/src/services/peers/analysis-history.ts', 'backend-hono/src/services/editor/agentic-sidebar.ts', 'backend-hono/src/routes/memory/', 'backend-hono/src/routes/editor/', 'frontend/components/editor/AgenticSidebar.tsx', 'frontend/components/memory/'] }
```

## DO NOT

- Do NOT modify existing thought-bank-store.ts schema — only ADD FTS index and extend awareness
- Do NOT create scoring/rotation or bulletin files
- Do NOT modify proposal-service or vote-counter
- Do NOT make Computer Use required — always graceful degradation
- Do NOT delete any existing shared memory or thought bank entries
