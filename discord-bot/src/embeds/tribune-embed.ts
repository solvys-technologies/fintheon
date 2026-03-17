import { EmbedBuilder } from 'discord.js';
import { Briefing } from '../integrations/notion';
import { baseEmbed, categoryEmoji } from './common';
import { formatTimestamp } from '../utils/format';

/** Build a rich embed for TOTT (Weekly Tribune) */
export function buildTribuneEmbed(briefing: Briefing): EmbedBuilder {
  const content = briefing.content || '';

  // Try to split into Past Week Recap and Upcoming Week Preview sections
  const sections = parseTribuneSections(content);

  const embed = baseEmbed()
    .setTitle(`${categoryEmoji.TOTT} The Weekly Tribune`);

  if (briefing.title) {
    embed.setDescription(`**${briefing.title}**`);
  }

  if (sections.recap) {
    embed.addFields({
      name: '📊 Past Week Recap',
      value: truncateField(sections.recap),
      inline: false,
    });
  }

  if (sections.preview) {
    embed.addFields({
      name: '🔮 Upcoming Week Preview',
      value: truncateField(sections.preview),
      inline: false,
    });
  }

  // If no sections parsed, show full content
  if (!sections.recap && !sections.preview) {
    embed.setDescription(truncateField(content));
  }

  embed.addFields({
    name: 'Published',
    value: formatTimestamp(new Date(briefing.createdAt)),
    inline: true,
  });

  return embed;
}

function parseTribuneSections(content: string): { recap: string; preview: string } {
  const recapMatch = content.match(/(?:past week|recap|last week)(.*?)(?=(?:upcoming|preview|next week)|$)/is);
  const previewMatch = content.match(/(?:upcoming|preview|next week)(.*?)$/is);

  return {
    recap: recapMatch?.[1]?.trim() || '',
    preview: previewMatch?.[1]?.trim() || '',
  };
}

function truncateField(text: string): string {
  return text.length > 1024 ? text.slice(0, 1021) + '...' : text;
}
