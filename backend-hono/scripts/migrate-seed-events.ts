#!/usr/bin/env bun
// [claude-code 2026-03-29] One-time migration: seed events JSON → scored_riskflow_items + narrative_card_links
// Run: cd backend-hono && bun run scripts/migrate-seed-events.ts

import seedEvents from "../../frontend/data/narrative-seed-events.json";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function migrate() {
  console.log(`Migrating ${(seedEvents as any[]).length} seed events...`);

  // First, discover actual columns to avoid schema cache misses
  const { data: probe, error: probeErr } = await sb
    .from("scored_riskflow_items")
    .select("*")
    .limit(1);

  if (probeErr) {
    console.error("Cannot probe scored_riskflow_items:", probeErr.message);
    return;
  }
  const knownCols = new Set(
    probe && probe.length > 0 ? Object.keys(probe[0]) : [],
  );
  console.log("Known columns:", [...knownCols].sort().join(", "));

  // Build items with only columns that exist
  const scoredItems = (seedEvents as any[]).map((e: any) => {
    const row: Record<string, any> = {
      tweet_id: e.id,
      source: "SeedEvent",
      headline: e.title,
      body: e.description ?? "",
      symbols: e.instruments ?? [],
      tags: e.tags ?? [],
      is_breaking: false,
      urgency: "normal",
      published_at: new Date(e.date).toISOString(),
      sentiment: e.sentiment === "bullish" ? "Bullish" : "Bearish",
      iv_score:
        e.severity === "high" ? 7.0 : e.severity === "medium" ? 4.0 : 2.0,
      macro_level: e.severity === "high" ? 3 : e.severity === "medium" ? 2 : 1,
      analyzed_at: new Date().toISOString(),
      scored_by: "seed-migration",
    };
    // Only include columns the table actually has
    return Object.fromEntries(
      Object.entries(row).filter(([k]) => knownCols.has(k)),
    );
  });

  // Upsert scored items
  const { data, error } = await sb
    .from("scored_riskflow_items")
    .upsert(scoredItems, { onConflict: "tweet_id", ignoreDuplicates: true })
    .select("tweet_id");

  if (error) {
    console.error("Failed to insert scored items:", error.message);
    return;
  }
  console.log(`Inserted ${data?.length ?? 0} scored items`);

  // Build narrative_card_links
  const links: Array<{
    card_id: string;
    thread_slug: string;
    confidence: number;
  }> = [];
  for (const e of seedEvents as any[]) {
    const threads: string[] =
      e.narrativeThreads ?? (e.narrative ? [e.narrative] : []);
    for (const thread of threads) {
      links.push({ card_id: e.id, thread_slug: thread, confidence: 1.0 });
    }
  }

  if (links.length > 0) {
    const { error: linkError } = await sb
      .from("narrative_card_links")
      .upsert(links, {
        onConflict: "card_id,thread_slug",
        ignoreDuplicates: true,
      });

    if (linkError) {
      console.error("Failed to insert narrative links:", linkError.message);
    } else {
      console.log(`Inserted ${links.length} narrative_card_links`);
    }
  }

  console.log("Migration complete.");
}

migrate().catch(console.error);
