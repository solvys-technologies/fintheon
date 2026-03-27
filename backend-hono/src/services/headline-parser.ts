import type { ParsedHeadline, NewsSource, UrgencyLevel, MarketDirection } from '../types/news-analysis.js'
import { extractSpeaker } from './commentator/speaker-extractor.js'

const breakingPatterns = [/^BREAKING[:\s-]/i, /^JUST IN[:\s-]/i, /^ALERT[:\s-]/i, /^URGENT[:\s-]/i]
const econDataPatterns = [
  /([\w\s]+?):\s*Actual\s+([\d.,]+%?)\s+vs\s+(?:Expected|Forecast|Exp)\s+([\d.,]+%?)/i,
  /([\w\s]+?)\s+Actual\s+([\d.,]+%?)\s+vs\s+(?:Exp|Forecast|Expected)\s+([\d.,]+%?)/i,
  /([\w\s]+?)\s+([\w\s]+?):\s*([\d.,]+%?)\s+\(Actual\)\s+vs\s+([\d.,]+%?)\s+(?:Expected|Forecast)/i
]
const actionPattern =
  /(FED|ECB|BOE|BOJ|PBOC|POWELL|YELLEN|TREASURY|CONGRESS|CHINA|US|UK|EU|GERMANY|JAPAN|OPEC)\s+(raises|cuts|hikes|slashes|holds|signals|warns|confirms)\s+([\w\s%]+?)(?:\s+by\s+([\d.,]+)\s*(bps|%|points))?(?=$|\.)/i

const symbolRegex = /\$[A-Z]{1,5}\b/g
export const LEVEL4_EMOJIS = ['⚠️', '🔴', '🚨']
export const MAJOR_MACRO_PRINTS = ['cpiPrint', 'ppiPrint', 'nfpPrint', 'gdpPrint', 'fedDecision']

// Financial Juice emoji tiers — used by fj-emoji-filter.ts and for consistent reference
export const FJ_EMOJI_TIERS = {
  critical: ['🔴'],
  high: ['⚠️', '🚨'],
  medium: ['🟡', '🟠'],
  low: ['🔵'],
} as const

export function hasLevel4Emoji(text: string): boolean {
  return LEVEL4_EMOJIS.some((emoji) => text.includes(emoji))
}

const knownTickers = ['SPY', 'QQQ', 'ES', 'NQ', 'IWM', 'TLT', 'ZN', 'ZB', 'DXY', 'VIX', 'CL', 'GC', 'BTC', 'ETH']

const defaultParsedHeadline = (text: string, source: NewsSource): ParsedHeadline => ({
  raw: text,
  source,
  symbols: [],
  isBreaking: false,
  urgency: 'normal',
  tags: [],
  confidence: 0.35
})

const detectBreaking = (text: string): { isBreaking: boolean; urgency: UrgencyLevel } => {
  const matched = breakingPatterns.some((regex) => regex.test(text))
  if (matched) return { isBreaking: true, urgency: 'immediate' }
  if (/DEVELOPING|JUST NOW|FLASH/i.test(text)) return { isBreaking: true, urgency: 'high' }
  return { isBreaking: false, urgency: 'normal' }
}

const extractSymbols = (text: string): string[] => {
  const inline = text.match(symbolRegex)?.map((s) => s.replace('$', '').toUpperCase()) ?? []
  const inferred = knownTickers.filter((ticker) => new RegExp(`\\b${ticker}\\b`, 'i').test(text))
  return Array.from(new Set([...inline, ...inferred]))
}

const detectEventType = (text: string): string | undefined => {
  const upper = text.toUpperCase()
  if (upper.includes('CPI')) return 'cpiPrint'
  if (upper.includes('PPI')) return 'ppiPrint'
  if (upper.includes('NFP') || upper.includes('PAYROLL')) return 'nfpPrint'
  if (upper.includes('GDP')) return 'gdpPrint'
  if (upper.includes('FED') || upper.includes('FOMC') || upper.includes('POWELL')) return 'fedDecision'
  if (upper.includes('EARNINGS') || upper.includes('EPS')) return 'earnings'
  if (upper.includes('SANCTION') || upper.includes('WAR') || upper.includes('TENSION')) return 'geopolitical'
  if (upper.includes('BANK') && upper.includes('CRISIS')) return 'bankingCrisis'
  return undefined
}

