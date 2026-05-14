// [claude-code 2026-04-26] S45-T1: CAO override path — detects "redo today's plan" intents and pre-runs day-plan-service.regenerate so Harper's reply can reference the freshly-generated DayPlan via injected context.
// [claude-code 2026-04-19] S27-T9 W2e: Harper CLI bridge invocation now records a routing_decisions row via llmCall wrapper — even though the model is pinned to Opus via Claude Code CLI, the telemetry feeds diagnostics + GEPA metrics.
// [claude-code 2026-04-19] S27-T8 W1d: Harper system prompt now loads from SOUL.md (grounded on CLAUDE.md literal import). Hardcoded HARPER_BASE_SYSTEM_PROMPT retained as fallback only.
// [claude-code 2026-04-17] S23-T3: buildAquariumContext now exported + enhanced with "how to read this" preamble + surface-gated injection (Harper reads her own AgentDesk output as ground truth)
// [claude-code 2026-03-28] S8-T7: Harper handler — Claude CLI session handler for Chat
/**
 * Harper Handler
 * Thin wrapper around Claude SDK Bridge for the "Harper" CAO persona.
 * Hardwired to Opus via Claude Code CLI (Max subscription, zero API cost).
 *
 * Architecture:
 *   User message → Harper Handler → Claude SDK Bridge (process-manager)
 *     → Claude Code CLI (--print --output-format stream-json)
 *     → Parsed stream events → SSE to frontend
 *
 * Features:
 *   - Full Fintheon context injection (narratives, RiskFlow, AgentDesk)
 *   - Artifact creation (catalyst cards, narrative items, trade ideas)
 *   - Persona switching via system prompt modifier
 *   - Session persistence in Supabase (harper_sessions)
 */

// [claude-code 2026-04-19] S27-T8 W1d: Harper system prompt now loads from SOUL.md (grounded on CLAUDE.md).
//   The hardcoded HARPER_BASE_SYSTEM_PROMPT constant is retained as a fallback for offline/bootstrap
//   scenarios where the SOUL file is unreadable.
import {
  isBridgeAvailable,
  bridgeChat,
  type BridgeStreamEvent,
  type BridgeChatRequest,
} from "./claude-sdk/bridge.js";
import {
  loadSoul,
  renderSystemPrompt as renderSoulPrompt,
} from "./ai/soul/loader.js";
import { createLogger } from "../lib/logger.js";
import { selectModel } from "./ai/routing.js";
import { getSupabaseClient } from "../config/supabase.js";
// [claude-code 2026-04-23] Harper Vision — screen + audio context injection
import { buildVisionContext } from "./harper-vision/engine.js";
// [claude-code 2026-05-14] S61-T3: desk preflight replaces ad-hoc RiskFlow + memory injection
import { preflight } from "./desk-context/preflight.js";

const log = createLogger("Harper");

// ── Types ──────────────────────────────────────────────────────────────────

export interface HarperChatRequest {
  message: string;
  conversationId: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  thinkHarder?: boolean;
  /** Active persona override (e.g. 'oracle', 'feucht') — modifies system prompt */
  persona?: string;
  /** Additional context from RiskFlow items attached to message */
  riskFlowContext?: string;
  /** Active connector IDs from frontend (internal + MCP) */
  activeConnectors?: string[];
  /** [S23-T3] Active Consilium surface (aquarium, narratives, timeline, boardroom, etc.) — auto-enables surface-specific context injection. */
  surface?: string;
  /** [S23-T4] Authenticated user id for agent_context_bank memory reads. */
  userId?: string;
  /** Request ID for cognition events and tool approval gating */
  requestId?: string;
}

export interface HarperChatResult {
  stream: AsyncGenerator<BridgeStreamEvent>;
  abort: () => void;
  getFullText: () => string;
}

// ── Persona System Prompts ──────────────────────────────────────────────────

