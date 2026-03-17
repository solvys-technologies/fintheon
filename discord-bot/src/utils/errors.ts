import { logger } from './logger';

export function handleError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  logger.error(`[${context}] ${message}`, { stack });
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      handleError(`${context} (attempt ${attempt}/${maxRetries})`, error);
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await sleep(delay);
      }
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
