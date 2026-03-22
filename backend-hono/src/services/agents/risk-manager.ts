// [claude-code 2026-03-16] Agent backend v7.9: merged PMA, Herald, Notion split docs
/**
 * Risk Manager Agent — Feucht's Domain
 * Evaluates trading proposals and enforces risk rules.
 *
 * Risk management is now primarily under Feucht's purview (Futures, Execution & Risk).
 * This module provides the core risk assessment logic that Feucht invokes
 * as Stage 4 of the agent pipeline.
 *
 * Agent roster context:
 *   - Feucht: owns this risk check (drawdown, exposure, position sizing, psychology)
 *   - Oracle: feeds prediction market + macro risk signals upstream (Stage 2)
 *   - Herald: feeds sentiment risk flags upstream (Stage 1)
 *   - Consul: provides fundamental risk context via research debate (Stage 3)
 */

import { generateText } from 'ai'
import { selectModel, createModelClient, type AiModelKey } from '../ai/model-selector.js'
import { sql, isDatabaseAvailable } from '../../config/database.js'
import type {
  RiskAssessment,
  TradingProposal,
  UserPsychology,
  RiskLevel,
  ProposalDecision,
  RiskAssessmentRow,
} from '../../types/agents.js'

// [claude-code 2026-03-22] Source of Truth fusion — reconciled risk rules
const SYSTEM_PROMPT = `You are Feucht's Risk Manager module for Priced In Capital's intraday futures desk.
You enforce the 14 Commandments and the Source of Truth risk framework.

Your role is to evaluate trading proposals and protect the trader from:
1. Excessive risk (position size, drawdown, PDPT overshoot)
2. Poor risk/reward trades (minimum 2:1 R:R — Commandment 8)
3. Trading during adverse conditions (blackout windows, post-11:30 AM)
4. Psychological blind spots (funded creep, revenge trading, hot hand overconfidence)
5. Commandment violations (especially 3, 7, 12, 14 — hard blocks)

Given a trading proposal and trader psychology profile, return a risk assessment:
{
  "riskScore": number (0-1, where 0 is safe, 1 is dangerous),
  "decision": "approved" | "rejected" | "modified",
  "issues": [
    {
      "category": "position_size" | "risk_reward" | "timing" | "psychology" | "correlation" | "commandment",
      "severity": "low" | "medium" | "high" | "extreme",
      "description": "string",
      "mitigation": "string (how to fix)",
      "commandmentRef": number | null
    }
  ],
  "portfolioImpact": {
    "maxDrawdown": number (percentage),
    "positionConcentration": number (percentage of account),
    "correlationRisk": "low" | "medium" | "high"
  },
  "blindSpotAlerts": ["array of relevant blind spot warnings"],
  "modificationSuggestions": [
    {
      "field": "positionSize" | "stopLoss" | "takeProfit" | "direction",
      "current": value,
      "suggested": value,
      "reason": "string"
    }
  ],
  "rejectionReason": "string (if rejected, cite commandment number)",
  "summary": "2-3 sentence overall assessment"
}

Risk thresholds (Source of Truth):
- PDPT target: $1,550/day ($50 buffer over $1,500 for clean fills)
- Min risk/reward: 2:1 (Commandment 8 — "good traders buy from good prices")
- Max daily drawdown: 3% of account
- VIX > 30: Reduce position size by 50%
- VIX > 35: Extreme volatility — further reduction required
- 120-second blackout after major econ prints (PMI, PPI, CPI, NFP, PCE, GDP)
- 11:30 AM EST circuit breaker — no new trades after
- Commandment 3: Reject proposals with conviction below medium
- Commandment 7: Reject any doubling-down on losing positions
- Commandment 12: Every trade MUST have a defined stop-loss
- Commandment 14: Morning routine must be completed before first trade

Detect funded creep: if position sizing or entry frequency exceeds
funded-account norms, flag as psychology issue.

Be firm but constructive. Cite commandment numbers in rejections. Protect the trader.

Respond with valid JSON only.`

