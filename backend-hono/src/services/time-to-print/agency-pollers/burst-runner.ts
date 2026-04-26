// [claude-code 2026-04-25] S40-P4: shared burst runner. Each agency poller
// passes in its own descriptor + extractor; this orchestrates the T-30s arm,
// 500ms reload+diff loop, and 60s window timeout.
//
// Lives separately so per-agency files stay focused on URL + extraction.

import { createHash } from "node:crypto";
import { acquirePage } from "../../browser/pool.js";
import { createLogger } from "../../../lib/logger.js";
import type {
  AgencyReleaseDescriptor,
  BurstResult,
  PrintExtraction,
} from "./types.js";

const log = createLogger("AgencyBurstRunner");

export type Extractor = (
  html: string,
  release: AgencyReleaseDescriptor,
) => PrintExtraction | null;

interface ArmOpts {
  release: AgencyReleaseDescriptor;
  scheduledAt: Date;
  extractor: Extractor;
  pollIntervalMs?: number;
  windowMs?: number;
  userAgent?: string;
}

const DEFAULT_USER_AGENT = "Fintheon RiskFlow (tp@pricedinresearch.io)";

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

export async function runBurst(opts: ArmOpts): Promise<BurstResult> {
  const start = Date.now();
  const armAt = opts.scheduledAt.getTime() - 30_000;
  const disarmAt = opts.scheduledAt.getTime() + (opts.windowMs ?? 60_000);
  const pollMs = opts.pollIntervalMs ?? 500;

  const waitMs = armAt - Date.now();
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }

  const handle = await acquirePage({
    userAgent: opts.userAgent ?? DEFAULT_USER_AGENT,
  });
  let baselineHash: string | null = null;
  let pollCount = 0;
  try {
    await handle.page.goto(opts.release.url, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    baselineHash = hashBody(await handle.page.content());

    while (Date.now() < disarmAt) {
      pollCount += 1;
      try {
        await handle.page.reload({
          waitUntil: "domcontentloaded",
          timeout: 5_000,
        });
        const html = await handle.page.content();
        const h = hashBody(html);
        if (h !== baselineHash) {
          const extraction = opts.extractor(html, opts.release);
          if (!extraction) {
            log.warn("Body changed but extraction failed (continuing)", {
              agency: opts.release.agency,
              eventKey: opts.release.eventKey,
            });
            baselineHash = h;
            await new Promise((r) => setTimeout(r, pollMs));
            continue;
          }
          return {
            ok: true,
            printedAt: new Date().toISOString(),
            extraction,
            pollCount,
            durationMs: Date.now() - start,
          };
        }
      } catch (err) {
        log.warn("Burst poll iteration threw (continuing)", {
          agency: opts.release.agency,
          error: err instanceof Error ? err.message : String(err),
        });
      }
      await new Promise((r) => setTimeout(r, pollMs));
    }

    return {
      ok: false,
      printedAt: new Date().toISOString(),
      pollCount,
      durationMs: Date.now() - start,
      reason: "window_expired_no_diff",
    };
  } finally {
    await handle.release();
  }
}
