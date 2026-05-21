import { createLogger } from "../../lib/logger.js";
import { getRecentOutputs } from "./agent-outputs.js";
import { getContextForAgent } from "../agent-context-bank-service.js";
import { buildFeedContext } from "../ai/agent-instructions/index.js";

const log = createLogger("desk-context");

const MAX_BLOCK_CHARS = 2000;
const SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000";

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 3) + "...";
}

/**
 * Assemble a desk context block for an agent before external tool use.
 * Includes: recent agent outputs, relevant memory blocks, and (Harper-only) RiskFlow context.
 * Each source is wrapped in try/catch — failure in one never blocks the rest.
 * Returns empty string on full degradation (Supabase down, unknown agent, etc.).
 * Maximum 2000 characters per context block to preserve token budget.
 */
export async function preflight(agentId: string): Promise<string> {
  const parts: string[] = [];

  // Recent agent outputs from ops feed / context bank
  try {
    const outputs = await getRecentOutputs(agentId);
    if (outputs.length > 0) {
      const block = outputs.join("\n");
      parts.push(
        `## Desk Context (Recent Activity)\n${truncate(block, MAX_BLOCK_CHARS)}`,
      );
    }
  } catch (err) {
    log.warn("preflight: getRecentOutputs failed", {
      agentId,
      error: String(err),
    });
  }

  // Relevant memory blocks from agent context bank
  try {
    const memories = await getContextForAgent(SYSTEM_USER_ID, agentId);
    if (memories.length > 0) {
      const memLines = memories
        .slice(0, 10)
        .map((m) => `- ${m.content.slice(0, 150)}`)
        .join("\n");
      parts.push(`## Relevant Memory\n${truncate(memLines, MAX_BLOCK_CHARS)}`);
    }
  } catch (err) {
    log.warn("preflight: getContextForAgent failed", {
      agentId,
      error: String(err),
    });
  }

  // Harper gets additional RiskFlow context (IV≥5 items, last 4h, top 10)
  if (agentId === "harper") {
    try {
      const feedCtx = await buildFeedContext();
      if (feedCtx) {
        parts.push(truncate(feedCtx, MAX_BLOCK_CHARS));
      }
    } catch (err) {
      log.warn("preflight: buildFeedContext failed", {
        agentId,
        error: String(err),
      });
    }
  }

  if (parts.length === 0) return "";

  return `\n\n--- DESK PREFLIGHT CONTEXT ---\n${parts.join("\n\n")}`;
}
