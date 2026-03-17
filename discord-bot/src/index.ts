import { config } from './config';
import { createClient } from './client';
import { logger } from './utils/logger';
import { registerCommands, handleInteraction } from './commands/registry';
import { handleBoardroomMessage } from './ai/handler';
import { pollNotionBriefings, pollNotionTribune, pollNotionTradeIdeas } from './scheduler/poller';
import { checkAndAlert } from './channels/the-tape';
import { schedule, stopAll } from './scheduler/cron';

const client = createClient();

client.once('ready', async () => {
  logger.info(`${config.bot.name} online as ${client.user?.tag}`);

  // Register slash commands
  await registerCommands();

  // Schedule Notion polling (every 60 seconds)
  schedule('notion-briefings', '* * * * *', () => pollNotionBriefings(client));
  schedule('notion-tribune', '* * * * *', () => pollNotionTribune(client));
  schedule('notion-trades', '* * * * *', () => pollNotionTradeIdeas(client));

  // Schedule tape alerts (every 5 minutes during market hours)
  schedule('tape-alerts', '*/5 * * * *', () => checkAndAlert(client));

  // Heartbeat log every 60 seconds
  schedule('heartbeat', '* * * * *', () => {
    logger.info('Heartbeat — bot alive', {
      guilds: client.guilds.cache.size,
      uptime: process.uptime().toFixed(0) + 's',
    });
  });

  logger.info('All scheduled jobs registered');
});

// Handle slash commands
client.on('interactionCreate', handleInteraction);

// Handle boardroom messages
client.on('messageCreate', handleBoardroomMessage);

// Graceful shutdown
function shutdown(signal: string): void {
  logger.info(`Received ${signal} — shutting down`);
  stopAll();
  client.destroy();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Handle unhandled errors
process.on('unhandledRejection', (error) => {
  logger.error('Unhandled rejection', { error });
});

// Login
client.login(config.discord.token).catch((error) => {
  logger.error('Failed to login to Discord', { error });
  process.exit(1);
});
