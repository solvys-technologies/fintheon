import OpenAI from 'openai';
import { config } from '../config';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/errors';

const client = new OpenAI({
  apiKey: config.ai.perplexityApiKey,
  baseURL: config.ai.perplexityBaseUrl,
});

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Send a chat completion request to Perplexity's sonar model */
export async function chat(messages: ChatMessage[]): Promise<string | null> {
  const result = await withRetry(
    async () => {
      const completion = await client.chat.completions.create({
        model: config.ai.model,
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      });
      return completion.choices[0]?.message?.content || null;
    },
    'perplexity.chat',
    2,
    2000,
  );

  return result;
}

/** Quick single-question query with system prompt */
export async function ask(systemPrompt: string, question: string): Promise<string | null> {
  return chat([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: question },
  ]);
}

/** Assess if a headline is market-moving (returns confidence 0-1) */
export async function assessHeadline(headline: string): Promise<number> {
  const result = await ask(
    'You are a market impact assessor. Given a headline, respond with ONLY a number between 0 and 1 indicating how market-moving it is. 0 = no impact, 1 = extreme impact (flash crash level). Consider: Fed actions, CPI/NFP surprises, geopolitical escalation, major earnings misses.',
    headline,
  );

  if (!result) return 0;
  const score = parseFloat(result.trim());
  return isNaN(score) ? 0 : Math.max(0, Math.min(1, score));
}
