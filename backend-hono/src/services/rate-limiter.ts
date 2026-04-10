export interface RateLimiterRule {
  limit: number;
  windowMs: number;
}

export interface RateLimiterOptions {
  defaultRule: RateLimiterRule;
  buckets?: Record<string, RateLimiterRule>;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  jitterMs?: number;
  maxRetries?: number;
  maxQueueSize?: number;
  logger?: (message: string, data?: Record<string, unknown>) => void;
}

export interface ScheduleOptions {
  bucket?: string;
}

interface Task<T> {
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
  attempt: number;
  bucket?: string;
}

interface BucketState {
  windowStart: number;
  used: number;
}

export interface RateLimiter {
  schedule<T>(fn: () => Promise<T>, options?: ScheduleOptions): Promise<T>;
  pending(): number;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRateLimitError = (error: unknown): boolean => {
  if (!error) return false;
  if (
    typeof error === "object" &&
    "status" in (error as Record<string, unknown>)
  ) {
    return (error as { status?: number }).status === 429;
  }
  if (error instanceof Response) {
    return error.status === 429;
  }
  return false;
};

const withJitter = (ms: number, jitter: number) => {
  const spread = Math.random() * jitter;
  return ms + spread * (Math.random() > 0.5 ? 1 : -1);
};

export const createRateLimiter = (options: RateLimiterOptions): RateLimiter => {
  const {
    defaultRule,
    buckets = {},
    baseBackoffMs = 500,
    maxBackoffMs = 30_000,
    jitterMs = 250,
    maxRetries = 5,
    maxQueueSize = 1_000,
    logger,
  } = options;

  const queue: Task<unknown>[] = [];
  const bucketState = new Map<string, BucketState>();
  let processing = false;

  const getRule = (bucket?: string) => buckets[bucket ?? ""] ?? defaultRule;

  const acquireSlot = (bucketKey: string, rule: RateLimiterRule) => {
    const now = Date.now();
    const state = bucketState.get(bucketKey) ?? { windowStart: now, used: 0 };
    if (now - state.windowStart >= rule.windowMs) {
      state.windowStart = now;
      state.used = 0;
    }

    if (state.used < rule.limit) {
      state.used += 1;
      bucketState.set(bucketKey, state);
      return { allowed: true, waitMs: 0 };
    }

    const waitMs = state.windowStart + rule.windowMs - now;
    return { allowed: false, waitMs };
  };

  const computeBackoff = (attempt: number) => {
    const exp = baseBackoffMs * 2 ** attempt;
    const bounded = Math.min(exp, maxBackoffMs);
    return Math.max(0, withJitter(bounded, jitterMs));
  };

  const requeue = <T>(task: Task<T>) => {
    queue.unshift(task);
  };

  const processQueue = async (): Promise<void> => {
    if (processing) return;
    processing = true;

    while (queue.length > 0) {
      const task = queue.shift();
      if (!task) break;

      const rule = getRule(task.bucket);
      const bucketKey = task.bucket ?? "default";
      const slot = acquireSlot(bucketKey, rule);

      if (!slot.allowed) {
        queue.unshift(task);
        await delay(slot.waitMs);
        continue;
      }

      try {
        const result = await task.fn();
        task.resolve(result);
      } catch (error) {
        if (isRateLimitError(error) && task.attempt < maxRetries) {
          const backoffMs = computeBackoff(task.attempt + 1);
          logger?.("rate-limit:backoff", {
            bucket: bucketKey,
            attempt: task.attempt + 1,
            backoffMs,
          });
          await delay(backoffMs);
          requeue({ ...task, attempt: task.attempt + 1 });
          continue;
        }
        task.reject(error);
      }
    }

    processing = false;
  };

  const schedule = async <T>(
    fn: () => Promise<T>,
    options?: ScheduleOptions,
  ) => {
    if (queue.length >= maxQueueSize) {
      return Promise.reject(new Error("RateLimiter queue is full"));
    }

    return new Promise<T>((resolve, reject) => {
      queue.push({
        fn,
        resolve,
        reject,
        attempt: 0,
        bucket: options?.bucket,
      });
      processQueue().catch((error) => {
        logger?.("rate-limit:process-error", { error });
      });
    });
  };

  const pending = () => queue.length;

  return { schedule, pending };
};
