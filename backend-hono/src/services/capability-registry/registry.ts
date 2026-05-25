// [claude-code 2026-05-07] S61-T2: Static capability registry — 5 agents with validated profiles
import {
  AgentCapabilityProfileSchema,
  type AgentCapabilityProfile,
} from "./types.js";

type AgentId = AgentCapabilityProfile["agent_id"];

const CAPABILITY_PROFILES: Omit<AgentCapabilityProfile, "agent_id">[] = [
  {
    responsibilities: [
      "Executive synthesis across all desks",
      "Approve or reject trade proposals from Feucht",
      "Orchestrate cross-desk analysis",
      "Operate platform via run_command / read_file / write_file / web_fetch / MCP",
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
    optional_tools: ["lockout"],
    prohibited_tools: [],
    handoff_targets: ["oracle", "feucht", "consul", "herald"],
  },
  {
    responsibilities: [
      "Extract implied probabilities from prediction markets",
      "Cross-reference market-implied odds with data",
      "Feed IV scoring engine with cross-domain context",
      "Flag regime transitions",
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
  {
    responsibilities: [
      "Technical analysis on /NQ, /MNQ, /ES",
      "Execute via TopStepX with drawdown constraints",
      "Run approved trading models (40/40 Club, Flush, Ripper, 22 VIX Fixer)",
      "Draft trade ideas with entry/stop/target/R:R",
    ],
    required_tools: [
      "get_quote",
      "get_vwap",
      "get_fib_levels",
      "get_ema_stack",
      "submit_trade_idea",
      "handoff_to_harper",
    ],
    optional_tools: ["get_econ_calendar", "lockout"],
    prohibited_tools: ["run_command", "write_file", "web_fetch"],
    handoff_targets: ["harper", "oracle", "consul"],
  },
  {
    responsibilities: [
      "Mega-cap fundamentals and earnings analysis",
      "Sector rotation and forward P/E tracking",
      "Alert-level classification (Level 1-3)",
      "Second-order effects mapping",
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
  {
    responsibilities: [
      "Sentiment intelligence across social and survey data",
      "Risk overlay on every trade idea",
      "Cross-desk exposure audit",
      "Contrarian enforcement in bullish environments",
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
];

const agentIds: AgentId[] = ["harper", "oracle", "feucht", "consul", "herald"];

let registry: Record<string, AgentCapabilityProfile> | null = null;

export function loadRegistry(): Record<string, AgentCapabilityProfile> {
  if (registry) return registry;

  const built: Record<string, AgentCapabilityProfile> = {};
  for (let i = 0; i < agentIds.length; i++) {
    const agentId = agentIds[i];
    const profile = { agent_id: agentId, ...CAPABILITY_PROFILES[i] };
    const result = AgentCapabilityProfileSchema.safeParse(profile);
    if (!result.success) {
      console.warn(
        `[capability-registry] Invalid profile for "${agentId}":`,
        result.error.flatten(),
      );
      continue;
    }
    built[agentId] = result.data;
  }
  registry = built;
  return built;
}

export function getProfile(agentId: AgentId): AgentCapabilityProfile {
  const r = loadRegistry();
  const profile = r[agentId];
  if (!profile) {
    throw new Error(`No capability profile for agent "${agentId}"`);
  }
  return profile;
}

export function getAllProfiles(): AgentCapabilityProfile[] {
  return Object.values(loadRegistry());
}

export function getRequiredTools(agentId: AgentId): string[] {
  return getProfile(agentId).required_tools;
}

export function getHandoffTargets(agentId: AgentId): string[] {
  return getProfile(agentId).handoff_targets;
}
