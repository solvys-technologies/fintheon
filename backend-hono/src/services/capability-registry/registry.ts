import { createLogger } from "../../lib/logger.js";
import { AgentCapabilityProfileSchema, type AgentCapabilityProfile } from "./types.js";

const log = createLogger("capability-registry");

const CAPABILITY_REGISTRY: Record<string, AgentCapabilityProfile> = {
  harper: {
    agent_id: "harper",
    responsibilities: [
      "Orchestrate desk agents (Oracle, Feucht, Consul, Herald)",
      "Synthesize cross-desk signals into a single executive view",
      "Approve or reject trade proposals from Feucht",
      "Operate the Fintheon platform via command and file tools",
    ],
    required_tools: [
      "handoff_to_oracle",
      "handoff_to_feucht",
      "handoff_to_consul",
      "handoff_to_herald",
      "browse_task",
      "run_command",
      "read_file",
      "write_file",
      "web_fetch",
      "read_mcp_config",
      "get_fintheon_paths",
    ],
    optional_tools: ["all MCP tools"],
    prohibited_tools: [],
    handoff_targets: ["oracle", "feucht", "consul", "herald"],
  },

  oracle: {
    agent_id: "oracle",
    responsibilities: [
      "Extract implied probabilities from Kalshi, Polymarket, and options surfaces",
      "Quantify divergence between market-implied odds and data",
      "Feed the IV scoring engine with cross-domain context",
      "Flag regime transitions when uncorrelated markets shift together",
    ],
    required_tools: [
      "get_kalshi_quote",
      "get_polymarket_quote",
      "get_options_iv_surface",
      "handoff_to_harper",
    ],
    optional_tools: ["get_econ_calendar"],
    prohibited_tools: ["run_command", "write_file", "web_fetch"],
    handoff_targets: ["harper", "feucht", "consul"],
  },

  feucht: {
    agent_id: "feucht",
    responsibilities: [
      "/NQ, /MNQ, /ES technical analysis on 1s–15m timeframes",
      "Run the four approved trading models (40/40 Club, Flush, Ripper, 22 VIX Fixer)",
      "Monitor ES/NQ synchronicity and VWAP / EMA / Fib confluence",
      "Draft trade ideas for Harper approval — never execute autonomously",
    ],
    required_tools: [
      "get_quote",
      "get_vwap",
      "get_fib_levels",
      "get_ema_stack",
      "submit_trade_idea",
      "handoff_to_harper",
    ],
    optional_tools: ["get_econ_calendar"],
    prohibited_tools: ["run_command", "write_file", "web_fetch"],
    handoff_targets: ["harper", "oracle", "consul"],
  },

  consul: {
    agent_id: "consul",
    responsibilities: [
      "Mega-cap tech watchlist analysis (AAPL, MSFT, NVDA, GOOGL, AMZN, META, TSLA, AVGO, COST, NFLX)",
      "Earnings beats/misses, guidance revisions, forward P/E, sector rotation",
      "Alert classification (Level 1–3) and second-order effects mapping",
    ],
    required_tools: [
      "get_earnings_calendar",
      "get_analyst_revisions",
      "get_company_fundamentals",
      "get_sector_rotation",
      "handoff_to_harper",
    ],
    optional_tools: ["get_econ_calendar"],
    prohibited_tools: ["run_command", "write_file", "web_fetch"],
    handoff_targets: ["harper", "oracle", "feucht"],
  },

  herald: {
    agent_id: "herald",
    responsibilities: [
      "Sentiment intelligence across X/Twitter, AAII, put/call ratios, news velocity, unusual options flow",
      "Risk overlay on every trade idea (Risk Score 1–10, PROCEED / REDUCE SIZE / RECONSIDER)",
      "Contrarian enforcement when consensus is overwhelmingly bullish",
    ],
    required_tools: [
      "get_sentiment_skew",
      "get_aaii_survey",
      "get_put_call_ratio",
      "get_unusual_options_flow",
      "get_news_velocity",
      "handoff_to_harper",
    ],
    optional_tools: ["get_econ_calendar", "web_fetch"],
    prohibited_tools: ["run_command", "write_file"],
    handoff_targets: ["harper", "oracle", "feucht", "consul"],
  },
};

export function loadRegistry(): void {
  for (const [id, profile] of Object.entries(CAPABILITY_REGISTRY)) {
    const result = AgentCapabilityProfileSchema.safeParse(profile);
    if (!result.success) {
      log.warn(`Capability registry validation failed for agent ${id}`, {
        issues: result.error.issues,
      });
    }
  }
  log.info(`Capability registry loaded: ${Object.keys(CAPABILITY_REGISTRY).length} agents`);
}

export function getProfile(agentId: string): AgentCapabilityProfile {
  const profile = CAPABILITY_REGISTRY[agentId];
  if (!profile) throw new Error(`No capability profile for agent: ${agentId}`);
  return profile;
}

export function getAllProfiles(): AgentCapabilityProfile[] {
  return Object.values(CAPABILITY_REGISTRY);
}

export function getRequiredTools(agentId: string): string[] {
  const profile = CAPABILITY_REGISTRY[agentId];
  if (!profile) return [];
  return profile.required_tools;
}

export function getHandoffTargets(agentId: string): string[] {
  const profile = CAPABILITY_REGISTRY[agentId];
  if (!profile) return [];
  return profile.handoff_targets;
}

loadRegistry();
