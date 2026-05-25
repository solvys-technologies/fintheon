// [codex 2026-05-07] S61-T3: Agent desk context preflight for all native agents.
// [claude-code 2026-05-13] Inject lockout state into agent context

import { createLogger } from "../../lib/logger.js";
import type { AgentId } from "../hermes/types.js";
import { getContextForAgent } from "../agent-context-bank-service.js";
import { getMemories } from "../agent-memory/memory-store.js";
import { buildFeedContext } from "../ai/agent-instructions/index.js";
import { generateDayPlan } from "../day-plan/day-plan-service.js";
import { getRecentOutputs } from "./agent-outputs.js";
import { getLockoutSummary } from "../lockout.js";
import { buildDeskStyleContext } from "../coliseum/agent-style.js";

const log = createLogger("desk-context");

const MAX_PREFLIGHT_CHARS = 2_000;
const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";
const DEFAULT_TEAM_ID = "pic";
const VALID_AGENTS = new Set<AgentId>([
  "harper",
  "oracle",
  "feucht",
  "consul",
  "herald",
]);

export interface PreflightOptions {
  userId?: string;
  includeArbitrumChamber?: boolean;
}

export async function preflight(
  agentId: string,
  options: PreflightOptions = {},
): Promise<string> {
  const normalized = normalizeAgentId(agentId);
  if (!normalized) return "";

  const sections: string[] = [];

  await pushSection(sections, "Desk Context (Recent Activity)", async () => {
    const outputs = await getRecentOutputs(normalized, 24);
    return outputs.map((output) => `- ${output}`);
  });

  await pushSection(sections, "Relevant Memory", async () => {
    const userId = options.userId ?? DEFAULT_USER_ID;
    const [contextBank, longTerm] = await Promise.all([
      getContextForAgent(userId, normalized).catch((err) => {
        log.warn("context bank read failed", {
          agentId: normalized,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }),
      getMemories(normalized, undefined, 6).catch((err) => {
        log.warn("agent memory read failed", {
          agentId: normalized,
          error: err instanceof Error ? err.message : String(err),
        });
        return [];
      }),
    ]);

    return [
      ...contextBank.slice(0, 6).map((entry) => {
        const label = entry.memory_type ?? "memory";
        return `- [${label}] ${clip(entry.content, 220)}`;
      }),
      ...longTerm.slice(0, 6).map((entry) => {
        return `- [${entry.memoryType}] ${clip(entry.content, 220)}`;
      }),
    ];
  });

  await pushSection(sections, "Active Desk Plan", async () => {
    const { plan } = await generateDayPlan({ teamId: DEFAULT_TEAM_ID });
    if (!plan) return [];
    const windows = plan.windows.slice(0, 3).map((w) => {
      const prices = w.pricesOfInterest?.length
        ? ` | POI ${w.pricesOfInterest.join(", ")}`
        : "";
      const entries = w.entries?.length
        ? ` | entries ${w.entries.join(", ")}`
        : "";
      const target = w.profitTarget ? ` | target ${w.profitTarget}` : "";
      const event = w.eventName ? ` | event ${w.eventName}` : "";
      return `- ${w.startTime}-${w.endTime}${event}${prices}${entries}${target}`;
    });
    return [
      `- Theme: ${clip(plan.deskTheme ?? "No desk theme set.", 320)}`,
      ...windows,
    ];
  });

  await pushSection(sections, "Lockout Status", async () => {
    return [getLockoutSummary(options.userId)];
  });

  if (normalized === "harper" || normalized === "oracle") {
    await pushSection(sections, "Desk Style", buildDeskStyleContext);
  }

  if (normalized === "harper") {
    await pushRaw(sections, async () => {
      const feed = await buildFeedContext();
      return feed ? `## Harper RiskFlow Context${feed}` : "";
    });

    if (options.includeArbitrumChamber) {
      await pushRaw(sections, async () => {
        const { buildArbitrumChamberContext } =
          await import("../harper-handler.js");
        const arbitrumChamber = await buildArbitrumChamberContext();
        return arbitrumChamber
          ? `## ArbitrumChamber Context${arbitrumChamber}`
          : "";
      });
    }
  }

  if (sections.length === 0) return "";

  return clip(
    `\n\n<desk-context>\n${sections.join("\n\n")}\n</desk-context>`,
    MAX_PREFLIGHT_CHARS,
  );
}

function normalizeAgentId(agentId: string): AgentId | null {
  const normalized = agentId.toLowerCase();
  const aliases: Record<string, AgentId> = {
    "harper-cao": "harper",
    "pma-merged": "oracle",
    "futures-desk": "feucht",
    "fundamentals-desk": "consul",
    herald: "herald",
  };
  const candidate = aliases[normalized] ?? normalized;
  return VALID_AGENTS.has(candidate as AgentId) ? (candidate as AgentId) : null;
}

async function pushSection(
  sections: string[],
  heading: string,
  read: () => Promise<string[]>,
): Promise<void> {
  try {
    const lines = (await read()).filter(Boolean);
    if (lines.length > 0) sections.push(`## ${heading}\n${lines.join("\n")}`);
  } catch (err) {
    log.warn("preflight section failed", {
      heading,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function pushRaw(
  sections: string[],
  read: () => Promise<string>,
): Promise<void> {
  try {
    const block = await read();
    if (block.trim()) sections.push(block.trim());
  } catch (err) {
    log.warn("preflight raw block failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 15)).trimEnd()}\n[truncated]`;
}
