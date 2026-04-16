// [claude-code 2026-04-16] T4: Builds memory context block for agent prompt injection
// Returns formatted string with last 3 deliberation outputs + accuracy feedback

import { getMemories } from "./memory-store.js";
import { composeFeedback } from "./feedback-composer.js";
import type { AgentId } from "./types.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("MemoryInjector");

/**
 * Build a memory context block for an agent's prompt.
 * Includes: recent deliberation outputs, accuracy feedback, REFLECT findings.
 */
export async function buildMemoryBlock(agentId: AgentId): Promise<string> {
  const sections: string[] = [];

  try {
    // 1. Last 3 deliberation outputs
    const deliberations = await getMemories(agentId, "deliberation_output", 3);
    if (deliberations.length > 0) {
      sections.push("## Your Recent Deliberation History");
      for (const mem of deliberations) {
        const date = new Date(mem.createdAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
        sections.push(`[${date}] ${mem.content}`);
      }
    }

    // 2. Accuracy feedback (composed from resolved outcomes)
    const feedback = await composeFeedback(agentId);
    if (feedback) {
      sections.push("## Your Prediction Accuracy");
      sections.push(feedback.summary);
      if (feedback.predictions.length > 0) {
        sections.push(
          `Direction accuracy: ${feedback.overallDirectionAccuracy.toFixed(0)}% | ` +
            `Avg magnitude error: ${feedback.overallMagnitudeError.toFixed(1)} pts`,
        );
      }
    }

    // 3. REFLECT findings (latest)
    const reflectFindings = await getMemories(agentId, "reflect_finding", 3);
    if (reflectFindings.length > 0) {
      sections.push("## REFLECT Insights (Scoring Quality)");
      for (const mem of reflectFindings) {
        sections.push(`- ${mem.content}`);
      }
    }

    // 4. Learned patterns (persistent insights)
    const patterns = await getMemories(agentId, "learned_pattern", 3);
    if (patterns.length > 0) {
      sections.push("## Learned Patterns");
      for (const mem of patterns) {
        sections.push(`- ${mem.content}`);
      }
    }
  } catch (err) {
    log.warn("Failed to build memory block", {
      agent: agentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  if (sections.length === 0) return "";

  return "\n<agent-memory>\n" + sections.join("\n") + "\n</agent-memory>\n";
}
