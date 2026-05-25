#!/usr/bin/env node
// RiskFlow pass-through scorer — copies raw items to scored table with
// default sentiment/IV scores. Runs on a 30s loop. No Claude dependency.
//
// Usage: npx tsx scripts/riskflow-scorer.ts

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "..", ".env") });

const LOOP_MS = 30_000;

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    log("FATAL: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");
    process.exit(1);
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });

  while (true) {
    try {
      const { data: raw } = await sb
        .from("raw_riskflow_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!raw || raw.length === 0) {
        await sleep(LOOP_MS);
        continue;
      }

      let written = 0;
      for (const r of raw) {
        const { error } = await sb.from("scored_riskflow_items").upsert(
          {
            tweet_id: r.tweet_id,
            headline: r.headline || r.body || "",
            source: r.source || "",
            symbols: r.symbols || [],
            tags: r.tags || [],
            is_breaking: r.is_breaking || false,
            urgency: r.urgency || "normal",
            published_at: r.published_at || new Date().toISOString(),
            image_url: r.image_url ?? null,
            video_url: r.video_url ?? null,
            sentiment: "neutral",
            iv_score: 3,
            macro_level: 2,
            scored_by: "passthrough-worker",
            analyzed_at: new Date().toISOString(),
          },
          { onConflict: "tweet_id", ignoreDuplicates: true },
        );
        if (!error) written++;
      }

      if (written > 0) {
        log(`Scored ${written} items`);
      }
    } catch (err) {
      log(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }

    await sleep(LOOP_MS);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
