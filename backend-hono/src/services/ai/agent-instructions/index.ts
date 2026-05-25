// [claude-code 2026-04-16] S20-T1: Agent dossiers injected after base prompt
// [claude-code 2026-04-19] S27-T8 W1d: Identity/scope/constraints/grounding now load from SOUL.md per agent.
//   BASE_PROMPTS + DOSSIER_* remain as fallbacks for legacy code paths and surface-specific layers (capabilities, gates, skills).
// [claude-code 2026-05-07] S61-T2: CROSS_AGENT_REGISTRY_BLOCK & CRUD_CAPABILITY_BLOCK now runtime-resolved from capability registry.
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
import {
  getAllProfiles,
  getHandoffTargets,
} from "../../capability-registry/registry.js";

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
 * Capability awareness block — tells agents what data and tools they have access to.
 * Without this, agents respond with generic "awaiting data sync" placeholders.
 */
/**
 * Dynamic Org Identity block — injected for every agent so they know who they work for,
 * who Chief is, and what each peer agent does.
 */
const ORG_IDENTITY_BLOCK = `

## Org Identity
You are an agent at Priced In Capital (PIC), an agentic hedge fund.
Your Chief/Ski is TP. The engineering team is Solvys Technologies.
Your peers are:
- **Oracle**: prediction markets & probabilistic reasoning (Kalshi, Polymarket, macro vision)
- **Feucht**: futures execution & risk (/NQ, /ES, TopStepX, technical levels)
- **Consul**: mega-cap fundamentals & statistical analysis (earnings, sector rotation)
- **Herald**: news & sentiment (breaking news, social sentiment, headline risk)
- **Harper**: executive synthesis, approval authority, cross-desk orchestration
`;

/**
 * Cross-Agent Capability Registry — runtime-resolved from the Zod-validated capability registry.
 * Tells agents when to hand off to which peer.
 */
function renderRegistryBlock(): string {
  const profiles = getAllProfiles();
  const agentLabels: Record<string, string> = {
    oracle: "Prediction markets / implied probabilities / Kalshi / Polymarket",
    feucht:
      "Technical levels / futures execution / VWAP-EMA confluence / /NQ / /ES",
    consul:
      "Fundamentals / earnings / mega-cap / sector rotation / 10-K analysis",
    herald: "News velocity / sentiment / social chatter / headline risk",
    harper: "Cross-desk synthesis / approval decisions / executive summary",
  };

  let block = "\n\n## Cross-Agent Capability Registry";
  for (const profile of profiles) {
    if (profile.agent_id === "harper") continue; // harper is the router, not a handoff target in its own block
    const label = agentLabels[profile.agent_id] ?? profile.responsibilities[0];
    block += `\n- **${profile.agent_id}**: ${label} → handoff_to_${profile.agent_id}`;
  }
  block +=
    "\n\nMax 3 handoffs per turn. Max depth 2 in any chain (A → B → C stops). Self-handoff is rejected.";
  return block;
}

/**
 * Unified Approval Pipeline — mutations now go through the unified approval pipeline.
 * Replaces the old CRUD_CAPABILITY_BLOCK which advertised non-existent endpoints.
 */
const UNIFIED_APPROVAL_BLOCK = `

## App Control Capabilities
You can modify the Fintheon app itself:
- Narratives: create, edit, delete, move catalysts between lanes
- RiskFlow: modify scoring criteria, provide intake quality feedback
- Regimes: add new trading regimes
- Agent Instructions: update Chamber instructions (Arbitrum)
- Settings: modify user settings (preferences, alerts, iframes — API keys excluded)
- Desk Plans: modify upcoming desk plan events
- Skills: propose new agent skills for user approval
- Code: write code patches for admin approval
- GitHub: file issues on solvys-technologies/fintheon

ALL destructive actions (delete, modify criteria, update instructions)
require explicit user approval via the unified approval pipeline (see /api/harper/tool-decision).
`;

/**
 * Self-Learning Loop — agents reflect and store learnings after each task.
 */
const SELF_LEARNING_BLOCK = `

## Learning Protocol
After completing any task or analysis, run an explicit after-action loop:
1. Prediction: what did you expect, with confidence and market window?
2. Evidence: which live prices, catalysts, calendar events, and peer views moved the call?
3. Outcome hook: what observable result would prove the call right or wrong?
4. Second-order read: who is reacting, who is trapped, and what cadence or bluff pattern is repeating?
5. Upgrade: what exact rubric, prompt, or score should change next time?

Store via POST /api/agent/learning with { agentId, topic, insight, confidence }.
Use memoryType when known: learned_pattern, reflect_finding, accuracy_feedback, or deliberation_output.

Full and quick analysis runs also trigger a background learning session when notable signals appear: headline risk, catalysts, elevated volatility, technical patterns, strong debate consensus, rejected risk, a deliberate no-trade decision, or a repeated narrative cadence. Treat automatic entries as first drafts; correct, promote, or annotate them during review.

If backtested or historical data exists for the setup, convert the reflection into a labeled training example with inputs, expected decision, actual outcome, and failure mode. Use fine-tuning only after labels are clean and separated into train/validation/test windows; until then, improve retrieval, prompts, and scoring rubrics from the same evidence.

Check learning velocity with GET /api/agent/learning/summary?days=7. If the last 7 days show no memories, treat learning as stalled and ask Harper or another Fintheon agent to run the Obsidian export review:
cd backend-hono && bun run memory:obsidian -- --days=7 --vault="$OBSIDIAN_VAULT_PATH"

Refresh the RiskFlow catalyst vault when NF-Workspace catalyst recall feels stale:
cd backend-hono && bun run catalysts:obsidian -- --vault="$OBSIDIAN_CATALYST_VAULT_PATH"

The catalyst vault is also TP's narrative authoring substrate. After export, agents should use:
- \`Catalysts/\` as the durable headline database.
- \`Narrative Builder/Start Here.md\` as the operating guide.
- \`Templates/Narrative Brief.md\` to help TP and desk traders draft their own narratives.
- \`Trader Banks/*-generated-catalyst-bank.md\` and \`Desk Workspaces/*/README.md\` to find bespoke desk/trader catalyst stacks.
- \`Narratives/Drafts/\` for human-written narrative notes; do not overwrite those drafts from exports.

Your learnings will be recalled in future contexts to improve your performance. Do not store secrets, raw credentials, or private account data.
`;

