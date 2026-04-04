// [claude-code 2026-04-03] Daily MiroShark auto-run — once per day at 6:00 AM ET (weekdays)
import cron from 'node-cron';
import { shouldAutoRun, startPrediction } from '../miroshark/miroshark-service.js';
import { createLogger } from '../../lib/logger.js';

const log = createLogger('MiroSharkDaily');

let scheduled = false;

export function startMiroSharkDaily(): void {
  if (scheduled) return;
  scheduled = true;

  // 6:00 AM ET weekdays — runs before MDB (6:30 AM) so data is fresh
  cron.schedule('0 6 * * 1-5', async () => {
    log.info('Daily MiroShark cron triggered');

    try {
      const { shouldRun, staleness } = await shouldAutoRun();
      if (!shouldRun) {
        log.info('Skipping — recent run exists', { staleness: `${staleness.toFixed(1)}h` });
        return;
      }

      log.info('Starting daily auto-run');
      const result = await startPrediction(
        { lanes: [], catalysts: [], ropes: [] },
        undefined,
        'full-brief',
      );

      if ('error' in result) {
        log.error('Daily auto-run failed', { error: result.error });
      } else {
        log.info('Daily auto-run complete', { simulationId: result.simulationId });
      }
    } catch (err) {
      log.error('Daily MiroShark cron error', { error: String(err) });
    }
  }, { timezone: 'America/New_York' });

  log.info('MiroShark daily cron scheduled (6:00 AM ET, weekdays)');
}
