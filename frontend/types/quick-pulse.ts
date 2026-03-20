// [claude-code 2026-03-10] Frontend QuickPulse types (mirror of backend)

export interface QuickPulseRequest {
  image?: string
  algoState?: {
    bias?: string
    position?: string
    indicators?: Record<string, unknown>
  }
  url?: string
}

export interface QuickPulseEntry {
  price: string
  reason: string
}

export interface QuickPulseResult {
  bias: 'Bullish' | 'Bearish' | 'Neutral'
  confidence: number
  rationale: string
  entries: {
    entry1: QuickPulseEntry
    entry2?: QuickPulseEntry
  }
  stopLoss: QuickPulseEntry
  target: QuickPulseEntry
  riskReward?: string
  timeframe?: string
  keyLevels?: string[]
  screenshot?: string
}
