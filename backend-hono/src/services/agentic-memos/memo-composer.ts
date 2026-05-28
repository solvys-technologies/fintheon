import { createLogger } from "../../lib/logger.js";
import { chatSync } from "../hermes/client.js";
import { createMemoDraft, hasMemoForSourceRefs } from "../desk-inbox/index.js";
import type { DeskInboxItem } from "../desk-inbox/types.js";
import type { DriftEvent } from "./drift-detector.js";
import type { FeedItem } from "../../types/riskflow.js";

const log = createLogger("MemoComposer");

interface AgentInputs {
  oracle: string;
  feucht: string;
  consul: string;
  herald: string;
}

export async function composeMemo(
  event: DriftEvent,
  deskId = "priced-in-capital",
): Promise<DeskInboxItem | null> {
  if (await hasMemoForSourceRefs(event.sourceRefs, deskId)) {
    log.info("Memo already exists for source refs, skipping", { id: event.id });
    return null;
  }
  const ctx = buildContext(event);
  const inputs = await gatherAgentInputs(ctx, event);
  const body = await harperCompose(event, inputs);
  return createMemoDraft({
    deskId,
    title: event.title,
    summary: event.summary,
    body,
    confidence: event.confidence,
    tickers: event.tickers,
    sourceRefs: event.sourceRefs,
    catalystDriftSessions: event.driftSessions,
  });
}

async function gatherAgentInputs(
  ctx: string,
  event: DriftEvent,
): Promise<AgentInputs> {
  const tickers = event.tickers.join(", ") || "Macro";
  const [oracle, feucht, consul, herald] = await Promise.all([
    callAgent(
      "oracle",
      `Context:\n${ctx}\n\nProvide a 2-sentence probability and prediction-market read for this RiskFlow drift event.`,
    ),
    callAgent(
      "feucht",
      `Context:\n${ctx}\n\nProvide a 2-sentence execution-risk and chart-state read for ${tickers}.`,
    ),
    callAgent(
      "consul",
      `Context:\n${ctx}\n\nProvide a 2-sentence fundamental and sector context for this catalyst drift.`,
    ),
    callAgent(
      "herald",
      `Context:\n${ctx}\n\nProvide a 2-sentence headline-velocity and social-signal read for this drift event.`,
    ),
  ]);
  return { oracle, feucht, consul, herald };
}

async function harperCompose(
  event: DriftEvent,
  inputs: AgentInputs,
): Promise<string> {
  try {
    const body = await chatSync("harper", buildHarperPrompt(event, inputs));
    if (body && body.length > 120) return body;
  } catch (err) {
    log.warn("Harper AI call failed, using template fallback", {
      err: String(err),
    });
  }
  return buildFallbackBody(event, inputs);
}

async function callAgent(
  agentId: "oracle" | "feucht" | "consul" | "herald",
  prompt: string,
): Promise<string> {
  try {
    const result = await chatSync(agentId, prompt);
    return result?.trim() ?? "";
  } catch {
    return "";
  }
}

function buildContext(event: DriftEvent): string {
  return [
    `Title: ${event.title}`,
    `Tickers: ${event.tickers.join(", ") || "Macro"}`,
    `Drift: ${event.driftSessions.toFixed(1)} sessions`,
    `Confidence: ${Math.round(event.confidence * 100)}%`,
    `Top headline: ${event.items[0]?.headline ?? "—"}`,
    `Source refs: ${event.sourceRefs.slice(0, 3).join(", ")}`,
  ].join("\n");
}

function buildHarperPrompt(event: DriftEvent, inputs: AgentInputs): string {
  const evidence = event.sourceRefs.map((ref) => `- ${ref}`).join("\n");
  return `You are Harper, CAO at Priced In Capital. Write a concise desk memo in Streamdown-compatible markdown. Keep it under 350 words. No trade orders. No direct execution. Drafts go to Inbox for approval only.

Event context:
${buildContext(event)}

Specialist inputs:
Oracle: ${inputs.oracle || "No input."}
Feucht: ${inputs.feucht || "No input."}
Consul: ${inputs.consul || "No input."}
Herald: ${inputs.herald || "No input."}

Write the memo with these exact sections:
# Harper Memo: [concise title]
## Catalyst
## What Changed
## Why It Matters
## Drift Duration
## Confidence
## Agent Inputs
## Cited Evidence
${evidence}
## Next Action`;
}

function buildFallbackBody(event: DriftEvent, inputs: AgentInputs): string {
  const evidence = event.sourceRefs.map((ref) => `- ${ref}`).join("\n");
  const rows = event.items
    .slice(0, 4)
    .map(
      (item: FeedItem) =>
        `| ${item.symbols?.[0] ?? "Macro"} | ${(item.ivScore ?? 0).toFixed(1)} | ${item.headline.slice(0, 78)} |`,
    )
    .join("\n");

  return `# ${event.title}

## Catalyst
${event.items[0]?.headline ?? event.summary}

## What Changed
${event.summary}

| Ticker | IV | Headline |
| --- | ---: | --- |
${rows}

## Why It Matters
Signal drifted ${event.driftSessions.toFixed(1)} sessions — desk thesis may need updating before next session opens.

## Drift Duration
${event.driftSessions.toFixed(1)} sessions

## Confidence
${Math.round(event.confidence * 100)}%

## Agent Inputs
**Oracle:** ${inputs.oracle || "—"}
**Feucht:** ${inputs.feucht || "—"}
**Consul:** ${inputs.consul || "—"}
**Herald:** ${inputs.herald || "—"}

## Cited Evidence
${evidence}

## Next Action
Desk to confirm whether second-session evidence warrants a published thesis update. Approve in Inbox before publishing. No trade execution.
`;
}
