#!/usr/bin/env bun
// [claude-code 2026-04-24] S35-T5: TOTT/WT → TWT rename; legacy TOTT/WT alias (sunsets 2026-05-08)
// dispatch-brief.ts — Generate daily briefs via provider chain + POST to Supabase + iMessage
// Usage: bun run scripts/dispatch-brief.ts MDB|ADB|PMDB|TWT
// Standalone — does NOT require backend to be running.

import { createClient } from "@supabase/supabase-js";
import { execFileSync } from "child_process";
import { appendFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { generateViaChain } from "../src/services/ai/provider-chain.js";

// ── Config ──
type DispatchBriefType = "MDB" | "ADB" | "PMDB" | "TWT";

// S35-T5: legacy TOTT/WT alias sunsets 2026-05-08
function normalizeBriefType(raw: string): DispatchBriefType {
  const upper = raw.toUpperCase();
  if (upper === "TOTT" || upper === "WT") {
    console.log(
      `[dispatch-brief] legacy brief type alias normalized: received=${upper} normalizedTo=TWT`,
    );
    return "TWT";
  }
  return upper as DispatchBriefType;
}

const BRIEF_TYPE: DispatchBriefType = normalizeBriefType(
  process.argv[2] ?? "ADB",
);
const RECIPIENT = "+15618490392";
const LOG_DIR = join(import.meta.dir, "..", "logs");
const LOG_FILE = join(LOG_DIR, `dispatch-${BRIEF_TYPE.toLowerCase()}.log`);
const BRIEF_MODEL = process.env.DISPATCH_BRIEF_MODEL ?? "deepseek-reasoner";

mkdirSync(LOG_DIR, { recursive: true });

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

function sendIMessage(text: string) {
  try {
    execFileSync(
      "osascript",
      [
        "-e",
        `tell application "Messages" to send "${text.replace(/"/g, '\\"').replace(/\n/g, "\\n")}" to participant "${RECIPIENT}" of (1st account whose service type = iMessage)`,
      ],
      { timeout: 15000 },
    );
    log("iMessage sent successfully");
  } catch (e) {
    log(`iMessage send failed: ${e instanceof Error ? e.message : "unknown"}`);
  }
}

// ── Supabase Client ──
// Load .env manually (standalone script, no dotenv)
try {
  const envText = readFileSync(join(import.meta.dir, "..", ".env"), "utf-8");
  for (const line of envText.split("\n")) {
    const match = line.match(/^([A-Z_]+)=(.+)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* .env missing — rely on inherited env */
}

const sbUrl =
  process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const sbKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

if (!sbUrl || !sbKey) {
  log("FATAL: No Supabase credentials found in env or .env");
  process.exit(1);
}

const supabase = createClient(sbUrl, sbKey);

// ── Brief Config ──
const BRIEF_CONFIG: Record<string, { label: string; prompt: string }> = {
  MDB: {
    label: "Morning Daily Brief",
    prompt: `You are a senior futures desk analyst at Priced In Capital. Generate the Morning Daily Brief (MDB).

Format sections:
- Day Type: [Macro/Catalyst/Drift/Compounding]
- Key Prints & Speeches (ET): time, actual vs expected, directional read
- After-Hours Movers: % changes + implied NQ/ES impact
- Macro/Political Take: 2-3 sentences on macro picture
- Pressure Summary: Price action + key levels
- Market Risks & VIX: Event risk status + volatility
- Overall Sentiment: One punchy sentence
- Market Regime: [BULL_TREND|BEAR_TREND|CONSOLIDATION|VOLATILE_CHOP|TRANSITION]
- Best Intraday Approach: Specific strategy

Keep it under 400 words. Write like a desk note, not a blog post. No fluff.`,
  },
  ADB: {
    label: "Afternoon Daily Brief",
    prompt: `You are a senior futures desk analyst at Priced In Capital. Generate the Afternoon Daily Brief (ADB).

Provide 3-5 bullet points covering:
- What happened since market open (key moves, catalysts)
- Any new developments (headlines, prints, speeches)
- Afternoon outlook (continuation vs reversal, key levels to watch)
- Risk events remaining today

Keep it under 200 words. Terse, actionable, no fluff.`,
  },
  PMDB: {
    label: "Post-Market Daily Brief",
    prompt: `You are a senior futures desk analyst at Priced In Capital. Generate the Post-Market Daily Brief (PMDB).

Provide 3-5 bullet points covering:
- Session recap: what drove price today
- Key overnight catalysts to watch
- After-hours earnings/events if any
- Tomorrow's calendar preview
- Positioning bias for next session

Keep it under 200 words. Terse, forward-looking.`,
  },
  TWT: {
    label: "The Weekly Tribune",
    prompt: `You are a senior futures desk analyst at Priced In Capital. Generate the Weekly Tribune (TWT - The Weekly Tribune).

Format sections:
- Week in Review: What drove markets this week (2-3 sentences)
- Key Data Points: Most impactful prints and their implications
- Regime Assessment: Is the market trending, consolidating, or transitioning?
- Week Ahead: Major events, earnings, prints on the calendar
- Positioning: Bias and approach for next week
- One Big Thought: The single most important thing to watch

Keep it under 500 words. Sunday vibes — reflective but actionable.`,
  },
};

// ── Check Idempotency ──
async function alreadyGenerated(): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("briefs")
    .select("id")
    .eq("brief_type", BRIEF_TYPE)
    .gte("created_at", `${today}T00:00:00`)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// ── Fetch Context from Supabase ──
async function fetchContext(): Promise<string> {
  const parts: string[] = [];

  // Recent scored RiskFlow items (last 24h, level 2+)
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: items } = await supabase
    .from("scored_riskflow_items")
    .select("headline, sentiment, iv_score, macro_level, risk_type, created_at")
    .gte("created_at", cutoff)
    .gte("macro_level", 2)
    .order("created_at", { ascending: false })
    .limit(20);

  if (items?.length) {
    parts.push("## Recent Market Headlines (last 24h)");
    for (const item of items) {
      parts.push(
        `- [L${item.macro_level}] ${item.headline} (${item.sentiment}, IV ${item.iv_score?.toFixed(1) ?? "?"}, ${item.risk_type ?? "General"})`,
      );
    }
  }

  // Recent econ events
  const { data: events } = await supabase
    .from("econ_events")
    .select("name, date, time, actual, forecast, previous, impact")
    .gte(
      "date",
      new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    )
    .order("date", { ascending: false })
    .limit(10);

  if (events?.length) {
    parts.push("\n## Recent Economic Events");
    for (const e of events) {
      parts.push(
        `- ${e.name} (${e.date}): actual=${e.actual ?? "?"}, forecast=${e.forecast ?? "?"}, previous=${e.previous ?? "?"} [${e.impact}]`,
      );
    }
  }

  // Latest brief for continuity
  const { data: lastBrief } = await supabase
    .from("briefs")
    .select("content, brief_type, created_at")
    .order("created_at", { ascending: false })
    .limit(1);

  if (lastBrief?.[0]) {
    parts.push(
      `\n## Previous Brief (${lastBrief[0].brief_type}, ${lastBrief[0].created_at})`,
    );
    parts.push(lastBrief[0].content.slice(0, 500) + "...");
  }

  return (
    parts.join("\n") ||
    "No recent context available. Generate based on general market awareness."
  );
}

// ── Generate via provider chain ──
async function generateViaProviderChain(
  prompt: string,
  context: string,
): Promise<string> {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fullPrompt = `${prompt}\n\nHere is the current market context:\n\n${context}\n\nGenerate the brief now. Today is ${today}.`;

  const result = await generateViaChain({
    prompt: fullPrompt,
    model: BRIEF_MODEL,
    maxOutputTokens: 8192,
    timeoutMs: 120_000,
  });

  if (!result.response.trim()) {
    throw new Error("Provider chain returned empty content");
  }

  return result.response.trim();
}

// ── Persist to Supabase ──
async function persistBrief(
  content: string,
  generatedBy: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("briefs")
    .insert({
      brief_type: BRIEF_TYPE,
      content,
      generated_by: generatedBy,
      category: BRIEF_TYPE === "TWT" ? "weekly" : "daily",
    })
    .select("id")
    .single();

  if (error) {
    log(`Supabase persist failed: ${error.message}`);
    return null;
  }
  return data?.id ?? null;
}

// ── Main ──
async function main() {
  const config = BRIEF_CONFIG[BRIEF_TYPE];
  if (!config) {
    log(`FATAL: Unknown brief type: ${BRIEF_TYPE}`);
    process.exit(1);
  }

  log(`Starting ${BRIEF_TYPE} (${config.label}) dispatch...`);

  if (await alreadyGenerated()) {
    log(`${BRIEF_TYPE} already generated today. Skipping.`);
    return;
  }

  log("Fetching market context from Supabase...");
  const context = await fetchContext();
  log(`Context: ${context.length} chars`);

  let content = "";
  const generatedBy = "provider-chain";
  try {
    log(`Generating brief via provider chain (${BRIEF_MODEL})...`);
    content = await generateViaProviderChain(config.prompt, context);
  } catch (err) {
    log(
      `FATAL: Provider chain generation failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    sendIMessage(`${BRIEF_TYPE} dispatch failed — provider chain unavailable.`);
    process.exit(1);
  }
  log(`Generated: ${content.length} chars`);

  if (!content || content.length < 50) {
    log("FATAL: Brief too short or empty");
    sendIMessage(`${BRIEF_TYPE} dispatch failed — empty provider response.`);
    process.exit(1);
  }

  log("Persisting to Supabase...");
  const briefId = await persistBrief(content, generatedBy);
  log(`Persisted: ${briefId ?? "failed"}`);

  const msg = `📊 ${config.label}\n\n${content}`;
  log(`Sending iMessage (${msg.length} chars)...`);
  sendIMessage(msg);

  log(`${BRIEF_TYPE} dispatch complete.`);
}

main().catch((e) => {
  log(`FATAL: ${e instanceof Error ? e.message : "unknown"}`);
  sendIMessage(
    `⚠️ ${BRIEF_TYPE} dispatch failed — ${e instanceof Error ? e.message : "unknown"}`,
  );
  process.exit(1);
});
