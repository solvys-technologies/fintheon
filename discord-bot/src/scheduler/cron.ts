import cron from 'node-cron';
import { logger } from '../utils/logger';

interface ScheduledTask {
  name: string;
  task: cron.ScheduledTask;
}

const tasks: ScheduledTask[] = [];

/** Schedule a cron job with a name for logging */
export function schedule(name: string, expression: string, fn: () => void | Promise<void>): void {
  const task = cron.schedule(expression, async () => {
    try {
      await fn();
    } catch (error) {
      logger.error(`Cron job [${name}] failed`, { error });
    }
  });

  tasks.push({ name, task });
  logger.info(`Scheduled cron job: ${name} (${expression})`);
}

/** Stop all scheduled tasks */
export function stopAll(): void {
  for (const { name, task } of tasks) {
    task.stop();
    logger.info(`Stopped cron job: ${name}`);
  }
  tasks.length = 0;
}

/** Get list of active task names */
export function getActiveJobs(): string[] {
  return tasks.map((t) => t.name);
}
