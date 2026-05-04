// [claude-code 2026-05-03] One-shot browser backfill: scrapes X profile pages via
// persistent browser session for all source-account handles, extracts tweets from
// a FROM/TO window, writes to raw_riskflow_items, and injects missed econ prints.
//
// Usage (from backend-hono):
//   bun scripts/browser-backfill.ts
//   DRY_RUN=true bun scripts/browser-backfill.ts

import "dotenv/config";

const DRY_RUN = process.env.DRY_RUN === "true";
const FROM = process.env.FROM ?? "2026-04-26";
const TO = process.env.TO ?? new Date().toISOString().slice(0, 10);
const SCROLL_COUNT = Math.max(1, Number(process.env.SCROLL_COUNT ?? 6));
const SCROLL_DELAY_MS = Math.max(300, Number(process.env.SCROLL_DELAY_MS ?? 1200));
const HANDLE_PAUSE_MS = Math.max(500, Number(process.env.HANDLE_PAUSE_MS ?? 3000));
const MIN_TWEET_LENGTH = 15;

if (!DRY_RUN) {
  process.env.FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW ??= "true";
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function stripHandle(h: string): string {
  return h.replace(/^@/, "").trim();
}

function normalizeTweetText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractHandleFromPermalink(href: string): string | null {
  const match = href.match(/\/([^/]+)\/status\/\d+/);
  return match ? stripHandle(match[1]) : null;
}

// ── Browser profile-page scraping ──────────────────────────────────────────

interface ExtractedTweet {
  tweet_id: string;
  text: string;
  timestamp: string;
  permalink: string;
  author_handle: string;
  image_url?: string | null;
  video_url?: string | null;
}

async function scrapeProfileTweets(
  page: import("playwright").Page,
  handle: string,
): Promise<ExtractedTweet[]> {
  const cleanHandle = stripHandle(handle);
  // Use /with_replies to get latest tweets in reverse-chronological order
  // (the bare profile page shows "Highlights" tab which surfaces old popular tweets)
  const url = `https://x.com/${cleanHandle}/with_replies`;

  console.log(`[browser-backfill] navigating to ${url}`);

  try {
    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.waitForTimeout(4_000);

    // Scroll aggressively to load tweets from the target date window.
    // X lazy-loads ~20 articles per scroll so we need enough scrolls to reach
    // tweets from 1-2 weeks ago (depends on posting frequency).
    for (let i = 0; i < SCROLL_COUNT; i++) {
      await page.mouse.wheel(0, 3000);
      await page.waitForTimeout(SCROLL_DELAY_MS);
    }

    const rawRows = await page.evaluate(() => {
      function extractBestImg(article: Element): string | null {
        const selectors = [
          "img[src*='pbs.twimg.com/media']",
          "img[src*='pbs.twimg.com/card_img']",
          "img[src*='twimg.com/media']",
          "img[src*='twimg.com/amplify_video_thumb']",
          "img[src*='pbs.twimg.com/amplify_video_thumb']",
          "[data-testid='tweetPhoto'] img",
        ];
        for (const sel of selectors) {
          const el = article.querySelector(sel) as HTMLImageElement | null;
          if (el?.src) return el.src;
        }
        return null;
      }

      function extractBestVideo(article: Element): string | null {
        const videoEls = article.querySelectorAll("video");
        for (const v of Array.from(videoEls)) {
          const ve = v as HTMLVideoElement;
          if (ve.src && /twimg\.com/.test(ve.src)) return ve.src;
          const srcEl = ve.querySelector(
            "source[src*='twimg.com']",
          ) as HTMLSourceElement | null;
          if (srcEl?.src && /twimg\.com/.test(srcEl.src)) return srcEl.src;
        }
        return null;
      }

      return Array.from(document.querySelectorAll("article")).flatMap(
        (article) => {
          const articleText = (article as HTMLElement).innerText || "";
          if (
            /\bPromoted\b/i.test(articleText) &&
            articleText.length < 300
          ) {
            return [];
          }
          const statusLinks = Array.from(
            article.querySelectorAll("a[href*='/status/']"),
          )
            .map((a) => (a as HTMLAnchorElement).href)
            .filter((href) => /\/\w+\/status\/\d+/.test(href));
          const permalink = statusLinks[0];
          if (!permalink) return [];
          const tweetIdMatch = permalink.match(/\/status\/(\d+)/);
          const tweetId = tweetIdMatch?.[1];
          const tweetText = (
            article.querySelector(
              "[data-testid='tweetText']",
            ) as HTMLElement | null
          )?.innerText;
          const timestamp =
            article.querySelector("time")?.getAttribute("datetime") ?? "";
          const imageUrl = extractBestImg(article);
          const videoUrl = extractBestVideo(article);
          if (!tweetId || !tweetText || !timestamp) return [];
          if (
            tweetText.length < 15 ||
            /\b(?:sponsored|advert|promoted|paid partnership)\b/i.test(
              tweetText,
            )
          ) {
            return [];
          }
          return [
            {
              tweetId,
              text: tweetText,
              timestamp,
              permalink,
              imageUrl: imageUrl || null,
              videoUrl: videoUrl || null,
            },
          ];
        },
      );
    });

    const seen = new Set<string>();
    const out: ExtractedTweet[] = [];
    for (const row of rawRows) {
      if (seen.has(row.tweetId)) continue;
      seen.add(row.tweetId);
      const author = extractHandleFromPermalink(row.permalink) ?? cleanHandle;

      // Fix timestamp: if the time element's datetime is missing/empty,
      // fallback to the Snowflake tweet ID which encodes the timestamp
      let timestamp = row.timestamp;
      if (!timestamp || isNaN(Date.parse(timestamp))) {
        // Snowflake ID: first 41 bits are milliseconds since Twitter epoch (1288834974657)
        const idNum = BigInt(row.tweetId);
        const snowflakeMs = Number(idNum >> 22n) + 1288834974657;
        timestamp = new Date(snowflakeMs).toISOString();
      }

      out.push({
        tweet_id: row.tweetId,
        text: normalizeTweetText(row.text),
        timestamp,
        permalink: row.permalink,
        author_handle: author,
        image_url: row.imageUrl ?? null,
        video_url: row.videoUrl ?? null,
      });
    }

    // Debug: show first 3 timestamps
    if (out.length > 0) {
      const samples = out.slice(0, 3).map((t) => `${t.tweet_id.slice(0, 6)}... @ ${t.timestamp.slice(0, 19)}`).join(", ");
      console.log(
        `[browser-backfill] ${cleanHandle}: ${out.length} tweets extracted, sample timestamps: ${samples}`,
      );
    } else {
      console.log(
        `[browser-backfill] ${cleanHandle}: 0 tweets extracted`,
      );
    }
    return out;
  } catch (err) {
    console.warn(
      `[browser-backfill] error scraping ${cleanHandle}:`,
      err instanceof Error ? err.message : String(err),
    );
    return [];
  }
}

// ── Convert to CollectedNewsItem ──────────────────────────────────────────

interface CollectedNewsItem {
  item_id: string;
  source: string;
  source_domain: string;
  headline: string;
  body: string;
  url: string;
  image_url?: string | null;
  video_url?: string | null;
  tier: "breaking" | "standard" | "commentary";
  published_at: string;
  fetched_at: string;
  fetch_latency_ms: number;
  ingest_pipeline?: string;
}

function tweetToCollectedItem(
  tw: ExtractedTweet,
  tier: "breaking" | "standard" | "commentary",
): CollectedNewsItem | null {
  const headline = tw.text.length > 220 ? tw.text.slice(0, 220) : tw.text;
  if (headline.trim().length < MIN_TWEET_LENGTH) return null;

  return {
    item_id: tw.tweet_id,
    source: `twitter:${tw.author_handle}`,
    source_domain: "x.com",
    headline,
    body: tw.text,
    url: tw.permalink,
    image_url: tw.image_url ?? null,
    video_url: tw.video_url ?? null,
    tier,
    published_at: tw.timestamp,
    fetched_at: new Date().toISOString(),
    fetch_latency_ms: 0,
    ingest_pipeline: "browser-backfill",
  };
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const fromMs = Date.parse(`${FROM}T00:00:00.000Z`);
  const toMs = Date.parse(`${TO}T23:59:59.999Z`);

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      script: "browser-backfill",
      dryRun: DRY_RUN,
      from: FROM,
      to: TO,
      writesFlag: process.env.FLAG_RISKFLOW_WORKER_WRITES_RISKFLOW,
    }),
  );

  const { withPersistentBrowserPage } =
    await import("../src/services/browser/index.js");
  const { writeCollectedItems } =
    await import("../src/workers/riskflow-worker/persist.js");
  const { getWireHandles, getBrowserHandles, getCommentaryHandles } =
    await import("../src/services/source-accounts/source-accounts-service.js");
  const { fetchEconCalendar } =
    await import("../src/services/econ-calendar-service.js");

  const [wire, macro, commentary] = await Promise.all([
    getWireHandles().catch(() => [] as string[]),
    getBrowserHandles().catch(() => [] as string[]),
    getCommentaryHandles().catch(() => [] as string[]),
  ]);

  console.log(
    `[browser-backfill] handles -- wire=${wire.length} macro=${macro.length} commentary=${commentary.length}`,
  );

  // Index by handle for tier lookup
  const wireSet = new Set(wire.map(stripHandle));
  const commentarySet = new Set(commentary.map(stripHandle));

  // Deduplicated unique handles (macro/browser as standard tier)
  const uniqueHandles = new Map<string, "breaking" | "standard" | "commentary">();
  for (const h of wire) {
    const c = stripHandle(h);
    if (c) uniqueHandles.set(c, "breaking");
  }
  for (const h of macro) {
    const c = stripHandle(h);
    if (c && !uniqueHandles.has(c)) uniqueHandles.set(c, "standard");
  }
  for (const h of commentary) {
    const c = stripHandle(h);
    if (c && !uniqueHandles.has(c)) uniqueHandles.set(c, "commentary");
  }

  console.log(`[browser-backfill] unique handles to scrape: ${uniqueHandles.size}`);

  // ── Scrape profile pages (per-handle browser session for crash resilience) ──

  let totalExtracted = 0;
  let totalWritten = 0;
  const allItems: CollectedNewsItem[] = [];

  const handleEntries = [...uniqueHandles.entries()];
  let handleIdx = 0;

  for (const [handle, tier] of handleEntries) {
    handleIdx++;

    let tweets: ExtractedTweet[] = [];
    try {
      tweets = await withPersistentBrowserPage(
        async (page) => scrapeProfileTweets(page, handle),
      );
    } catch (err) {
      console.warn(
        `[browser-backfill] session error for ${handle}, retrying once:`,
        err instanceof Error ? err.message : String(err),
      );
      // Retry once with a fresh session
      try {
        await new Promise((r) => setTimeout(r, 2000));
        tweets = await withPersistentBrowserPage(
          async (page) => scrapeProfileTweets(page, handle),
        );
      } catch (retryErr) {
        console.error(
          `[browser-backfill] ${handle}: retry also failed, skipping`,
          retryErr instanceof Error ? retryErr.message : String(retryErr),
        );
        continue;
      }
    }

    totalExtracted += tweets.length;

    // Filter to date window
    const inWindow = tweets.filter((tw) => {
      const ts = Date.parse(tw.timestamp);
      return Number.isFinite(ts) && ts >= fromMs && ts <= toMs;
    });

    const items = inWindow
      .map((tw) => tweetToCollectedItem(tw, tier))
      .filter((it): it is CollectedNewsItem => it !== null);

    console.log(
      `[browser-backfill] ${handle} (${handleIdx}/${handleEntries.length}): ${tweets.length} scraped, ${inWindow.length} in window, ${items.length} eligible`,
    );

    allItems.push(...items);

    // Rate-limit pause between handles
    if (handleIdx < handleEntries.length) {
      await new Promise((r) => setTimeout(r, HANDLE_PAUSE_MS));
    }
  }

  console.log(
    `[browser-backfill] scrape complete: ${totalExtracted} total extracted across ${uniqueHandles.size} handles`,
  );
  console.log(
    `[browser-backfill] ${allItems.length} items in date window to write`,
  );

  if (DRY_RUN) {
    console.log("[browser-backfill] DRY_RUN -- skipping writes");
    // Show a sample
    for (const item of allItems.slice(0, 5)) {
      console.log(`  ${item.published_at} @${item.source} ${item.headline.slice(0, 80)}`);
    }
  } else {
    // Write in batches of 100
    const BATCH_SIZE = 100;
    for (let i = 0; i < allItems.length; i += BATCH_SIZE) {
      const batch = allItems.slice(i, i + BATCH_SIZE);
      const written = await writeCollectedItems(batch);
      totalWritten += written;
      console.log(
        `[browser-backfill] batch ${Math.floor(i / BATCH_SIZE) + 1}: ${written}/${batch.length} written`,
      );
      if (i + BATCH_SIZE < allItems.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    console.log(`[browser-backfill] total written: ${totalWritten}`);
  }

  // ── Inject econ calendar prints ──────────────────────────────────────

  const events = await fetchEconCalendar({ from: FROM, to: TO });
  let econInjected = 0;
  const { injectEconPrintToFeed } =
    await import("../src/services/riskflow/econ-bridge.js");

  for (const ev of events) {
    if (!ev.actual || ev.actual.trim() === "") continue;
    const actual = parseFloat(String(ev.actual).replace(/,/g, ""));
    if (!Number.isFinite(actual)) continue;
    const forecast = ev.forecast
      ? parseFloat(String(ev.forecast).replace(/,/g, ""))
      : undefined;
    const previous = ev.previous
      ? parseFloat(String(ev.previous).replace(/,/g, ""))
      : undefined;
    const date = (ev.date ?? FROM).slice(0, 10);
    try {
      await injectEconPrintToFeed({
        eventName: ev.name,
        actual,
        forecast: Number.isFinite(forecast!) ? forecast : undefined,
        previous: Number.isFinite(previous!) ? previous : undefined,
        date,
      });
      econInjected++;
    } catch (err) {
      console.warn(
        `[browser-backfill] econ inject skip: ${ev.name}`,
        err instanceof Error ? err.message : err,
      );
    }
    await new Promise((r) => setTimeout(r, 80));
  }

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      script: "browser-backfill",
      stage: "complete",
      handlesScraped: uniqueHandles.size,
      totalExtracted,
      itemsInWindow: allItems.length,
      itemsWritten: totalWritten,
      econInjectAttempts: econInjected,
      calendarRowsInRange: events.length,
      dryRun: DRY_RUN,
    }),
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[browser-backfill] fatal", err);
    process.exit(1);
  });
