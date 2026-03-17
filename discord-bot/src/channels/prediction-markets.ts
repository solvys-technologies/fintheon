import { TextChannel } from 'discord.js';
import { TradeIdea } from '../integrations/notion';
import { buildProposalEmbed } from '../embeds/proposal-embed';
import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';

/** Post a trade proposal to #prediction-markets with voting reactions */
export async function postTradeProposal(channel: TextChannel, idea: TradeIdea): Promise<void> {
  try {
    const embed = buildProposalEmbed(idea);
    const message = await channel.send({ embeds: [embed] });

    // Add voting reactions
    await message.react('👍');
    await message.react('👎');

    logger.info('Posted trade proposal to #prediction-markets', {
      thesis: idea.thesis.slice(0, 50),
    });
  } catch (error) {
    handleError('prediction-markets.postTradeProposal', error);
  }
}