const extractNumbers = (text: string) => {
  for (const pattern of econDataPatterns) {
    const match = text.match(pattern)
    if (!match) continue
    const [, label, actualText, forecastText] = match
    return {
      label: label.trim(),
      actualText,
      forecastText,
      actual: parseFloat(actualText.replace(/[^-\d.]/g, '')),
      forecast: parseFloat(forecastText.replace(/[^-\d.]/g, '')),
      unit: actualText.includes('%') ? '%' : undefined
    }
  }
  return undefined
}

const parseActionStatement = (text: string) => {
  const match = text.match(actionPattern)
  if (!match) return undefined
  const [, entity, action, target, magnitudeText, unit] = match
  return {
    entity: entity.toUpperCase(),
    action: action.toLowerCase(),
    target: target.trim(),
    magnitude: magnitudeText ? parseFloat(magnitudeText.replace(/[^-\d.]/g, '')) : undefined,
    unit
  }
}

const inferMarketReaction = (
  text: string
): { direction: MarketDirection; intensity: 'mild' | 'moderate' | 'severe' } | undefined => {
  if (/markets?\s+(?:tumble|drop|sell off|sink|slide)/i.test(text)) {
    return {
      direction: 'down',
      intensity: /tumble|plunge|crash/i.test(text) ? 'severe' : 'moderate'
    }
  }
  if (/markets?\s+(?:surge|jump|rally|rip)/i.test(text)) {
    return {
      direction: 'up',
      intensity: /surge|rip|soar/i.test(text) ? 'severe' : 'moderate'
    }
  }
  return undefined
}

export interface ParseHeadlineOptions {
  source?: NewsSource
}

export interface HeadlineParseResult {
  parsed: ParsedHeadline
  isConfident: boolean
}

export const parseHeadline = (text: string, options?: ParseHeadlineOptions): HeadlineParseResult => {
  const trimmed = text.trim()
  const source = options?.source ?? 'Custom'
  const parsed = defaultParsedHeadline(trimmed, source)
  const { isBreaking, urgency } = detectBreaking(trimmed)
  parsed.isBreaking = isBreaking
  parsed.urgency = urgency

  parsed.symbols = extractSymbols(trimmed)
  parsed.eventType = detectEventType(trimmed)
  parsed.marketReaction = inferMarketReaction(trimmed)

  const actionInfo = parseActionStatement(trimmed)
  if (actionInfo) {
    parsed.entity = actionInfo.entity
    parsed.action = actionInfo.action.toUpperCase()
    parsed.target = actionInfo.target
    parsed.magnitude = actionInfo.magnitude
    parsed.unit = actionInfo.unit
    parsed.confidence += 0.25
  }

  const numberInfo = extractNumbers(trimmed)
  if (numberInfo) {
    parsed.numbers = {
      actual: numberInfo.actual,
      actualText: numberInfo.actualText,
      forecast: numberInfo.forecast,
      forecastText: numberInfo.forecastText,
      unit: numberInfo.unit
    }
    parsed.confidence += 0.25
    parsed.tags.push('economic-data')
    parsed.eventType ??= 'economicData'
  }

  // Speaker extraction — adds speaker/institution fields but does NOT affect scoring (T5 scope)
  const speakerInfo = extractSpeaker(trimmed)
  if (speakerInfo.speaker) {
    parsed.speaker = speakerInfo.speaker
    parsed.speakerInstitution = speakerInfo.institution ?? undefined
    parsed.isOfficialStatement = speakerInfo.isOfficial
  }

  if (parsed.symbols.length > 0) {
    parsed.confidence += 0.15
  }
  if (parsed.eventType) {
    parsed.tags.push(parsed.eventType)
    parsed.confidence += 0.1
  }

  parsed.confidence = Math.min(1, Math.max(0, parsed.confidence))
  const isConfident = parsed.confidence >= 0.65

  return { parsed, isConfident }
}

