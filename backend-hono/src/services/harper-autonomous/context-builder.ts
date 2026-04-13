// [claude-code 2026-04-04] Context Builder — assembles the full prompt for each Harper autonomous turn

import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { getRecentEntries, type JournalEntry } from "./journal-store.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("HarperContext");

const PROJECT_ROOT =
  process.env.FINTHEON_PROJECT_ROOT ??
  join(import.meta.dirname, "..", "..", "..", "..");

// ── Soul File Cache ────────────────────────────────────────────────────────

let soulFileCache: string | null = null;
let soulFileCacheTime = 0;
const SOUL_CACHE_TTL = 5 * 60_000; // 5 minutes

async function getSoulFile(): Promise<string> {
  if (soulFileCache && Date.now() - soulFileCacheTime < SOUL_CACHE_TTL) {
    return soulFileCache;
  }

  try {
    const soulPath = join(import.meta.dirname, "HARPER-SOUL.md");
    soulFileCache = await readFile(soulPath, "utf-8");
    soulFileCacheTime = Date.now();
    return soulFileCache;
  } catch (err) {
    log.error("Failed to read HARPER-SOUL.md", {
      error: err instanceof Error ? err.message : String(err),
    });
    return "# Harper — CAO\nSoul file unavailable. Operate in degraded mode.";
  }
}

// ── Codebase Manifest ──────────────────────────────────────────────────────

let manifestCache: string | null = null;
let manifestCacheTime = 0;
const MANIFEST_CACHE_TTL = 30 * 60_000; // 30 minutes

async function getCodebaseManifest(): Promise<string> {
  if (manifestCache && Date.now() - manifestCacheTime < MANIFEST_CACHE_TTL) {
    return manifestCache;
  }

  try {
    const manifestPath = join(import.meta.dirname, "CODEBASE-MANIFEST.json");
    const raw = await readFile(manifestPath, "utf-8");
    const entries = JSON.parse(raw) as Array<{ path: string; purpose: string }>;
    manifestCache = entries
      .map((e) => `- \`${e.path}\` — ${e.purpose}`)
      .join("\n");
    manifestCacheTime = Date.now();
    return manifestCache;
  } catch {
    // Manifest doesn't exist yet — generate a minimal one
    try {
      const tree = execFileSync(
        "find",
        [
          "backend-hono/src/services",
          "-name",
          "*.ts",
          "-not",
          "-path",
          "*/node_modules/*",
        ],
        { cwd: PROJECT_ROOT, timeout: 5000, encoding: "utf-8" },
      );
      const lines = tree.trim().split("\n").sort().slice(0, 60).join("\n");
      manifestCache = lines;
      manifestCacheTime = Date.now();
      return manifestCache;
    } catch {
      return "(codebase manifest unavailable)";
    }
  }
}

// ── Git Diff ───────────────────────────────────────────────────────────────

function getRecentGitChanges(): string {
  try {
    return execFileSync("git", ["diff", "--stat", "HEAD~5"], {
      cwd: PROJECT_ROOT,
      timeout: 5000,
      encoding: "utf-8",
    }).trim();
  } catch {
    return "(git diff unavailable)";
  }
}

// ── Journal Context ────────────────────────────────────────────────────────