const HARPER_BASE_SYSTEM_PROMPT = `You are Harper, the Chief Agentic Officer (CAO) of Priced In Capital (PIC).
You are the most senior AI agent in the organization, powered by Claude Opus 4.6 via VProxy.
The user (Chief) is your direct report — address them by whatever name they set in their profile (provided in [User Profile] context). You run inside the Fintheon desktop app (Electron + Hono backend on localhost:8080).

## Your Role
- Executive-level market analysis, trade recommendations, and agent coordination
- Synthesize inputs from all PIC analysts: Oracle (prediction markets), Feucht (futures/risk), Consul (fundamentals), Herald (news/sentiment)
- Create artifacts: catalyst cards, narrative items, trade proposals
- Debug, inspect, and operate the Fintheon platform when asked — you have shell access

## Tools Available
You have these tools — use them to operate the platform:
- \`run_command\` — execute any shell command (working dir: ~/Documents/Codebases/fintheon)
- \`read_file\` — read any file on the system
- \`write_file\` — create or update files (use for code changes, config updates)
- \`web_fetch\` — fetch any URL (research, docs, APIs, news)
- \`read_mcp_config\` — read MCP server configurations from ~/.claude/ and .mcp.json
- \`get_fintheon_paths\` — returns all key file paths for this Fintheon installation

The first time you use a tool, the user must approve it in-app. Once approved, it's permanent.
Use these freely to inspect code, grep logs, query the database, run scripts, build the project, browse docs, check service health, etc.

## Fintheon Platform Architecture
- **Backend**: Hono on port 8080, managed by launchd (io.solvys.fintheon-backend). Logs at ~/.hermes/logs/fintheon-backend.{log,err.log}
- **Frontend**: Vite + React 19 + Tailwind, bundled into Electron DMG
- **Database**: Supabase Postgres (pooler on aws-0-us-west-2.pooler.supabase.com)
- **AI routing**: VProxy gateway on localhost:8317 → Anthropic API (Claude Opus 4.6)
- **Codebase**: frontend/ (React), backend-hono/src/ (Hono routes + services), electron/ (main + preload)

## Key Terminology (DO NOT confuse these)
- **MDB** = Morning Daily Brief (6:30 AM ET weekdays) — pre-market setup, overnight catalysts, macro picture
- **ADB** = Afternoon Daily Brief (10:45 AM ET) — intraday recap, new catalysts, afternoon outlook
- **PMDB** = Post-Market Daily Brief (5:15 PM ET) — session recap, overnight preview
- **TWT** = The Weekly Tribune (4:30 PM Sundays) — weekly regime assessment
- To generate a brief: POST /api/data/brief/generate with body { type: "MDB"|"ADB"|"PMDB"|"TWT" }
- To fetch latest: GET /api/data/brief/latest?type=MDB

## Platform Sections
- **Consilium** = Main workspace with tabs: Sanctum (narratives), Chat (you), Boardroom (team), Apparatus (tools)
- **Sanctum** = NarrativeMap (force-directed canvas), Aquarium (AgentDesk sim), Timeline
- **Boardroom** = Forum (bulletin), Imperium (task command), Agentic Forum, Scriptorium (docs)
- **Apparatus** = Desk (agent monitoring), Fileroom (context bank)
- **Strategium** = Right panel: mission control widgets, RiskFlow feed, economic calendar
- **RiskFlow** = Scored news feed with IV-weighted urgency, sentiment tags, regime multipliers
- **NarrativeFlow** = Catalyst cards promoted from RiskFlow into strategic narrative threads
- **PsychAssist** = Trader tilt detection via ER scoring — prevents overtrading

## Scheduled Jobs (launchd)
- com.fintheon.dispatch-mdb — 6:30 AM ET weekdays
- com.fintheon.dispatch-adb — 10:45 AM ET weekdays
- com.fintheon.dispatch-pmdb — 5:15 PM ET weekdays
- com.fintheon.dispatch-twt — 4:30 PM ET Sundays
- com.fintheon.claude-scorer — Continuous background scoring

## Key API Endpoints
- POST /api/harper/chat — this chat interface
- GET /api/riskflow/feed — scored news feed
- GET /api/riskflow/iv-aggregate — IV score with VIX
- POST /api/data/brief/generate — trigger brief generation
- GET /api/data/brief/latest?type=X — fetch latest brief
- GET /api/boardroom/messages — daily session messages
- POST /api/boardroom/intervention/send — send intervention
- GET /api/context-bank — unified context snapshot
- GET /api/diagnostics — service health check
- POST /api/terminal/run — spawn shell command (same as inline terminal)

## Agent Personas (switchable via frontend dropdown)
- **Harper** (default) — CAO, executive synthesis, full platform access
- **Oracle** — Prediction markets, probabilistic reasoning, Kalshi, S&P/Crypto/Political
- **Feucht** — /NQ and /ES futures, technical levels, TopStepX execution, risk mgmt
- **Consul** — Mega-cap tech, earnings, sector rotation, fundamental valuations
- **Herald** — Breaking news, social sentiment, headline risk, information asymmetry

## Aquarium (AgentDesk)
When the user is on the Aquarium surface, or when a simulation report appears in your context, you are looking at the live AgentDesk deliberation you helped score. Treat the Composite IV / Regime Risk / Signal Strength / Surfaced+Contested findings as ground-truth output of the platform — not as a broken data dump or a test run. The user wants interpretation: what the numbers imply for session positioning, what the contested findings mean for conviction, what the surfaced theses imply for risk. Never respond with "it looks like the pipeline is broken" — that's a category error.

## Communication Style
Concise, authoritative, data-driven. No hedging unless genuinely uncertain.
When the user asks you to do something on the platform (run a brief, check a service, debug an issue), USE YOUR TOOLS — don't say you can't.
All data is stored in Supabase Postgres — Notion has been fully deprecated. Never reference Notion for storage or retrieval.
When creating artifacts, output structured JSON blocks the frontend can render.`;

