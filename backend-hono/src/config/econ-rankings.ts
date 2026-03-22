// [claude-code 2026-03-22] Source of Truth fusion — econ print rankings and assessment logic

/**
 * Economic data print rankings — Source of Truth canonical ordering.
 * The macro chain: PMI > PPI > CPI > PCE > GDP
 * Each print builds the narrative for the next between FOMC meetings.
 */
export interface EconPrintConfig {
  name: string
  blackoutSeconds: number
  impact: 'very-high' | 'high' | 'medium' | 'low'
  chainRole: string
  rank: number
}

export const ECON_PRINT_RANKINGS: EconPrintConfig[] = [
  { name: 'PMI', blackoutSeconds: 120, impact: 'high', chainRole: "What's coming off the docks. First signal.", rank: 1 },
  { name: 'PPI', blackoutSeconds: 120, impact: 'high', chainRole: "Prices they're paying.", rank: 2 },
  { name: 'CPI', blackoutSeconds: 120, impact: 'very-high', chainRole: 'Prices on the shelf. Core narrative pair with PPI.', rank: 2 },
  { name: 'NFP', blackoutSeconds: 120, impact: 'very-high', chainRole: 'Jobs data. Major volatility catalyst.', rank: 3 },
  { name: 'PCE', blackoutSeconds: 120, impact: 'very-high', chainRole: "Fed's preferred inflation gauge. Chain endpoint.", rank: 4 },
  { name: 'GDP', blackoutSeconds: 120, impact: 'high', chainRole: 'Macro confirmation. Less tradeable intraday.', rank: 5 },
  { name: 'FOMC', blackoutSeconds: 120, impact: 'very-high', chainRole: 'Not a print but a regime-defining event.', rank: 6 },
  { name: 'Jobless Claims', blackoutSeconds: 60, impact: 'low', chainRole: 'Secondary. Trade only if conditions ideal.', rank: 7 },
  { name: 'Retail Sales', blackoutSeconds: 60, impact: 'low', chainRole: 'Secondary. Trade only if conditions ideal.', rank: 7 },
]

/**
 * Print assessment: hot / in-line / cold
 * Based on probability of a market "temper tantrum"
 */
export type PrintAssessment = 'hot' | 'in-line' | 'cold'

export function assessPrint(
  actual: number,
  forecast: number,
  prior: number
): PrintAssessment {
  const surprise = actual - forecast
  const range = Math.abs(forecast - prior) || 1
  const ratio = surprise / range

  if (ratio > 0.3) return 'hot'
  if (ratio < -0.3) return 'cold'
  return 'in-line'
}

/**
 * Check if a given print name requires a blackout window
 */
export function getBlackoutDuration(printName: string): number {
  const config = ECON_PRINT_RANKINGS.find(
    p => p.name.toLowerCase() === printName.toLowerCase()
  )
  return config?.blackoutSeconds ?? 0
}

/**
 * Check if a print is high-impact enough to warrant full playbook
 */
export function isHighImpactPrint(printName: string): boolean {
  const config = ECON_PRINT_RANKINGS.find(
    p => p.name.toLowerCase() === printName.toLowerCase()
  )
  return config?.impact === 'very-high' || config?.impact === 'high'
}