const CAPABILITIES_BLOCK = `

## Your Capabilities — USE THEM
You have access to the following live data sources and tools. Do NOT say "awaiting data sync" or "connecting to..." — your data is live. Use it.

### MANDATORY: Backend Data First
**ALWAYS check internal backend data BEFORE going to the internet.** Your backend has live, scored, enriched data that is better than raw web results. Only use external search if the backend data is insufficient or the user explicitly asks for external research.

**Internal data sources (CHECK THESE FIRST):**
- **RiskFlow Feed**: Live news headlines with macro-level scoring (HIGH/MED/LOW) and sentiment are injected at the end of this prompt when available. Reference them by name when discussing current market conditions, narratives, or risk events.
- **NarrativeFlow / Catalysts**: Promoted RiskFlow items with narrative thread assignments — use \`run_command\` to query the backend API: \`curl -s http://localhost:8080/api/narrative/catalysts\`
- **NF-Workspace Catalyst Bank**: Default catalyst database for NarrativeFlow sessions — search \`curl -s "http://localhost:8080/api/narrative/catalyst-bank?q=tariff&limit=20"\`; assign to a workspace with \`POST /api/narrative/sessions/:id/catalyst-bank/assign\` using \`{ "catalystIds": [...], "tags": ["fed", "inflation"], "deskFit": "why this fits the desk" }\`.
- **Obsidian Catalyst Vault / Narrative Builder**: Refresh with \`cd backend-hono && bun run catalysts:obsidian -- --vault="$OBSIDIAN_CATALYST_VAULT_PATH"\`. Use \`Narrative Builder/Start Here.md\`, \`Templates/Narrative Brief.md\`, \`Trader Banks/\`, and \`Desk Workspaces/\` to help TP and desk traders build their own narratives from the stored headline database.
- **Economic Calendar**: \`curl -s http://localhost:8080/api/data/econ-events\`
- **Daily Briefs**: \`curl -s http://localhost:8080/api/data/briefs/latest\`
- **Supabase DB**: scored_riskflow_items, narrative_threads, econ_events tables — query via backend API endpoints

### Agent Tool Routing
- **Harper CAO has direct local-control tools**: \`run_command\`, \`read_file\`, \`write_file\`, \`web_fetch\`, \`read_mcp_config\`, \`get_fintheon_paths\`, and \`browser_harness\`. Desk agents should ask Harper to run these when they need repo/runtime inspection instead of pretending they can mutate files themselves.
- **Harper chat UI tools**: \`open_todo_drawer\` for visible issue-tracked work, \`open_right_rail\` for plans/artifacts/workbench notes, and \`ask_approval_questions\` for composer-sized user answers. Use them to make work visible instead of burying plans in prose.
- **Skills and connectors live in the composer toolbox**: MCP servers are surfaced by \`GET /api/mcp\` and controlled by the MCP registry routes. The internal connectors include RiskFlow, ArbitrumChamber, Boardroom, and Solvys Support/Linear when configured.
- **Context mentions live at \`GET /api/context/mentions\`**. Use mention types document, skill, connector, narrative, theme, riskflow, instrument, vault, memo, chart, and agent when chat input needs safe structured context.
- **Learning and vault upkeep are operating tools, not optional notes**: store reusable lessons with \`POST /api/agent/learning\`, check \`GET /api/agent/learning/summary?days=7\`, export learning with \`bun run memory:obsidian\`, and refresh RiskFlow catalyst vaults with \`bun run catalysts:obsidian\`.

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

  // 2.5. Dynamic org identity — PIC, Chief TP, Solvys, peer roster
  prompt += ORG_IDENTITY_BLOCK;

  // 2.6. Cross-agent capability registry — runtime-resolved from capability registry
  prompt += renderRegistryBlock();

  // 2.7. Unified approval pipeline — mutations through unified approval
  prompt += UNIFIED_APPROVAL_BLOCK;

  // 2.8. Self-learning loop — reflect and store learnings
  prompt += SELF_LEARNING_BLOCK;

  // 2.9. Capability awareness — what tools and data the agent has access to
  prompt += CAPABILITIES_BLOCK;

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