export interface RiskManagerInput {
  proposal: TradingProposal
  psychology?: UserPsychology
  currentPnL?: number
  accountSize?: number
  vixLevel?: number
  existingPositions?: { symbol: string; size: number; pnl?: number }[]
  /** Current time in EST (HH:MM format) for circuit breaker checks */
  timeEST?: string
  /** Whether morning routine has been completed today */
  morningRoutineDone?: boolean
  /** Seconds since last major econ print (for blackout check) */
  secondsSinceLastPrint?: number
  /** Number of consecutive losses this session */
  consecutiveLosses?: number
}

/**
 * Assess a trading proposal
 */
export async function assessProposal(
  userId: string,
  input: RiskManagerInput
): Promise<RiskAssessment> {
  const selection = selectModel({ taskType: 'reasoning' })
  const model = createModelClient(selection.model as AiModelKey)

  const prompt = buildPrompt(input)

  const { text } = await generateText({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    temperature: 0.2,
    maxOutputTokens: 1024,
  })

  const parsed = parseJsonSafe<Partial<RiskAssessment>>(text)

  const assessment: RiskAssessment = {
    id: crypto.randomUUID(),
    userId,
    proposalId: input.proposal.id,
    riskScore: parsed?.riskScore ?? 0.5,
    decision: parsed?.decision ?? 'pending',
    issues: parsed?.issues ?? [],
    portfolioImpact: parsed?.portfolioImpact ?? {
      maxDrawdown: 0,
      positionConcentration: 0,
      correlationRisk: 'low',
    },
    blindSpotAlerts: parsed?.blindSpotAlerts ?? [],
    modificationSuggestions: parsed?.modificationSuggestions,
    rejectionReason: parsed?.rejectionReason,
    summary: parsed?.summary ?? 'Assessment pending.',
    createdAt: new Date().toISOString(),
  }

  // Apply automatic rules
  assessment.decision = applyAutomaticRules(input, assessment)

  // Save to database
  await saveAssessment(assessment)

  return assessment
}

/**
 * Apply automatic risk rules — Source of Truth reconciled
 */
