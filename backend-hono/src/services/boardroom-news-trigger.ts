/**
 * Boardroom Breaking News Trigger Handler
 * 
 * Listens for Herald sentinel alerts (Macro Level 3-4 events) and
 * spawns boardroom discussions when critical market-moving news hits.
 * 
 * This is an event-driven trigger that works alongside the scheduled
 * morning standup to ensure agents respond to breaking news in real-time.
 */

import { appendToBoardroom, sendToIntervention } from './hermes-sessions.js';
import type { BoardroomAgent, InterventionSeverity } from '../types/boardroom.js';

/**
 * Macro Event Levels
 * 
 * Level 1: Routine economic data (minor impact)
 * Level 2: Notable data releases (moderate impact)
 * Level 3: Market-moving events (significant impact) - TRIGGERS BOARDROOM
 * Level 4: Black swan / crisis events (extreme impact) - TRIGGERS BOARDROOM
 */
export type MacroEventLevel = 1 | 2 | 3 | 4;

/**
 * Categories of market-moving events that trigger boardroom discussion
 */
export type MarketEventType =
  | 'CPI'                    // Consumer Price Index
  | 'NFP'                    // Non-Farm Payrolls
  | 'FOMC'                   // Federal Open Market Committee / Fed decisions
  | 'FED_RATE'               // Federal Reserve rate decisions
  | 'VIX_SPIKE'              // VIX volatility surge
  | 'VIX_CRUSH'              // VIX volatility collapse
  | 'BLACK_SWAN'             // Unforeseen black swan events
  | 'GEOPOLITICAL'           // Major geopolitical events
  | 'EARNINGS_CRASH'         // Major earnings surprise / crash
  | 'LIQUIDITY_CRISIS'       // Market liquidity events
  | 'CURRENCY_CRISIS'        // FX market disruption
  | 'COMMODITY_SHOCK'        // Energy / metals price shocks
  | 'CREDIT_EVENT'           // Credit market disruption
  | 'REGULATORY'             // Major regulatory announcements
  | 'OTHER';                 // Other market-moving events

/**
 * Herald Sentinel Alert structure
 * Represents incoming alerts from the Herald risk/sentinel agent
 */
export interface HeraldSentinelAlert {
  /** Unique alert identifier */
  id: string;
  /** Alert timestamp */
  timestamp: string;
  /** Event type/category */
  eventType: MarketEventType;
  /** Macro severity level (1-4) */
  macroLevel: MacroEventLevel;
  /** Headline or summary of the event */
  headline: string;
  /** Detailed description */
  description?: string;
  /** Affected instruments/symbols */
  affectedInstruments?: string[];
  /** Expected impact direction */
  impactDirection?: 'bullish' | 'bearish' | 'neutral' | 'mixed';
  /** Impact magnitude (0-100) */
  impactMagnitude?: number;
  /** Source of the alert */
  source?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Configuration for the news trigger handler
 */
export interface NewsTriggerConfig {
  /** Minimum macro level to trigger boardroom (default: 3) */
  minMacroLevel: MacroEventLevel;
  /** Whether VIX moves always trigger regardless of level */
  vixAlwaysTriggers: boolean;
  /** VIX threshold for automatic trigger (percentage move) */
  vixTriggerThreshold: number;
  /** Enable geo-political event triggers */
  enableGeopoliticalTriggers: boolean;
  /** Enable black swan triggers */
  enableBlackSwanTriggers: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_NEWS_TRIGGER_CONFIG: NewsTriggerConfig = {
  minMacroLevel: 3,
  vixAlwaysTriggers: true,
  vixTriggerThreshold: 10, // 10% VIX move
  enableGeopoliticalTriggers: true,
  enableBlackSwanTriggers: true,
};

/**
 * Check if an alert should trigger a boardroom discussion
 * 
 * @param alert - The herald sentinel alert to evaluate
 * @param config - Trigger configuration (optional, uses defaults)
 * @returns True if the alert should trigger boardroom discussion
 */
export function shouldTriggerBoardroom(
  alert: HeraldSentinelAlert,
  config: NewsTriggerConfig = DEFAULT_NEWS_TRIGGER_CONFIG
): boolean {
  // Always trigger on Level 4 (black swan / crisis)
  if (alert.macroLevel === 4) {
    return true;
  }

  // Trigger on Level 3+ (market-moving) if meets minimum threshold
  if (alert.macroLevel >= config.minMacroLevel) {
    // Check for market-moving event types
    const marketMovingTypes: MarketEventType[] = [
      'CPI',
      'NFP',
      'FOMC',
      'FED_RATE',
      'BLACK_SWAN',
      'LIQUIDITY_CRISIS',
      'CURRENCY_CRISIS',
      'CREDIT_EVENT',
    ];

    if (marketMovingTypes.includes(alert.eventType)) {
      return true;
    }

    // VIX special handling
    if (alert.eventType === 'VIX_SPIKE' || alert.eventType === 'VIX_CRUSH') {
      if (config.vixAlwaysTriggers) {
        return true;
      }
      // Check if VIX move exceeds threshold
      if (alert.impactMagnitude && alert.impactMagnitude >= config.vixTriggerThreshold) {
        return true;
      }
    }

    // Geopolitical events (if enabled)
    if (config.enableGeopoliticalTriggers && alert.eventType === 'GEOPOLITICAL') {
      return alert.macroLevel >= 3;
    }

    // Black swan events (if enabled)
    if (config.enableBlackSwanTriggers && alert.eventType === 'BLACK_SWAN') {
      return true;
    }
  }

  return false;
}

/**
 * Determine intervention severity based on alert
 * 
 * @param alert - The herald sentinel alert
 * @returns Severity level for the intervention
 */
export function getSeverityFromAlert(alert: HeraldSentinelAlert): InterventionSeverity {
  // Level 4 = Critical
  if (alert.macroLevel === 4) {
    return 'critical';
  }

  // Level 3 with high impact = Critical
  if (alert.macroLevel === 3 && (alert.impactMagnitude ?? 0) >= 70) {
    return 'critical';
  }

  // Level 3 = Warning
  if (alert.macroLevel === 3) {
    return 'warning';
  }

  // Fallback
  return 'warning';
}

/**
 * Format alert into boardroom message
 * 
 * @param alert - The herald sentinel alert
 * @returns Formatted message for boardroom posting
 */
export function formatAlertForBoardroom(alert: HeraldSentinelAlert): string {
  const SEVERITY_EMOJI: Record<InterventionSeverity, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  };

