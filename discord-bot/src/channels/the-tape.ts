import { Client, TextChannel } from 'discord.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';
import { fetchMarketSnapshot, isMarketHours, shouldAlert } from '../integrations/market-data';
import { buildAlertEmbed, buildAlertMessage } from '../embeds/alert-embed';

let lastAlertTime = 0;

/** Check market conditions and fire alerts if warranted */
export async function checkAndAlert(client: Client): Promise<void> {
  try {
    // Only during market hours
    if (!isMarketHours()) return;

    // Throttle: max 1 alert per 30 minutes
    const now = Date.now();
    if (now - lastAlertTime < config.polling.alertCooldown) return;

    const snapshot = await fetchMarketSnapshot();
    if (!snapshot || !shouldAlert(snapshot)) return;

    const channel = await client.channels.fetch(config.channels.theTape) as TextChannel;
    if (!channel) {
      logger.warn('Could not find the-tape channel');
      return;
    }

    const alertMsg = buildAlertMessage(snapshot);
    const embed = buildAlertEmbed(snapshot);

    await channel.send({
      content: `@everyone ${alertMsg}`,
      embeds: [embed],
    });

    lastAlertTime = now;
    logger.info('Fired volatility alert', { risk: snapshot.riskAssessment });
  } catch (error) {
    handleError('the-tape.checkAndAlert', error);
  }
}

/** Get the last alert timestamp (for /status) */
export function getLastAlertTime(): number {
  return lastAlertTime;
}
