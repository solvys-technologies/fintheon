import { Message } from 'discord.js';
import { ChatMessage } from '../integrations/perplexity';

const MAX_CONTEXT_MESSAGES = 20;

/** In-memory conversation context per channel */
const channelContexts = new Map<string, ChatMessage[]>();

/** Add a message to the channel's conversation context */
export function addToContext(channelId: string, role: 'user' | 'assistant', content: string, username?: string): void {
  if (!channelContexts.has(channelId)) {
    channelContexts.set(channelId, []);
  }

  const context = channelContexts.get(channelId)!;
  const formatted = username ? `[${username}]: ${content}` : content;

  context.push({ role, content: formatted });

  // Trim to max context window
  if (context.length > MAX_CONTEXT_MESSAGES) {
    context.splice(0, context.length - MAX_CONTEXT_MESSAGES);
  }
}

/** Get the current conversation context for a channel */
export function getContext(channelId: string): ChatMessage[] {
  return channelContexts.get(channelId) || [];
}

/** Clear context for a channel */
export function clearContext(channelId: string): void {
  channelContexts.delete(channelId);
}

/** Build the full message array for a Perplexity API call */
export function buildMessages(systemPrompt: string, channelId: string): ChatMessage[] {
  const context = getContext(channelId);
  return [
    { role: 'system', content: systemPrompt },
    ...context,
  ];
}
