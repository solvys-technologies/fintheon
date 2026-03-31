# S12-T2: TipTap Document Editor + Document Management

> **Sprint:** S12 | **Track:** T2 of 3 | **Depends on:** S11 (Sprint 1) complete | **Branch:** `v.8.28.1`

## Objective

Build a standalone TipTap block editor that replaces Notion for internal docs. Solvys Gold themed, with catalyst/headline `@mention` system (same pattern as boardroom chat). Full CRUD: create, edit, list, search, delete documents. Content stored as TipTap JSON in JSONB column.

---

## Files to Read First

- `backend-hono/src/services/boardroom-store.ts` — DB + in-memory fallback pattern
- `backend-hono/src/config/database.ts` — `sql`, `isDatabaseAvailable()`
- `backend-hono/src/routes/index.ts` — Route mounting pattern
- `backend-hono/src/types/peers.ts` — User type for author info
- `backend-hono/src/services/riskflow/central-scorer.ts` — Where scored items live (for catalyst @mention lookup)
- `backend-hono/src/routes/riskflow/handlers.ts` — Existing catalyst/headline search endpoints to reuse for @mention
- `frontend/lib/services.ts` — `PeersService` class pattern
- `frontend/components/peers/PeerCard.tsx` — Solvys Gold card styling
- `frontend/components/layout/MainLayout.tsx` — Tab/panel integration

---

## Dependencies to Install FIRST

```bash
cd frontend && bun add @tiptap/react @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-mention
```

---

## Backend: New Files

### `backend-hono/src/services/documents/doc-store.ts` (~150 lines)

Exports:
- `createDocument(title: string, authorId: string, deskId?: string, tags?: string[]): Promise<Document>` — creates with empty TipTap doc `{}`
- `getDocument(id: string): Promise<Document | null>` — full doc with content
- `listDocuments(filter?: { authorId?: string; deskId?: string; search?: string; tags?: string[] }): Promise<Document[]>` — title ILIKE search, tag filter, newest first
- `updateDocument(id: string, updates: { title?: string; content?: Record<string, unknown>; tags?: string[] }): Promise<Document | null>` — partial update, bumps updatedAt
- `deleteDocument(id: string, userId: string): Promise<boolean>` — author only

Types (define in this file or in a shared types file):
```typescript
interface Document {
  id: string
  title: string
  content: Record<string, unknown>  // TipTap JSON
  authorId: string
  deskId: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
}
```

Pattern: DB + in-memory fallback Map (same as boardroom-store.ts).

### `backend-hono/src/routes/documents/index.ts` (~80 lines)

```
POST   /           — create document (body: { title, deskId?, tags? })
GET    /           — list documents (query: search, tags, deskId, limit, offset)
GET    /:id        — get document with full content
PUT    /:id        — update document (body: { title?, content?, tags? })
DELETE /:id        — delete document (author only)
```

All endpoints require auth.

---

## Backend: Files to Modify

### `backend-hono/src/routes/index.ts`

Mount document routes:
```typescript
import { createDocumentRoutes } from './documents/index.js'
app.route('/api/documents', createDocumentRoutes())
```

---

## Frontend: New Files

### `frontend/components/editor/DocumentEditor.tsx` (~280 lines)

TipTap block editor with full formatting toolbar.

**Editor extensions:**
- `StarterKit` — bold, italic, strike, headings (H1-H3), bullet list, ordered list, code block, blockquote, horizontal rule
- `Underline` — underline support
- `Mention` — `@mention` for catalysts/headlines from RiskFlow

**Catalyst @mention system:**
- Configure TipTap `Mention` extension with suggestion handler
- On `@` keystroke, query backend for recent catalysts/headlines (reuse existing RiskFlow search endpoint or add a lightweight `/api/riskflow/search?q=` if needed)
- Show dropdown of matching catalysts with headline text
- On select, insert as inline mention node (rendered as gold chip in editor)
- Store mention data in TipTap JSON content (node type: 'mention', attrs: { id, label, source })

