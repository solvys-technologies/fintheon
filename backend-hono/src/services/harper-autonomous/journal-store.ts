// [claude-code 2026-04-04] Harper Journal Store — persistent inner monologue for autonomous loop

import { sql, isDatabaseAvailable } from '../../config/database.js'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('HarperJournal')

// ── Types ──────────────────────────────────────────────────────────────────

export interface JournalEntry {
  id?: string
  entryType: 'observation' | 'decision' | 'learning' | 'memo' | 'regime_shift' | 'scoring_qa' | 'narrative' | 'brief_review'
  content: string
  context?: Record<string, unknown>
  tags?: string[]
  sessionId?: string
  createdAt?: string
}

interface JournalRow {
  id: string
  entry_type: string
  content: string
  context: Record<string, unknown>
  tags: string[]
  session_id: string | null
  created_at: string
}

// ── In-memory fallback ─────────────────────────────────────────────────────

const MEMORY_MAX = 200
const memoryEntries: JournalEntry[] = []

function mapRow(row: JournalRow): JournalEntry {
  return {
    id: row.id,
    entryType: row.entry_type as JournalEntry['entryType'],
    content: row.content,
    context: row.context,
    tags: row.tags,
    sessionId: row.session_id ?? undefined,
    createdAt: row.created_at,
  }
}

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function writeJournalEntry(entry: JournalEntry): Promise<JournalEntry> {
  const { entryType, content, context = {}, tags = [], sessionId } = entry

  if (!isDatabaseAvailable()) {
    const fallback: JournalEntry = {
      id: crypto.randomUUID(),
      entryType,
      content,
      context,
      tags,
      sessionId,
      createdAt: new Date().toISOString(),
    }
    memoryEntries.unshift(fallback)
    if (memoryEntries.length > MEMORY_MAX) memoryEntries.pop()
    log.info(`Journal entry written (in-memory): ${entryType}`)
    return fallback
  }

  try {
    const rows = await sql`
      INSERT INTO harper_journal (entry_type, content, context, tags, session_id)
      VALUES (${entryType}, ${content}, ${JSON.stringify(context)}::jsonb, ${tags as any}, ${sessionId ?? null})
      RETURNING *
    `
    log.info(`Journal entry written: ${entryType} [${tags.join(', ')}]`)
    return mapRow(rows[0] as JournalRow)
  } catch (err) {
    log.error('Failed to write journal entry', { error: err instanceof Error ? err.message : String(err) })
    // Fallback to memory
    const fallback: JournalEntry = {
      id: crypto.randomUUID(),
      entryType,
      content,
      context,
      tags,
      sessionId,
      createdAt: new Date().toISOString(),
    }
    memoryEntries.unshift(fallback)
    return fallback
  }
}

export async function getRecentEntries(
  limit = 20,
  entryType?: string,
): Promise<JournalEntry[]> {
  if (!isDatabaseAvailable()) {
    let filtered = memoryEntries
    if (entryType) filtered = filtered.filter((e) => e.entryType === entryType)
    return filtered.slice(0, limit)
  }

  try {
    const rows = entryType
      ? await sql`
          SELECT * FROM harper_journal
          WHERE entry_type = ${entryType}
          ORDER BY created_at DESC LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM harper_journal
          ORDER BY created_at DESC LIMIT ${limit}
        `
    return (rows as JournalRow[]).map(mapRow)
  } catch (err) {
    log.error('Failed to read journal entries', { error: err instanceof Error ? err.message : String(err) })
    return memoryEntries.slice(0, limit)
  }
}

export async function searchJournal(query: string, limit = 10): Promise<JournalEntry[]> {
  if (!isDatabaseAvailable()) {
    const lower = query.toLowerCase()
    return memoryEntries
      .filter((e) => e.content.toLowerCase().includes(lower))
      .slice(0, limit)
  }

  try {
    const rows = await sql`
      SELECT * FROM harper_journal
      WHERE to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
      ORDER BY created_at DESC LIMIT ${limit}
    `
    return (rows as JournalRow[]).map(mapRow)
  } catch (err) {
    log.error('Failed to search journal', { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}

export async function getEntriesByTags(tags: string[], limit = 20): Promise<JournalEntry[]> {
  if (!isDatabaseAvailable()) {
    return memoryEntries
      .filter((e) => e.tags?.some((t) => tags.includes(t)))
      .slice(0, limit)
  }

  try {
    const rows = await sql`
      SELECT * FROM harper_journal
      WHERE tags && ${tags as any}
      ORDER BY created_at DESC LIMIT ${limit}
    `
    return (rows as JournalRow[]).map(mapRow)
  } catch (err) {
    log.error('Failed to read journal by tags', { error: err instanceof Error ? err.message : String(err) })
    return []
  }
}
