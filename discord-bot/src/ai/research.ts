import { ask } from '../integrations/perplexity';
import { RESEARCH_SYSTEM_PROMPT } from './persona';
import { logger } from '../utils/logger';

/** Research current market conditions for context enrichment */
export async function researchMarketConditions(): Promise<string | null> {
  return ask(
    RESEARCH_SYSTEM_PROMPT,
    'What are the current market conditions? Include: S&P 500, NASDAQ, VIX level, any major headlines today, Fed stance, and key economic data this week.',
  );
}

/** Research a specific topic with market context */
export async function researchTopic(topic: string): Promise<string | null> {
  return ask(
    RESEARCH_SYSTEM_PROMPT,
    topic,
  );
}
