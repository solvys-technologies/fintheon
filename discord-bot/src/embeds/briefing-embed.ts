import { EmbedBuilder } from 'discord.js';
import { Briefing } from '../integrations/notion';
import { baseEmbed, categoryNames, categoryEmoji } from './common';
import { splitText, formatTimestamp } from '../utils/format';

/** Build a rich embed for MDB/ADB/PMDB briefings */
export function buildBriefingEmbed(briefing: Briefing): EmbedBuilder[] {
  const emoji = categoryEmoji[briefing.category] || '📋';
  const name = categoryNames[briefing.category] || briefing.category;
  const title = `${emoji} ${name}`;

  const chunks = splitText(briefing.content, 4000);

  return chunks.map((chunk, index) => {
    const embed = baseEmbed()
      .setDescription(chunk);

    if (index === 0) {
      embed.setTitle(briefing.title ? `${title} — ${briefing.title}` : title);
    }

    if (index === chunks.length - 1) {
      embed.addFields({
        name: 'Posted',
        value: formatTimestamp(new Date(briefing.createdAt)),
        inline: true,
      });
    }

    return embed;
  });
}
