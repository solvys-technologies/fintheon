import { Message, Client } from 'discord.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import { chat, ChatMessage } from '../integrations/perplexity';
import { HARPER_SYSTEM_PROMPT } from './persona';
import { addToContext, buildMessages } from './context';
import { truncate } from '../utils/format';

/** Handle incoming messages for the #boardroom channel */
export async function handleBoardroomMessage(message: Message): Promise<void> {
  // Ignore bot messages
  if (message.author.bot) return;

  // Only respond in #boardroom or when mentioned
  const isBoardroom = message.channelId === config.channels.boardroom;
  const isMentioned = message.mentions.has(message.client.user!);

  if (!isBoardroom && !isMentioned) return;

  try {
    // Show typing indicator
    if ('sendTyping' in message.channel) {
      await message.channel.sendTyping();
    }

    // Add user message to context
    addToContext(
      message.channelId,
      'user',
      message.content,
      message.author.displayName || message.author.username,
    );

    // Build messages with full context
    const messages = buildMessages(HARPER_SYSTEM_PROMPT, message.channelId);

    // Get response from Perplexity
    const response = await chat(messages);

    if (!response) {
      await message.reply(
        "I'm having trouble reaching my research tools right now. Try again in a moment.",
      );
      return;
    }

    // Add assistant response to context
    addToContext(message.channelId, 'assistant', response);

    // Split long responses into multiple messages (Discord's 2000 char limit)
    const chunks = splitResponse(response);
    for (const chunk of chunks) {
      await message.reply(chunk);
    }

    logger.info('Boardroom response sent', {
      user: message.author.username,
      length: response.length,
    });
  } catch (error) {
    handleError('ai.handleBoardroomMessage', error);
    await message.reply(
      "Something went wrong processing that. Give me a moment and try again.",
    );
  }
}

function splitResponse(text: string, maxLength = 2000): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find a good split point (newline or space)
    let splitAt = remaining.lastIndexOf('\n', maxLength);
    if (splitAt === -1 || splitAt < maxLength / 2) {
      splitAt = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitAt === -1) {
      splitAt = maxLength;
    }

    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }

  return chunks;
}
