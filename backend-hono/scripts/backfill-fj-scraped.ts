#!/usr/bin/env bun
/**
 * FJ Historical Backfill — Firecrawl Pre-Scraped Data
 *
 * Loads 625 FJ headlines already scraped via Firecrawl (stored at .firecrawl/fj-combined-headlines.json)
 * and pushes them through the bulk-ingest API endpoint.
 *
 * Data sources: financialjuice.com sitemap (389 URLs) + x.com/financialjuice search results (236 tweets)
 * Category breakdown: 134 geopolitical, 99 econ data, 71 fed commentary, 34 political, 287 other
 *
 * Usage: cd backend-hono && bun run scripts/backfill-fj-scraped.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const BACKFILL_FILE = resolve(
  import.meta.dir,
  "../../.firecrawl/fj-combined-headlines.json",
);
const API_BASE = process.env.API_BASE || "http://localhost:8080";
const BATCH_SIZE = 50;

interface FJItem {
  id: string;
  headline: string;
  source: string;
  url: string;
}

async function main() {
  let raw: { total: number; items: FJItem[] };
  try {
    raw = JSON.parse(readFileSync(BACKFILL_FILE, "utf-8"));
  } catch (err) {
    console.error(
      `[backfill] Failed to read ${BACKFILL_FILE}:`,
      (err as Error).message,
    );
    process.exit(1);
  }

  const items = raw.items;
  console.log(
    `[backfill] Loaded ${items.length} headlines from Firecrawl scrape`,
  );

  let stored = 0;
  let batchNum = 0;

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    batchNum++;
    const batch = items.slice(i, i + BATCH_SIZE);
    const rawText = batch.map((item) => item.headline).join("\n\n");

    try {
      const response = await fetch(`${API_BASE}/api/calibration/bulk-ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rawText,
          instrument: "/ES",
          source: "backfill",
        }),
      });

      if (!response.ok) {
        console.error(
          `[backfill] Batch ${batchNum} failed: HTTP ${response.status}`,
        );
        continue;
      }

      const result = (await response.json()) as {
        stored?: number;
        parsed?: number;
      };
      const batchStored = result.stored ?? 0;
      stored += batchStored;
      console.log(
        `[backfill] Batch ${batchNum}: ${batch.length} headlines → ${batchStored} stored`,
      );
    } catch (err) {
      console.error(
        `[backfill] Batch ${batchNum} network error:`,
        (err as Error).message,
      );
    }
  }

  console.log(`[backfill] Done. Total stored: ${stored}`);
}

main().catch(console.error);
