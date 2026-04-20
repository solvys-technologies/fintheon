// [claude-code 2026-03-26] T4: Prompt wiring — cross-agent thought bank awareness
import type { ThoughtBankContext } from "../../../types/thought-bank.js";
import type { AgentName } from "../../../types/context-bank.js";
import { VALID_AGENTS } from "../../../types/context-bank.js";

/**
 * Format thought bank context into a prompt block for agent system prompts.
 * Each agent sees what OTHER agents have been analyzing recently.
 * This creates the "collective plane of individual thoughts".
 */
export function formatThoughtBankBlock(thoughts: ThoughtBankContext[]): string {
  if (thoughts.length === 0) return "";

  const entries = thoughts.map((t) => {
    const instruments =
      t.instruments.length > 0 ? ` [${t.instruments.join(", ")}]` : "";
    const confidence = Math.round(t.confidence * 100);
    const age =
      t.ageMinutes < 60
        ? `${Math.round(t.ageMinutes)}m ago`
        : `${Math.round(t.ageMinutes / 60)}h ago`;
    const title = t.title ? `"${t.title}"` : "(untitled)";

    return `- **${t.agent}** — ${title}${instruments} (${confidence}% confidence, ${age})\n  ${t.briefSummary}`;
  });

  return `

## Collective Thought Plane — What Other Agents Are Thinking

The following are recent analyses from your fellow PIC agents. Reference their thinking when relevant — you are part of a collaborative intelligence network, not operating in isolation. If another agent's analysis contradicts yours, acknowledge the disagreement and explain your reasoning.

${entries.join("\n\n")}

To see any agent's full analysis, the Human Executive can type "@AgentName show full analysis" in the Boardroom.

### Your Thought Bank
When you respond, your full analysis is automatically stored in the Thought Bank for other agents to reference. The Boardroom only shows your brief take — be conversational and concise there. Your deep thinking is preserved and accessible.
`;
}

/**
 * Build the complete thought bank context string for a specific agent.
 * Called by hermes-handler.ts before building the system prompt.
 * Returns empty string if no recent thoughts exist.
 */
export async function buildThoughtBankPromptBlock(
  currentAgent: string,
): Promise<string> {
  try {
    const { buildThoughtBankContext } =
      await import("../../thought-bank-store.js");

    const agentName: AgentName = VALID_AGENTS.includes(
      currentAgent as AgentName,
    )
      ? (currentAgent as AgentName)
      : "Harper";

    const thoughts = await buildThoughtBankContext(agentName, 3);
    let block = formatThoughtBankBlock(thoughts);

    // S13-T3: Append relevant shared memory entries (regime context)
    try {
      const { listSharedMemory } = await import("../../peers/shared-memory.js");
      const regimeEntries = await listSharedMemory({ category: "regime" });
      if (regimeEntries.length > 0) {
        const lines = regimeEntries.slice(0, 5).map((e) => {
          // S28-T1: prefer a plain-text summary field over a raw JSON dump
          // so analyst dossiers stored in shared memory can't leak their
          // `{"agentId":...}` shape into the agent's system prompt.
          const v = e.value as Record<string, unknown> | string | null;
          const display =
            typeof v === "string"
              ? v
              : ((v as Record<string, unknown>)?.summary ??
                (v as Record<string, unknown>)?.text ??
                (v as Record<string, unknown>)?.note ??
                "");
          const safe = String(display).slice(0, 300);
          return `- **${e.key}** (${e.agentName ?? "system"}): ${safe || "(no summary)"}`;
        });
        block += `\n\n## Shared Team Memory — Regime Context\n\n${lines.join("\n")}\n`;
      }
    } catch {
      /* shared memory not available — non-fatal */
    }

    return block;
  } catch (error) {
    console.error("[ThoughtBankAwareness] Failed to build context:", error);
    return "";
  }
}
