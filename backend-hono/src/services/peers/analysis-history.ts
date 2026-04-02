// [claude-code 2026-04-01] S13-T3: Cross-agent analysis history with FTS

import { sql, isDatabaseAvailable } from '../../config/database.js'
import { mapRowToThought, type ThoughtBankRow, type AgentThought } from '../../types/thought-bank.js'

// ---------------------------------------------------------------------------
// Full-text search on agent_thought_bank
// ---------------------------------------------------------------------------

/**
 * Full-text search across agent analysis history.
 * Uses PostgreSQL to_tsvector/to_tsquery for proper FTS,
 * falls back to ILIKE for in-memory.
 */
export async function searchAnalysisHistory(
  query: string,
  opts?: { agent?: string; since?: string; limit?: number }
): Promise<AgentThought[]> {
  const limit = opts?.limit ?? 20

  if (!isDatabaseAvailable()) {
    // In-memory: we don't have the thought bank memory store here,
    // return empty — FTS only works with DB
    return []
  }

  // Sanitize query for tsquery — replace spaces with &, strip special chars
  const tsQuery = query
    .replace(/[^\w\s/]/g, '')  // preserve / for futures symbols like /ES, /NQ
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' & ')

  if (!tsQuery) return []

  const result = await sql`
    SELECT *,
      ts_rank(
        to_tsvector('english', COALESCE(content, '')),
        to_tsquery('english', ${tsQuery})
      ) AS rank
    FROM agent_thought_bank
    WHERE to_tsvector('english', COALESCE(content, ''))
      @@ to_tsquery('english', ${tsQuery})
      AND (${opts?.agent ?? null}::text IS NULL OR agent = ${opts?.agent ?? ''})
      AND (${opts?.since ?? null}::timestamptz IS NULL OR created_at >= ${opts?.since ?? '1970-01-01'}::timestamptz)
    ORDER BY rank DESC, created_at DESC
    LIMIT ${limit}
  `

  return result.map((r) => mapRowToThought(r as ThoughtBankRow))
}

/**
 * Get recent analysis history for a specific agent.
 */
export async function getAgentAnalysisHistory(
  agentName: string,
  limit = 20
): Promise<AgentThought[]> {
  if (!isDatabaseAvailable()) return []

  const result = await sql`
    SELECT * FROM agent_thought_bank
    WHERE agent = ${agentName}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return result.map((r) => mapRowToThought(r as ThoughtBankRow))
}

/**
 * Get analysis history mentioning a specific instrument.
 */
export async function getAnalysisByInstrument(
  instrument: string,
  limit = 20
): Promise<AgentThought[]> {
  if (!isDatabaseAvailable()) return []

  const result = await sql`
    SELECT * FROM agent_thought_bank
    WHERE ${instrument} = ANY(instruments)
    ORDER BY created_at DESC
    LIMIT ${limit}
  `
  return result.map((r) => mapRowToThought(r as ThoughtBankRow))
}
