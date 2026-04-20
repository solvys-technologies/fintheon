// [claude-code 2026-04-20] S28-T1: agent-triggered voice reply.
// Generates a voice-native reply for the routed agent (Coach / Oracle / Harper)
// and speaks it back through the user's Omi via speakToUser. This is the
// agent side of the Omi voice loop — webhook transcript → reply → earbuds.

import { COACH_SYSTEM_PROMPT } from "../ai/agent-instructions/coach.js";
import { ORACLE_FAST_VOICE_PROMPT } from "../ai/agent-instructions/oracle-fast-voice.js";
import { createLogger } from "../../lib/logger.js";
import { speakToUser } from "./speak.js";
import type { OmiPrimaryAgent } from "./types.js";

const log = createLogger("OmiAgentReply");

const AGENT_PROMPTS: Record<OmiPrimaryAgent, string> = {
  coach: COACH_SYSTEM_PROMPT,
  oracle: ORACLE_FAST_VOICE_PROMPT,
  harper: `You are Harper, CAO of Priced In Capital, speaking to the trader through earbuds via Omi. Respond in at most two short sentences. No markdown, no lists, no URLs. This is speech.`,
};

const REPLY_MODEL = process.env.OMI_REPLY_MODEL ?? "anthropic/claude-haiku-4.5";

async function generateReply(
  agent: OmiPrimaryAgent,
  utterance: string,
  preamble?: string,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return "";

  const system =
    AGENT_PROMPTS[agent] + (preamble ? `\n\nLead with: "${preamble}"` : "");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.OPENROUTER_APP_URL ?? "https://fintheon-solvys.vercel.app",
      "X-Title": process.env.OPENROUTER_APP_NAME ?? "Fintheon-Omi-Voice",
    },
    body: JSON.stringify({
      model: REPLY_MODEL,
      max_tokens: 180,
      messages: [
        { role: "system", content: system },
        { role: "user", content: utterance },
      ],
    }),
  });

  if (!res.ok) {
    log.warn("openrouter reply failed", {
      status: res.status,
      body: await res.text().catch(() => ""),
    });
    return "";
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function speakAgentReply(
  userId: string,
  agent: OmiPrimaryAgent,
  utterance: string,
  preamble?: string,
): Promise<void> {
  const text = utterance.trim();
  if (!text) return;

  try {
    const reply = await generateReply(agent, text, preamble);
    if (!reply) return;
    await speakToUser(userId, reply);
  } catch (err) {
    log.warn("speakAgentReply failed (non-fatal)", { error: String(err) });
  }
}
