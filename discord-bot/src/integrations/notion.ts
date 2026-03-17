import { Client as NotionClient } from '@notionhq/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { richTextToPlain } from '../utils/format';
import { withRetry } from '../utils/errors';

const notion = new NotionClient({ auth: config.notion.apiKey });

export type BriefingCategory = 'MDB' | 'ADB' | 'PMDB' | 'TOTT';

export interface Briefing {
  id: string;
  category: BriefingCategory;
  title: string;
  content: string;
  createdAt: string;
  status: string;
}

export interface TradeIdea {
  id: string;
  thesis: string;
  confidence: string;
  target: string;
  analyst: string;
  market: string;
  polymarketLink: string;
  status: string;
  createdAt: string;
}

/** Fetch active briefings from Harper Messages DB, filtered by category */
export async function fetchBriefings(category?: BriefingCategory): Promise<Briefing[]> {
  const filter: any = {
    and: [
      { property: 'Status', select: { equals: 'Active' } },
    ],
  };

  if (category) {
    filter.and.push({ property: 'Category', select: { equals: category } });
  }

  const result = await withRetry(
    () => notion.databases.query({
      database_id: config.notion.harperMessagesDb,
      filter,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 5,
    }),
    'notion.fetchBriefings',
  );

  if (!result) return [];

  return result.results.map((page: any) => ({
    id: page.id,
    category: getSelectValue(page.properties.Category) as BriefingCategory,
    title: getTitleValue(page.properties.Name || page.properties.Title),
    content: getRichTextValue(page.properties.Content || page.properties.Body),
    createdAt: page.created_time,
    status: getSelectValue(page.properties.Status),
  }));
}

/** Fetch the latest briefing for a specific category */
export async function fetchLatestBriefing(category: BriefingCategory): Promise<Briefing | null> {
  const briefings = await fetchBriefings(category);
  return briefings[0] || null;
}

/** Fetch proposed trade ideas from Trade Ideas DB */
export async function fetchTradeIdeas(): Promise<TradeIdea[]> {
  const result = await withRetry(
    () => notion.databases.query({
      database_id: config.notion.tradeIdeasDb,
      filter: { property: 'Status', select: { equals: 'Proposed' } },
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      page_size: 10,
    }),
    'notion.fetchTradeIdeas',
  );

  if (!result) return [];

  return result.results.map((page: any) => ({
    id: page.id,
    thesis: getRichTextValue(page.properties.Thesis),
    confidence: getSelectValue(page.properties.Confidence),
    target: getRichTextValue(page.properties.Target),
    analyst: getRichTextValue(page.properties.Analyst),
    market: getSelectValue(page.properties.Market),
    polymarketLink: getUrlValue(page.properties['Polymarket Link']),
    status: getSelectValue(page.properties.Status),
    createdAt: page.created_time,
  }));
}

// --- Property extractors ---

function getSelectValue(prop: any): string {
  return prop?.select?.name || '';
}

function getTitleValue(prop: any): string {
  if (!prop?.title) return '';
  return richTextToPlain(prop.title);
}

function getRichTextValue(prop: any): string {
  if (!prop?.rich_text) return '';
  return richTextToPlain(prop.rich_text);
}

function getUrlValue(prop: any): string {
  return prop?.url || '';
}
