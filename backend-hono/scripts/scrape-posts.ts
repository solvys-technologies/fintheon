// [claude-code 2026-03-26] FireCrawl scrape utility — fetch up to 500 posts from a single page
import "dotenv/config";
import FirecrawlApp from "@mendable/firecrawl-js";
import { writeFileSync } from "fs";
import { resolve } from "path";

// ── Config ──────────────────────────────────────────────────────────
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
if (!FIRECRAWL_API_KEY) {
  console.error("❌  Missing FIRECRAWL_API_KEY in .env");
  process.exit(1);
}

const TARGET_URL = process.argv[2];
if (!TARGET_URL) {
  console.error("Usage: bun run scripts/scrape-posts.ts <URL> [maxPages]");
  process.exit(1);
}

const MAX_PAGES = parseInt(process.argv[3] || "500", 10);

// ── FireCrawl client ────────────────────────────────────────────────
const fc = new FirecrawlApp({ apiKey: FIRECRAWL_API_KEY });

async function scrapePosts() {
  console.log(`\n🔥 Scraping: ${TARGET_URL}`);
  console.log(`   Max pages/posts: ${MAX_PAGES}\n`);

  // Option A: Single-page scrape (infinite scroll / load-more)
  console.log("── Attempting single-page scrape ──");
  const scrapeResult = await fc.scrapeUrl(TARGET_URL, {
    formats: ["markdown", "html"],
    waitFor: 5000, // wait 5s for JS/dynamic content
    timeout: 60000, // 60s timeout
  });

  if (scrapeResult.success) {
    const outPath = resolve("scripts/output", "scrape-single.json");
    ensureDir("scripts/output");
    writeFileSync(outPath, JSON.stringify(scrapeResult, null, 2));
    console.log(`✅ Single-page scrape saved → ${outPath}`);
    console.log(
      `   Markdown length: ${scrapeResult.markdown?.length ?? 0} chars`,
    );
  } else {
    console.error("❌ Single-page scrape failed:", scrapeResult);
  }

  // Option B: Crawl (follows links / pagination up to MAX_PAGES)
  console.log("\n── Attempting crawl (pagination) ──");
  const crawlResult = await fc.crawlUrl(TARGET_URL, {
    limit: MAX_PAGES,
    scrapeOptions: {
      formats: ["markdown"],
      waitFor: 3000,
    },
  });

  if (crawlResult.success) {
    const pages = crawlResult.data || [];
    const outPath = resolve("scripts/output", "crawl-posts.json");
    writeFileSync(outPath, JSON.stringify(pages, null, 2));
    console.log(`✅ Crawl complete → ${outPath}`);
    console.log(`   Pages fetched: ${pages.length}`);
  } else {
    console.error("❌ Crawl failed:", crawlResult);
  }

  console.log("\n🏁 Done.\n");
}

function ensureDir(dir: string) {
  const fullPath = resolve(dir);
  try {
    const { mkdirSync } = require("fs");
    mkdirSync(fullPath, { recursive: true });
  } catch {}
}

scrapePosts().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
