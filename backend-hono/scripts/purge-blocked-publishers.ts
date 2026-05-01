/**
 * S55: Purge blocked-publisher rows from raw_riskflow_items and scored_riskflow_items.
 * Dry-run first (count + sample), then confirm purge.
 * Run: bun run scripts/purge-blocked-publishers.ts [--confirm]
 */
import { getSupabaseClient } from "../src/config/supabase.js";

const BLOCKED_HOSTS = [
  "reuters.com",
  "bloomberg.com",
  "bloomberglaw.com",
  "bloombergquint.com",
  "cnbc.com",
  "foxnews.com",
  "foxbusiness.com",
  "msnbc.com",
  "cnn.com",
  "marketwatch.com",
  "ft.com",
  "wsj.com",
  "barrons.com",
  "nbcnews.com",
  "abcnews.go.com",
  "cbsnews.com",
  "usatoday.com",
  "businessinsider.com",
  "insider.com",
  "yahoo.com",
  "finance.yahoo.com",
  "seekingalpha.com",
  "zerohedge.com",
  "benzinga.com",
  "fool.com",
  "investopedia.com",
  "nytimes.com",
  "washingtonpost.com",
  "bbc.com",
  "bbc.co.uk",
  "theguardian.com",
  "economist.com",
  "aljazeera.com",
  "axios.com",
  "politico.com",
  "semafor.com",
  "theinformation.com",
  "punchbowl.news",
  "puck.news",
  "dailywire.com",
  "newsmax.com",
  "oann.com",
  "motherjones.com",
  "slate.com",
  "salon.com",
  "thehill.com",
  "npr.org",
  "pbs.org",
  "thedailybeast.com",
  "newsweek.com",
  "dailymail.co.uk",
  "huffpost.com",
  "huffingtonpost.com",
  "buzzfeed.com",
  "buzzfeednews.com",
  "vox.com",
];

// Approved gov/data domains — these REMAIN untouched
const GOV_WHITELIST = [
  "bls.gov",
  "federalreserve.gov",
  "newyorkfed.org",
  "atlantafed.org",
  "fred.stlouisfed.org",
  "bea.gov",
  "census.gov",
  "treasury.gov",
  "sec.gov",
  "cftc.gov",
  "dol.gov",
  "commerce.gov",
];

function hostnameOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isGovWhitelist(host: string): boolean {
  return GOV_WHITELIST.some((d) => host === d || host.endsWith("." + d));
}

function hostMatches(host: string, blocked: string): boolean {
  return host === blocked || host.endsWith("." + blocked);
}

function isBlocked(url: string | null | undefined): string | null {
  const host = hostnameOf(url);
  if (!host) return null;
  if (isGovWhitelist(host)) return null;
  return BLOCKED_HOSTS.find((d) => hostMatches(host, d)) ?? null;
}

async function getAllRows(
  table: string,
  sb: ReturnType<typeof getSupabaseClient>,
): Promise<any[]> {
  const all: any[] = [];
  const PAGE = 1000;
  let offset = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await sb!
      .from(table)
      .select("id, headline, source, url, published_at")
      .order("published_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (error) {
      console.error(`${table} query error:`, error.message);
      break;
    }
    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }
    all.push(...data);
    offset += data.length;
    if (data.length < PAGE) hasMore = false;
    console.error(`  ${table}: fetched ${all.length} rows so far...`);
  }
  return all;
}