function formatJournalEntries(entries: JournalEntry[]): string {
  if (entries.length === 0) return "(no prior journal entries)";

  return entries
    .map((e) => {
      const time = e.createdAt
        ? new Date(e.createdAt).toLocaleTimeString("en-US", {
            timeZone: "America/New_York",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "??:??";
      const tags = e.tags?.length ? ` [${e.tags.join(", ")}]` : "";
      return `- **${time} ET** (${e.entryType})${tags}: ${e.content.slice(0, 200)}${e.content.length > 200 ? "..." : ""}`;
    })
    .join("\n");
}

// ── RiskFlow Feed Context ──────────────────────────────────────────────────

async function getRiskFlowContext(): Promise<string> {
  try {
    const res = await fetch("http://localhost:8080/api/riskflow/feed?limit=10");
    if (!res.ok) return "(RiskFlow feed unavailable)";
    const data = (await res.json()) as {
      items?: Array<{
        headline: string;
        macroLevel: number;
        sentiment: string;
        source: string;
      }>;
    };
    if (!data.items?.length) return "(no recent RiskFlow items)";

    return data.items
      .map((item) => {
        const level =
          item.macroLevel >= 4
            ? "CRITICAL"
            : item.macroLevel >= 3
              ? "HIGH"
              : item.macroLevel >= 2
                ? "MED"
                : "LOW";
        return `- [${level}] ${item.headline} (${item.sentiment}, via ${item.source})`;
      })
      .join("\n");
  } catch {
    return "(RiskFlow feed unavailable)";
  }
}

// ── Task Prompt Builder ────────────────────────────────────────────────────

export interface HarperTask {
  type:
    | "heartbeat"
    | "level4-item"
    | "vix-spike"
    | "pipeline-stall"
    | "scoring-qa"
    | "narrative-synthesis"
    | "brief-review"
    | "regime-memo"
    | "consilium-intervention"
    | "feed-quality-feedback"
    | "manual";
  payload: Record<string, unknown>;
  priority: "low" | "normal" | "high" | "critical";
}

function buildTaskPrompt(task: HarperTask): string {
  switch (task.type) {
    case "heartbeat":
      return `## Heartbeat Task
Run your heartbeat-health hook. Check pipeline health, scoring coverage, and codebase changes.
If TradingView MCP is available, read chart state and Pine indicator values.
Write a brief heartbeat summary to your journal (<100 words).
Write an ops feed entry (severity: info) summarizing status.
If this is every 3rd heartbeat, also run narrative-synthesis hook.
If this is every 6th heartbeat, also run scoring-qa hook.`;

    case "level4-item":
      return `## Level 4 Item Alert
A CRITICAL item has been scored in RiskFlow.
${JSON.stringify(task.payload, null, 2)}

Run your level4-response hook:
1. Analyze the headline and scoring context
2. Check for narrative cluster (3+ related items in 2 hours)
3. Assess regime implications
4. Write analysis to Ops feed (severity: warning or critical)
5. Write synthesis to journal`;

    case "vix-spike":
      return `## VIX Spike Detected
${JSON.stringify(task.payload, null, 2)}

Run your vix-spike-response hook:
1. If TradingView is open, capture a chart screenshot
2. Determine what changed (catalyst, technical break)
3. Write regime shift memo to Ops feed (severity: warning)
4. Flag any proposals that need reassessment`;

    case "pipeline-stall":
      return `## Pipeline Stall Detected
No new scored items for 30+ minutes during market hours.
${JSON.stringify(task.payload, null, 2)}

Run your pipeline-stall-response hook:
1. Check diagnostics: GET http://localhost:8080/api/diagnostics
2. Check central-scorer status
3. Check feed-poller freshness
4. Diagnose root cause
5. If maintenance-tier fix available, execute it
6. Write diagnosis to Ops feed (severity: critical)`;

    case "brief-review":
      return `## Brief Generated — Quality Review
A brief has been generated and needs quality review.
${JSON.stringify(task.payload, null, 2)}

Run your brief-review hook:
1. Fetch the latest brief: GET http://localhost:8080/api/data/brief/latest?type=${task.payload.briefType ?? "MDB"}
2. Grade: Does it reflect current regime? Are catalysts fresh?
3. Check for contradictions with your journal
4. If this is an ADB, also run Tech Flow Watchlist screener via TradingView MCP
5. Flag issues in Ops feed`;

    case "scoring-qa":
      return `## Scoring QA Check
Sample recent scored items and check for calibration drift.
1. Query 5 recent scored items from RiskFlow feed
2. Check: Does macro_level match apparent severity?
3. Check: Are POI items (Powell, Trump, Bessent) properly escalated?
4. Check: Are stale items still scored HIGH/CRITICAL?
5. Write findings to Ops feed`;

    case "narrative-synthesis":
      return `## Narrative Synthesis
Look for patterns in recent scored items.
1. Read last 10 scored items from RiskFlow
2. Look for clustering: same risk_type, instruments, direction
3. Cross-reference with existing NarrativeFlow threads
4. If new narrative detected, recommend thread creation in Ops feed
5. Write synthesis to journal`;

    case "feed-quality-feedback":
      return `## Feed Quality Feedback — User Dismissed Items
Chief thumbs-downed items from the RiskFlow feed. These are garbage that slipped through the content guard.

${JSON.stringify(task.payload, null, 2)}

Run your feed-quality hook:
1. Analyze the dismissed headlines — what pattern let them through?
2. Query riskflow_dismissed_items for recent dismissals: SELECT headline, source, submitted_by, dismissed_at FROM riskflow_dismissed_items ORDER BY dismissed_at DESC LIMIT 20
3. Identify common patterns: same source? same author? similar phrasing? ad/promo content?
4. If a content guard rule would catch future instances, write the rule suggestion to Ops feed (severity: warning)
5. If the items come from a source account that's consistently low-quality, flag it for removal
6. Tag dismissed items in the DB: UPDATE riskflow_dismissed_items SET tags = array_append(tags, 'harper-reviewed') WHERE dismissed_at > now() - interval '1 hour' AND NOT ('harper-reviewed' = ANY(COALESCE(tags, '{}')))
7. Write findings to journal`;

    case "consilium-intervention":
      return `## Consilium Intervention Required
Agent disagreement or @Harper mention detected in Boardroom.
${JSON.stringify(task.payload, null, 2)}

Run your consilium-observer hook:
1. Read the conflicting messages
2. Identify the core disagreement
3. Present both views with confidence scores
4. State your assessment or present trade-offs for Chief`;

    case "manual":
      return `## Manual Task from Chief
${task.payload.message ?? JSON.stringify(task.payload)}`;

    default:
      return `## Task: ${task.type}\n${JSON.stringify(task.payload, null, 2)}`;
  }
}

// ── Dismissed Items Context ────────────────────────────────────────────────

async function getDismissedItemsContext(): Promise<string> {
  try {
    const { getSupabaseClient } = await import("../../config/supabase.js");
    const sb = getSupabaseClient();
    if (!sb) return "(dismissed items unavailable)";

    const { data } = await sb
      .from("riskflow_dismissed_items")
      .select("headline, source, submitted_by, dismissed_at, tags")
      .order("dismissed_at", { ascending: false })
      .limit(10);

    if (!data?.length) return "(no recent dismissals)";

    return data
      .map((d: any) => {
        const reviewed = d.tags?.includes("harper-reviewed")
          ? " [reviewed]"
          : " [pending]";
        const time = new Date(d.dismissed_at).toLocaleTimeString("en-US", {
          timeZone: "America/New_York",
          hour: "2-digit",
          minute: "2-digit",
        });
        return `- ${time} ET${reviewed}: "${d.headline}" (${d.source ?? "unknown"}, by ${d.submitted_by ?? "user"})`;
      })
      .join("\n");
  } catch {
    return "(dismissed items unavailable)";
  }
}

// ── Main Context Assembly ──────────────────────────────────────────────────

export async function buildAutonomousContext(
  task: HarperTask,
): Promise<{ systemPrompt: string; taskPrompt: string }> {
  const [soulFile, journalEntries, manifest, gitDiff, riskFlow, dismissed] =
    await Promise.all([
      getSoulFile(),
      getRecentEntries(20),
      getCodebaseManifest(),
      Promise.resolve(getRecentGitChanges()),
      getRiskFlowContext(),
      getDismissedItemsContext(),
    ]);

  const journalContext = formatJournalEntries(journalEntries);
  const taskPrompt = buildTaskPrompt(task);

  const systemPrompt = `${soulFile}

---

## [INJECTED] Codebase Manifest
${manifest}

## [INJECTED] Recent Changes (git diff --stat HEAD~5)
\`\`\`
${gitDiff}
\`\`\`

## [INJECTED] Journal Context (last ${journalEntries.length} entries)
${journalContext}

## [INJECTED] Live RiskFlow Headlines
${riskFlow}

## [INJECTED] Recent Dismissed Items (Feed Quality Feedback)
${dismissed}`;

  return { systemPrompt, taskPrompt };
}

export { buildTaskPrompt };
