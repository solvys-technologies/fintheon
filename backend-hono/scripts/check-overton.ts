import { getSupabaseClient } from "../src/config/supabase.js";

const sb = getSupabaseClient();
if (!sb) {
  console.log("no supabase");
  process.exit(1);
}

console.log("=== Source accounts containing 'overton' ===");
const { data: accts } = await sb
  .from("riskflow_source_accounts")
  .select("*")
  .ilike("handle", "%overton%");
console.log(JSON.stringify(accts, null, 2));

console.log("\n=== raw_riskflow_items with 'overton' in headline ===");
const { data: raw } = await sb
  .from("raw_riskflow_items")
  .select("id,headline,source,url")
  .ilike("headline", "%overton%")
  .limit(10);
console.log(raw?.length ?? 0, "matches");
for (const r of raw ?? [])
  console.log(`  [${r.source}] ${r.headline?.slice(0, 100)} | ${r.url}`);

console.log("\n=== scored_riskflow_items with 'overton' in headline ===");
const { data: scored } = await sb
  .from("scored_riskflow_items")
  .select("id,headline,source,url")
  .ilike("headline", "%overton%")
  .limit(10);
console.log(scored?.length ?? 0, "matches");
for (const r of scored ?? [])
  console.log(`  [${r.source}] ${r.headline?.slice(0, 100)} | ${r.url}`);

console.log("\n=== scored_riskflow_items with 'overton' in source ===");
const { data: scored2 } = await sb
  .from("scored_riskflow_items")
  .select("id,headline,source,url")
  .ilike("source", "%overton%")
  .limit(10);
console.log(scored2?.length ?? 0, "matches");
for (const r of scored2 ?? [])
  console.log(`  [${r.source}] ${r.headline?.slice(0, 100)} | ${r.url}`);
