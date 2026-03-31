// [claude-code 2026-03-31] S13-T2: Claude Computer Use + TradingView trade plan skill
/**
 * TradingView Trade Plan Generator
 * Uses Claude Computer Use to view TradingView charts and produce structured trade plans.
 * Graceful degradation when Computer Use is unavailable.
 */

import { getSessionManager } from '../claude-sdk/session-manager.js'
import { getHealth } from '../claude-sdk/process-manager.js'
import { sql, isDatabaseAvailable } from '../../config/database.js'
import type { StoredProposal } from '../autopilot/proposal-service.js'
import { createLogger } from '../../lib/logger.js'

const log = createLogger('TradePlan')

// ── Types ──────────────────────────────────────────────────────────────────

export interface TradePlan {
  instrument: string
  direction: 'long' | 'short'
  entryPrice: number
  stopLoss: number
  takeProfitLevels: number[]     // up to 3 TP levels
  riskRewardRatio: number
  timeframe: string              // e.g., '4H', '1D', '15m'
  keyLevels: Array<{ label: string; price: number }>
  chartAnalysis: string          // Claude's written analysis
  confidence: number             // 0-100
  trendTemplate: 'ripper' | 'strong_trend' | 'weak_trend' | null
  screenshotBase64?: string      // optional chart screenshot
}

// ── Computer Use Availability ──────────────────────────────────────────────

/**
 * Check if Claude Computer Use is available.
 * Requires ENABLE_COMPUTER_USE=true and a working Claude CLI.
 */
export function isComputerUseAvailable(): boolean {
  return process.env.ENABLE_COMPUTER_USE === 'true'
}

/** Async check that also verifies CLI health */
export async function isComputerUseReady(): Promise<boolean> {
  if (!isComputerUseAvailable()) return false
  const health = await getHealth()
  return health.available
}

// ── Trade Plan Generation ──────────────────────────────────────────────────

/**
 * Generate a trade plan by invoking Claude Computer Use on TradingView.
 * Returns null if Computer Use is unavailable or generation fails.
 */