function applyAutomaticRules(
  input: RiskManagerInput,
  assessment: RiskAssessment
): ProposalDecision {
  const issues = assessment.issues

  // Flat direction is always safe
  if (input.proposal.direction === 'flat') {
    return 'approved'
  }

  // HARD BLOCK: Commandment 14 — morning routine
  if (input.morningRoutineDone === false) {
    assessment.rejectionReason = '[C14] Morning routine not completed. No trading until routine is verified.'
    assessment.issues.push({
      category: 'commandment',
      severity: 'extreme',
      description: 'Commandment 14: The morning routine is non-negotiable.',
      mitigation: 'Complete morning routine before submitting trades.',
    })
    return 'rejected'
  }

  // HARD BLOCK: 11:30 AM EST circuit breaker
  if (input.timeEST) {
    const [h, m] = input.timeEST.split(':').map(Number)
    if (h > 11 || (h === 11 && m >= 30)) {
      assessment.rejectionReason = '11:30 AM EST circuit breaker — no new trades.'
      assessment.issues.push({
        category: 'timing',
        severity: 'extreme',
        description: 'Circuit breaker: 11:30 AM EST hard stop. No new trades after this time.',
        mitigation: 'Trading session is over. Review and prepare for tomorrow.',
      })
      return 'rejected'
    }
  }

  // HARD BLOCK: 120-second blackout after major econ prints
  if (input.secondsSinceLastPrint !== undefined && input.secondsSinceLastPrint < 120) {
    assessment.rejectionReason = `120-second blackout active (${120 - input.secondsSinceLastPrint}s remaining). The wick fills back in.`
    assessment.issues.push({
      category: 'timing',
      severity: 'extreme',
      description: 'News blackout: 120 seconds must pass after a major econ print. Initial spike is noise/algos/stop hunts.',
      mitigation: 'Wait for the wick to fill back — the reclaim IS the trade.',
    })
    return 'rejected'
  }

  // HARD BLOCK: Commandment 12 — no trade without stop-loss
  if (!input.proposal.stopLoss) {
    assessment.rejectionReason = '[C12] Be right or be right out — stop-loss is non-negotiable.'
    assessment.issues.push({
      category: 'commandment',
      severity: 'extreme',
      description: 'Commandment 12: Every trade must have a defined stop-loss.',
      mitigation: 'Define a stop-loss level before entry.',
    })
    return 'rejected'
  }

  // HARD BLOCK: Commandment 3 — no shot in the dark
  if (input.proposal.confidence !== undefined && input.proposal.confidence < 50) {
    assessment.rejectionReason = '[C3] No shot in the dark trades — conviction too low.'
    assessment.issues.push({
      category: 'commandment',
      severity: 'extreme',
      description: `Commandment 3: Confidence at ${input.proposal.confidence}% is below medium threshold.`,
      mitigation: 'Build a stronger thesis or wait for a higher-conviction setup.',
    })
    return 'rejected'
  }

  // HARD BLOCK: Commandment 7 — no doubling down on losers
  if (input.existingPositions?.length) {
    const sameSymbolLosing = input.existingPositions.find(
      p => p.symbol === input.proposal.instrument && (p.pnl ?? 0) < 0
    )
    if (sameSymbolLosing) {
      assessment.rejectionReason = '[C7] No doubling down on losers. Cut and reassess.'
      assessment.issues.push({
        category: 'commandment',
        severity: 'extreme',
        description: `Commandment 7: Already holding a losing position in ${sameSymbolLosing.symbol}. Cannot add.`,
        mitigation: 'Close the losing position first, then reassess from scratch.',
      })
      return 'rejected'
    }
  }

  // Reject if risk score is too high
  if (assessment.riskScore > 0.8) {
    assessment.rejectionReason = 'Risk score exceeds threshold (0.8)'
    return 'rejected'
  }

  // Reject if any extreme issues
  const hasExtreme = issues.some(i => i.severity === 'extreme')
  if (hasExtreme) {
    assessment.rejectionReason = 'Extreme risk factor identified'
    return 'rejected'
  }

  // SOFT: Commandment 6 — anti-revenge after consecutive losses
  if (input.consecutiveLosses && input.consecutiveLosses >= 2) {
    assessment.issues.push({
      category: 'psychology',
      severity: 'high',
      description: `Commandment 6: ${input.consecutiveLosses} consecutive losses. Revenge trading risk elevated.`,
      mitigation: 'Consider switching instrument or direction. You never need to make back losses the same way.',
    })
  }

  // SOFT: R:R minimum 2:1 (Commandment 8)
  if (input.proposal.riskRewardRatio !== undefined && input.proposal.riskRewardRatio < 2) {
    assessment.issues.push({
      category: 'risk_reward',
      severity: 'high',
      description: `Commandment 8: R:R at ${input.proposal.riskRewardRatio}:1 is below 2:1 minimum.`,
      mitigation: 'Adjust entry, stop, or target to achieve at least 2:1 R:R.',
    })
  }

  // Suggest modifications if high severity issues
  const hasHigh = issues.some(i => i.severity === 'high')
  if (hasHigh && assessment.modificationSuggestions?.length) {
    return 'modified'
  }

  // VIX thresholds
  if (input.vixLevel && input.vixLevel > 35) {
    assessment.issues.push({
      category: 'timing',
      severity: 'high',
      description: `VIX at ${input.vixLevel} — extreme volatility`,
      mitigation: 'Reduce position size by 50% or wait for VIX to settle.',
    })
    return 'modified'
  }
  if (input.vixLevel && input.vixLevel > 30) {
    assessment.issues.push({
      category: 'timing',
      severity: 'medium',
      description: `VIX at ${input.vixLevel} — elevated volatility`,
      mitigation: 'Reduce position size by 50%.',
    })
  }

  // Daily PnL check
  const accountSize = input.accountSize ?? 50000
  const dailyPnLPercent = ((input.currentPnL ?? 0) / accountSize) * 100

  if (dailyPnLPercent < -3) {
    assessment.rejectionReason = 'Daily loss limit reached (-3%). Commandment 13: there is always another trade.'
    assessment.issues.push({
      category: 'psychology',
      severity: 'extreme',
      description: 'Daily loss limit reached. No new trades allowed.',
      mitigation: 'Stop trading for the day. Review tomorrow.',
    })
    return 'rejected'
  }

  // Check for high issues without modification suggestions
  if (hasHigh) {
    return 'modified'
  }

  return 'approved'
}

/**
 * Build prompt for risk manager
 */
