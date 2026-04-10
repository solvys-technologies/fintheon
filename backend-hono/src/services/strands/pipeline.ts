// [claude-code 2026-04-04] Strands Graph-based agent pipeline
// Replaces services/agents/pipeline.ts with Strands multi-agent orchestration
//
// Pipeline stages (v7.9):
//   Stage 1 (parallel): Herald (sentiment) + Market Data context
//   Stage 2: Oracle — PMA Combined (prediction markets + macro)
//   Stage 3: Consul — Fundamental overlay (bull/bear + debate)
//   Stage 4: Feucht — Risk check (proposal + risk assessment)
//
// Graph topology:
//   herald ──┐
//            ├──→ oracle ──→ consul ──→ feucht
//   (input) ─┘
//
// Herald and the initial market context run as source nodes (parallel).
// Oracle depends on Herald. Consul depends on Oracle. Feucht depends on Consul.

import { Graph } from "@strands-agents/sdk/multiagent";
import { createOracleAgent } from "./agents/oracle.js";
import { createFeuchtAgent } from "./agents/feucht.js";
import { createConsulAgent } from "./agents/consul.js";
import { createHeraldAgent } from "./agents/herald.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("StrandsPipeline");

export interface PipelineInput {
  /** User's query or trade thesis to evaluate */
  thesis: string;
  /** Optional market context (VIX, regime, etc.) */
  marketContext?: string;
  /** Include full debate (bull vs bear)? */
  includeDebate?: boolean;
  /** Include trade proposal generation? */
  includeProposal?: boolean;
}

/**
 * Create the PIC agent pipeline as a Strands Graph.
 *
 * The graph executes deterministically:
 * 1. Herald analyzes sentiment (source node, runs first)
 * 2. Oracle overlays prediction market + macro signals
 * 3. Consul provides fundamental overlay + debate
 * 4. Feucht validates risk + generates proposal
 */
export function createPICPipeline() {
  const herald = createHeraldAgent();
  const oracle = createOracleAgent();
  const consul = createConsulAgent();
  const feucht = createFeuchtAgent();

  const graph = new Graph({
    id: "pic-pipeline",
    nodes: [herald, oracle, consul, feucht],
    edges: [
      ["herald", "oracle"],
      ["oracle", "consul"],
      ["consul", "feucht"],
    ],
    maxConcurrency: 2,
    maxSteps: 10,
  });

  return graph;
}

/**
 * Run the full PIC pipeline and return the final result.
 */
export async function runPICPipeline(input: PipelineInput) {
  const startTime = Date.now();
  log.info("PIC pipeline started", { thesis: input.thesis.slice(0, 100) });

  const graph = createPICPipeline();

  const prompt = buildPipelinePrompt(input);
  const result = await graph.invoke(prompt);

  const duration = Date.now() - startTime;
  log.info("PIC pipeline complete", { durationMs: duration });

  return {
    result: result.toString(),
    durationMs: duration,
  };
}

/**
 * Stream the PIC pipeline for real-time frontend updates.
 */
export async function* streamPICPipeline(input: PipelineInput) {
  const startTime = Date.now();
  log.info("PIC pipeline stream started", {
    thesis: input.thesis.slice(0, 100),
  });

  const graph = createPICPipeline();
  const prompt = buildPipelinePrompt(input);

  for await (const event of graph.stream(prompt)) {
    yield event;
  }

  log.info("PIC pipeline stream complete", {
    durationMs: Date.now() - startTime,
  });
}

function buildPipelinePrompt(input: PipelineInput): string {
  const parts: string[] = [];

  if (input.marketContext) {
    parts.push(`[Market Context]\n${input.marketContext}`);
  }

  parts.push(`[Trading Thesis / Query]\n${input.thesis}`);

  if (input.includeDebate !== false) {
    parts.push(
      "[Instructions] Include a bull vs bear debate with conviction scoring.",
    );
  }
  if (input.includeProposal !== false) {
    parts.push(
      "[Instructions] Generate a trade proposal with entry/stop/target levels and risk assessment.",
    );
  }

  return parts.join("\n\n");
}