  const TYPE_EMOJI: Record<MarketEventType, string> = {
    CPI: '📊',
    NFP: '💼',
    FOMC: '🏛️',
    FED_RATE: '🏦',
    VIX_SPIKE: '📈',
    VIX_CRUSH: '📉',
    BLACK_SWAN: '🦢',
    GEOPOLITICAL: '🌍',
    EARNINGS_CRASH: '💥',
    LIQUIDITY_CRISIS: '💧',
    CURRENCY_CRISIS: '💱',
    COMMODITY_SHOCK: '🛢️',
    CREDIT_EVENT: '💳',
    REGULATORY: '⚖️',
    OTHER: '📰',
  };

  const severity = getSeverityFromAlert(alert);
  const emoji = SEVERITY_EMOJI[severity];
  const typeEmoji = TYPE_EMOJI[alert.eventType] || '📰';

  let message = `${emoji}${typeEmoji} **[BREAKING NEWS ALERT]** — Macro Level ${alert.macroLevel}\n\n`;
  message += `**${alert.headline}**\n\n`;

  if (alert.description) {
    message += `${alert.description}\n\n`;
  }

  if (alert.affectedInstruments && alert.affectedInstruments.length > 0) {
    message += `*Affected:* ${alert.affectedInstruments.join(', ')}\n`;
  }

  if (alert.impactDirection) {
    const dirEmoji: Record<string, string> = {
      bullish: '🟢',
      bearish: '🔴',
      neutral: '🟡',
      mixed: '🟠',
    };
    message += `*Impact:* ${dirEmoji[alert.impactDirection] || '⚪'} ${alert.impactDirection.toUpperCase()}\n`;
  }

  if (alert.impactMagnitude) {
    message += `*Magnitude:* ${alert.impactMagnitude}/100\n`;
  }

  message += `\n_@Harper-Hermes convening boardroom for rapid assessment_`;

