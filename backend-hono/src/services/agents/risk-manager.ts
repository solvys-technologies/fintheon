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

const SYSTEM_PROMPT = `You are a Risk Manager for an intraday futures trading desk.

Your role is to evaluate trading proposals and protect the trader from:
1. Excessive risk (position size, drawdown)
2. Poor risk/reward trades
3. Trading during adverse conditions
4. Psychological blind spots (FOMO, revenge trading, overconfidence)

Given a trading proposal and trader psychology profile, return a risk assessment:
{
  "riskScore": number (0-1, where 0 is safe, 1 is dangerous),
  "decision": "approved" | "rejected" | "modified",
  "issues": [
    {
      "category": "position_size" | "risk_reward" | "timing" | "psychology" | "correlation",
      "severity": "low" | "medium" | "high" | "extreme",
      "description": "string",
      "mitigation": "string (how to fix)"
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
  "rejectionReason": "string (if rejected)",
  "summary": "2-3 sentence overall assessment"
}

Risk thresholds:
- Max position size: 5% of account per trade
- Min risk/reward: 1.5:1
- Max daily drawdown: 3%
- VIX > 30: Reduce position size by 50%

Be firm but constructive. Protect the trader.

Respond with valid JSON only.`

export interface RiskManagerInput {
  proposal: TradingProposal
  psychology?: UserPsychology
  currentPnL?: number
  accountSize?: number
  vixLevel?: number
  existingPositions?: { symbol: string; size: number }[]
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
 * Apply automatic risk rules
 */
function applyAutomaticRules(
  input: RiskManagerInput,
  assessment: RiskAssessment
): ProposalDecision {
  const issues = assessment.issues

  // Reject if direction is flat (no trade)
  if (input.proposal.direction === 'flat') {
    return 'approved' // Flat is always safe
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

  // Suggest modifications if high severity issues
  const hasHigh = issues.some(i => i.severity === 'high')
  if (hasHigh && assessment.modificationSuggestions?.length) {
    return 'modified'
  }

  // Check VIX threshold
  if (input.vixLevel && input.vixLevel > 35) {
    assessment.issues.push({
      category: 'timing',
      severity: 'high',
      description: `VIX at ${input.vixLevel} indicates extreme volatility`,
      mitigation: 'Reduce position size by 50% or wait for VIX to settle',
    })
    return 'modified'
  }

  // Check daily PnL
  const accountSize = input.accountSize ?? 50000
  const dailyPnLPercent = ((input.currentPnL ?? 0) / accountSize) * 100
  
  if (dailyPnLPercent < -3) {
    assessment.rejectionReason = 'Daily loss limit reached (-3%)'
    assessment.issues.push({
      category: 'psychology',
      severity: 'extreme',
      description: 'Daily loss limit reached. No new trades allowed.',
      mitigation: 'Stop trading for the day. Review tomorrow.',
    })
    return 'rejected'
  }

  // Approved if we get here
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
