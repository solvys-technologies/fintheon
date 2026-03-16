// [claude-code 2026-03-15] Added writeDailyPnlToNotion + checkDailyPnlExists for P&L watchdog pipeline
// [claude-code 2026-03-14] Fix brief sort: property-based sort instead of timestamp sort
// [claude-code 2026-03-03] Phase 3: Notion service — fetches MDB Brief from Harper Messages DB
// [claude-code 2026-03-03] Extended: Trade Ideas + Daily P&L query functions for Notion poller.
// [claude-code 2026-03-04] Economic calendar now sourced from Notion DB via alias-based field mapping.
// [claude-code 2026-03-05] Added Notion write (createPage/updatePage), fetchEconCalendar, fetchEconPrints, writeEconPrint.

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

// Notion DB IDs from PIC-NOTION-ENTITY-MAP.md
const HARPER_MESSAGES_DB = '30c141b0da7d81ba8bb6e319a0c4c309';
const DAILY_BRIEFS_DB = '704074dcba7d4eec9b7acb1514765761';
const TRADE_IDEAS_DB = '136fa9a2069e4afc835e0e139ead49f2';
const DAILY_PNL_DB = 'ee7d03052a424dcb95f6406c166e7584';
export const ECONOMIC_EVENTS_DB = process.env.NOTION_ECONOMIC_EVENTS_DB ?? 'ee319e74caf648f6843ba3019a8de97d';
export const ECON_PRINTS_DB = process.env.NOTION_ECON_PRINTS_DB ?? '';

const SCHEDULE_TITLE_ALIASES = ['Name', 'Title', 'Event', 'Calendar Event'];
const SCHEDULE_DETAIL_ALIASES = ['Detail', 'Details', 'Description', 'Notes', 'Commentary'];
const SCHEDULE_DATE_ALIASES = ['Date', 'Event Date', 'Start', 'Time'];
const SCHEDULE_FORECAST_ALIASES = ['Forecast', 'Estimate', 'Consensus'];
const SCHEDULE_PREVIOUS_ALIASES = ['Previous', 'Prev', 'Prior'];
const SCHEDULE_ACTUAL_ALIASES = ['Actual', 'Result', 'Print'];

function getNotionKey(): string | undefined {
  return (process.env as Record<string, string | undefined>).NOTION_API_KEY;
}

export interface MDBBriefItem {
  title: string;
  detail: string;
}

export interface ScheduleItem {
  title: string;
  detail: string;
  forecast?: string;
  actual?: string;
  previous?: string;
  date?: string;
}

// ── Notion helpers ──────────────────────────────────────────────────────────

export async function notionQuery(
  databaseId: string,
  options?: { filter?: object; sorts?: Array<Record<string, unknown>>; pageSize?: number }
): Promise<any[]> {
  const key = getNotionKey();
  if (!key) return [];

  const body: Record<string, unknown> = { page_size: options?.pageSize ?? 50 };
  if (options?.filter) body.filter = options.filter;
  if (options?.sorts) body.sorts = options.sorts;

  const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`[Notion] Query failed for DB ${databaseId}: ${res.status}`);
    return [];
  }

  const json = await res.json() as { results?: any[] };
  return json.results ?? [];
}

export function getPropText(page: any, field: string): string {
  const prop = page?.properties?.[field];
  if (!prop) return '';
  if (prop.type === 'title') return prop.title?.map((t: any) => t.plain_text).join('') ?? '';
  if (prop.type === 'rich_text') return prop.rich_text?.map((t: any) => t.plain_text).join('') ?? '';
  if (prop.type === 'select') return prop.select?.name ?? '';
  if (prop.type === 'date') return prop.date?.start ?? '';
  return '';
}

