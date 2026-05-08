// [claude-code 2026-05-07] S61-T2: Capability enforcer — tool permission checks at runtime
import { getProfile } from "./registry.js";
import type { AgentCapabilityProfile, RegistryEnforcementResult } from "./types.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("capability-registry");

export function enforceCapability(
  agentId: AgentCapabilityProfile["agent_id"],
  toolName: string,
): RegistryEnforcementResult {
  const profile = getProfile(agentId);

  if (profile.prohibited_tools.includes(toolName)) {
    const reason = "prohibited tool";
    log.info(`DENIED: ${agentId} → ${toolName} (${reason})`);
    return { allowed: false, reason };
  }

  if (profile.required_tools.includes(toolName)) {
    const reason = "required tool";
    return { allowed: true, reason };
  }

  if (profile.optional_tools.includes(toolName)) {
    const reason = "optional tool";
    return { allowed: true, reason };
  }

  const reason = "unknown tool — not in required, optional, or prohibited lists";
  log.info(`DENIED: ${agentId} → ${toolName} (${reason})`);
  return { allowed: false, reason };
}
