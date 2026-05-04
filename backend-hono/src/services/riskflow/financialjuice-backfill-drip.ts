// [claude-code 2026-05-04] Slow-drip FinancialJuice backfill runner for last-2d
// recovery. Pulls profile tweets via persistent browser session, inserts missing
// rows in chronological batches, then scores immediately.

import { withPersistentBrowserPage } from "../browser/index.js";
import { writeCollectedItems } from "../../workers/riskflow-worker/persist.js";
import { scoringCycle } from "./central-scorer.js";
import type { CollectedNewsItem } from "../../workers/riskflow-worker/sources/types.js";
import { getSupabaseClient } from "../../config/supabase.js";

const HANDLE = "financialjuice";
const FROM = "2026-05-01";
const TO = "2026-05-03";
const MIN_BATCH = 10;
const MAX_BATCH = 15;
const INTERVAL_MS = 30 * 60 * 1000;

interface ExtractedTweet {
  tweet_id: string;
  text: string;
  timestamp: string;
  permalink: string;
  image_url: string | null;
  video_url: string | null;
}

interface DripState {
  running: boolean;
  startedAt: string | null;
  lastRunAt: string | null;
  nextRunAt: string | null;
  from: string;
  to: string;
  handle: string;
  batchMin: number;
  batchMax: number;
  intervalMs: number;
  lastWritten: number;
  lastScored: number;
  totalWritten: number;
  totalScored: number;
  lastError: string | null;
}

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

const state: DripState = {
  running: false,
  startedAt: null,
  lastRunAt: null,
  nextRunAt: null,
  from: FROM,
  to: TO,
  handle: HANDLE,
  batchMin: MIN_BATCH,
  batchMax: MAX_BATCH,
  intervalMs: INTERVAL_MS,
  lastWritten: 0,
  lastScored: 0,
  totalWritten: 0,
  totalScored: 0,
  lastError: null,
};

function randomBatchSize(): number {
  return Math.floor(Math.random() * (MAX_BATCH - MIN_BATCH + 1)) + MIN_BATCH;
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function tweetToItem(tw: ExtractedTweet): CollectedNewsItem {
  const headline = tw.text.length > 220 ? tw.text.slice(0, 220) : tw.text;
  return {
    item_id: tw.tweet_id,
    source: `twitter:${HANDLE}`,
    source_domain: "x.com",
    headline,
    body: tw.text,
    url: tw.permalink,
    image_url: tw.image_url,
    video_url: tw.video_url,
    tier: "breaking",
    published_at: tw.timestamp,
    fetched_at: new Date().toISOString(),
    fetch_latency_ms: 0,
    ingest_pipeline: "browser-backfill-drip",
  };
}

async function scrapeFinancialJuice(): Promise<ExtractedTweet[]> {
  const fromMs = Date.parse(`${FROM}T00:00:00.000Z`);
  const toMs = Date.parse(`${TO}T23:59:59.999Z`);

  return withPersistentBrowserPage(async (page) => {
    await page.goto(`https://x.com/${HANDLE}/with_replies`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(4_000);
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(1_100);
    }

    const rows = await page.evaluate(() => {
      function img(article: Element): string | null {
        const selectors = [
          "img[src*='pbs.twimg.com/media']",
          "img[src*='pbs.twimg.com/card_img']",
          "[data-testid='tweetPhoto'] img",
        ];
        for (const sel of selectors) {
          const el = article.querySelector(sel) as HTMLImageElement | null;
          if (el?.src) return el.src;
        }
        return null;
      }

      function video(article: Element): string | null {
        const videos = article.querySelectorAll("video");
        for (const node of Array.from(videos)) {
          const v = node as HTMLVideoElement;
          if (v.src && /twimg\.com/.test(v.src)) return v.src;
          const srcEl = v.querySelector(
            "source[src*='twimg.com']",
          ) as HTMLSourceElement | null;
          if (srcEl?.src && /twimg\.com/.test(srcEl.src)) return srcEl.src;
        }
        return null;
      }

      return Array.from(document.querySelectorAll("article")).flatMap((a) => {
        const link = a.querySelector("a[href*='/status/']") as HTMLAnchorElement | null;
        const text = (a.querySelector("[data-testid='tweetText']") as HTMLElement | null)?.innerText;
        const timestamp = a.querySelector("time")?.getAttribute("datetime") ?? "";
        if (!link?.href || !text || !timestamp) return [];
        const idMatch = link.href.match(/\/status\/(\d+)/);
        if (!idMatch?.[1]) return [];
        return [{
          tweet_id: idMatch[1],
          text,
          timestamp,
          permalink: link.href,
          image_url: img(a),
          video_url: video(a),
        }];
      });
    });

    const unique = new Map<string, ExtractedTweet>();
    for (const row of rows) {
      const ts = Date.parse(row.timestamp);
      if (!Number.isFinite(ts) || ts < fromMs || ts > toMs) continue;
      if (normalize(row.text).length < 15) continue;
      unique.set(row.tweet_id, {
        ...row,
        text: normalize(row.text),
      });
    }
    return Array.from(unique.values()).sort((a, b) => {
      return Date.parse(a.timestamp) - Date.parse(b.timestamp);
    });
  });
}

async function runOneTick(): Promise<void> {
  if (!state.running || inFlight) return;
  inFlight = true;
  state.lastError = null;
  state.lastRunAt = new Date().toISOString();
  try {
    const tweets = await scrapeFinancialJuice();
    const sb = getSupabaseClient();
    const idSet = new Set<string>();
    if (sb && tweets.length > 0) {
      const ids = tweets.map((t) => t.tweet_id);
      const { data } = await sb
        .from("raw_riskflow_items")
        .select("tweet_id")
        .in("tweet_id", ids);
      for (const row of data ?? []) {
        const id = (row as { tweet_id?: string }).tweet_id;
        if (id) idSet.add(id);
      }
    }
    const missing = tweets.filter((t) => !idSet.has(t.tweet_id));
    const batchSize = randomBatchSize();
    const items = missing.slice(0, batchSize).map(tweetToItem);
    const written = await writeCollectedItems(items);
    const scored = written > 0 ? await scoringCycle() : 0;
    state.lastWritten = written;
    state.lastScored = scored;
    state.totalWritten += written;
    state.totalScored += scored;
  } catch (error) {
    state.lastError = error instanceof Error ? error.message : String(error);
  } finally {
    inFlight = false;
    if (state.running) {
      state.nextRunAt = new Date(Date.now() + INTERVAL_MS).toISOString();
      timer = setTimeout(() => {
        void runOneTick();
      }, INTERVAL_MS);
    }
  }
}

export function startFinancialJuiceBackfillDrip(): DripState {
  if (state.running) return getFinancialJuiceBackfillDripStatus();
  state.running = true;
  state.startedAt = new Date().toISOString();
  state.nextRunAt = new Date().toISOString();
  void runOneTick();
  return getFinancialJuiceBackfillDripStatus();
}

export function stopFinancialJuiceBackfillDrip(): DripState {
  state.running = false;
  state.nextRunAt = null;
  if (timer) clearTimeout(timer);
  timer = null;
  return getFinancialJuiceBackfillDripStatus();
}

export function getFinancialJuiceBackfillDripStatus(): DripState {
  return { ...state };
}
