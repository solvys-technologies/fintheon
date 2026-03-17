import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import { fetchLatestBriefing } from '../integrations/notion';
import { buildBriefingEmbed } from '../embeds/briefing-embed';

export async function handleMdb(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction as ChatInputCommandInteraction;

  await cmd.deferReply();

  const briefing = await fetchLatestBriefing('MDB');
  if (!briefing) {
    await cmd.editReply('No Dawn Dispatch available at this time.');
    return;
  }

  const embeds = buildBriefingEmbed(briefing);
  await cmd.editReply({ embeds });
}
