import { EmbedBuilder } from 'discord.js';
import { TradeIdea } from '../integrations/notion';
import { baseEmbed } from './common';
import { formatTimestamp, truncate } from '../utils/format';

/** Build a rich embed for trade proposals */
export function buildProposalEmbed(idea: TradeIdea): EmbedBuilder {
  const embed = baseEmbed()
    .setTitle('📈 Trade Proposal')
    .setDescription(truncate(idea.thesis, 4000));

  if (idea.confidence) {
    embed.addFields({ name: 'Confidence', value: idea.confidence, inline: true });
  }

  if (idea.target) {
    embed.addFields({ name: 'Target', value: idea.target, inline: true });
  }

  if (idea.analyst) {
    embed.addFields({ name: 'Analyst', value: idea.analyst, inline: true });
  }

  if (idea.market) {
    embed.addFields({ name: 'Market', value: idea.market, inline: true });
  }

  if (idea.polymarketLink) {
    embed.addFields({ name: 'Polymarket', value: `[View Market](${idea.polymarketLink})`, inline: true });
  }

  embed.addFields({
    name: 'Proposed',
    value: formatTimestamp(new Date(idea.createdAt)),
    inline: true,
  });

  return embed;
}
