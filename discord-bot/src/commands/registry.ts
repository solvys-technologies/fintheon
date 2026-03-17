import { REST, Routes, SlashCommandBuilder, Client, Interaction } from 'discord.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { handleMdb } from './mdb';
import { handleAdb } from './adb';
import { handlePmdb } from './pmdb';
import { handleTott } from './tott';
import { handleStatus } from './status';
import { handleTape } from './tape';
import { handleAsk } from './ask';

const commands = [
  new SlashCommandBuilder().setName('mdb').setDescription('Fetch the latest Dawn Dispatch'),
  new SlashCommandBuilder().setName('adb').setDescription('Fetch the latest Afternoon Brief'),
  new SlashCommandBuilder().setName('pmdb').setDescription('Fetch the latest Post-Market Brief'),
  new SlashCommandBuilder().setName('tott').setDescription('Fetch the latest Weekly Tribune'),
  new SlashCommandBuilder().setName('status').setDescription('Bot health: uptime, last posts, connection status'),
  new SlashCommandBuilder().setName('tape').setDescription('Current volatility reading: VIX, NQ, risk assessment'),
  new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask a freeform market question with live research')
    .addStringOption((opt) =>
      opt.setName('question').setDescription('Your market question').setRequired(true),
    ),
];

const handlers: Record<string, (interaction: Interaction) => Promise<void>> = {
  mdb: handleMdb,
  adb: handleAdb,
  pmdb: handlePmdb,
  tott: handleTott,
  status: handleStatus,
  tape: handleTape,
  ask: handleAsk,
};

/** Register slash commands with the Discord API */
export async function registerCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(config.discord.token);

  try {
    await rest.put(
      Routes.applicationGuildCommands(
        (await rest.get(Routes.currentApplication()) as any).id,
        config.discord.guildId,
      ),
      { body: commands.map((c) => c.toJSON()) },
    );
    logger.info(`Registered ${commands.length} slash commands`);
  } catch (error) {
    logger.error('Failed to register slash commands', { error });
  }
}

/** Handle incoming slash command interactions */
export async function handleInteraction(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const handler = handlers[interaction.commandName];
  if (!handler) return;

  try {
    await handler(interaction);
  } catch (error) {
    logger.error(`Command /${interaction.commandName} failed`, { error });
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({
        content: 'Something went wrong processing that command.',
        ephemeral: true,
      });
    }
  }
}