export function toText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function normalizeIsoDate(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

// ── Notion Write Helpers ────────────────────────────────────────────────────

export async function notionCreatePage(
  databaseId: string,
  properties: Record<string, unknown>
): Promise<{ id: string; url: string } | null> {
  const key = getNotionKey();
  if (!key) return null;

  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
  });

  if (!res.ok) {
    console.error(`[Notion] createPage failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const json = await res.json() as { id: string; url: string };
  return { id: json.id, url: json.url };
}

export async function notionUpdatePage(
  pageId: string,
  properties: Record<string, unknown>
): Promise<boolean> {
  const key = getNotionKey();
  if (!key) return false;

  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ properties }),
  });

  if (!res.ok) {
    console.error(`[Notion] updatePage failed for ${pageId}: ${res.status}`);
    return false;
  }
  return true;
}

// ── Public API ──────────────────────────────────────────────────────────────

// [claude-code 2026-03-15] T4: fix overnight PMDB + Saturday + ET timezone handling
// Brief rotation schedule (all times ET):
//   TOTT (Tale of the Tape)        — Sunday >= 17:00 through Monday < 07:00
//   PMDB (Post-Market Daily Brief) — Saturday (all day), Sunday < 17:00,
//                                    weekday < 07:00 (overnight), weekday >= 17:30
//   ADB  (Afternoon Daily Brief)   — weekday 11:00 AM to 5:29 PM
//   MDB  (Morning Daily Brief)     — weekday 7:00 AM to 10:59 AM
export type BriefType = 'MDB' | 'ADB' | 'PMDB' | 'TOTT';

export function getCurrentBriefType(): BriefType {
  const etStr = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' });
  const et = new Date(etStr);
  const day = et.getDay(); // 0 = Sunday
  const h = et.getHours();
  const t = h * 60 + et.getMinutes();

  // TOTT: Sunday >= 17:00 through Monday < 07:00
  if (day === 0 && t >= 17 * 60) return 'TOTT';
  if (day === 1 && t < 7 * 60) return 'TOTT';

  // Saturday — PMDB all day
  if (day === 6) return 'PMDB';
  // Sunday before 17:00 — PMDB
  if (day === 0) return 'PMDB';
  // Weekday overnight (before 7 AM) — PMDB
  if (t < 7 * 60) return 'PMDB';
  // Weekday post-market (>= 17:30) — PMDB
  if (t >= 17 * 60 + 30) return 'PMDB';
  // Weekday afternoon (>= 11:00) — ADB
  if (t >= 11 * 60) return 'ADB';
  // Weekday morning (>= 07:00) — MDB
  return 'MDB';
}

// Brief cache — persists so the brief doesn't disappear between fetches
let _briefCache: { items: MDBBriefItem[]; briefType: BriefType; fetchedAt: number } | null = null;
const BRIEF_CACHE_TTL_MS = 5 * 60_000;

/** Bust the brief cache so the next fetchMDBBrief call hits Notion fresh */
export function bustBriefCache(): void {
  _briefCache = null;
}

/**
 * Archive existing MDB pages for today and write a single new one.
 * Keeps HARPER_MESSAGES_DB to exactly one active MDB per briefType.
 */
export async function writeMDBReportToNotion(
  content: string,
  briefType: BriefType
): Promise<{ id: string; url: string } | null> {
  const key = getNotionKey();
  if (!key) return null;

  const categoryMap: Record<BriefType, string> = { MDB: 'MDB', ADB: 'ADB', PMDB: 'PMDB', TOTT: 'TOTT' };
  const category = categoryMap[briefType];

  // Archive all existing pages for this brief type
  try {
    const existing = await notionQuery(HARPER_MESSAGES_DB, {
      filter: {
        property: 'Source',
        select: { equals: 'Harper-Notion' },
      },
      pageSize: 50,
    });
    const toArchive = existing.filter((p: any) => {
      const cat = getPropText(p, 'Category').toUpperCase();
      return cat === category || cat.startsWith(category);
    });
    await Promise.all(
      toArchive.map((p: any) =>
        fetch(`${NOTION_API}/pages/${p.id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${key}`,
            'Notion-Version': NOTION_VERSION,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            archived: true,
            properties: { Status: { status: { name: 'Archived' } } },
          }),
        }).catch(() => null)
      )
    );
  } catch (err) {
    console.warn('[Notion] writeMDBReportToNotion: archive step failed', err);
  }

  // Create the single new report page
  const today = new Date().toISOString().slice(0, 10);
  const page = await notionCreatePage(HARPER_MESSAGES_DB, {
    Name: { title: [{ text: { content: `${category} — ${today}` } }] },
    Message: { rich_text: [{ text: { content: content.slice(0, 2000) } }] },
    Category: { select: { name: category } },
    Source: { select: { name: 'Harper-Notion' } },
    Status: { status: { name: 'Active' } },
  });

  bustBriefCache();
  return page;
}

/**
 * Fetch the single most relevant brief for the current time slot.
 * Returns exactly one MDBBriefItem (or empty array if nothing found).
 * Supports TOTT (Tip of the Tape) type for ad-hoc intraday briefs.
 */
export async function fetchMDBBrief(overrideType?: BriefType): Promise<MDBBriefItem[]> {
  const key = getNotionKey();
  if (!key) {
    console.error('[Notion] NOTION_API_KEY missing — brief unavailable');
    return _briefCache?.items ?? [];
  }

  const currentType = overrideType ?? getCurrentBriefType();

  // Return cache if fresh and same brief type
  if (_briefCache && _briefCache.briefType === currentType && Date.now() - _briefCache.fetchedAt < BRIEF_CACHE_TTL_MS) {
    return _briefCache.items;
  }

  try {
    // Category keywords per brief type
    const categoryKeywords: Record<BriefType, string[]> = {
      MDB: ['MDB', 'MORNING', 'EOD BRIEF'],
      ADB: ['ADB', 'AFTERNOON'],
      PMDB: ['PMDB', 'POST-MARKET', 'POST MARKET', 'EOD'],
      TOTT: ['TOTT', 'TIP OF THE TAPE'],
    };

    // Query Harper Messages DB — source: Harper-Notion, sorted by recency
    const pages = await notionQuery(HARPER_MESSAGES_DB, {
      filter: {
        property: 'Source',
        select: { equals: 'Harper-Notion' },
      },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      pageSize: 20,
    });

    if (pages.length === 0) {
      return _briefCache?.items ?? [];
    }

    // Find briefs matching current type — NO fallback to unrelated types
    const keywords = categoryKeywords[currentType];
    const matchingPages = pages.filter((page: any) => {
      const message = getPropText(page, 'Message').toUpperCase();
      const category = getPropText(page, 'Category').toUpperCase();
      return keywords.some((kw) => message.includes(kw) || category.includes(kw));
    });

    if (matchingPages.length === 0 && pages.length > 0) {
      // No matching brief for this time slot — fall back to most recent brief of any type
      const fallback = pages[0];
      const message = getPropText(fallback, 'Message');
      const category = getPropText(fallback, 'Category');
      const items: MDBBriefItem[] = [{
        title: `Latest — ${category || 'Brief'}`,
        detail: message,
      }];
      _briefCache = { items, briefType: currentType, fetchedAt: Date.now() };
      return items;
    }
    if (matchingPages.length === 0) {
      _briefCache = { items: [], briefType: currentType, fetchedAt: Date.now() };
      return [];
    }

    // Single item: the most recent matching brief only
    const bestPage = matchingPages[0];
    const message = getPropText(bestPage, 'Message');
    const category = getPropText(bestPage, 'Category');
    const items: MDBBriefItem[] = [{
      title: `${currentType} — ${category || 'Brief'}`,
      detail: message,
    }];

    _briefCache = { items, briefType: currentType, fetchedAt: Date.now() };
    return items;
  } catch (err) {
    console.error('[Notion] fetchMDBBrief error:', err);
    return _briefCache?.items ?? [];
  }
}

export async function fetchSchedule(): Promise<ScheduleItem[]> {
  if (!getNotionKey()) {
    console.error('[Notion] NOTION_API_KEY missing — schedule unavailable');
    return [];
  }

  try {
    const pages = await notionQuery(ECONOMIC_EVENTS_DB, { pageSize: 100 });
    if (pages.length === 0) {
      console.warn(`[Schedule] 0 pages from DB ${ECONOMIC_EVENTS_DB} — ensure it's shared with the integration`);
    }
    const mapped = pages.map((page: any) => {
      const title = toText(extractPropValue(getPropByAlias(page, SCHEDULE_TITLE_ALIASES)));
      const detail = toText(extractPropValue(getPropByAlias(page, SCHEDULE_DETAIL_ALIASES)));
      const dateRaw = toText(extractPropValue(getPropByAlias(page, SCHEDULE_DATE_ALIASES)));
      const forecast = toText(extractPropValue(getPropByAlias(page, SCHEDULE_FORECAST_ALIASES)));
      const previous = toText(extractPropValue(getPropByAlias(page, SCHEDULE_PREVIOUS_ALIASES)));
      const actual = toText(extractPropValue(getPropByAlias(page, SCHEDULE_ACTUAL_ALIASES)));

      return {
        title: title || 'Untitled Event',
        detail: detail || 'No details provided',
        forecast: forecast || undefined,
        previous: previous || undefined,
        actual: actual || undefined,
        date: normalizeIsoDate(dateRaw),
        sortTs: dateRaw ? (new Date(dateRaw).getTime() || Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER,
      };
    })
      .filter((item) => item.title || item.detail)
      .sort((a, b) => a.sortTs - b.sortTs)
      .map(({ sortTs, ...item }) => item);

    return mapped;
  } catch (err) {
    console.error('[Notion] fetchSchedule error:', err);
    return [];
  }
}

// ── Trade Ideas ─────────────────────────────────────────────────────────────

export interface NotionTradeIdea {
  id: string;
  title: string;
  ticker: string;
  direction: 'long' | 'short' | 'neutral';
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  potentialRisk?: number;   // |entry - SL| / entry * 100
  potentialProfit?: number; // |TP - entry| / entry * 100
  riskRewardRatio?: number;
  confidence?: string;
  timeframe?: string;
  sourceAgent?: string;
  hermesDescription?: string;
  notionUrl: string;
  createdAt: string;
  updatedAt: string;
}

/** Try multiple property name aliases (case-insensitive). */
export function getPropByAlias(page: any, aliases: string[]): any {
  const keys = Object.keys(page?.properties ?? {});
  for (const alias of aliases) {
    const match = keys.find((k) => k.toLowerCase() === alias.toLowerCase());
    if (match) return page.properties[match];
  }
  return null;
}

/** Extract scalar value from any Notion property type. */
export function extractPropValue(prop: any): string | number | boolean | null {
  if (!prop) return null;
  switch (prop.type) {
    case 'title': return prop.title?.map((t: any) => t.plain_text).join('') ?? null;
    case 'rich_text': return prop.rich_text?.map((t: any) => t.plain_text).join('') ?? null;
    case 'number': return prop.number ?? null;
    case 'select': return prop.select?.name ?? null;
    case 'multi_select': return prop.multi_select?.map((s: any) => s.name).join(', ') ?? null;
    case 'date': return prop.date?.start ?? null;
    case 'checkbox': return prop.checkbox ?? null;
    case 'url': return prop.url ?? null;
    case 'status': return prop.status?.name ?? null;
    case 'formula': {
      const f = prop.formula;
      return f ? (f[f.type] ?? null) : null;
    }
    default: return null;
  }
}

// Exact property names from live Trade Ideas DB (verified 2026-03-03):
// 'Trade Idea' (title), 'Ticker' (rich_text), 'Direction' (select: Long/Short),
// 'Entry Price' (number), 'Exit Price' (number), 'Confidence' (number 0-100),
// 'Analyst' (select), 'Thesis' (rich_text), 'Status' (status), 'Date' (date), 'Model' (select)

function confidenceLabel(n: number): string {
  if (n >= 70) return 'high';
  if (n >= 50) return 'medium';
  return 'low';
}

export async function queryTradeIdeas(): Promise<NotionTradeIdea[]> {
  if (!getNotionKey()) {
    console.warn('[Notion] NOTION_API_KEY not set — skipping trade idea query');
    return [];
  }
  try {
    // Only fetch non-template, non-archived ideas (Status != Proposed template)
    const pages = await notionQuery(TRADE_IDEAS_DB);
    // Filter: skip TEMPLATEs and unactioned proposals (Proposed/Denied/Closed)
    const EXCLUDED_STATUSES = new Set(['Proposed', 'Denied', 'Closed']);
    return pages
      .filter((page: any) => {
        const title = extractPropValue(page.properties?.['Trade Idea']) ?? '';
        if (String(title).startsWith('TEMPLATE')) return false;
        const status = String(extractPropValue(page.properties?.['Status']) ?? '');
        if (status && EXCLUDED_STATUSES.has(status)) return false;
        return true;
      })
      .map((page: any) => {
        const props = page.properties ?? {};

        // Title of the trade idea (e.g. "Fed Zero Rate Cuts in 2026 — Long YES")
        const tradeTitle = String(extractPropValue(props['Trade Idea']) ?? '');
        // Ticker / instrument (e.g. "RATECUTCOUNT-26-0")
        const ticker = String(extractPropValue(props['Ticker']) || '') || tradeTitle;
        // Direction: "Long" | "Short" → normalize to lowercase
        const rawDir = String(extractPropValue(props['Direction']) ?? 'neutral').toLowerCase();
        const direction: 'long' | 'short' | 'neutral' =
          rawDir === 'long' ? 'long' : rawDir === 'short' ? 'short' : 'neutral';
        // Prices
        const entry = (extractPropValue(props['Entry Price']) as number | null) ?? undefined;
        const exitPrice = (extractPropValue(props['Exit Price']) as number | null) ?? undefined;
        // Confidence: number 0-100 → classify as string label
        const confNum = extractPropValue(props['Confidence']) as number | null;
        const confidence = confNum != null ? confidenceLabel(confNum) : undefined;
        // Source agent (Analyst field)
        const sourceAgent = String(extractPropValue(props['Analyst']) ?? '') || undefined;
        // Full thesis as the description seed
        const thesis = String(extractPropValue(props['Thesis']) ?? '') || undefined;

        // For prediction market contracts: entry is the contract price (0-1 scale or cents)
        // No explicit SL/TP — risk = entry price (cost of contract), profit = 1 - entry
        let potentialRisk: number | undefined;
        let potentialProfit: number | undefined;
        let riskRewardRatio: number | undefined;
        if (entry && entry <= 1) {
          // Kalshi-style contract: entry is price in $0-$1
          potentialRisk = entry * 100; // % of contract cost
          potentialProfit = (1 - entry) * 100;
          if (potentialRisk > 0) riskRewardRatio = potentialProfit / potentialRisk;
        } else if (entry && exitPrice) {
          // Traditional instrument with entry + exit price
          potentialRisk = undefined; // No SL in DB
          potentialProfit = (Math.abs(exitPrice - entry) / entry) * 100;
        }

        return {
          id: page.id as string,
          title: tradeTitle || ticker || 'Untitled Trade',
          ticker: ticker || tradeTitle || 'UNKNOWN',
          direction,
          entry: entry ?? undefined,
          stopLoss: undefined, // Not in DB schema
          takeProfit: exitPrice,
          potentialRisk,
          potentialProfit,
          riskRewardRatio,
          confidence,
          timeframe: String(extractPropValue(props['Date']) ?? '') || undefined,
          sourceAgent,
          hermesDescription: thesis ? thesis.slice(0, 300) : undefined, // Seed with thesis excerpt
          notionUrl: page.url ?? '',
          createdAt: page.created_time ?? new Date().toISOString(),
          updatedAt: page.last_edited_time ?? new Date().toISOString(),
        };
      });
  } catch (err) {
    console.warn('[Notion] Failed to query trade ideas:', err);
    return [];
  }
}

// ── Daily P&L / KPIs ────────────────────────────────────────────────────────

export interface NotionPerformanceKpi {
  label: string;
  value: string;
  meta: string;
}

export async function queryDailyPnL(): Promise<NotionPerformanceKpi[]> {
  if (!getNotionKey()) {
    console.warn('[Notion] NOTION_API_KEY not set — skipping P&L query');
    return [];
  }
  try {
    const pages = await notionQuery(DAILY_PNL_DB, { pageSize: 100 });
    if (pages.length === 0) return [];

    const sortedPages = [...pages].sort((a: any, b: any) => {
      const aDateRaw = toText(extractPropValue(getPropByAlias(a, ['Date', 'Day']))) || String(a.created_time ?? '');
      const bDateRaw = toText(extractPropValue(getPropByAlias(b, ['Date', 'Day']))) || String(b.created_time ?? '');
      const aTs = new Date(aDateRaw).getTime() || 0;
      const bTs = new Date(bDateRaw).getTime() || 0;
      return bTs - aTs;
    });

    const latest = sortedPages[0];
    const kpis: NotionPerformanceKpi[] = [];

    // Exact property names from live Daily P&L DB (verified 2026-03-03):
    // 'Net P&L', 'Gross P&L', 'Win Rate', 'Trades Taken', 'Bias', 'NTN Summary', 'Day' (title), 'Date'
    const props = latest.properties ?? {};
    const pnl = extractPropValue(props['Net P&L'] ?? props['Gross P&L']);
    const winRate = extractPropValue(props['Win Rate']);
    const tradesTaken = extractPropValue(props['Trades Taken']);
    const bias = extractPropValue(props['Bias']);
    // Use Avg P&L / Trade formula as a proxy for daily return if available
    const avgPnl = extractPropValue(props['Avg P&L / Trade']);
    // No drawdown column exists — leave it out
    const dailyReturn = null;
    const drawdown = null;

    if (pnl !== null) {
      const n = typeof pnl === 'number' ? pnl : parseFloat(String(pnl));
      kpis.push({
        label: 'Net P&L',
        value: isNaN(n) ? String(pnl) : `${n >= 0 ? '+' : ''}$${Math.abs(n).toLocaleString()}`,
        meta: 'Live · Notion',
      });
    }
    if (winRate !== null) {
      const n = typeof winRate === 'number' ? winRate : parseFloat(String(winRate));
      kpis.push({
        label: 'Win Rate',
        value: isNaN(n) ? String(winRate) : `${(n > 1 ? n : n * 100).toFixed(0)}%`,
        meta: 'Daily sessions',
      });
    }
    if (tradesTaken !== null) {
      kpis.push({
        label: 'Trades Taken',
        value: String(tradesTaken),
        meta: bias ? `Bias: ${bias}` : 'Today',
      });
    }
    if (avgPnl !== null) {
      const n = typeof avgPnl === 'number' ? avgPnl : parseFloat(String(avgPnl));
      kpis.push({
        label: 'Avg P&L / Trade',
        value: isNaN(n) ? String(avgPnl) : `${n >= 0 ? '+' : ''}$${Math.abs(n).toFixed(0)}`,
        meta: 'Per trade',
      });
    }
    // dailyReturn and drawdown are null (not in DB) — omitted intentionally

    return kpis;
  } catch (err) {
    console.warn('[Notion] Failed to query P&L:', err);
    return [];
  }
}

// ── Daily P&L Write (Watchdog Pipeline) ──────────────────────────────────────

export interface DailyPnlWriteInput {
  date: string;        // YYYY-MM-DD
  netPnl: number;
  grossPnl: number;
  winRate: number;     // 0-1
  tradesTaken: number;
  bias: string;
  summary?: string;
}

/** Check if a Daily P&L entry already exists for the given date */
export async function checkDailyPnlExists(date: string): Promise<boolean> {
  if (!getNotionKey()) return false;

  try {
    const pages = await notionQuery(DAILY_PNL_DB, {
      filter: {
        property: 'Date',
        date: { equals: date },
      },
      pageSize: 1,
    });
    return pages.length > 0;
  } catch (err) {
    console.error('[Notion] checkDailyPnlExists error:', err);
    return false;
  }
}

/** Write a daily P&L row to the Notion Daily P&L DB */
export async function writeDailyPnlToNotion(input: DailyPnlWriteInput): Promise<{ id: string; url: string } | null> {
  const key = getNotionKey();
  if (!key) {
    console.error('[Notion] NOTION_API_KEY missing — cannot write daily P&L');
    return null;
  }

  const properties: Record<string, unknown> = {
    Day: { title: [{ text: { content: input.date } }] },
    Date: { date: { start: input.date } },
    'Net P&L': { number: input.netPnl },
    'Gross P&L': { number: input.grossPnl },
    'Win Rate': { number: input.winRate },
    'Trades Taken': { number: input.tradesTaken },
    Bias: { select: { name: input.bias.charAt(0).toUpperCase() + input.bias.slice(1) } },
  };

  if (input.summary) {
    properties['NTN Summary'] = { rich_text: [{ text: { content: input.summary.slice(0, 2000) } }] };
  }

  const result = await notionCreatePage(DAILY_PNL_DB, properties);
  if (result) {
    console.log(`[Notion] Daily P&L written for ${input.date}: $${input.netPnl} (${result.url})`);
  }
  return result;
}