  return message;
}

/**
 * Trigger boardroom discussion for breaking news
 * 
 * This is the main entry point when a Herald sentinel alert is received.
 * It evaluates the alert, and if it meets the criteria, posts to the
 * boardroom to wake up agents for an emergency discussion.
 * 
 * @param alert - The herald sentinel alert
 * @param config - Trigger configuration (optional)
 * @returns Object indicating whether boardroom was triggered and why
 */
export async function triggerBoardroomForNews(
  alert: HeraldSentinelAlert,
  config: NewsTriggerConfig = DEFAULT_NEWS_TRIGGER_CONFIG
): Promise<{ triggered: boolean; reason?: string; message?: string }> {
  // Check if this alert should trigger boardroom
  if (!shouldTriggerBoardroom(alert, config)) {
    return { triggered: false, reason: 'Alert does not meet trigger criteria' };
  }

  // Format the alert message
  const message = formatAlertForBoardroom(alert);

  // Post to boardroom
  await appendToBoardroom(message, 'assistant');

  // Also send to intervention channel to ensure Harper-Hermes sees it immediately
  const interventionMessage = `🚨 BREAKING: ${alert.headline} (Macro Level ${alert.macroLevel})`;
  await sendToIntervention(interventionMessage, 'pic-intervention');

  // Log the trigger
  console.log(`[BoardroomNewsTrigger] Triggered boardroom for: ${alert.headline}`);
  console.log(`[BoardroomNewsTrigger] Alert ID: ${alert.id}, Type: ${alert.eventType}, Level: ${alert.macroLevel}`);

  return {
    triggered: true,
    reason: `Macro Level ${alert.macroLevel} ${alert.eventType} event`,
    message,
  };
}

/**
 * Create a Herald sentinel alert from raw data
 * 
 * Helper function to construct properly formatted alerts
 * 
 * @param data - Raw alert data
 * @returns Formatted HeraldSentinelAlert
 */
export function createHeraldAlert(data: Partial<HeraldSentinelAlert>): HeraldSentinelAlert {
  return {
    id: data.id ?? crypto.randomUUID(),
    timestamp: data.timestamp ?? new Date().toISOString(),
    eventType: data.eventType ?? 'OTHER',
    macroLevel: data.macroLevel ?? 2,
    headline: data.headline ?? 'Unknown Event',
    description: data.description,
    affectedInstruments: data.affectedInstruments,
    impactDirection: data.impactDirection,
    impactMagnitude: data.impactMagnitude,
    source: data.source,
    metadata: data.metadata,
  };
}

/**
 * Filter alerts to market-moving only
 * 
 * This is a pre-filter that can be applied to incoming alerts
 * before they reach the trigger logic
 * 
 * @param alerts - Array of alerts to filter
 * @returns Filtered array containing only market-moving alerts
 */
export function filterToMarketMoving(alerts: HeraldSentinelAlert[]): HeraldSentinelAlert[] {
  const marketMovingTypes: MarketEventType[] = [
    'CPI',
    'NFP',
    'FOMC',
    'FED_RATE',
    'VIX_SPIKE',
    'VIX_CRUSH',
    'BLACK_SWAN',
    'GEOPOLITICAL',
    'LIQUIDITY_CRISIS',
    'CURRENCY_CRISIS',
    'COMMODITY_SHOCK',
    'CREDIT_EVENT',
  ];

  return alerts.filter(
    (alert) =>
      alert.macroLevel >= 3 ||
      marketMovingTypes.includes(alert.eventType) ||
      (alert.impactMagnitude ?? 0) >= 50
  );
}

/**
 * HTTP handler for receiving Herald alerts
 * 
 * This can be used as a Hono route handler to receive webhook-style
 * alerts from the Herald sentinel system
 * 
 * Usage in routes:
 * ```typescript
 * import { handleHeraldAlertWebhook } from './services/boardroom-news-trigger';
 * app.post('/api/boardroom/herald-alert', handleHeraldAlertWebhook);
 * ```
 */
export async function handleHeraldAlertWebhook(c: Context): Promise<Response> {
  try {
    const body = await c.req.json<Partial<HeraldSentinelAlert>>();
    const alert = createHeraldAlert(body);

    const result = await triggerBoardroomForNews(alert);

    if (result.triggered) {
      return c.json({
        success: true,
        triggered: true,
        reason: result.reason,
        alertId: alert.id,
      });
    } else {
      return c.json({
        success: true,
        triggered: false,
        reason: result.reason,
        alertId: alert.id,
      });
    }
  } catch (error) {
    console.error('[BoardroomNewsTrigger] Failed to process herald alert:', error);
    return c.json({ error: 'Failed to process herald alert' }, 500);
  }
}

// Hono Context type for the webhook handler
type Context = {
  req: {
    json: <T>() => Promise<T>;
  };
  json: (data: unknown, status?: number) => Response;
};
