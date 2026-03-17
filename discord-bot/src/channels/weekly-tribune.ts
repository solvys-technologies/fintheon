import { TextChannel } from 'discord.js';
import { Briefing } from '../integrations/notion';
import { buildTribuneEmbed } from '../embeds/tribune-embed';
import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';

/** Post a TOTT entry to #weekly-tribune */
export async function postTribune(channel: TextChannel, briefing: Briefing): Promise<void> {
  try {
    const embed = buildTribuneEmbed(briefing);
    await channel.send({ embeds: [embed] });
    logger.info('Posted TOTT to #weekly-tribune', { title: briefing.title });
  } catch (error) {
    handleError('weekly-tribune.postTribune', error);
  }
}
