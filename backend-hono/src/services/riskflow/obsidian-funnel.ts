import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { riskFlowMainVaultRoot } from "../obsidian-vaults/paths.js";
import type { ScoredRiskFlowItem } from "../supabase-service.js";

let funnelQueue: Promise<void> = Promise.resolve();

export function enqueueRiskFlowObsidianFunnel(
  items: ScoredRiskFlowItem[],
): void {
  if (process.env.RISKFLOW_OBSIDIAN_FUNNEL_ENABLED === "false") return;
  const root = riskFlowMainVaultRoot();
  if (!root) return;
  const eligible = items.filter(
    (item) =>
      item.tweet_id &&
      item.headline &&
      (item.macro_level === undefined || Number(item.macro_level) > 0),
  );
  if (eligible.length === 0) return;
  funnelQueue = funnelQueue
    .then(() => writeRiskFlowNotes(root, eligible))
    .catch((error) => {
      console.warn(
        `[RiskFlowVault] funnel failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
}

async function writeRiskFlowNotes(
  root: string,
  items: ScoredRiskFlowItem[],
): Promise<void> {
  await ensureRiskFlowVault(root);
  await Promise.all(items.map((item) => writeRiskFlowNote(root, item)));
}

async function ensureRiskFlowVault(root: string): Promise<void> {
  await Promise.all([
    mkdir(join(root, "Catalysts"), { recursive: true }),
    mkdir(join(root, "Narrative Builder"), { recursive: true }),
  ]);
  const readme = join(root, "README.md");
  if (existsSync(readme)) return;
  await writeFile(
    readme,
    [
      "---",
      `type: "riskflow-main-vault"`,
      `created_at: ${JSON.stringify(new Date().toISOString())}`,
      `tags: ["fintheon", "riskflow", "main-vault"]`,
      "---",
      "",
      "# RiskFlow Main Vault",
      "",
      "Scored RiskFlow headlines funnel here as markdown catalyst notes for NarrativeFlow and desk vault references.",
    ].join("\n"),
  );
}

async function writeRiskFlowNote(
  root: string,
  item: ScoredRiskFlowItem,
): Promise<void> {
  const month = monthStamp(item.published_at);
  const rel = join("Catalysts", month, noteName(item));
  await mkdir(join(root, "Catalysts", month), { recursive: true });
  await writeFile(join(root, rel), buildNote(item));
}

function buildNote(item: ScoredRiskFlowItem): string {
  const tags = [
    "fintheon",
    "riskflow",
    "catalyst",
    ...(item.tags ?? []),
  ].filter(Boolean);
  return [
    frontmatter({
      id: item.tweet_id,
      type: "riskflow-catalyst",
      source: item.source ?? "riskflow",
      url: item.url ?? null,
      published_at: item.published_at ?? null,
      analyzed_at: item.analyzed_at ?? null,
      iv_score: item.iv_score ?? null,
      macro_level: item.macro_level ?? null,
      sentiment: item.sentiment ?? null,
      risk_type: item.risk_type ?? null,
      symbols: item.symbols ?? [],
      tags,
      generated_at: new Date().toISOString(),
    }),
    "",
    `# ${safeText(item.headline) || "Untitled RiskFlow Catalyst"}`,
    "",
    `Source: ${item.source ?? "riskflow"}${item.url ? ` - ${item.url}` : ""}`,
    `Published: ${item.published_at ?? "unknown"}`,
    `IV Score: ${item.iv_score ?? "n/a"} / Macro: ${item.macro_level ?? "n/a"} / Sentiment: ${item.sentiment ?? "n/a"}`,
    "",
    "## Catalyst",
    "",
    safeText(item.body) || safeText(item.headline),
    "",
    item.agent_note ? `## Agent Note\n\n${safeText(item.agent_note)}\n` : "",
    "## Narrative Use",
    "",
    "- Available to attach as NarrativeFlow anchor, supporting, confirming, conflicting, or watchlist evidence.",
    "- Promote into a desk vault when it becomes part of a desk-specific thesis.",
  ]
    .filter(Boolean)
    .join("\n");
}

function noteName(item: ScoredRiskFlowItem): string {
  return `${dateStamp(item.published_at)}-${safeSlug(item.tweet_id)}-${safeSlug(
    item.headline ?? "catalyst",
  )}.md`;
}

function dateStamp(value?: string | null): string {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "undated";
  return date.toISOString().slice(0, 10);
}

function monthStamp(value?: string | null): string {
  const stamp = dateStamp(value);
  return stamp === "undated" ? "undated" : stamp.slice(0, 7);
}

function safeSlug(value: string, fallback = "item"): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return slug || fallback;
}

function safeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
}

function yamlValue(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((item) => JSON.stringify(item)).join(", ")}]`;
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return JSON.stringify(value);
}

function frontmatter(data: Record<string, unknown>): string {
  return `---\n${Object.entries(data)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`)
    .join("\n")}\n---`;
}
