// [claude-code 2026-03-10] Shared QuickPulse request/result types

export interface QuickPulseRequest {
  image?: string       // base64 image data (user-provided, optional)
  algoState?: {
    bias?: string
    position?: string
    indicators?: Record<string, unknown>
  }
  url?: string         // specific URL to screenshot (optional, defaults to localhost:5173)
}

export interface QuickPulseEntry {
  price: string
  reason: string
}

export interface QuickPulseResult {
  bias: 'Bullish' | 'Bearish' | 'Neutral'
  confidence: number          // 0–100
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
  screenshot?: string         // base64 PNG if auto-captured
}
