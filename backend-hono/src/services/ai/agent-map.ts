// [claude-code 2026-04-19] S27-T9 W2e: translate hermes-handler's HermesAgentRole into the
// canonical routing AgentId so selectModel() stays the single source of model truth.

import type { AgentId } from "./routing.js";

export type HermesAgentRole =
  | "harper-cao"
  | "pma-merged"
  | "futures-desk"
  | "fundamentals-desk"
  | "herald";

const HERMES_TO_ROUTING: Record<HermesAgentRole, AgentId> = {
  "harper-cao": "harper",
  "pma-merged": "oracle",
  "futures-desk": "feucht",
  "fundamentals-desk": "consul",
  herald: "herald",
};

export function toRoutingAgent(role: HermesAgentRole): AgentId {
  return HERMES_TO_ROUTING[role] ?? "harper";
}
