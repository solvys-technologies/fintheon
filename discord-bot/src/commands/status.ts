import { Interaction, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { config } from '../config';
import { baseEmbed } from '../embeds/common';
import { getLastPosted } from '../scheduler/poller';
import { getLastAlertTime } from '../channels/the-tape';
import { getActiveJobs } from '../scheduler/cron';
import { formatUptime, formatRelative } from '../utils/format';

const startTime = Date.now();

export async function handleStatus(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction as ChatInputCommandInteraction;

  const uptime = formatUptime(Date.now() - startTime);
  const lastPosts = getLastPosted();
  const activeJobs = getActiveJobs();
  const lastAlert = getLastAlertTime();

  const embed = baseEmbed()
    .setTitle('🤖 Harper-Perp Status')
    .setColor(config.colors.green)
    .addFields(
      { name: 'Uptime', value: uptime, inline: true },
      { name: 'Connection', value: '🟢 Online', inline: true },
      { name: 'Active Jobs', value: activeJobs.length > 0 ? activeJobs.join(', ') : 'None', inline: true },
    );

  // Last post times
  const postEntries = Object.entries(lastPosts);
  if (postEntries.length > 0) {
    embed.addFields({
      name: 'Last Posts',
      value: postEntries.map(([key, id]) => `**${key}:** ${id.slice(0, 8)}...`).join('\n'),
      inline: false,
    });
  }

  if (lastAlert > 0) {
    embed.addFields({
      name: 'Last Alert',
      value: formatRelative(new Date(lastAlert)),
      inline: true,
    });
  }

  await cmd.reply({ embeds: [embed] });
}
