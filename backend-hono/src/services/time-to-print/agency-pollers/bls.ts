// [claude-code 2026-04-25] S40-P4: BLS direct-page burst poller. Diff body
// hashes against the page's pre-arm baseline; on first diff, extract the
// numeric Actual / Previous / commentary. Emits SSE econ-print on hit.
//
// Release pages (deterministic URLs maintained quarterly):
//   cpi    https://www.bls.gov/news.release/cpi.htm
//   ppi    https://www.bls.gov/news.release/ppi.htm
//   empsit https://www.bls.gov/news.release/empsit.htm
//   jolts  https://www.bls.gov/news.release/jolts.htm
//   eci    https://www.bls.gov/news.release/eci.htm
//
// User-Agent set per agency etiquette.

import { createHash } from "node:crypto";
import { acquirePage } from "../../browser/pool.js";
import { createLogger } from "../../../lib/logger.js";
import type {
  AgencyReleaseDescriptor,
  BurstResult,
  EconEventKey,
  PrintExtraction,
} from "./types.js";

const log = createLogger("BLSPoller");

export const BLS_RELEASES: Record<string, AgencyReleaseDescriptor> = {
  cpi: {
    agency: "bls",
    eventKey: "cpi",
    url: "https://www.bls.gov/news.release/cpi.htm",
    description: "Consumer Price Index",
  },
  ppi: {
    agency: "bls",
    eventKey: "ppi",
    url: "https://www.bls.gov/news.release/ppi.htm",
    description: "Producer Price Index",
  },
  empsit: {
    agency: "bls",
    eventKey: "empsit",
    url: "https://www.bls.gov/news.release/empsit.htm",
    description: "Employment Situation",
  },
  jolts: {
    agency: "bls",
    eventKey: "jolts",
    url: "https://www.bls.gov/news.release/jolts.htm",
    description: "Job Openings and Labor Turnover Survey",
  },
  eci: {
    agency: "bls",
    eventKey: "eci",
    url: "https://www.bls.gov/news.release/eci.htm",
    description: "Employment Cost Index",
  },
};

const USER_AGENT = "Fintheon RiskFlow (tp@pricedinresearch.io)";

function hashBody(body: string): string {
  return createHash("sha256").update(body).digest("hex");
}

function extractFirstNumber(text: string): number | null {
  const m = text.match(/[-+]?\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}

function extractCpiActual(html: string): PrintExtraction | null {
  // BLS CPI release pattern: "The Consumer Price Index for All Urban Consumers
  // (CPI-U) increased 0.2 percent in <Month>, the U.S. Bureau of Labor
  // Statistics reported today."
  const cpiMatch = html.match(
    /(?:Consumer Price Index|CPI-U)[^.]*?(increased|decreased|unchanged|rose|fell)\s+([\d.]+)\s*percent/i,
  );
  const previousMatch = html.match(
    /(?:in the previous month|prior month)[^.]*?([\d.]+)\s*percent/i,
  );
  if (!cpiMatch) return null;
  const direction = cpiMatch[1].toLowerCase();
  const num = parseFloat(cpiMatch[2]);
  const signed = direction === "decreased" || direction === "fell" ? -num : num;
  return {
    eventKey: "cpi",
    actual: signed,
    forecast: null,
    previous: previousMatch ? parseFloat(previousMatch[1]) : null,
    commentary: cpiMatch[0],
  };
}

function extractGenericActual(
  html: string,
  eventKey: EconEventKey,
): PrintExtraction | null {
  // Best-effort default: pull the first percent number near the keyword. Refine
  // per-release as we observe real prints.
  const keyword = eventKey.toUpperCase();
  const idx = html.toUpperCase().indexOf(keyword);
  if (idx < 0) return null;
  const window = html.slice(idx, idx + 300);
  const num = extractFirstNumber(window);
  if (num == null) return null;
  return {
    eventKey,
    actual: num,
    forecast: null,
    previous: null,
    commentary: window.slice(0, 160),
  };
}

function extract(
  html: string,
  eventKey: EconEventKey,
): PrintExtraction | null {
  if (eventKey === "cpi") return extractCpiActual(html);
  return extractGenericActual(html, eventKey);
}

export async function armBLSBurst(opts: {
  release: AgencyReleaseDescriptor;
  scheduledAt: Date;
  pollIntervalMs?: number;
  windowMs?: number;
}): Promise<BurstResult> {
  const start = Date.now();
  const armAt = opts.scheduledAt.getTime() - 30_000;
  const disarmAt = opts.scheduledAt.getTime() + (opts.windowMs ?? 60_000);
  const pollMs = opts.pollIntervalMs ?? 500;

  // Wait until arm time.
  const waitMs = armAt - Date.now();
  if (waitMs > 0) {
    await new Promise((r) => setTimeout(r, waitMs));
  }

  const handle = await acquirePage({ userAgent: USER_AGENT });
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
          const extraction = extract(html, opts.release.eventKey);
          if (!extraction) {
            log.warn("BLS body changed but extraction failed", {
              release: opts.release.eventKey,
              hash: h.slice(0, 8),
            });
            baselineHash = h; // continue polling for the actual diff
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
        log.warn("BLS poll iteration threw (continuing)", {
          release: opts.release.eventKey,
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
