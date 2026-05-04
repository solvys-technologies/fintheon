// [claude-code 2026-05-03] S58-T1: OpenRouter second-rung fallback for AI chain.
import type { ChainRequest } from "./provider-chain.js";

export async function generateTextViaOpenRouter(
  request: ChainRequest,
): Promise<string> {
  const messages = [] as Array<{ role: "system" | "user"; content: string }>;
  if (request.systemPrompt) {
    messages.push({ role: "system", content: request.systemPrompt });
  }
  messages.push({ role: "user", content: request.prompt });

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.OPENROUTER_APP_URL ?? "https://fintheon-solvys.vercel.app",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Fintheon-AI-Gateway",
    },
    body: JSON.stringify({
      model: toOpenRouterModel(request.model),
      messages,
      max_tokens: request.maxOutputTokens ?? 8192,
      temperature: request.temperature ?? 0.4,
    }),
    signal: AbortSignal.timeout(request.timeoutMs ?? 120_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter ${res.status}: ${text.slice(0, 200)}`);
  }
  const payload = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return payload.choices?.[0]?.message?.content ?? "";
}

function toOpenRouterModel(model?: string): string {
  if (!model || model === "deepseek-reasoner") return "deepseek/deepseek-reasoner";
  return model.includes("/") ? model : `deepseek/${model}`;
}
