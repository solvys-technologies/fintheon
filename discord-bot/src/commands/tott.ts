import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import { fetchLatestBriefing } from '../integrations/notion';
import { buildTribuneEmbed } from '../embeds/tribune-embed';

export async function handleTott(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction as ChatInputCommandInteraction;

  await cmd.deferReply();

  const briefing = await fetchLatestBriefing('TOTT');
  if (!briefing) {
    await cmd.editReply('No Weekly Tribune available at this time.');
    return;
  }

  const embed = buildTribuneEmbed(briefing);
  await cmd.editReply({ embeds: [embed] });
}
