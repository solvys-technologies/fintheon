import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import { fetchLatestBriefing } from '../integrations/notion';
import { buildBriefingEmbed } from '../embeds/briefing-embed';

export async function handlePmdb(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction as ChatInputCommandInteraction;

  await cmd.deferReply();

  const briefing = await fetchLatestBriefing('PMDB');
  if (!briefing) {
    await cmd.editReply('No Post-Market Brief available at this time.');
    return;
  }

  const embeds = buildBriefingEmbed(briefing);
  await cmd.editReply({ embeds });
}