**Headline attachment:**
- Below the editor, a "Linked Headlines" section
- Button: "Attach Headline" → opens search modal for RiskFlow items
- Selected headlines stored in document metadata (separate from TipTap content)
- Display as compact cards below editor

**Toolbar:**
- Single row of icon buttons: B, I, U, S, H1, H2, H3, UL, OL, Code, Quote, HR
- Active state highlights with Solvys Gold (#c79f4a)
- Use lucide-react icons

**Theme:**
- Editor background: #050402
- Text color: #f0ead6
- Accent/toolbar borders: #c79f4a at 20% opacity
- Placeholder text: #f0ead6 at 30% opacity
- Code block bg: #0a0a08
- No gradients

**Auto-save:**
- Debounce content changes by 1 second
- Call `DocumentService.updateDocument(id, { content })` on change
- Show subtle "Saved" / "Saving..." indicator

**Layout:**
- Title input (large, bold) above editor
- Tags input (comma-separated) below title
- Toolbar between tags and editor
- Editor takes remaining height

### `frontend/components/editor/DocumentList.tsx` (~120 lines)

- Vertical list of documents: title, author name, last updated (relative time), tag chips
- Search input at top (debounced, filters by title via API)
- Tag filter: clickable chips that toggle tag filter
- "New Document" button → calls `DocumentService.createDocument({ title: 'Untitled' })`, then opens DocumentEditor
- Click existing doc → opens DocumentEditor with that doc's content
- Desk filter dropdown (optional)
- Empty state: "No documents yet. Create your first."
- Solvys Gold accent

### `frontend/lib/services.ts` — ADD `DocumentService`

```typescript
class DocumentService {
  async createDocument(data: { title: string; deskId?: string; tags?: string[] }): Promise<{ document: Document }>
  async listDocuments(params?: { search?: string; tags?: string[]; deskId?: string }): Promise<{ documents: Document[] }>
  async getDocument(id: string): Promise<{ document: Document }>
  async updateDocument(id: string, data: { title?: string; content?: Record<string, unknown>; tags?: string[] }): Promise<{ document: Document }>
  async deleteDocument(id: string): Promise<{ ok: boolean }>
}
```

---

## Frontend: Files to Modify

### `frontend/components/layout/MainLayout.tsx`

Add **Docs** tab/panel to navigation:
- Renders DocumentList as the default view
- When a document is selected, renders DocumentEditor inline or as a detail panel
- Use existing tab/panel pattern from the codebase

---

## Database Table (this track owns)

```sql
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

CREATE INDEX IF NOT EXISTS idx_documents_author ON documents(author_id);
CREATE INDEX IF NOT EXISTS idx_documents_desk ON documents(desk_id);
```

Put this in `supabase/migrations/20260331_sprint2_documents.sql`.

---

## Verification

1. `cd backend-hono && bun run build` passes
2. `cd frontend && bun run build` passes
3. POST `/api/documents` creates a document with empty content
4. PUT `/api/documents/:id` with TipTap JSON content saves correctly
5. GET `/api/documents/:id` returns full content
6. GET `/api/documents?search=test` filters by title
7. DocumentEditor renders with toolbar, typing produces formatted text
8. `@mention` triggers catalyst search dropdown
9. Auto-save fires after 1s of no typing
10. DocumentList shows docs, search works, "New Document" creates blank doc

## Changelog

```typescript
{ date: '2026-03-31T...', agent: 'claude-code', summary: 'S12-T2: TipTap document editor with catalyst @mention, auto-save, Solvys Gold theme + document CRUD backend', files: ['backend-hono/src/services/documents/doc-store.ts', 'backend-hono/src/routes/documents/', 'frontend/components/editor/', 'supabase/migrations/20260331_sprint2_documents.sql'] }
```

## DO NOT

- Do NOT create bulletin or research task files — those are T1 and T3
- Do NOT modify boardroom-store.ts, peer-registry, or proposal-service
- Do NOT add the agentic sidebar or Computer Use — that's Sprint 3
- Do NOT touch RiskFlow scoring logic — only read/search scored items for @mention
- Do NOT install packages beyond the 4 TipTap deps listed above
