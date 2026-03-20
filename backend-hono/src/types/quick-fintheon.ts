// [claude-code 2026-03-10] Shared QuickFintheon request/result types

export interface QuickFintheonRequest {
  image?: string       // base64 image data (user-provided, optional)
  algoState?: {
    bias?: string
    position?: string
    indicators?: Record<string, unknown>
  }
  url?: string         // specific URL to screenshot (optional, defaults to localhost:5173)
}

export interface QuickFintheonEntry {
  price: string
  reason: string
}

export interface QuickFintheonResult {
  bias: 'Bullish' | 'Bearish' | 'Neutral'
  confidence: number          // 0–100
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
  screenshot?: string         // base64 PNG if auto-captured
}
