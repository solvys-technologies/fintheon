// [claude-code 2026-03-19] T1: Developments extractor — parses boardroom JSONL for structured events

import { getBoardroomMessages } from './hermes-sessions.js';
import type { DevelopmentEvent, DevelopmentCategory, DevelopmentSeverity } from '../types/developments.js';
import type { BoardroomAgent } from '../types/boardroom.js';

// Simple in-memory cache
let _cache: DevelopmentEvent[] | null = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 120_000; // 120s

const TICKER_REGEX = /\b(\/ES|\/NQ|\/CL|SPX|VIX|BTC|ETH)\b/gi;

function extractTitle(content: string): string {
  const firstLine = content.split('\n')[0] ?? '';
  return firstLine.slice(0, 80).trim() || 'Untitled';
}

function extractInstruments(content: string): string[] {
  const matches = content.match(TICKER_REGEX);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.toUpperCase()))];
}

function classifySeverity(content: string): DevelopmentSeverity {
  const upper = content.toUpperCase();
  if (upper.includes('CRITICAL')) return 'critical';
  if (upper.includes('WARNING')) return 'warning';
  return 'info';
}

interface ExtractorFilter {
  since?: string;
  category?: DevelopmentCategory;
  agent?: BoardroomAgent;
  limit?: number;
}

export async function extractDevelopments(filter?: ExtractorFilter): Promise<DevelopmentEvent[]> {
  const now = Date.now();

  // Return cached if fresh
  if (_cache && now - _cacheTime < CACHE_TTL_MS) {
    return applyFilter(_cache, filter);
  }

  const { messages } = await getBoardroomMessages('pic-boardroom');
  const events: DevelopmentEvent[] = [];

  for (const msg of messages) {
    const content = msg.content;
    let category: DevelopmentCategory | null = null;
    let severity: DevelopmentSeverity = 'info';

    if (content.includes('[TRADE IDEA]')) {
      category = 'trade_idea';
      severity = 'info';
    } else if (content.includes('[RISK ALERT]')) {
      category = 'risk_alert';
      severity = classifySeverity(content);
    } else if (/regime/i.test(content) && /shift|change|transition/i.test(content)) {
      category = 'regime_shift';
      severity = 'warning';
    } else if (content.includes('[HUDDLE TRIGGERED]')) {
      category = 'huddle';
      severity = 'critical';
    } else if (content.includes('[PRE-MARKET BRIEF]') || content.includes('[POST-MARKET BRIEF]')) {
      category = 'briefing';
      severity = 'info';
    } else if (content.includes('[STANDUP]')) {
      category = 'standup';
      severity = 'info';
    }

    if (!category) continue;

    events.push({
      id: msg.id,
      agent: msg.agent,
      title: extractTitle(content),
      detail: content,
      category,
      severity,
      timestamp: msg.timestamp,
      relatedInstruments: extractInstruments(content),
    });
  }

  // Sort by timestamp desc (most recent first)
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Cache results
  _cache = events;
  _cacheTime = now;

  return applyFilter(events, filter);
}

function applyFilter(events: DevelopmentEvent[], filter?: ExtractorFilter): DevelopmentEvent[] {
  let result = events;

  if (filter?.agent) {
    result = result.filter(e => e.agent === filter.agent);
  }
  if (filter?.category) {
    result = result.filter(e => e.category === filter.category);
  }
  if (filter?.since) {
    const sinceMs = new Date(filter.since).getTime();
    result = result.filter(e => new Date(e.timestamp).getTime() >= sinceMs);
  }
  if (filter?.limit) {
    result = result.slice(0, filter.limit);
  }

  return result;
}
