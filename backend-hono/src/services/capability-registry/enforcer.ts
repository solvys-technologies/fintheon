import { createLogger } from "../../lib/logger.js";
import { getProfile, getRequiredTools, getHandoffTargets } from "./registry.js";
import type { RegistryEnforcementResult } from "./types.js";

const log = createLogger("capability-registry");

export function enforceCapability(
  agentId: string,
  toolName: string,
): RegistryEnforcementResult {
  let profile;
  try {
    profile = getProfile(agentId);
  } catch {
    return { allowed: false, reason: `unknown agent: ${agentId}` };
  }

  if (profile.prohibited_tools.includes(toolName)) {
    log.warn(`Tool denied: ${agentId} → ${toolName} (prohibited)`, { agentId, toolName });
    return { allowed: false, reason: "prohibited tool" };
  }

  if (profile.required_tools.includes(toolName)) {
    return { allowed: true, reason: "required tool" };
  }

  if (profile.optional_tools.includes(toolName)) {
    return { allowed: true, reason: "optional tool" };
  }

  return { allowed: false, reason: "tool not in capability profile" };
}

export { getHandoffTargets, getRequiredTools };
