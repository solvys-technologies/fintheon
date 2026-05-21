// [claude-code 2026-04-16] S20-T1: Agent dossiers injected after base prompt
// [claude-code 2026-04-19] S27-T8 W1d: Identity/scope/constraints/grounding now load from SOUL.md per agent.
//   BASE_PROMPTS + DOSSIER_* remain as fallbacks for legacy code paths and surface-specific layers (capabilities, gates, skills).
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import type { HermesAgentRole } from "../../hermes-service.js";
import { BASE_PROMPTS } from "./base-prompts.js";
import { SHARED_BELIEFS } from "./shared-beliefs.js";
import { AGENT_PHILOSOPHY } from "./philosophy-blocks.js";
import {
  SKILL_INSTRUCTIONS,
  DEEP_ANALYSIS_BLOCK,
} from "./skill-instructions.js";
import { getCommandmentGates } from "./commandment-gates.js";
import { DOSSIER_ORACLE } from "./dossiers/oracle.js";
import { DOSSIER_FEUCHT } from "./dossiers/feucht.js";
import { DOSSIER_CONSUL } from "./dossiers/consul.js";
import { DOSSIER_HERALD } from "./dossiers/herald.js";
import { getSupabaseClient } from "../../../config/supabase.js";
import {
  loadSoul,
  renderSystemPrompt as renderSoulPrompt,
  type AgentId as SoulAgentId,
} from "../soul/loader.js";
import { getAllProfiles } from "../../capability-registry/registry.js";

const ROLE_TO_SOUL_ID: Record<HermesAgentRole, SoulAgentId> = {
  "harper-cao": "harper",
  "pma-merged": "oracle",
  "futures-desk": "feucht",
  "fundamentals-desk": "consul",
  herald: "herald",
};

/** Cache entry for compiled prompts */
type CacheEntry = { prompt: string; expiresAt: number };
const promptCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/** Persona file cache (same TTL pattern) */
const personaCache = new Map<string, CacheEntry>();
const PERSONA_DIR = join(
  homedir(),
  ".hermes",
  "memories",
  "harper-handoff",
  "agent-personas",
);

const ROLE_TO_PERSONA_FILE: Record<string, string> = {
  "harper-cao": "harper.md",
  "pma-merged": "oracle.md",
  "futures-desk": "feucht.md",
  "fundamentals-desk": "horace.md",
  herald: "herald.md",
};

/** Agent dossiers — authoritative personality + operational rules. Coexists with persona files; dossier wins on conflict. */
const AGENT_DOSSIERS: Partial<Record<HermesAgentRole, string>> = {
  "pma-merged": DOSSIER_ORACLE,
  "futures-desk": DOSSIER_FEUCHT,
  "fundamentals-desk": DOSSIER_CONSUL,
  herald: DOSSIER_HERALD,
};

