import { EmbedBuilder } from 'discord.js';
import { config } from '../config';

/** Create a base embed with standard Harper-Perp branding */
export function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(config.colors.gold)
    .setFooter({ text: `${config.bot.name} · Fintheon` })
    .setTimestamp();
}

/** Category display names */
export const categoryNames: Record<string, string> = {
  MDB: 'Dawn Dispatch',
  ADB: 'Afternoon Brief',
  PMDB: 'Post-Market Brief',
  TOTT: 'The Weekly Tribune',
};

/** Category emoji prefixes */
export const categoryEmoji: Record<string, string> = {
  MDB: '🌅',
  ADB: '☀️',
  PMDB: '🌙',
  TOTT: '📰',
};

/** Risk level emoji */
export const riskEmoji: Record<string, string> = {
  LOW: '🟢',
  ELEVATED: '🟡',
  HIGH: '🟠',
  EXTREME: '🔴',
};
