// [claude-code 2026-03-31] S12-T2: Document store — DB + in-memory fallback (boardroom-store pattern)

import { sql, isDatabaseAvailable } from "../../config/database.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Document {
  id: string;
  title: string;
  content: Record<string, unknown>; // TipTap JSON
  authorId: string;
  deskId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface DocumentRow {
  id: string;
  title: string;
  content: Record<string, unknown>;
  author_id: string;
  desk_id: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

function mapRowToDocument(row: DocumentRow): Document {
  return {
    id: row.id,
    title: row.title,
    content:
      typeof row.content === "string"
        ? JSON.parse(row.content)
        : (row.content ?? {}),
    authorId: row.author_id,
    deskId: row.desk_id,
    tags: row.tags ?? [],
    createdAt:
      typeof row.created_at === "object"
        ? (row.created_at as Date).toISOString()
        : row.created_at,
    updatedAt:
      typeof row.updated_at === "object"
        ? (row.updated_at as Date).toISOString()
        : row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// In-memory fallback
// ---------------------------------------------------------------------------

const MEMORY_DOCS_MAX = 200;

const memoryStore = {
  documents: new Map<string, Document>(),
};

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function createDocument(
  title: string,
  authorId: string,
  deskId?: string,
  tags?: string[],
): Promise<Document> {
  if (!isDatabaseAvailable() || !sql) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const doc: Document = {
      id,
      title,
      content: {},
      authorId,
      deskId: deskId ?? null,
      tags: tags ?? [],
      createdAt: now,
      updatedAt: now,
    };
    memoryStore.documents.set(id, doc);
    // Cap memory
    if (memoryStore.documents.size > MEMORY_DOCS_MAX) {
      const oldest = Array.from(memoryStore.documents.entries()).sort((a, b) =>
        a[1].createdAt.localeCompare(b[1].createdAt),
      )[0];
      if (oldest) memoryStore.documents.delete(oldest[0]);
    }
    return doc;
  }

  const result = await sql`
    INSERT INTO documents (title, author_id, desk_id, tags)
    VALUES (${title}, ${authorId}, ${deskId ?? null}, ${tags ?? []})
    RETURNING *
  `;
  return mapRowToDocument(result[0] as DocumentRow);
}

export async function getDocument(id: string): Promise<Document | null> {
  if (!isDatabaseAvailable() || !sql) {
    return memoryStore.documents.get(id) ?? null;
  }

  const result = await sql`SELECT * FROM documents WHERE id = ${id} LIMIT 1`;
  if (result.length === 0) return null;
  return mapRowToDocument(result[0] as DocumentRow);
}

export async function listDocuments(filter?: {
  authorId?: string;
  deskId?: string;
  search?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}): Promise<Document[]> {
  const limit = filter?.limit ?? 50;
  const offset = filter?.offset ?? 0;

  if (!isDatabaseAvailable() || !sql) {
    let docs = Array.from(memoryStore.documents.values());
    if (filter?.authorId)
      docs = docs.filter((d) => d.authorId === filter.authorId);
    if (filter?.deskId) docs = docs.filter((d) => d.deskId === filter.deskId);
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      docs = docs.filter((d) => d.title.toLowerCase().includes(q));
    }
    if (filter?.tags?.length) {
      docs = docs.filter((d) => filter.tags!.some((t) => d.tags.includes(t)));
    }
    return docs
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(offset, offset + limit);
  }

  // DB path — use COALESCE/null trick for optional filters
  const result = await sql`
    SELECT * FROM documents
    WHERE (${filter?.authorId ?? null}::uuid IS NULL OR author_id = ${filter?.authorId ?? null}::uuid)
      AND (${filter?.deskId ?? null}::uuid IS NULL OR desk_id = ${filter?.deskId ?? null}::uuid)
      AND (${filter?.search ?? null}::text IS NULL OR title ILIKE '%' || ${filter?.search ?? ""} || '%')
    ORDER BY updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  let docs = result.map((r) => mapRowToDocument(r as DocumentRow));

  // Tag filter in JS (text[] overlap is awkward in tagged templates)
  if (filter?.tags?.length) {
    docs = docs.filter((d) => filter.tags!.some((t) => d.tags.includes(t)));
  }

  return docs;
}

export async function updateDocument(
  id: string,
  updates: {
    title?: string;
    content?: Record<string, unknown>;
    tags?: string[];
  },
): Promise<Document | null> {
  if (!isDatabaseAvailable() || !sql) {
    const existing = memoryStore.documents.get(id);
    if (!existing) return null;
    const updated: Document = {
      ...existing,
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.content !== undefined && { content: updates.content }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
      updatedAt: new Date().toISOString(),
    };
    memoryStore.documents.set(id, updated);
    return updated;
  }

  // Build update dynamically — always bump updated_at
  if (
    updates.title !== undefined &&
    updates.content !== undefined &&
    updates.tags !== undefined
  ) {
    const result = await sql`
      UPDATE documents
      SET title = ${updates.title}, content = ${JSON.stringify(updates.content)}::jsonb, tags = ${updates.tags}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;
    return result.length > 0
      ? mapRowToDocument(result[0] as DocumentRow)
      : null;
  }
  if (updates.title !== undefined) {
    const result = await sql`
      UPDATE documents SET title = ${updates.title}, updated_at = NOW() WHERE id = ${id} RETURNING *
    `;
    return result.length > 0
      ? mapRowToDocument(result[0] as DocumentRow)
      : null;
  }
  if (updates.content !== undefined) {
    const result = await sql`
      UPDATE documents SET content = ${JSON.stringify(updates.content)}::jsonb, updated_at = NOW() WHERE id = ${id} RETURNING *
    `;
    return result.length > 0
      ? mapRowToDocument(result[0] as DocumentRow)
      : null;
  }
  if (updates.tags !== undefined) {
    const result = await sql`
      UPDATE documents SET tags = ${updates.tags}, updated_at = NOW() WHERE id = ${id} RETURNING *
    `;
    return result.length > 0
      ? mapRowToDocument(result[0] as DocumentRow)
      : null;
  }

  return getDocument(id);
}

export async function deleteDocument(
  id: string,
  userId: string,
): Promise<boolean> {
  if (!isDatabaseAvailable() || !sql) {
    const doc = memoryStore.documents.get(id);
    if (!doc || doc.authorId !== userId) return false;
    memoryStore.documents.delete(id);
    return true;
  }

  const result = await sql`
    DELETE FROM documents WHERE id = ${id} AND author_id = ${userId} RETURNING id
  `;
  return result.length > 0;
}