async function loadPersonaFile(role: HermesAgentRole): Promise<string> {
  const fileName = ROLE_TO_PERSONA_FILE[role];
  if (!fileName) return "";

  const cached = personaCache.get(role);
  if (cached && cached.expiresAt > Date.now()) return cached.prompt;

  try {
    const content = await readFile(join(PERSONA_DIR, fileName), "utf-8");
    personaCache.set(role, {
      prompt: content,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return content;
  } catch {
    console.warn(
      `[AgentInstructions] Persona file not found for ${role}: ${fileName}`,
    );
    return "";
  }
}

/**
 * Render a cross-agent capability registry block from the runtime registry.
 * Replaces the old static CROSS_AGENT_REGISTRY_BLOCK string.
 * Mutations go through the unified approval pipeline (see /api/harper/tool-decision).
 */
function renderRegistryBlock(): string {
  const profiles = getAllProfiles();
  const lines: string[] = [
    "",
    "## Agent Capability Registry",
    "The following desk agents are available for handoff. Each has a defined tool scope.",
    "",
  ];
  for (const p of profiles) {
    lines.push(`### ${p.agent_id}`);
    lines.push(`Responsibilities: ${p.responsibilities.join("; ")}`);
    lines.push(`Required tools: ${p.required_tools.join(", ")}`);
    if (p.optional_tools.length > 0) {
      lines.push(`Optional tools: ${p.optional_tools.join(", ")}`);
    }
    if (p.prohibited_tools.length > 0) {
      lines.push(`Prohibited tools: ${p.prohibited_tools.join(", ")}`);
    }
    if (p.handoff_targets.length > 0) {
      lines.push(`Handoff targets: ${p.handoff_targets.join(", ")}`);
    }
    lines.push("");
  }
  lines.push(
    "Mutations (write operations) go through the unified approval pipeline (see /api/harper/tool-decision).",
  );
  return lines.join("\n");
}

/**
 * Capability awareness block — tells agents what data and tools they have access to.
 * Without this, agents respond with generic "awaiting data sync" placeholders.
 */
const CAPABILITIES_BLOCK = `

## Your Capabilities — USE THEM
You have access to the following live data sources and tools. Do NOT say "awaiting data sync" or "connecting to..." — your data is live. Use it.

### MANDATORY: Backend Data First
**ALWAYS check internal backend data BEFORE going to the internet.** Your backend has live, scored, enriched data that is better than raw web results. Only use external search if the backend data is insufficient or the user explicitly asks for external research.

**Internal data sources (CHECK THESE FIRST):**
- **RiskFlow Feed**: Live news headlines with macro-level scoring (HIGH/MED/LOW) and sentiment are injected at the end of this prompt when available. Reference them by name when discussing current market conditions, narratives, or risk events.
- **NarrativeFlow / Catalysts**: Promoted RiskFlow items with narrative thread assignments — use \`run_command\` to query the backend API: \`curl -s http://localhost:8080/api/narrative/catalysts\`
- **Economic Calendar**: \`curl -s http://localhost:8080/api/data/econ-events\`
- **Daily Briefs**: \`curl -s http://localhost:8080/api/data/briefs/latest\`
- **Supabase DB**: scored_riskflow_items, narrative_threads, econ_events tables — query via backend API endpoints


**External sources (USE ONLY AFTER checking internal data):**
- **Exa Search**: Neural web search for financial research, news, analysis, and real-time information.
- **Yahoo Finance**: Real-time quotes, options chains, fundamentals, and company data.
- **Playwright Browser**: Headless browser for chart screenshots, TopStepX chart interaction, and web scraping.

When live data appears below (e.g., RiskFlow headlines), weave it into your analysis. Cite specific headlines, scores, and sources. You are a live analyst — act like one.
`;

/**
 * Build a dynamic system prompt for the given agent role + context.
 *
 * Composition order:
 *   1. Base role description
 *   2. Shared beliefs (neural web — all agents)
 *   3. Capabilities block (tools and data)
 *   4. Agent-specific philosophy block
 *   5. Commandment gates (contextual, if trading state provided)
 *   6. Skill instructions (if [SKILL:*] tag detected)
 *   7. Deep analysis block (if thinkHarder)
 *   --- appended by caller (hermes-handler.ts) ---
 *   8. Live RiskFlow feed context
 *   9. Cross-agent thought bank context (collective thought plane)
 */
export async function getAgentSystemPrompt(
  role: HermesAgentRole,
  context?: {
    skillTag?: string | null;
    thinkHarder?: boolean;
    tradingState?: {
      timeEST?: string;
      morningRoutineDone?: boolean;
      consecutiveLosses?: number;
      lastBigWinWithin48h?: boolean;
      holdingLosingPosition?: boolean;
      currentPnL?: number;
    };
  },
): Promise<string> {
  // Cache key includes trading state hash for gate variations
  const gateHash = context?.tradingState
    ? `${context.tradingState.timeEST ?? ""}:${context.tradingState.morningRoutineDone ?? ""}:${context.tradingState.consecutiveLosses ?? 0}`
    : "";
  const cacheKey = `${role}:${context?.skillTag ?? ""}:${context?.thinkHarder ? "1" : "0"}:${gateHash}`;
  const cached = promptCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.prompt;
  }

  // 1. SOUL-grounded identity — loads CLAUDE.md literally + the agent-specific extra dossier.
  //    Replaces BASE_PROMPTS + DOSSIER_* composition for the identity layer.
  //    Legacy constants are kept for surfaces that still reference them (voice, sidecar bootstrap) and
  //    as the fallback path below.
  let prompt = "";
  const soulId = ROLE_TO_SOUL_ID[role];
  if (soulId) {
    try {
      const soul = await loadSoul(soulId);
      prompt = renderSoulPrompt(soul);
    } catch (err) {
      console.warn(
        `[AgentInstructions] SOUL load failed for role=${role} (${soulId}); falling back to legacy prompt composition.`,
        err,
      );
    }
  }

  // Fallback composition when SOUL load fails. Keeps the system resilient under misconfiguration.
  if (!prompt) {
    prompt = BASE_PROMPTS[role] ?? BASE_PROMPTS["harper-cao"];

    // 1.5. Full persona profile from ~/.hermes persona files
    const persona = await loadPersonaFile(role);
    if (persona) {
      prompt += `\n\n## Full Persona Profile\n${persona}`;
    }

    // 1.6. Agent dossier — authoritative identity, worldview, and operational rules
    const dossier = AGENT_DOSSIERS[role];
    if (dossier) {
      prompt += dossier;
    }
  }

  // 2. Shared beliefs — the neural web
  prompt += SHARED_BELIEFS;

  // 2.5. Capability awareness — what tools and data the agent has access to
  prompt += CAPABILITIES_BLOCK;

  // 2.6. Runtime capability registry — cross-agent roster + tool scope (replaces static CROSS_AGENT_REGISTRY_BLOCK)
  prompt += renderRegistryBlock();

  // 3. Agent-specific philosophy block
  const philosophy = AGENT_PHILOSOPHY[role];
  if (philosophy) {
    prompt += philosophy;
  }

  // 4. Commandment gates (contextual)
  if (context?.tradingState) {
    prompt += getCommandmentGates(context.tradingState);
  }

  // 5. Skill instructions when [SKILL:*] detected
  if (context?.skillTag) {
    const skillKey = context.skillTag.toUpperCase();
    const skillBlock = SKILL_INSTRUCTIONS[skillKey];
    if (skillBlock) {
      prompt += skillBlock;
    }
  }

  // 6. Deep analysis block
  if (context?.thinkHarder) {
    prompt += DEEP_ANALYSIS_BLOCK;
  }

  // Cache the compiled prompt
  promptCache.set(cacheKey, { prompt, expiresAt: Date.now() + CACHE_TTL_MS });

  return prompt;
}

/**
 * Extract skill tag from message text (e.g. [SKILL:BRIEF] → 'BRIEF')
 */
export function extractSkillTag(message: string): string | null {
  const match = message.match(/\[SKILL:(\w+)\]/i);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Build a live RiskFlow feed context block for agent chat prompts.
 * Queries scored_riskflow_items directly for rich catalyst data (IV scores, sentiment, tags, macro level).
 */
export async function buildFeedContext(): Promise<string> {
  try {
    const sb = getSupabaseClient();
    if (!sb) return "";

    const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data } = await sb
      .from("scored_riskflow_items")
      .select(
        "headline, sentiment, iv_score, macro_level, tags, source, published_at",
      )
      .gte("published_at", cutoff)
      .gte("iv_score", 2)
      .order("iv_score", { ascending: false })
      .limit(30);

    if (!data || data.length === 0) return "";

    const headlines = data
      .map(
        (item: any, i: number) =>
          `${i + 1}. [IV ${item.iv_score ?? "?"} ${item.sentiment ?? "neutral"} ML${item.macro_level ?? "?"}${item.tags?.length ? " | " + item.tags.join(", ") : ""}] ${item.headline} (${item.source ?? "unknown"})`,
      )
      .join("\n");

    return `\n\n## Live Scored Catalysts (last 12h, IV≥2)\n${headlines}\n\nReference these catalysts by name, IV score, and sentiment when discussing current market conditions.`;
  } catch {
    return "";
  }
}

/**
 * Build a REFLECT context block for Harper standup prompts.
 * Returns the latest news analysis quality report so Harper can flag scoring issues.
 */
export async function buildReflectContext(): Promise<string> {
  try {
    const { getLatestReflectReport } =
      await import("../../autoresearch/reflect-engine.js");
    const report = await getLatestReflectReport();
    if (!report) return "";

    const criticalCount = report.findings.filter(
      (f: any) => f.severity === "critical",
    ).length;
    const warningCount = report.findings.filter(
      (f: any) => f.severity === "warning",
    ).length;

    let block = `\n\n## REFLECT — News Analysis Quality Report (${report.generatedAt.slice(0, 10)})`;
    block += `\n${report.summary}`;

    if (criticalCount > 0 || warningCount > 0) {
      block += "\n\nFindings:";
      for (const f of report.findings) {
        if (f.severity === "info") continue;
        block += `\n- [${f.severity.toUpperCase()}] ${f.message} → ${f.recommendation}`;
      }
    }

    if (report.adjustments.length > 0) {
      block += "\n\nRecommended adjustments:";
      for (const a of report.adjustments) {
        block += `\n- ${a.parameter}: ${a.reason}`;
      }
    }

    block +=
      "\n\nMention any critical REFLECT findings in your standup. If all metrics are healthy, note that scoring quality is on track.";
    return block;
  } catch {
    return "";
  }
}