async function main() {
  const confirm = process.argv.includes("--confirm");
  const sb = getSupabaseClient();
  if (!sb) {
    console.error("Supabase not configured");
    process.exit(1);
  }

  // ── AUDIT: scored_riskflow_items ──
  console.log("\n=== DRY-RUN AUDIT: scored_riskflow_items ===\n");
  const scoredAll = await getAllRows("scored_riskflow_items", sb);

  const scoredBlocked: Array<{
    id: string;
    headline: string;
    source: string;
    host: string;
    blocked: string;
  }> = [];
  for (const row of scoredAll ?? []) {
    const blocked = isBlocked(row.url);
    if (blocked) {
      scoredBlocked.push({
        id: row.id,
        headline: (row.headline ?? "").slice(0, 100),
        source: row.source ?? "unknown",
        host: hostnameOf(row.url) ?? "unknown",
        blocked,
      });
    }
  }

  console.log(
    `scored_riskflow_items: ${scoredAll?.length ?? 0} total, ${scoredBlocked.length} BLOCKED`,
  );
  for (const item of scoredBlocked.slice(0, 25)) {
    console.log(
      `  [${item.source}] ${item.host} → ${item.blocked} | ${item.headline}`,
    );
  }
  if (scoredBlocked.length > 25)
    console.log(`  ... +${scoredBlocked.length - 25} more`);

  // ── AUDIT: raw_riskflow_items ──
  console.log("\n=== DRY-RUN AUDIT: raw_riskflow_items ===\n");
  const rawAll = await getAllRows("raw_riskflow_items", sb);

  const rawBlocked: Array<{
    id: string;
    headline: string;
    source: string;
    host: string;
    blocked: string;
  }> = [];
  for (const row of rawAll ?? []) {
    const blocked = isBlocked(row.url);
    if (blocked) {
      rawBlocked.push({
        id: row.id,
        headline: (row.headline ?? "").slice(0, 100),
        source: row.source ?? "unknown",
        host: hostnameOf(row.url) ?? "unknown",
        blocked,
      });
    }
  }

  console.log(
    `raw_riskflow_items: ${rawAll?.length ?? 0} total, ${rawBlocked.length} BLOCKED`,
  );
  for (const item of rawBlocked.slice(0, 15)) {
    console.log(
      `  [${item.source}] ${item.host} → ${item.blocked} | ${item.headline}`,
    );
  }
  if (rawBlocked.length > 15)
    console.log(`  ... +${rawBlocked.length - 15} more`);

  const totalBlocked = scoredBlocked.length + rawBlocked.length;

  if (totalBlocked === 0) {
    console.log("\n✓ No blocked publisher rows found. Database is clean.");
    process.exit(0);
  }

  // ── Source breakdown ──
  console.log("\n=== Blocked by source ===\n");
  const bySource = new Map<string, number>();
  for (const item of [...scoredBlocked, ...rawBlocked]) {
    bySource.set(item.source, (bySource.get(item.source) ?? 0) + 1);
  }
  for (const [src, count] of Array.from(bySource.entries()).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${src}: ${count}`);
  }

  if (!confirm) {
    console.log(
      `\nPURGE REQUIRED: ${totalBlocked} total blocked rows across scored + raw tables.`,
    );
    console.log("Run with --confirm to execute the purge:");
    console.log("  bun run scripts/purge-blocked-publishers.ts --confirm");
    process.exit(1);
  }

  // ── PURGE ──
  console.log("\n=== PURGING (confirm=true) ===\n");

  // Delete from scored_riskflow_items
  if (scoredBlocked.length > 0) {
    const scoredIds = scoredBlocked.map((r) => r.id);
    // Batch delete in chunks of 200
    let scoredDeleted = 0;
    for (let i = 0; i < scoredIds.length; i += 200) {
      const chunk = scoredIds.slice(i, i + 200);
      const { error, count } = await sb
        .from("scored_riskflow_items")
        .delete({ count: "exact" })
        .in("id", chunk);
      if (error) {
        console.error(`scored delete chunk ${i} error:`, error.message);
      } else {
        scoredDeleted += count ?? 0;
      }
    }
    console.log(`scored_riskflow_items: deleted ${scoredDeleted} rows`);
  }

  // Delete from raw_riskflow_items
  if (rawBlocked.length > 0) {
    const rawIds = rawBlocked.map((r) => r.id);
    let rawDeleted = 0;
    for (let i = 0; i < rawIds.length; i += 200) {
      const chunk = rawIds.slice(i, i + 200);
      const { error, count } = await sb
        .from("raw_riskflow_items")
        .delete({ count: "exact" })
        .in("id", chunk);
      if (error) {
        console.error(`raw delete chunk ${i} error:`, error.message);
      } else {
        rawDeleted += count ?? 0;
      }
    }
    console.log(`raw_riskflow_items: deleted ${rawDeleted} rows`);
  }

  console.log(
    `\n✓ Purge complete. Deleted ${scoredBlocked.length + rawBlocked.length} rows.`,
  );

  // Verify
  console.log("\n=== POST-PURGE VERIFICATION ===\n");
  const verifyScored = await getAllRows("scored_riskflow_items", sb);

  let remaining = 0;
  for (const row of verifyScored ?? []) {
    if (isBlocked(row.url)) {
      remaining++;
      if (remaining <= 5)
        console.log(
          `  REMAINING: [${row.source}] ${row.headline?.slice(0, 80)}`,
        );
    }
  }
  if (remaining > 0) {
    console.log(
      `\n⚠ WARNING: ${remaining} blocked rows still remain (may need broader sweep)`,
    );
    process.exit(2);
  }
  console.log(
    "✓ Verified: zero blocked publisher rows in scored_riskflow_items.",
  );
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
