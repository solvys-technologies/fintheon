// [claude-code 2026-03-19] T1: Breaking news huddle — agent round-robin on Level 4 events

import { handleHermesChat } from "./hermes-handler.js";
import { appendToBoardroom } from "./hermes-sessions.js";
import type { FeedItem } from "../types/riskflow.js";
import type { HermesAgentRole } from "./hermes-service.js";

let lastHuddleTime = 0;
const HUDDLE_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

const AGENTS: Array<{ role: HermesAgentRole; name: string }> = [
  { role: "harper-cao", name: "Harper" },
  { role: "pma-merged", name: "Oracle" },
  { role: "futures-desk", name: "Feucht" },
  { role: "fundamentals-desk", name: "Consul" },
  { role: "herald", name: "Herald" },
];

export async function triggerHuddle(event: FeedItem): Promise<void> {
  if (Date.now() - lastHuddleTime < HUDDLE_COOLDOWN_MS) {
    console.log("[Huddle] Cooldown active, skipping");
    return;
  }

  lastHuddleTime = Date.now();

  await appendToBoardroom(
    `[HUDDLE TRIGGERED] ${event.headline}\nSource: ${event.source} | Urgency: ${event.urgency} | Sentiment: ${event.sentiment ?? "unknown"}`,
    "assistant",
  );

  for (const agent of AGENTS) {
    const prompt = `[HUDDLE] Breaking Level 4 event: "${event.headline}". Body: ${event.body ?? "N/A"}. Symbols: ${event.symbols.join(", ")}. Provide your domain-specific assessment in 2-3 sentences.`;
    try {
      const response = await handleHermesChat({
        message: prompt,
        agentOverride: agent.role,
      });
      await appendToBoardroom(
        `**${agent.name}** (Huddle):\n${response.content}`,
        "assistant",
      );
    } catch (err) {
      console.error(`[Huddle] Agent ${agent.name} failed:`, err);
      await appendToBoardroom(
        `**${agent.name}** (Huddle): [Error — agent unavailable]`,
        "assistant",
      );
    }
  }

  // Harper consolidates
  const consolidatePrompt =
    "[HUDDLE] As CAO, consolidate the team assessments above into a 2-sentence action recommendation.";
  try {
    const harperResponse = await handleHermesChat({
      message: consolidatePrompt,
      agentOverride: "harper-cao",
    });
    await appendToBoardroom(
      `**Harper** (Huddle Summary):\n${harperResponse.content}`,
      "assistant",
    );
  } catch (err) {
    console.error("[Huddle] Harper consolidation failed:", err);
  }

  console.log("[Huddle] Complete for:", event.headline);
}
