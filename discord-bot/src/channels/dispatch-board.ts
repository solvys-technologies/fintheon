import { TextChannel } from 'discord.js';
import { Briefing } from '../integrations/notion';
import { buildBriefingEmbed } from '../embeds/briefing-embed';
import { logger } from '../utils/logger';
import { handleError } from '../utils/errors';

/** Post a briefing (MDB/ADB/PMDB) to #dispatch-board */
export async function postBriefing(channel: TextChannel, briefing: Briefing): Promise<void> {
  try {
    const embeds = buildBriefingEmbed(briefing);
    await channel.send({ embeds });
    logger.info(`Posted ${briefing.category} to #dispatch-board`, { title: briefing.title });
  } catch (error) {
    handleError('dispatch-board.postBriefing', error);
  }
}