export async function generateTradePlan(
  instrument: string,
  direction: 'long' | 'short',
  context?: string,
): Promise<TradePlan | null> {
  if (!isComputerUseAvailable()) {
    log.info('Computer Use not enabled — skipping trade plan generation')
    return null
  }

  const health = await getHealth()
  if (!health.available) {
    log.warn('Claude CLI not available — skipping trade plan generation')
    return null
  }

  const timeframe = inferTimeframe(instrument)

  const prompt = buildTradePlanPrompt(instrument, direction, timeframe, context)

  try {
    const session = getSessionManager()
    const raw = await session.sendPromptSync(prompt, {
      model: 'claude-sonnet-4-5-20250514',
      allowedTools: ['computer'],
      maxTurns: 5,
      timeoutMs: 180_000, // 3 min — Computer Use is slow
    })

    const plan = parseTradePlanResponse(raw, instrument, direction, timeframe)
    if (!plan) {
      log.warn('Failed to parse trade plan from Claude response', {
        instrument,
        responseLength: raw.length,
      })
      return null
    }

    log.info('Trade plan generated', {
      instrument,
      direction,
      entry: plan.entryPrice,
      stop: plan.stopLoss,
      tpCount: plan.takeProfitLevels.length,
      confidence: plan.confidence,
    })

    return plan
  } catch (err) {
    log.warn('Trade plan generation failed (non-fatal)', {
      instrument,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ── Proposal Enrichment ────────────────────────────────────────────────────

/**
 * Enrich an existing StoredProposal with trade plan data.
 * Updates entry, stop, TP, keyLevels, confidence, and analystInputs.
 */
export async function enrichProposalWithTradePlan(
  proposalId: string,
  plan: TradePlan,
): Promise<StoredProposal | null> {
  if (!isDatabaseAvailable() || !sql) {
    log.warn('Database not available — cannot enrich proposal')
    return null
  }

  try {
    const result = await sql`
      UPDATE trading_proposals
      SET entry_price = ${plan.entryPrice},
          stop_loss = ${plan.stopLoss},
          take_profit = ${JSON.stringify(plan.takeProfitLevels)}::jsonb,
          risk_reward_ratio = ${plan.riskRewardRatio},
          confidence_score = ${plan.confidence / 100},
          analyst_inputs = analyst_inputs || ${JSON.stringify({
            tradePlanAnalysis: plan.chartAnalysis,
            tradePlanTimeframe: plan.timeframe,
            tradePlanKeyLevels: JSON.stringify(plan.keyLevels),
            tradePlanConfidence: String(plan.confidence),
            tradePlanTrendTemplate: plan.trendTemplate ?? '',
          })}::jsonb,
          updated_at = NOW()
      WHERE id = ${proposalId}
      RETURNING *
    `

    if (result.length === 0) {
      log.warn('Proposal not found for enrichment', { proposalId })
      return null
    }

    log.info('Proposal enriched with trade plan', { proposalId, instrument: plan.instrument })
    return mapRowToProposal(result[0])
  } catch (err) {
    log.error('Failed to enrich proposal', {
      proposalId,
      error: err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ── Prompt Building ────────────────────────────────────────────────────────

function buildTradePlanPrompt(
  instrument: string,
  direction: 'long' | 'short',
  timeframe: string,
  context?: string,
): string {
  const contextLine = context ? `\nAdditional context from the bulletin post: "${context.slice(0, 500)}"` : ''

  return `You are a professional technical analyst. Use Computer Use to open TradingView and analyze ${instrument}.

Steps:
1. Open TradingView in the browser and navigate to the ${instrument} chart
2. Switch to the 15m timeframe (structure timeframe)
3. Identify the base of the last fundamentally driven or parabolic move — this is where the trend began, not just the last swing
4. Select the Fibonacci Retracement drawing tool from the toolbar
5. Draw the fib from the BASE of that move to the current swing extreme (high for longs, low for shorts)
6. Open the fib tool's settings/templates and apply the correct saved template:
   - "Ripper" — use when price is above all fib zones (explosive momentum, no retracement)
   - "Strong Trend" — use when price holds above the 0.382–0.5 fib zone
   - "Weak Trend" — use when price is between the 0.5–0.786 fib zone
   STRICT RULE: When price closes below the last available fib zone of the current template, switch to the next template down (Ripper → Strong Trend → Weak Trend). Always load the template that matches where price actually is.
7. Now switch to the 5m timeframe (entry timeframe) to find precise entry points within the fib zones identified on 15m
8. Read the indicators already loaded on the chart:
   - Reversal RSI: Check for RSI divergences (bullish div = potential long entry, bearish div = potential short entry)
   - Price Overlay suite: Read the Liquidity points (key for entry — look for sweeps/reclaims), Fast EMA (20), Slow EMA (100), and Volume Delta Candles. If a signal fires from this suite, it confirms the entry.
9. On 5m, combine fib zones + indicator readings + VWAP for entry refinement
10. Based on the 15m fib structure + 5m entry analysis + indicator confluence, generate a ${direction} trade plan

${contextLine}

Return ONLY a JSON object (no markdown fences, no explanation outside the JSON) with this exact structure:
{
  "entryPrice": <number>,
  "stopLoss": <number>,
  "takeProfitLevels": [<number>, <number>, <number>],
  "riskRewardRatio": <number>,
  "keyLevels": [{"label": "<string>", "price": <number>}],
  "chartAnalysis": "<your written analysis>",
  "confidence": <number 0-100>,
  "trendTemplate": "ripper" | "strong_trend" | "weak_trend"
}

Important:
- Entry, stop, and TP must be realistic current price levels for ${instrument}
- Risk:Reward ratio should be calculated from entry/stop/TP1
- Include 1-3 take profit levels
- Key levels should include the fib zones from the applied template
- trendTemplate must match whichever saved template you applied on the chart
- Confidence 0-100 reflects how strong the setup is`
}

// ── Response Parsing ───────────────────────────────────────────────────────

function parseTradePlanResponse(
  raw: string,
  instrument: string,
  direction: 'long' | 'short',
  timeframe: string,
): TradePlan | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = raw.match(/\{[\s\S]*"entryPrice"[\s\S]*\}/)
    if (!jsonMatch) return null

    const parsed = JSON.parse(jsonMatch[0])

    // Validate required fields
    if (
      typeof parsed.entryPrice !== 'number' ||
      typeof parsed.stopLoss !== 'number' ||
      !Array.isArray(parsed.takeProfitLevels) ||
      parsed.takeProfitLevels.length === 0
    ) {
      return null
    }

    return {
      instrument,
      direction,
      entryPrice: parsed.entryPrice,
      stopLoss: parsed.stopLoss,
      takeProfitLevels: parsed.takeProfitLevels.slice(0, 3).map(Number),
      riskRewardRatio: typeof parsed.riskRewardRatio === 'number'
        ? parsed.riskRewardRatio
        : calculateRR(parsed.entryPrice, parsed.stopLoss, parsed.takeProfitLevels[0], direction),
      timeframe,
      keyLevels: Array.isArray(parsed.keyLevels)
        ? parsed.keyLevels.filter((kl: unknown) =>
            typeof kl === 'object' && kl !== null && 'label' in kl && 'price' in kl
          )
        : [],
      chartAnalysis: typeof parsed.chartAnalysis === 'string' ? parsed.chartAnalysis : '',
      confidence: typeof parsed.confidence === 'number'
        ? Math.min(100, Math.max(0, parsed.confidence))
        : 50,
      trendTemplate: ['ripper', 'strong_trend', 'weak_trend'].includes(parsed.trendTemplate)
        ? parsed.trendTemplate
        : null,
      screenshotBase64: typeof parsed.screenshotBase64 === 'string'
        ? parsed.screenshotBase64
        : undefined,
    }
  } catch {
    return null
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function calculateRR(
  entry: number,
  stop: number,
  tp: number,
  direction: 'long' | 'short',
): number {
  const risk = Math.abs(entry - stop)
  if (risk === 0) return 0
  const reward = direction === 'long' ? tp - entry : entry - tp
  return Math.round((reward / risk) * 100) / 100
}

function inferTimeframe(_instrument: string): string {
  // Structure on 15m, entry on 5m — always 15m as the primary timeframe
  return '15m'
}

function mapRowToProposal(row: Record<string, unknown>): StoredProposal {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    strategyName: String(row.strategy_name),
    instrument: String(row.instrument),
    direction: String(row.direction) as 'long' | 'short' | 'flat',
    entryPrice: row.entry_price as number | undefined,
    stopLoss: row.stop_loss as number | undefined,
    takeProfit: (row.take_profit as number[]) ?? [],
    positionSize: Number(row.position_size),
    riskRewardRatio: Number(row.risk_reward_ratio),
    confidenceScore: Number(row.confidence_score),
    rationale: String(row.rationale),
    analystInputs: (row.analyst_inputs as Record<string, string>) ?? {},
    timeframe: String(row.timeframe),
    setupType: String(row.setup_type),
    status: String(row.status) as StoredProposal['status'],
    expiresAt: String(row.expires_at),
    acknowledgedAt: row.acknowledged_at as string | undefined,
    executedAt: row.executed_at as string | undefined,
    executionResult: row.execution_result as Record<string, unknown> | undefined,
    riskAssessmentId: row.risk_assessment_id as string | undefined,
    debateId: row.debate_id as string | undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  }
}
