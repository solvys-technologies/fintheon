// [claude-code 2026-03-28] One-time backfill script for market impact data
// Usage: cd backend-hono && npx tsx scripts/backfill-market-impact.ts

import "dotenv/config";
import { runMarketImpactEnrichment } from "../src/services/cron/market-impact-enricher.js";

const BATCH_DELAY_MS = 2000;

async function main() {
  console.log("[Backfill] Starting market impact backfill...");

  let totalProcessed = 0;
  let totalEnriched = 0;
  let totalErrors = 0;
  let batch = 0;

  while (true) {
    batch++;
    console.log(`[Backfill] Batch ${batch}...`);

    const result = await runMarketImpactEnrichment();
    totalProcessed += result.processed;
    totalEnriched += result.enriched;
    totalErrors += result.errors;

    console.log(
      `[Backfill] Batch ${batch}: ${result.enriched}/${result.processed} enriched, ${result.errors} errors`,
    );

    // If no items were processed, we're done
    if (result.processed === 0) {
      console.log("[Backfill] No more items to process.");
      break;
    }

    // Rate limit delay between batches
    await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
  }

  console.log(
    `[Backfill] Complete: ${totalEnriched}/${totalProcessed} enriched across ${batch} batches, ${totalErrors} errors`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("[Backfill] Fatal error:", err);
  process.exit(1);
});
