// [claude-code 2026-04-15] Per-agent thinking phrases for Boardroom DAG deliberation
import type { HermesAgentId } from "../../backend-hono/src/services/agent-bus/types";

export const AGENT_THINKING_PHRASES: Record<HermesAgentId, string[]> = {
  oracle: [
    "Scanning volatility surfaces...",
    "Mapping implied vol term structure...",
    "Reading gamma exposure levels...",
    "Probing dark pool flow patterns...",
    "Calibrating vol-of-vol metrics...",
    "Analyzing options skew signals...",
  ],
  feucht: [
    "Modeling futures curve dynamics...",
    "Stress-testing risk exposures...",
    "Analyzing roll yield structure...",
    "Calculating tail risk scenarios...",
    "Measuring correlation breakdowns...",
    "Evaluating margin requirements...",
  ],
  consul: [
    "Reviewing earnings revisions...",
    "Parsing macro indicators...",
    "Weighing fundamental catalysts...",
    "Assessing sector rotation signals...",
    "Analyzing balance sheet strength...",
    "Cross-referencing economic releases...",
  ],
  herald: [
    "Monitoring breaking headlines...",
    "Gauging market sentiment shifts...",
    "Tracking social media velocity...",
    "Scoring news impact magnitude...",
    "Filtering signal from noise...",
    "Measuring narrative momentum...",
  ],
  harper: [
    "Synthesizing agent consensus...",
    "Weighting conviction scores...",
    "Reconciling divergent signals...",
    "Building final assessment...",
    "Harmonizing risk perspectives...",
    "Distilling actionable insight...",
  ],
};
