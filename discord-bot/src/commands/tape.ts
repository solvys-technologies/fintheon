import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import { fetchMarketSnapshot } from '../integrations/market-data';
import { buildAlertEmbed } from '../embeds/alert-embed';
import { baseEmbed, riskEmoji } from '../embeds/common';
import { config } from '../config';

export async function handleTape(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction as ChatInputCommandInteraction;

  await cmd.deferReply();

  const snapshot = await fetchMarketSnapshot();
  if (!snapshot) {
    const embed = baseEmbed()
      .setTitle('📊 The Tape')
      .setDescription('Unable to fetch market data at this time. Markets may be closed.')
      .setColor(config.colors.blue);

    await cmd.editReply({ embeds: [embed] });
    return;
  }

  const emoji = riskEmoji[snapshot.riskAssessment] || '⚪';
  const embed = baseEmbed()
    .setTitle('📊 The Tape — Current Reading')
    .setColor(snapshot.riskAssessment === 'LOW' ? config.colors.green : config.colors.red)
    .addFields(
      { name: 'VIX', value: snapshot.vix.toFixed(2), inline: true },
      { name: 'VIX Change', value: `${snapshot.vixChange >= 0 ? '+' : ''}${snapshot.vixChange.toFixed(2)}%`, inline: true },
      { name: 'NQ Level', value: snapshot.nqLevel.toFixed(0), inline: true },
      { name: 'NQ Implied Move', value: `${snapshot.nqImpliedMove.toFixed(0)} pts`, inline: true },
      { name: 'Risk Assessment', value: `${emoji} ${snapshot.riskAssessment}`, inline: true },
    );

  await cmd.editReply({ embeds: [embed] });
}
