#!/usr/bin/env bun
// backfill-narrative-seeds.ts — Reads calibration observations from Supabase,
// classifies into NarrativeFlow categories + narrative themes via Claude CLI,
// writes to frontend/data/narrative-seed-events.json
//
// Usage: bun run scripts/backfill-narrative-seeds.ts [--dry-run]
//
// Processes in batches of 40 headlines per Claude CLI call.
// Each batch gets classified into: category, severity, sentiment, narrative theme, tags.

import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DRY_RUN = process.argv.includes("--dry-run");
const CLAUDE_PATH = "/Users/tifos/.local/bin/claude";
const SEED_FILE = join(
  import.meta.dir,
  "..",
  "..",
  "frontend",
  "data",
  "narrative-seed-events.json",
);
const BATCH_SIZE = 40;

// Load .env
try {
  const envText = readFileSync(join(import.meta.dir, "..", ".env"), "utf-8");
  for (const line of envText.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {}

const sbUrl = process.env.SUPABASE_URL ?? "";
const sbKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
if (!sbUrl || !sbKey) {
  console.error("No Supabase credentials");
  process.exit(1);
}

const supabase = createClient(sbUrl, sbKey);

// Category mapping for known eventTypes
const EVENT_TYPE_TO_CATEGORY: Record<string, string> = {
  fedDecision: "monetary",
  geopolitical: "geopolitical",
  politicalCommentary: "geopolitical",
  tariffs: "geopolitical",
  chinaTrade: "geopolitical",
  cpiPrint: "macroeconomic",
  ppiPrint: "macroeconomic",
  nfpPrint: "macroeconomic",
  ismPrint: "macroeconomic",
  jobless: "macroeconomic",
  gdpPrint: "macroeconomic",
  retailSales: "macroeconomic",
  housing: "macroeconomic",
  sectorNews: "earnings",
  earnings: "earnings",
};

interface ClassifiedItem {
  id: string;
  title: string;
  description: string;
  date: string;
  category: string;
  severity: string;
  sentiment: string;
  direction: string;
  instruments: string[];
  tags: string[];
  narrative: string; // the broader narrative theme
}

function classifyViaClaudeCli(
  headlines: Array<{
    id: string;
    headline: string;
    eventType: string;
    createdAt: string;
  }>,
): ClassifiedItem[] {
  const headlineList = headlines
    .map((h, i) => `${i}|${h.id}|${h.headline}|${h.eventType}`)
    .join("\n");

  const prompt = `You are classifying financial news headlines for a trading narrative board.

For each headline below, output a JSON array where each item has:
- id: the ID from the input
- title: cleaned headline (remove emojis, source prefixes like "FinancialJuice")
- description: one sentence expanding on the headline's market significance
- date: best estimate of the event date (YYYY-MM-DD). Use the eventType and headline context. If you can't determine the date, use "2026-03-01" as default.
- category: one of [geopolitical, monetary, macroeconomic, earnings, market-structure, supply-chain, black-swan]
- severity: one of [low, medium, high]
- sentiment: one of [bullish, bearish, neutral]
- direction: one of [bullish, bearish, neutral]
- instruments: array of affected tickers ["/NQ", "/ES", "/ZN", "DXY", etc.]
- tags: array of 2-4 relevant tags
- narrative: the broader narrative theme this belongs to (e.g. "Trump Tariff War", "Fed Rate Cycle", "Middle East Tensions", "AI Disruption", "Bond Market Stress", "Labor Market Weakening")

IMPORTANT: Group items into coherent NARRATIVES. Headlines about the same storyline should share the same "narrative" value. Think of narratives as lanes on a trading board — each lane tracks one evolving story.

Headlines (format: index|id|headline|eventType):
${headlineList}

Return ONLY a valid JSON array, no markdown fences, no explanation.`;

  try {
    const result = execFileSync(
      CLAUDE_PATH,
      ["-p", prompt, "--model", "sonnet", "--output-format", "text"],
      { timeout: 180000, maxBuffer: 2 * 1024 * 1024, encoding: "utf-8" },
    );

    // Extract JSON from response
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error("No JSON array found in Claude response");
      return [];
    }
    return JSON.parse(jsonMatch[0]) as ClassifiedItem[];
  } catch (e) {
    console.error(
      "Claude CLI failed:",
      e instanceof Error ? e.message : "unknown",
    );
    return [];
  }
}

// Narrative theme detection from headline text
const NARRATIVE_PATTERNS: Array<{
  pattern: RegExp;
  narrative: string;
  category: string;
  tags: string[];
}> = [
  // Geopolitical
  {
    pattern: /tariff|25%|reciprocal|trade.war|import.dut/i,
    narrative: "Trump Tariff War",
    category: "geopolitical",
    tags: ["tariffs", "trade-war"],
  },
  {
    pattern: /china|beijing|xi jinping|us.cn|sino/i,
    narrative: "US-China Trade Tensions",
    category: "geopolitical",
    tags: ["china", "trade"],
  },
  {
    pattern: /israel|iran|houthi|hezbollah|hamas|gaza|middle.east|irgc|yemen/i,
    narrative: "Middle East Tensions",
    category: "geopolitical",
    tags: ["middle-east", "geopolitical"],
  },
  {
    pattern: /russia|ukraine|putin|zelensky|ceasefire|nato/i,
    narrative: "Russia-Ukraine Conflict",
    category: "geopolitical",
    tags: ["russia", "ukraine"],
  },
  {
    pattern: /eu.tariff|europe.*trade|eu.*deal|european.commission/i,
    narrative: "EU Trade Relations",
    category: "geopolitical",
    tags: ["eu", "trade"],
  },
  {
    pattern: /trump.*fire.*powell|powell.*fire|fed.independence/i,
    narrative: "Fed Independence Crisis",
    category: "monetary",
    tags: ["powell", "trump", "fed"],
  },
  {
    pattern: /bessent|treasury.sec|yellen/i,
    narrative: "Treasury Policy",
    category: "geopolitical",
    tags: ["treasury", "bessent"],
  },
  {
    pattern: /canada|mexico|usmca|nafta/i,
    narrative: "North America Trade",
    category: "geopolitical",
    tags: ["canada", "mexico", "trade"],
  },
  // Monetary
  {
    pattern: /fed.*cut|rate.*cut|fomc|fed.*decision|powell.*speak|dot.plot/i,
    narrative: "Fed Rate Cycle",
    category: "monetary",
    tags: ["fed", "rates"],
  },
  {
    pattern: /hawkish|dovish|monetary.policy|tighten|easing/i,
    narrative: "Fed Rate Cycle",
    category: "monetary",
    tags: ["fed", "policy"],
  },
  // Macro
  {
    pattern: /cpi|consumer.price|inflation.*data/i,
    narrative: "Inflation Watch",
    category: "macroeconomic",
    tags: ["cpi", "inflation"],
  },
  {
    pattern: /ppi|producer.price/i,
    narrative: "Inflation Watch",
    category: "macroeconomic",
    tags: ["ppi", "inflation"],
  },
  {
    pattern: /nfp|payroll|jobs.*report|employment.*situation|unemployment/i,
    narrative: "Labor Market Pulse",
    category: "macroeconomic",
    tags: ["nfp", "jobs"],
  },
  {
    pattern: /gdp|gross.domestic/i,
    narrative: "Growth Outlook",
    category: "macroeconomic",
    tags: ["gdp", "growth"],
  },
  {
    pattern: /ism|pmi|manufacturing.*index|services.*index/i,
    narrative: "Growth Outlook",
    category: "macroeconomic",
    tags: ["pmi", "manufacturing"],
  },
  {
    pattern: /retail.sales|consumer.spend/i,
    narrative: "Consumer Strength",
    category: "macroeconomic",
    tags: ["retail", "consumer"],
  },
  {
    pattern: /jobless.*claim|initial.*claim|continuing.*claim/i,
    narrative: "Labor Market Pulse",
    category: "macroeconomic",
    tags: ["claims", "jobs"],
  },
  {
    pattern: /housing|home.sale|building.permit|mortgage/i,
    narrative: "Housing & Real Estate",
    category: "macroeconomic",
    tags: ["housing"],
  },
  // Market Structure
  {
    pattern:
      /treasury.*auction|bond.*auction|10.year.*auction|2.year.*auction/i,
    narrative: "Bond Market Stress",
    category: "market-structure",
    tags: ["bonds", "auction"],
  },
  {
    pattern: /yield.*curve|2y.*10y|2s10s|inversion|steepen/i,
    narrative: "Bond Market Stress",
    category: "market-structure",
    tags: ["yield-curve", "bonds"],
  },
  {
    pattern: /treasury.*yield|10.year.*yield|bond.*yield|tn[ox]/i,
    narrative: "Bond Market Stress",
    category: "market-structure",
    tags: ["yields", "bonds"],
  },
  {
    pattern: /vix|volatility.*index|fear.*index/i,
    narrative: "Volatility Regime",
    category: "market-structure",
    tags: ["vix", "volatility"],
  },
  {
    pattern: /fitch|moody|s&p.*rating|credit.*downgrade|credit.*rating/i,
    narrative: "Credit & Ratings",
    category: "market-structure",
    tags: ["credit", "rating"],
  },
  {
    pattern: /dollar.*index|dxy|usd.*strength|greenback/i,
    narrative: "Dollar Dynamics",
    category: "market-structure",
    tags: ["dxy", "dollar"],
  },
  {
    pattern: /yen|jpy|boj|bank.of.japan|carry.trade/i,
    narrative: "Yen Carry Trade",
    category: "market-structure",
    tags: ["yen", "japan"],
  },
  // Earnings / Sector
  {
    pattern: /nvda|nvidia|ai.*chip|gpu|semiconductor/i,
    narrative: "AI & Semiconductors",
    category: "earnings",
    tags: ["nvidia", "ai", "chips"],
  },
  {
    pattern: /deepseek|chinese.*ai|ai.*model/i,
    narrative: "AI Disruption",
    category: "earnings",
    tags: ["ai", "deepseek", "china"],
  },
  {
    pattern: /earnings|eps|revenue.*beat|revenue.*miss|guidance/i,
    narrative: "Earnings Season",
    category: "earnings",
    tags: ["earnings"],
  },
  {
    pattern:
      /aapl|apple|msft|microsoft|googl|alphabet|amzn|amazon|meta|tsla|tesla/i,
    narrative: "Mag 7 Earnings",
    category: "earnings",
    tags: ["mega-cap", "earnings"],
  },
  // Energy
  {
    pattern: /oil|crude|opec|wti|brent|energy.*price|petroleum/i,
    narrative: "Energy Markets",
    category: "supply-chain",
    tags: ["oil", "energy"],
  },
  {
    pattern: /natural.gas|lng|pipeline/i,
    narrative: "Energy Markets",
    category: "supply-chain",
    tags: ["natgas", "energy"],
  },
  // Crypto
  {
    pattern: /bitcoin|btc|crypto|ethereum|digital.asset/i,
    narrative: "Crypto Cycle",
    category: "market-structure",
    tags: ["crypto", "bitcoin"],
  },
];

function classifyByKeyword(h: {
  id: string;
  headline: string;
  eventType: string;
  createdAt: string;
}): ClassifiedItem {
  const text = h.headline.toLowerCase();

  // Try narrative pattern matching first
  let narrative = "Market Commentary";
  let cat = EVENT_TYPE_TO_CATEGORY[h.eventType] ?? "macroeconomic";
  let matchedTags: string[] = [];

  for (const np of NARRATIVE_PATTERNS) {
    if (np.pattern.test(h.headline)) {
      narrative = np.narrative;
      cat = np.category;
      matchedTags = np.tags;
      break;
    }
  }

  // Fall back to eventType-based narrative name if no pattern matched
  if (narrative === "Market Commentary" && h.eventType !== "other") {
    const TYPE_NARRATIVES: Record<string, string> = {
      fedDecision: "Fed Rate Cycle",
      geopolitical: "Geopolitical Risk",
      politicalCommentary: "Political Landscape",
      tariffs: "Trump Tariff War",
      chinaTrade: "US-China Trade Tensions",
      cpiPrint: "Inflation Watch",
      ppiPrint: "Inflation Watch",
      nfpPrint: "Labor Market Pulse",
      ismPrint: "Growth Outlook",
      gdpPrint: "Growth Outlook",
      jobless: "Labor Market Pulse",
      retailSales: "Consumer Strength",
      housing: "Housing & Real Estate",
      sectorNews: "Sector Rotation",
      earnings: "Earnings Season",
    };
    narrative = TYPE_NARRATIVES[h.eventType] ?? "Market Commentary";
  }

  let sentiment: string = "neutral";
  if (
    /surge|rally|beat|strong|positive|bullish|rip|soar|jump|green|record.high/.test(
      text,
    )
  )
    sentiment = "bullish";
  if (
    /crash|plunge|miss|weak|negative|bearish|drop|down|sell|tumble|plummet|red|decline|fall/.test(
      text,
    )
  )
    sentiment = "bearish";

  let severity: string = "medium";
  if (
    /emergency|crash|crisis|war|invasion|flash|plunge|circuit.breaker|black.swan|systemic|breaking/i.test(
      text,
    )
  )
    severity = "high";
  if (/slight|minor|modest|little|small|unchanged|steady|flat/.test(text))
    severity = "low";

  const instruments: string[] = ["/NQ", "/ES"];
  if (/bond|treasury|yield|10.year|2.year|zn|zb|tnx/i.test(text))
    instruments.push("/ZN");
  if (/oil|crude|cl|opec|wti|brent/i.test(text)) instruments.push("/CL");
  if (/dollar|dxy|yen|jpy|euro|eur/i.test(text)) instruments.push("DXY");
  if (/gold|xau|gc/i.test(text)) instruments.push("/GC");

  const tags = [
    ...new Set(
      [
        ...matchedTags,
        h.eventType !== "other" ? h.eventType : undefined,
      ].filter(Boolean) as string[],
    ),
  ];

  return {
    id: h.id,
    title: h.headline
      .replace(/^[🔴🟡🟢⚪️📊💹📉📈🚨]+\s*/, "")
      .replace(/\s*-\s*FinancialJuice.*$/, "")
      .trim(),
    description: h.headline,
    date: h.createdAt.slice(0, 10),
    category: cat,
    severity,
    sentiment,
    direction: sentiment,
    instruments,
    tags,
    narrative,
  };
}

async function main() {
  console.log("Fetching all calibration observations from Supabase...");

  const { data: observations, error } = await supabase
    .from("calibration_observations")
    .select("id, headline, event_type, instrument, source, created_at")
    .order("created_at", { ascending: true })
    .limit(1000);

  if (error) {
    console.error("Supabase error:", error.message);
    process.exit(1);
  }

  const obs = (observations ?? []).map((o) => ({
    id: o.id,
    headline: o.headline,
    eventType: o.event_type,
    instrument: o.instrument,
    createdAt: o.created_at,
  }));

  console.log(`Fetched ${obs.length} observations`);

  // Filter out Japanese text and very short headlines
  const usable = obs.filter(
    (o) =>
      o.headline.length > 15 &&
      !/^[\u3000-\u9FFF\uF900-\uFAFF]/.test(o.headline), // skip JP-leading
  );
  console.log(
    `Usable headlines: ${usable.length} (filtered ${obs.length - usable.length} JP/short)`,
  );

  // Split into known-type (keyword classify) and "other" (needs Claude)
  const knownType = usable.filter(
    (o) => o.eventType !== "other" && EVENT_TYPE_TO_CATEGORY[o.eventType],
  );
  const needsAI = usable.filter(
    (o) => o.eventType === "other" || !EVENT_TYPE_TO_CATEGORY[o.eventType],
  );

  console.log(
    `Known type: ${knownType.length}, needs AI classification: ${needsAI.length}`,
  );

  // Classify known types via keywords (instant)
  const keywordResults = knownType.map(classifyByKeyword);
  console.log(`Keyword classified: ${keywordResults.length}`);

  // Classify "other" via Claude CLI in batches
  const aiResults: ClassifiedItem[] = [];
  if (!DRY_RUN) {
    const batches = Math.ceil(needsAI.length / BATCH_SIZE);
    for (let i = 0; i < batches; i++) {
      const batch = needsAI.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      console.log(`\nBatch ${i + 1}/${batches} (${batch.length} headlines)...`);
      const results = classifyViaClaudeCli(batch);
      aiResults.push(...results);
      console.log(`  → Classified ${results.length} items`);
      // Rate limit: 2s between batches
      if (i < batches - 1) await new Promise((r) => setTimeout(r, 2000));
    }
  } else {
    console.log("DRY RUN — skipping Claude CLI classification");
    aiResults.push(...needsAI.map(classifyByKeyword));
  }

  // Merge all results
  const allItems = [...keywordResults, ...aiResults];
  console.log(`\nTotal classified: ${allItems.length}`);

  // Load existing seed events (preserve manually curated ones)
  let existing: any[] = [];
  try {
    existing = JSON.parse(readFileSync(SEED_FILE, "utf-8"));
    console.log(`Existing seed events: ${existing.length}`);
  } catch {
    console.log("No existing seed file");
  }

  // Deduplicate by title similarity (skip if headline already exists)
  const existingTitles = new Set(
    existing.map((e: any) => e.title.toLowerCase().slice(0, 40)),
  );
  const newItems = allItems.filter(
    (item) => !existingTitles.has(item.title.toLowerCase().slice(0, 40)),
  );
  console.log(`New items after dedup: ${newItems.length}`);

  // Assign sequential IDs
  const startId = existing.length + 1;
  const finalItems = newItems.map((item, i) => ({
    ...item,
    id: `seed-${String(startId + i).padStart(3, "0")}`,
    source: "calibration-backfill",
    status: "resolved",
  }));

  // Merge with existing
  const merged = [...existing, ...finalItems];
  console.log(`Final seed file: ${merged.length} events`);

  // Write
  writeFileSync(SEED_FILE, JSON.stringify(merged, null, 2) + "\n");
  console.log(`Written to ${SEED_FILE}`);

  // Stats
  const narratives = new Map<string, number>();
  for (const item of finalItems) {
    narratives.set(item.narrative, (narratives.get(item.narrative) ?? 0) + 1);
  }
  console.log("\nNarrative themes:");
  for (const [theme, count] of [...narratives.entries()].sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${theme}: ${count}`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
