/**
 * Base Agent
 * Shared infrastructure for all AI agents
 * Phase 6 - Day 20
 */

import { invokeAgent } from '../strands/index.js'
import { sql, isDatabaseAvailable } from '../../config/database.js'
import type { AgentType, AgentReport, AgentReportRow } from '../../types/agents.js'

const isDev = process.env.NODE_ENV !== 'production'

// Report cache TTL (5 minutes for most, 1 minute for market data)
const CACHE_TTL_MS: Record<AgentType, number> = {
  market_data: 60_000,
  news_sentiment: 300_000,
  technical: 300_000,
  bullish_researcher: 600_000,
  bearish_researcher: 600_000,
  trader: 300_000,
  risk_manager: 300_000,
}

// In-memory cache for dev mode
const reportCache = new Map<string, { report: AgentReport; expiresAt: number }>()

export interface AgentContext {
  userId: string
  symbol?: string
  additionalData?: Record<string, unknown>
}

export interface AgentConfig<T = unknown> {
  agentType: AgentType
  taskType: string
  systemPrompt: string
  parseResponse: (text: string) => T
}

/**
 * Base function to run an agent
 */
export async function runAgent<T>(
  config: AgentConfig<T>,
  context: AgentContext,
  userPrompt: string
): Promise<{ report: T; latencyMs: number; model: string }> {
  const startTime = Date.now()

  const { text } = await invokeAgent({
    systemPrompt: config.systemPrompt,
    userPrompt,
    model: { temperature: 0.3, maxTokens: 2048 },
  })

  const reportData = config.parseResponse(text)
  const latencyMs = Date.now() - startTime

  return {
    report: reportData as T,
    latencyMs,
    model: 'strands-vproxy',
  }
}

/**
 * Save agent report to database
 */
export async function saveAgentReport<T extends object>(
  userId: string,
  agentType: AgentType,
  reportData: T,
  options: { confidenceScore?: number; model?: string; latencyMs?: number } = {}
): Promise<AgentReport> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + CACHE_TTL_MS[agentType])

  if (!isDatabaseAvailable() || !sql) {
    // In-memory fallback
    const id = crypto.randomUUID()
    const report: AgentReport = {
      id,
      userId,
      agentType,
      reportData: reportData as unknown as Record<string, unknown>,
      confidenceScore: options.confidenceScore ?? 0.8,
      model: options.model,
      latencyMs: options.latencyMs,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    }
    const cacheKey = `${userId}:${agentType}`
    reportCache.set(cacheKey, { report, expiresAt: expiresAt.getTime() })
    return report
  }

  const result = await sql`
    INSERT INTO agent_reports (user_id, agent_type, report_data, confidence_score, model, latency_ms, expires_at)
    VALUES (
      ${userId}, 
      ${agentType}, 
      ${JSON.stringify(reportData)}::jsonb, 
      ${options.confidenceScore ?? null},
      ${options.model ?? null},
      ${options.latencyMs ?? null},
      ${expiresAt.toISOString()}
    )
    RETURNING *
  `

  return mapRowToReport(result[0] as AgentReportRow)
}

/**
 * Get latest agent report (with caching)
 */
export async function getLatestReport(
  userId: string,
  agentType: AgentType
): Promise<AgentReport | null> {
  const cacheKey = `${userId}:${agentType}`
  
  // Check memory cache
  const cached = reportCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAt) {
    return cached.report
  }

  if (!isDatabaseAvailable() || !sql) {
    return null
  }

  const result = await sql`
    SELECT * FROM agent_reports
    WHERE user_id = ${userId} 
      AND agent_type = ${agentType}
      AND (expires_at IS NULL OR expires_at > NOW())
    ORDER BY created_at DESC
    LIMIT 1
  `

  if (result.length === 0) return null

  const report = mapRowToReport(result[0] as AgentReportRow)
  
  // Update cache
  const ttl = CACHE_TTL_MS[agentType]
  reportCache.set(cacheKey, { report, expiresAt: Date.now() + ttl })
  
  return report
}

/**
 * Get multiple reports by type
 */
export async function getReports(
  userId: string,
  options: { agentType?: AgentType; limit?: number; since?: string } = {}
): Promise<AgentReport[]> {
  const limit = options.limit ?? 10

  if (!isDatabaseAvailable() || !sql) {
    // Return from memory cache
    const reports: AgentReport[] = []
    for (const [key, cached] of reportCache.entries()) {
      if (key.startsWith(`${userId}:`)) {
        if (!options.agentType || cached.report.agentType === options.agentType) {
          reports.push(cached.report)
        }
      }
    }
    return reports.slice(0, limit)
  }

  const typeFilter = options.agentType ? sql`AND agent_type = ${options.agentType}` : sql``
  const sinceFilter = options.since ? sql`AND created_at > ${options.since}` : sql``

  const result = await sql`
    SELECT * FROM agent_reports
    WHERE user_id = ${userId} ${typeFilter} ${sinceFilter}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `

  return result.map((row) => mapRowToReport(row as AgentReportRow))
}

/**
 * Parse JSON from AI response
 */
export function parseJsonResponse<T>(text: string): T {
  // Clean up markdown formatting
  const cleaned = text
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch (error) {
    console.error('[Agent] Failed to parse JSON response:', text.slice(0, 200))
    throw new Error('Failed to parse agent response')
  }
}

/**
 * Map database row to AgentReport
 */
function mapRowToReport(row: AgentReportRow): AgentReport {
  return {
    id: row.id,
    userId: row.user_id,
    agentType: row.agent_type as AgentType,
    reportData: row.report_data,
    confidenceScore: row.confidence_score ?? 0.8,
    model: row.model ?? undefined,
    latencyMs: row.latency_ms ?? undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at ?? undefined,
  }
}

/**
 * Calculate confidence score from report data
 */
export function calculateConfidence(factors: { weight: number; value: number }[]): number {
  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0)
  const weightedSum = factors.reduce((sum, f) => sum + f.weight * f.value, 0)
  return Math.min(1, Math.max(0, weightedSum / totalWeight))
}
