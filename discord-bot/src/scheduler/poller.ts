import { Client, TextChannel } from 'discord.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { fetchBriefings, fetchLatestBriefing, fetchTradeIdeas, BriefingCategory } from '../integrations/notion';
import { postBriefing } from '../channels/dispatch-board';
import { postTribune } from '../channels/weekly-tribune';
import { postTradeProposal } from '../channels/prediction-markets';

// Track last posted IDs to prevent duplicates
const lastPosted: Record<string, string> = {};

/** Record a post to prevent re-posting */
export function markPosted(key: string, id: string): void {
  lastPosted[key] = id;
}

/** Check if an item was already posted */
function wasPosted(key: string, id: string): boolean {
  return lastPosted[key] === id;
}

/** Get last post times for status reporting */
export function getLastPosted(): Record<string, string> {
  return { ...lastPosted };
}

/** Poll Notion for new briefings and post to appropriate channels */
export async function pollNotionBriefings(client: Client): Promise<void> {
  const categories: BriefingCategory[] = ['MDB', 'ADB', 'PMDB'];

  for (const category of categories) {
    const briefing = await fetchLatestBriefing(category);
    if (!briefing || wasPosted(category, briefing.id)) continue;

    const channel = await client.channels.fetch(config.channels.dispatchBoard) as TextChannel;
    if (!channel) {
      logger.warn(`Could not find dispatch-board channel`);
      continue;
    }

    await postBriefing(channel, briefing);
    markPosted(category, briefing.id);
    logger.info(`Posted ${category}: ${briefing.title}`);
  }
}

/** Poll Notion for new TOTT entries */
export async function pollNotionTribune(client: Client): Promise<void> {
  const briefing = await fetchLatestBriefing('TOTT');
  if (!briefing || wasPosted('TOTT', briefing.id)) return;

  const channel = await client.channels.fetch(config.channels.weeklyTribune) as TextChannel;
  if (!channel) {
    logger.warn('Could not find weekly-tribune channel');
    return;
  }

  await postTribune(channel, briefing);
  markPosted('TOTT', briefing.id);
  logger.info(`Posted TOTT: ${briefing.title}`);
}

/** Poll Notion for new trade proposals */
export async function pollNotionTradeIdeas(client: Client): Promise<void> {
  const ideas = await fetchTradeIdeas();

  for (const idea of ideas) {
    if (wasPosted(`trade-${idea.id}`, idea.id)) continue;

    const channel = await client.channels.fetch(config.channels.predictionMarkets) as TextChannel;
    if (!channel) {
      logger.warn('Could not find prediction-markets channel');
      return;
    }

    await postTradeProposal(channel, idea);
    markPosted(`trade-${idea.id}`, idea.id);
    logger.info(`Posted trade idea: ${idea.thesis.slice(0, 50)}`);
  }
}
