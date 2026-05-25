// [claude-code 2026-05-05] S59-T1: Native agent runtime.
// Takes agent_id + message → loads SOUL → injects memory → calls DeepSeek → parses response.
// Drop-in replacement for what hermes-sidecar/runtime.py pretended to do.

import { buildContext } from "./context-engine.js";
import { generateTextViaOllama } from "../ai/ollama-hermes-client.js";
import type { AgentId, ChatEvent } from "./types.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("HermesRuntime");

export interface HermesChatOptions {
  model?: string;
  temperature?: number;
  maxOutputTokens?: number;
  stream?: boolean;
  timeoutMs?: number;
}

export interface HermesChatResult {
  content: string;
  tokens?: {
    in: number;
    out: number;
  };
}

export async function hermesChat(
  agentId: AgentId,
  userMessage: string,
  history: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [],
  options: HermesChatOptions = {},
): Promise<HermesChatResult> {
  const messages = [
    ...history,
    { role: "user" as const, content: userMessage },
  ];

  const ctx = await buildContext(agentId, messages, 120_000);

  const promptMessages = [
    { role: "system" as const, content: ctx.systemPrompt },
    ...ctx.messages,
  ];

  const fullPrompt = promptMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n");

  log.info("hermesChat invoking DeepSeek", {
    agentId,
    tokenBudget: ctx.tokenBreakdown.total,
    messageCount: ctx.messages.length,
  });

  const response = await generateTextViaOllama({
    prompt: fullPrompt,
    systemPrompt: ctx.systemPrompt,
    model: options.model,
    temperature: options.temperature ?? 0.3,
    maxOutputTokens: options.maxOutputTokens ?? 8192,
    timeoutMs: options.timeoutMs ?? 120_000,
  });

  return {
    content: response,
    tokens: {
      in: ctx.tokenBreakdown.total,
      out: Math.ceil(response.length / 4),
    },
  };
}

export async function* hermesChatStream(
  agentId: AgentId,
  userMessage: string,
  history: Array<{
    role: "user" | "assistant" | "system";
    content: string;
  }> = [],
  options: HermesChatOptions = {},
): AsyncGenerator<ChatEvent> {
  const result = await hermesChat(agentId, userMessage, history, options);

  const chunkSize = 20;
  for (let i = 0; i < result.content.length; i += chunkSize) {
    yield {
      type: "delta",
      payload: { text: result.content.slice(i, i + chunkSize) },
    };
    await new Promise((resolve) => setTimeout(resolve, 5));
  }

  yield {
    type: "done",
    payload: {
      finish_reason: "stop",
      tokens_in: result.tokens?.in,
      tokens_out: result.tokens?.out,
    },
  };
}
