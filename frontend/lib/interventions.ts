/**
 * Intervention helpers — callable from any agent context.
 *
 * Usage:
 *   import { triggerIntervention, postTradeIdea } from '../lib/interventions';
 *   await triggerIntervention({ agent: 'Feucht', type: 'risk_alert', message: '...', severity: 'critical' });
 *   await postTradeIdea({ agent: 'Feucht', instrument: 'ES', direction: 'long', conviction: 'high', thesis: '...' });
 */

import type {
  TriggerInterventionParams,
  TradeIdeaParams,
  InterventionType,
  InterventionSeverity,
  TradeDirection,
  ConvictionLevel,
} from './services';

export type { TriggerInterventionParams, TradeIdeaParams, InterventionType, InterventionSeverity, TradeDirection, ConvictionLevel };

/* ------------------------------------------------------------------ */
/*  Message classification helpers (used by BoardroomChat)             */
/* ------------------------------------------------------------------ */

const INTERVENTION_RE = /^(ℹ️|⚠️|🚨)\s\*\*\[(RISK ALERT|OVERTRADING WARNING|RULE VIOLATION|MARKET EVENT|POSITION CHECK)\]\*\*/;
const TRADE_IDEA_RE = /^(🟢|🔴|🟡)\s\*\*\[TRADE IDEA\]\*\*/;

export function isInterventionMessage(content: string): boolean {
  return INTERVENTION_RE.test(content);
}

export function isTradeIdeaMessage(content: string): boolean {
  return TRADE_IDEA_RE.test(content);
}

export type ParsedIntervention = {
  severity: InterventionSeverity;
  type: string;
  agent: string;
  body: string;
};

export function parseIntervention(content: string): ParsedIntervention | null {
  const match = content.match(
    /^(ℹ️|⚠️|🚨)\s\*\*\[([^\]]+)\]\*\*\s\((\w+)\)\s—\s(\w+)\n\n([\s\S]*)/,
  );
  if (!match) return null;
  const [, , type, severity, agent, body] = match;
  return {
    severity: severity.toLowerCase() as InterventionSeverity,
    type,
    agent,
    body,
  };
}

export type ParsedTradeIdea = {
  direction: TradeDirection;
  agent: string;
  instrument: string;
  conviction: string;
  entry?: string;
  stopLoss?: string;
  target?: string;
  keyLevels?: string;
  thesis: string;
};

export function parseTradeIdea(content: string): ParsedTradeIdea | null {
  const lines = content.split('\n').filter(Boolean);
  if (lines.length < 3) return null;

  const headerMatch = lines[0].match(/^(?:🟢|🔴|🟡)\s\*\*\[TRADE IDEA\]\*\*\s—\s(\w+)/);
  if (!headerMatch) return null;
  const agent = headerMatch[1];

  const detailMatch = lines[1].match(
    /\*\*([^*]+)\*\*\s\|\s(LONG|SHORT|NEUTRAL)\s\|\sConviction:\s(\w+)/i,
  );
  if (!detailMatch) return null;
  const [, instrument, direction, conviction] = detailMatch;

  // Parse optional numbers line
  let entry: string | undefined;
  let stopLoss: string | undefined;
  let target: string | undefined;
  let keyLevels: string | undefined;
  let thesisStartIdx = 2;

  for (let i = 2; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('Entry:')) {
      const parts = line.split('|').map((s) => s.trim());
      for (const p of parts) {
        if (p.startsWith('Entry:')) entry = p.replace('Entry:', '').trim();
        if (p.startsWith('Stop:')) stopLoss = p.replace('Stop:', '').trim();
        if (p.startsWith('Target:')) target = p.replace('Target:', '').trim();
      }
      thesisStartIdx = i + 1;
    } else if (line.startsWith('Key Levels:')) {
      keyLevels = line.replace('Key Levels:', '').trim();
      thesisStartIdx = i + 1;
    } else {
      break;
    }
  }

  const thesis = lines.slice(thesisStartIdx).join('\n');

  return {
    direction: direction.toLowerCase() as TradeDirection,
    agent,
    instrument,
    conviction: conviction.toLowerCase(),
    entry,
    stopLoss,
    target,
    keyLevels,
    thesis,
  };
}

/* ------------------------------------------------------------------ */
/*  Agent topic routing                                                */
/* ------------------------------------------------------------------ */

export interface AgentTopicMatch {
  agent: string;
  relevance: number; // 0-1
}

// [claude-code 2026-03-16] Agent roster v7.9: 6→5 agents (Sentinel→Feucht, Charles→Oracle, Horace→Herald)
const AGENT_TOPICS: Record<string, { keywords: RegExp; description: string }> = {
  Feucht: {
    keywords: /volatility|iv|vix|options|gamma|theta|skew|vol.?surface|implied|futures|spread|risk|drawdown|exposure|margin|stop.?loss|max.?loss|position.?size|limit|breach/i,
    description: 'Futures, execution, volatility, and risk management',
  },
  Herald: {
    keywords: /sentiment|news|social|twitter|x\.com|headline|report/i,
    description: 'News sentiment and social signals',
  },
  Oracle: {
    keywords: /macro|fed|rate|cpi|gdp|employment|inflation|yield|bond|treasury|polymarket|prediction|execution|order|fill|slippage|entry|exit|position|trade|buy|sell|close|open/i,
    description: 'All-seer — prediction markets, macro intelligence, and execution oversight',
  },
  Consul: {
    keywords: /fundamental|valuation|earnings|revenue|pe|eps|mega.?cap|large.?cap|balance.?sheet|cashflow|dividend|guidance|margin/i,
    description: 'Fundamentals and mega-caps desk',
  },
  'Harper-Opus': {
    keywords: /strategy|plan|review|summary|overview|coordination|meeting|agenda/i,
    description: 'CAO — executive strategy and oversight',
  },
};

/**
 * Given a message, return agents ranked by topic relevance.
 * Only returns agents with a match.
 */
export function matchAgentsToTopic(message: string): AgentTopicMatch[] {
  const results: AgentTopicMatch[] = [];
  for (const [agent, { keywords }] of Object.entries(AGENT_TOPICS)) {
    const matches = message.match(keywords);
    if (matches) {
      // Score based on number of keyword matches
      const allMatches = message.match(new RegExp(keywords.source, 'gi'));
      const relevance = Math.min(1, (allMatches?.length ?? 1) * 0.3);
      results.push({ agent, relevance });
    }
  }
  return results.sort((a, b) => b.relevance - a.relevance);
}