function buildPrompt(input: RiskManagerInput): string {
  const sections: string[] = ['Evaluate this trading proposal:']

  const { proposal } = input
  sections.push(`\n=== PROPOSAL ===`)
  sections.push(`Instrument: ${proposal.instrument}`)
  sections.push(`Direction: ${proposal.direction}`)
  sections.push(`Entry: ${proposal.entryPrice ?? 'N/A'}`)
  sections.push(`Stop Loss: ${proposal.stopLoss ?? 'N/A'}`)
  sections.push(`Take Profit: ${proposal.takeProfit?.join(', ') ?? 'N/A'}`)
  sections.push(`Position Size: ${proposal.positionSize} contracts`)
  sections.push(`Risk/Reward: ${proposal.riskRewardRatio}`)
  sections.push(`Confidence: ${proposal.confidence}%`)
  sections.push(`Rationale: ${proposal.rationale}`)

  const accountSize = input.accountSize ?? 50000
  sections.push(`\n=== ACCOUNT ===`)
  sections.push(`Account Size: $${accountSize.toLocaleString()}`)
  sections.push(`Current PnL: $${(input.currentPnL ?? 0).toLocaleString()} (${((input.currentPnL ?? 0) / accountSize * 100).toFixed(2)}%)`)
  
  if (input.vixLevel) {
    sections.push(`VIX Level: ${input.vixLevel}`)
  }

  if (input.existingPositions?.length) {
    sections.push(`\nExisting Positions:`)
    input.existingPositions.forEach(p => sections.push(`- ${p.symbol}: ${p.size} contracts`))
  }

  if (input.psychology) {
    sections.push(`\n=== TRADER PSYCHOLOGY ===`)
    sections.push(`Blind Spots: ${input.psychology.blindSpots.join(', ') || 'None identified'}`)
    sections.push(`Goal: ${input.psychology.goal ?? 'Not set'}`)
    if (input.psychology.psychScores) {
      sections.push(`FOMO tendency: ${input.psychology.psychScores.fomo}/10`)
      sections.push(`Revenge trading risk: ${input.psychology.psychScores.revenge}/10`)
      sections.push(`Overconfidence: ${input.psychology.psychScores.overconfidence}/10`)
    }
  }

  sections.push('\nAssess the proposal and enforce risk rules.')

  return sections.join('\n')
}

/**
 * Save assessment to database
 */
async function saveAssessment(assessment: RiskAssessment): Promise<void> {
  if (!isDatabaseAvailable() || !sql) {
    return
  }

  await sql`
    INSERT INTO risk_assessments (
      id, user_id, proposal_id, risk_manager_report, risk_score,
      decision, rejection_reason, modification_suggestions, model
    )
    VALUES (
      ${assessment.id},
      ${assessment.userId},
      ${assessment.proposalId ?? null},
      ${JSON.stringify({
        issues: assessment.issues,
        portfolioImpact: assessment.portfolioImpact,
        blindSpotAlerts: assessment.blindSpotAlerts,
        summary: assessment.summary,
      })}::jsonb,
      ${assessment.riskScore},
      ${assessment.decision},
      ${assessment.rejectionReason ?? null},
      ${assessment.modificationSuggestions ? JSON.stringify(assessment.modificationSuggestions) : null}::jsonb,
      ${null}
    )
  `
}

/**
 * Get user psychology profile
 */
export async function getUserPsychology(userId: string): Promise<UserPsychology | null> {
  if (!isDatabaseAvailable() || !sql) {
    return null
  }

  const result = await sql`
    SELECT * FROM user_psychology WHERE user_id = ${userId} LIMIT 1
  `

  if (result.length === 0) return null

  const row = result[0]
  return {
    userId: String(row.user_id),
    blindSpots: (row.blind_spots as string[]) ?? [],
    goal: row.goal as string | undefined,
    orientationComplete: Boolean(row.orientation_complete),
    psychScores: (row.psych_scores as UserPsychology['psychScores']) ?? {
      fomo: 5,
      revenge: 5,
      overconfidence: 5,
      lossAversion: 5,
    },
    lastAssessmentAt: row.last_assessment_at as string | undefined,
    agentNotes: (row.agent_notes as string[]) ?? [],
  }
}

/**
 * Safe JSON parse
 */
function parseJsonSafe<T>(text: string): T | null {
  try {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    return JSON.parse(cleaned) as T
  } catch {
    return null
  }
}
