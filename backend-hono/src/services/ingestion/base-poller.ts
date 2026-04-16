// [claude-code 2026-04-16] S20-T9: Shared base poller — poll/dedup/filter/write pattern for all ingestion pipelines

import { createLogger } from "../../lib/logger.js";

type PollerLogger = ReturnType<typeof createLogger>;
import { getPollingConfig } from "../riskflow/polling-config.js";
import { filterWithContentGuard } from "../riskflow/content-guard.js";
import { writeRawItems, type RawRiskFlowItem } from "../supabase-service.js";
import { register, recordRun, recordError } from "../health-registry.js";

export interface BasePollerConfig {
  name: string;
  /** Override dynamic interval — if provided, ignores getPollingConfig() */
  fixedIntervalMs?: number;
  /** Custom interval function (e.g., feed-poller's market-hours logic) */
  getInterval?: () => number;
  /** Delay before first poll after start() (default: 0) */
  initialDelayMs?: number;
}

export interface PollResult {
  items: RawRiskFlowItem[];
}

/**
 * Create a reusable poller with shared lifecycle, dedup, content guard, and write logic.
 * Each poller provides its own `poll()` function that fetches and transforms items.
 */
export function createBasePoller(
  config: BasePollerConfig,
  pollFn: (log: PollerLogger) => Promise<PollResult>,
) {
  const log = createLogger(config.name);
  const seenIds = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  register(config.name);

  function getNextInterval(): number {
    if (config.fixedIntervalMs) return config.fixedIntervalMs;
    if (config.getInterval) return config.getInterval();
    return getPollingConfig().interval;
  }

  function hashString(s: string): string {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h).toString(36);
  }

  function dedup(items: RawRiskFlowItem[]): RawRiskFlowItem[] {
    return items.filter((item) => {
      const key =
        item.tweet_id || `${config.name}-${hashString(item.headline || "")}`;
      if (seenIds.has(key)) return false;
      seenIds.add(key);
      return true;
    });
  }

  function filterContent(items: RawRiskFlowItem[]): RawRiskFlowItem[] {
    return filterWithContentGuard(
      items,
      (i) => `${i.headline || ""} ${i.body || ""}`,
    );
  }

  async function tick(): Promise<void> {
    try {
      const result = await pollFn(log);
      if (result.items.length === 0) {
        recordRun(config.name);
        return;
      }

      const unique = dedup(result.items);
      if (unique.length === 0) {
        recordRun(config.name);
        return;
      }

      const clean = filterContent(unique);
      if (clean.length > 0) {
        const written = await writeRawItems(clean);
        log.info(
          `Wrote ${written} items (${result.items.length} fetched, ${unique.length} unique, ${clean.length} passed guard)`,
        );
      }

      recordRun(config.name);
    } catch (err) {
      recordError(config.name, err);
      log.warn("Poll cycle failed:", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  function scheduleNext(): void {
    if (!running) return;
    const interval = getNextInterval();
    timer = setTimeout(async () => {
      await tick();
      scheduleNext();
    }, interval);
    (timer as any).unref?.();
  }

  function start(): void {
    if (running) return;
    running = true;
    log.info(`Starting (interval: ${getNextInterval() / 1000}s)`);

    if (config.initialDelayMs && config.initialDelayMs > 0) {
      timer = setTimeout(() => {
        tick().then(() => scheduleNext());
      }, config.initialDelayMs);
    } else {
      tick().then(() => scheduleNext());
    }
  }

  function stop(): void {
    running = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    log.info("Stopped");
  }

  function isActive(): boolean {
    return running;
  }

  function clearDedup(): void {
    seenIds.clear();
  }

  return { start, stop, isActive, tick, clearDedup };
}
