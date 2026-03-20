/**
 * Agent Handlers
 * Request handlers for collaborative AI agents
 * Phase 6 - Day 25
 */

// [claude-code 2026-03-11] Added performance endpoint for agent outcome tracking
import type { Context } from 'hono'
import { runAgentPipeline, runAnalystsOnly } from '../../services/agents/pipeline.js'
import { getReports } from '../../services/agents/base-agent.js'
import { getDebates } from '../../services/agents/debate-protocol.js'
import { getCombinedPerformance } from '../../services/agents/outcome-tracker.js'
import type { AgentType, AnalyzeRequest, GetReportsRequest } from '../../types/agents.js'

/**
 * POST /api/agents/analyze
 * Run the full agent analysis pipeline
 */
export async function handleAnalyze(c: Context) {
  const userId = c.get('userId') as string | undefined

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const body = await c.req.json<AnalyzeRequest>().catch(() => null)

    const result = await runAgentPipeline(userId, {
      includeDebate: body?.includeDebate ?? true,
      includeProposal: body?.includeProposal ?? true,
    })

    return c.json(result)
  } catch (error) {
    console.error('[Agents] Analyze error:', error)
    return c.json({ error: 'Analysis failed' }, 500)
  }
}

/**
 * POST /api/agents/quick-analysis
 * Run analysts only (no debate or proposal)
 */
export async function handleQuickAnalysis(c: Context) {
  const userId = c.get('userId') as string | undefined

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const result = await runAnalystsOnly(userId)
    return c.json(result)
  } catch (error) {
    console.error('[Agents] Quick analysis error:', error)
    return c.json({ error: 'Quick analysis failed' }, 500)
  }
}

/**
 * GET /api/agents/reports
 * Get agent reports
 */
export async function handleGetReports(c: Context) {
  const userId = c.get('userId') as string | undefined

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const agentType = c.req.query('type') as AgentType | undefined
    const limit = parseInt(c.req.query('limit') ?? '10', 10)
    const since = c.req.query('since')

    const reports = await getReports(userId, { agentType, limit, since })

    return c.json({ reports, total: reports.length })
  } catch (error) {
    console.error('[Agents] Get reports error:', error)
    return c.json({ error: 'Failed to get reports' }, 500)
  }
}

/**
 * GET /api/agents/debates
 * Get researcher debates
 */
export async function handleGetDebates(c: Context) {
  const userId = c.get('userId') as string | undefined

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    const limit = parseInt(c.req.query('limit') ?? '5', 10)
    const debates = await getDebates(userId, limit)

    return c.json({ debates, total: debates.length })
  } catch (error) {
    console.error('[Agents] Get debates error:', error)
    return c.json({ error: 'Failed to get debates' }, 500)
  }
}

/**
 * GET /api/agents/proposals
 * Get recent trading proposals
 */
export async function handleGetProposals(c: Context) {
  const userId = c.get('userId') as string | undefined

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    // Proposals are stored in agent_reports with type 'trader'
    const reports = await getReports(userId, { agentType: 'trader', limit: 10 })

    const proposals = reports.map(r => ({
      id: r.id,
      ...r.reportData,
      createdAt: r.createdAt,
    }))

    return c.json({ proposals, total: proposals.length })
  } catch (error) {
    console.error('[Agents] Get proposals error:', error)
    return c.json({ error: 'Failed to get proposals' }, 500)
  }
}

/**
 * GET /api/agents/status
 * Get agent pipeline status
 */
export async function handleGetStatus(c: Context) {
  const userId = c.get('userId') as string | undefined

  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  try {
    // Get most recent report from each agent type
    const agentTypes: AgentType[] = [
      'market_data',
      'news_sentiment',
      'technical',
      'bullish_researcher',
      'bearish_researcher',
    ]

    const statusPromises = agentTypes.map(async (type) => {
      const reports = await getReports(userId, { agentType: type, limit: 1 })
      return {
        agentType: type,
        lastReport: reports[0]?.createdAt ?? null,
        isStale: reports[0] 
          ? new Date().getTime() - new Date(reports[0].createdAt).getTime() > 300_000 
          : true,
      }
    })

    const statuses = await Promise.all(statusPromises)

    return c.json({
      agents: statuses,
      allFresh: statuses.every(s => !s.isStale),
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Agents] Get status error:', error)
    return c.json({ error: 'Failed to get status' }, 500)
  }
}

/**
 * GET /api/agents/performance
 * Get combined agent performance stats (futures + predictions)
 */
export async function handleGetPerformance(c: Context) {
  try {
    const days = parseInt(c.req.query('days') ?? '30', 10)
    const performance = await getCombinedPerformance(Math.min(365, Math.max(1, days)))

    return c.json({
      ...performance,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Agents] Get performance error:', error)
    return c.json({ error: 'Failed to get performance' }, 500)
  }
}

/**
 * GET /api/agents/predictions
 * Polymarket predictions removed (integration not set up)
 */
export async function handleGetPredictions(c: Context) {
  return c.json({ predictions: [], stats: { total: 0, correct: 0, accuracy: 0 }, timestamp: new Date().toISOString() })
}