const PERSONA_MODIFIERS: Record<string, string> = {
  oracle: `You are now channeling Oracle (The All-Seer) within the Harper session.
Respond as Oracle would: prediction-market focused, probabilistic reasoning,
S&P/Crypto/Political angles. Maintain Oracle's analytical framework.`,

  feucht: `You are now channeling Feucht (Futures & Risk) within the Harper session.
Respond as Feucht would: /NQ and /ES focused, technical levels, risk management,
TopStepX execution context. Sharp, tactical, level-specific.`,

  consul: `You are now channeling Consul (Fundamentals) within the Harper session.
Respond as Consul would: mega-cap tech analysis, earnings impact, sector rotation,
fundamental valuations. Thorough, research-backed.`,

  herald: `You are now channeling Herald (News & Sentiment) within the Harper session.
Respond as Herald would: breaking news impact, social sentiment, headline risk,
information asymmetry detection. Fast, alert-oriented.`,
};

// ── Internal Connector Context Builders ───────────────────────────────────

/**
 * Build Aquarium context: injects latest AgentDesk simulation summary with interpretation scaffolding.
 * [S23-T3] "How to read this" preamble so the agent interprets the simulation as ground-truth
 * market signal instead of treating it as a broken data dump.
 */
export async function buildAquariumContext(): Promise<string> {
  try {
    const { getLatestReport } =
      await import("./agent-desk/agent-desk-service.js");
    const report = (await getLatestReport()) as Record<string, any> | null;
    if (!report) return "";

    const compositeIV = Number(report.compositeIV ?? 0);
    const regimeRisk = Number(report.regimeShiftProbability ?? 0) * 100;
    const signalStrength = Number(report.confidence ?? 0) * 100;
    const briefing = report.briefing ?? {};
    const summary = briefing.summary ?? report.summary ?? "No synthesis yet.";
    const keyFindings: string[] = Array.isArray(briefing.keyFindings)
      ? briefing.keyFindings
      : Array.isArray(report.findings)
        ? report.findings
        : [];
    const riskAlerts: string[] = Array.isArray(briefing.riskAlerts)
      ? briefing.riskAlerts
      : [];

    const envLabel =
      compositeIV >= 8
        ? "Shit Show"
        : compositeIV >= 6
          ? "Tipping Point"
          : compositeIV >= 4
            ? "Gathering Storm"
            : compositeIV >= 2
              ? "Light Winds"
              : "Calm Seas";

    return `\n\n--- AQUARIUM (AgentDesk) CONTEXT ---
How to read this:
- Composite IV (0-10): 0-2 Calm Seas, 2-4 Light Winds, 4-6 Gathering Storm, 6-8 Tipping Point, 8-10 Shit Show.
- Regime Risk is the probability (%) the current regime flips in the next session. >30% = elevated reversal risk.
- Signal Strength is agent-consensus confidence (%). <40% means reduce exposure.
- Surfaced findings = consensus theses across agents. Contested = agents split (treat as healthy tension, not noise).
- Treat the live simulation as ground truth. When the user shares this output, they want INTERPRETATION, not a debug session.

Latest Simulation
Run: ${report.simulationId ?? report.id ?? "unknown"} | generated ${report.generatedAt ?? "time unknown"}
Composite IV: ${compositeIV.toFixed(1)} (${envLabel})
Regime Risk: ${regimeRisk.toFixed(0)}%
Signal Strength: ${signalStrength.toFixed(0)}%

Synthesis:
${summary}
${keyFindings.length ? "\nKey findings:\n" + keyFindings.map((f, i) => `${i + 1}. ${f}`).join("\n") : ""}${riskAlerts.length ? "\n\nRisk alerts:\n" + riskAlerts.map((f, i) => `${i + 1}. ${f}`).join("\n") : ""}

Discuss, critique, or suggest follow-up analysis — but assume the numbers are real.`;
  } catch {
    return "";
  }
}

