// [claude-code 2026-03-10] Frontend QuickFintheon types (mirror of backend)

export interface QuickFintheonRequest {
  image?: string
  algoState?: {
    bias?: string
    position?: string
    indicators?: Record<string, unknown>
  }
  url?: string
}

export interface QuickFintheonEntry {
  price: string
  reason: string
}

export interface QuickFintheonResult {
  bias: 'Bullish' | 'Bearish' | 'Neutral'
  confidence: number
  rationale: string
  entries: {
    entry1: QuickFintheonEntry
    entry2?: QuickFintheonEntry
  }
  stopLoss: QuickFintheonEntry
  target: QuickFintheonEntry
  riskReward?: string
  timeframe?: string
  keyLevels?: string[]
  screenshot?: string
}
