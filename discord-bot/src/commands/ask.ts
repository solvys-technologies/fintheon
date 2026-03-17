import { Interaction, ChatInputCommandInteraction } from 'discord.js';
import { HARPER_SYSTEM_PROMPT } from '../ai/persona';
import { ask } from '../integrations/perplexity';
import { baseEmbed } from '../embeds/common';
import { truncate } from '../utils/format';
import { config } from '../config';

export async function handleAsk(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;
  const cmd = interaction as ChatInputCommandInteraction;

  const question = cmd.options.getString('question', true);

  await cmd.deferReply();

  const answer = await ask(HARPER_SYSTEM_PROMPT, question);

  if (!answer) {
    await cmd.editReply(
      "I'm having trouble reaching my research tools right now. Try again in a moment.",
    );
    return;
  }

  const embed = baseEmbed()
    .setTitle('🔍 Research Response')
    .setDescription(truncate(answer, 4000))
    .addFields({ name: 'Question', value: truncate(question, 256), inline: false })
    .setColor(config.colors.blue);

  await cmd.editReply({ embeds: [embed] });
}
