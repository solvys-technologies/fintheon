// [claude-code 2026-03-27] S2-T4: Bulk text parser — parses raw FJ post dumps into structured items
import { parseHeadline } from '../headline-parser.js';
import { classifyFJHeadline } from '../twitter-cli/fj-emoji-filter.js';
import type { ParsedHeadline } from '../../types/news-analysis.js';
import type { FJClassification } from '../twitter-cli/fj-emoji-filter.js';
import type { CalibrationObservation } from '../../types/calibration.js';
import type { MarketRegime } from '../../types/regime.js';

// ─── Types ──────────────────────────────────────────────────────

export interface BulkParseResult {
  total: number;
  parsed: ParsedBulkItem[];
  skipped: number;
  errors: string[];
}

export interface ParsedBulkItem {
  rawText: string;
  headline: string;
  parsedHeadline: ParsedHeadline;
  fjClassification: FJClassification;
  eventType: string;
  symbols: string[];
  estimatedTimestamp?: string;
}

// ─── Splitting heuristics ───────────────────────────────────────

const TIMESTAMP_PATTERN = /\b\d{1,2}:\d{2}\s*(AM|PM|am|pm)?\b/;
const DATE_PATTERN = /\b\d{4}-\d{2}-\d{2}\b/;
const EMOJI_PREFIX_PATTERN = /^[🔴⚠️🟡🟠🔵🚨]/;

function splitBulkText(rawText: string): string[] {
  // 1. Try double-newline splits first
  let chunks = rawText.split(/\n\s*\n/).map(c => c.trim()).filter(Boolean);

  // 2. If only one chunk, try single-newline splits (each line = one headline)
  if (chunks.length <= 1) {
    chunks = rawText.split(/\n/).map(c => c.trim()).filter(Boolean);
  }

  // 3. Further split on emoji prefixes if a chunk contains multiple
  const refined: string[] = [];
  for (const chunk of chunks) {
    const emojiSplits = chunk.split(/(?=🔴|⚠️|🟡|🟠|🔵|🚨)/).map(c => c.trim()).filter(Boolean);
    if (emojiSplits.length > 1) {
      refined.push(...emojiSplits);
    } else {
      refined.push(chunk);
    }
  }

  return refined;
}

// ─── Headline normalization ─────────────────────────────────────

function normalizeHeadline(raw: string): string {
  let text = raw.trim();
  // Normalize URL-slug hyphens-as-spaces (FJ URL slugs)
  if (/^[A-Za-z]+-[A-Za-z]+-/.test(text) && !text.includes(' ')) {
    text = text.replace(/-/g, ' ');
  }
  // Decode common URL-encoded chars
  text = text.replace(/%20/g, ' ').replace(/%27/g, "'").replace(/%22/g, '"');
  // Collapse whitespace
  text = text.replace(/\s+/g, ' ').trim();
  // Strip trailing URLs
  text = text.replace(/https?:\/\/\S+/g, '').trim();
  return text;
}

function extractTimestamp(text: string): string | undefined {
  const dateMatch = text.match(DATE_PATTERN);
  if (dateMatch) return dateMatch[0];
  const timeMatch = text.match(TIMESTAMP_PATTERN);
  if (timeMatch) return timeMatch[0];
  return undefined;
}

// ─── Public API ─────────────────────────────────────────────────

export function parseBulkText(rawText: string): BulkParseResult {
  const chunks = splitBulkText(rawText);
  const parsed: ParsedBulkItem[] = [];
  const errors: string[] = [];
  let skipped = 0;

  for (const chunk of chunks) {
    const headline = normalizeHeadline(chunk);

    // Skip very short lines (noise)
    if (headline.length < 10) {
      skipped++;
      continue;
    }

    try {
      const { parsed: parsedHeadline } = parseHeadline(headline, { source: 'FinancialJuice' });
      const fjClassification = classifyFJHeadline(headline);
      const eventType = parsedHeadline.eventType ?? classifyEventType(headline);
      const estimatedTimestamp = extractTimestamp(chunk);

      parsed.push({
        rawText: chunk,
        headline,
        parsedHeadline,
        fjClassification,
        eventType,
        symbols: parsedHeadline.symbols,
        estimatedTimestamp,
      });
    } catch (err) {
      errors.push(`Failed to parse: "${headline.slice(0, 80)}...": ${(err as Error).message}`);
      skipped++;
    }
  }

  return { total: chunks.length, parsed, skipped, errors };
}

/**
 * Simple event type classifier for headlines that parseHeadline doesn't catch.
 */
function classifyEventType(text: string): string {
  const upper = text.toUpperCase();
  if (/\bCPI\b/.test(upper)) return 'cpiPrint';
  if (/\bPPI\b/.test(upper)) return 'ppiPrint';
  if (/\bNFP\b|\bPAYROLL/.test(upper)) return 'nfpPrint';
  if (/\bGDP\b/.test(upper)) return 'gdpPrint';
  if (/\bFOMC\b|\bFED\b|\bPOWELL\b/.test(upper)) return 'fedDecision';
  if (/\bTARIFF|\bTRADE WAR|\bDUTY|\bDUTIES\b/.test(upper)) return 'tariffs';
  if (/\bSANCTION|\bWAR\b|\bTENSION|\bMISSILE|\bATTACK\b/.test(upper)) return 'geopolitical';
  if (/\bCHINA\b.*\bTRADE\b|\bTRADE\b.*\bCHINA\b/.test(upper)) return 'chinaTrade';
  if (/\bEARNING|\bEPS\b|\bREVENUE\b/.test(upper)) return 'earnings';
  if (/\bISM\b|\bPMI\b/.test(upper)) return 'ismPrint';
  if (/\bRETAIL\s+SALE/.test(upper)) return 'retailSales';
  if (/\bJOBLESS\b|\bCLAIMS\b/.test(upper)) return 'jobless';
  if (/\bHOUSING\b|\bHOME\s+SALE/.test(upper)) return 'housing';
  if (/\bOPEC\b|\bOIL\b|\bCRUDE\b/.test(upper)) return 'sectorNews';
  if (/\bPOLITICAL\b|\bCONGRESS\b|\bSENATE\b|\bTRUMP\b|\bBIDEN\b/.test(upper)) return 'politicalCommentary';
  return 'other';
}

/**
 * Convert parsed bulk items into CalibrationObservation format for DB storage.
 */
export function bulkItemsToObservations(
  items: ParsedBulkItem[],
  instrument: string,
  defaultRegime?: MarketRegime
): Omit<CalibrationObservation, 'id' | 'createdAt'>[] {
  return items.map(item => ({
    headline: item.headline,
    eventType: item.eventType,
    instrument,
    regimeAtTime: defaultRegime,
    source: 'backfill' as const,
    observedAt: item.estimatedTimestamp ?? undefined,
  }));
}