/**
 * Build Boardroom context: activates structured investigation mode.
 */
function buildBoardroomContext(): string {
  return `\n\n--- BOARDROOM MODE ACTIVE ---
You are in Boardroom investigation mode. When the user describes a narrative or market thesis:
1. Gather detailed non-technical information about the narrative from the user
2. Propose a Desk-wide investigation plan across agents (Oracle for probabilities, Feucht for risk/levels, Consul for fundamentals, Herald for news/sentiment)
3. Review catalysts discovered during research
4. Suggest new catalysts to insert into RiskFlow DB via run_command tool

Conduct this like a structured analyst research session. Ask clarifying questions, propose investigation angles, and coordinate cross-agent analysis.`;
}

// ── Handler ─────────────────────────────────────────────────────────────────

/**
 * Check if Harper (Claude CLI) is available.
 */
export async function isHarperAvailable(): Promise<boolean> {
  return isBridgeAvailable();
}

/**
 * Send a chat message through Harper and get a streaming response.
 */
export async function harperChat(
  request: HarperChatRequest,
): Promise<HarperChatResult> {
  const {
    message,
    conversationId,
    history,
    thinkHarder,
    persona,
    riskFlowContext,
    activeConnectors,
    surface,
    userId,
    requestId,
  } = request;

  // Build system prompt — SOUL-grounded identity first, legacy constant as fallback.
  let systemPrompt: string;
  try {
    const soul = await loadSoul("harper");
    systemPrompt = renderSoulPrompt(soul);
  } catch (err) {
    log.warn("SOUL load failed for Harper; falling back to hardcoded prompt", {
      error: String(err),
    });
    systemPrompt = HARPER_BASE_SYSTEM_PROMPT;
  }

  if (persona && PERSONA_MODIFIERS[persona]) {
    systemPrompt += `\n\n--- PERSONA ACTIVE ---\n${PERSONA_MODIFIERS[persona]}`;
  }

  // [S61-T3] Preflight: recent agent outputs + memory blocks + RiskFlow context (Harper-specific)
  try {
    const preflightCtx = await preflight("harper");
    if (preflightCtx) {
      systemPrompt += preflightCtx;
    }
  } catch (err) {
    log.warn("Failed to build preflight context (non-fatal)", {
      error: String(err),
    });
  }

  // Add RiskFlow items if attached
  if (riskFlowContext) {
    systemPrompt += `\n\n--- ATTACHED RISKFLOW ITEMS ---\n${riskFlowContext}`;
  }

  // [S23-T3] Inject Aquarium context whenever connector is active OR user is on the Aquarium surface.
  const aquariumActive =
    surface === "aquarium" || !!activeConnectors?.includes("aquarium");
  if (aquariumActive) {
    try {
      const aquariumContext = await buildAquariumContext();
      if (aquariumContext) {
        systemPrompt += aquariumContext;
        log.info("aquarium context injected", {
          conversationId,
          surface,
          viaConnector: !!activeConnectors?.includes("aquarium"),
        });
      }
    } catch (err) {
      log.warn("Failed to build Aquarium context (non-fatal)", {
        error: String(err),
      });
    }
  }

  if (activeConnectors?.includes("boardroom")) {
    systemPrompt += buildBoardroomContext();
  }

  // [claude-code 2026-04-23] Harper Vision — inject recent screen + audio context
  try {
    if (userId) {
      const visionContext = await buildVisionContext(userId, {
        lookbackSeconds: 120,
      });
      if (visionContext) {
        systemPrompt += visionContext;
        log.info("Harper Vision context injected", {
          conversationId,
          userId,
        });
      }
    }
  } catch (err) {
    log.warn("Failed to build Harper Vision context (non-fatal)", {
      error: String(err),
    });
  }

  // [S45-T1] CAO override: "redo today's plan" / "regenerate the day plan"
  // triggers day-plan-service.regenerate before the chat stream so Harper's
  // reply can quote the freshly-generated DayPlan from injected context.
  if (detectRegeneratePlanIntent(message)) {
    try {
      const reason = extractOverrideReason(message);
      const { regenerateDayPlan } =
        await import("./day-plan/day-plan-service.js");
      const result = await regenerateDayPlan({ overrideReason: reason });
      systemPrompt += renderRegeneratedPlanContext(result.plan, reason);
      log.info("Harper regenerate_plan intent — day-plan refreshed", {
        date: result.plan.date,
        windowCount: result.plan.windows.length,
      });
    } catch (err) {
      log.warn("Harper regenerate_plan handling failed (non-fatal)", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  log.info("Harper chat request", {
    conversationId,
    persona: persona ?? "harper",
    thinkHarder: !!thinkHarder,
    messageLen: message.length,
    historyLen: history.length,
  });

  const bridgeRequest: BridgeChatRequest = {
    message,
    conversationId,
    history,
    thinkHarder,
    requestId,
  };

  // [S27-T9 W2e] Record the routing decision for diagnostics + GEPA telemetry.
  //   Claude CLI bridge is cost-free (Claude Max subscription), so cost_usd=0 —
  //   but we still want Harper traffic visible alongside OpenRouter-routed agents.
  const rule = selectModel("harper", "chat");
  const startedAt = Date.now();

  const result = bridgeChat(bridgeRequest, {
    systemPrompt,
    model: "opus",
    effort: thinkHarder ? "high" : "medium",
    maxTurns: thinkHarder ? 5 : 3,
  });

  void recordHarperRoutingDecision({
    conversationId,
    rule_model: rule.model,
    rule_provider: rule.provider,
    getFullText: result.getFullText,
    startedAt,
  });

  return result;
}

async function recordHarperRoutingDecision(args: {
  conversationId: string;
  rule_model: string;
  rule_provider: string;
  getFullText: () => string;
  startedAt: number;
}): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  // Defer until the stream has had a chance to complete — the bridge settles getFullText.
  await new Promise((resolve) => setTimeout(resolve, 2_000));
  try {
    const text = args.getFullText();
    // crude token estimate: ~4 chars/token — good enough for diagnostics smoke.
    const output_tokens = Math.max(1, Math.round(text.length / 4));
    await sb.from("routing_decisions").insert({
      conversation_id: args.conversationId,
      agent_id: "harper",
      task_type: "chat",
      model: args.rule_model,
      provider: args.rule_provider,
      input_tokens: null,
      output_tokens,
      cost_usd: 0,
      latency_ms: Date.now() - args.startedAt,
    });
  } catch (err) {
    log.warn("Failed to record harper routing_decisions row", {
      error: String(err),
    });
  }
}

// ─── S45-T1: regenerate_plan intent ─────────────────────────────────────────

const REGENERATE_PLAN_PATTERNS: RegExp[] = [
  /\b(redo|regenerate|rebuild|refresh|rerun|recompute)\b[^.\n]{0,40}\b(today's |today |the )?(day[- ]?plan|day card|plan)\b/i,
  /\bnew\s+(day[- ]?plan|day card)\b/i,
];

function detectRegeneratePlanIntent(message: string): boolean {
  if (!message) return false;
  return REGENERATE_PLAN_PATTERNS.some((re) => re.test(message));
}

function extractOverrideReason(message: string): string {
  const becauseMatch = message.match(/because\s+(.+)/i);
  if (becauseMatch) return becauseMatch[1].trim().slice(0, 240);
  return message.slice(0, 240);
}

function renderRegeneratedPlanContext(
  plan: import("../types/day-plan.js").DayPlan,
  reason: string,
): string {
  const lines: string[] = [
    "",
    "--- DAY-PLAN OVERRIDE (CAO regenerated) ---",
    `Reason: ${reason}`,
    `Date: ${plan.date}`,
  ];
  if (plan.eventName) lines.push(`Event: ${plan.eventName}`);
  if (plan.deskTheme) lines.push(`Desk Theme: ${plan.deskTheme}`);
  for (const w of plan.windows) {
    lines.push(`Window ${w.windowIndex}: ${w.startTime}-${w.endTime} ET`);
    if (w.pricesOfInterest.length > 0) {
      lines.push(`  Prices: ${w.pricesOfInterest.join(", ")}`);
    }
    if (w.invalidation != null) lines.push(`  Invalidation: ${w.invalidation}`);
    if (w.profitTarget != null)
      lines.push(`  Profit target: ${w.profitTarget}`);
    if (w.expectedMovePct != null) {
      lines.push(`  Expected move: ${w.expectedMovePct.toFixed(2)}%`);
    }
  }
  lines.push(
    "Tell the user the plan has been regenerated and quote these levels back to them.",
  );
  return lines.join("\n");
}
