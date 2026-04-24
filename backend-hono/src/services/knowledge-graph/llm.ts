// [claude-code 2026-04-23] S31-T9 predictive knowledge graph + feature proposals
// Harper LLM call for the weekly proposer. Strict JSON-array contract; refuses
// when usage signal is weak.

import { llmCall } from "../ai/llm-call.js";

const LOG = "[knowledge-graph/llm]";

export const MAX_PROPOSALS_PER_USER = 3;
export const MIN_EVENTS_FOR_SIGNAL = 25;

const PROPOSER_SYSTEM_PROMPT = `You are Harper, the CAO of Fintheon. You analyze a single user's recent usage telemetry and propose concrete feature additions that would deepen their dominant usage patterns.

INPUT shape: a list of {surface, events, distinctActions, trend} rows for one user, ranked by event count.

OUTPUT shape: a JSON array of up to ${MAX_PROPOSALS_PER_USER} proposals. Each proposal:
{
  "title": "short headline (<=80 chars)",
  "description": "1-2 sentence description of the feature and why it fits this user (<=300 chars)",
  "anchorSurface": "exact surface string from the input that drove the proposal"
}

Allowed feature categories:
- new data view (chart, table, summary)
- new filter (refines an existing list/feed)
- new automation (routine, alert, scheduled action)
- new card variant (different rendering of an existing card)
- new brief section (added to MDB/ADB/PMDB/TWT)
- new agent invocation shortcut (one-tap path to invoke an agent on something)

REFUSAL: If no surface has at least ${MIN_EVENTS_FOR_SIGNAL} events OR no surface has a clearly dominant or rising trend, respond with exactly: []
Do NOT propose generic features. Do NOT propose features for low-usage surfaces in an attempt to boost engagement. Be concrete.

Respond with ONLY the raw JSON array. No commentary, no markdown, no code fences.`;

export interface SurfaceSummary {
  surface: string;
  events: number;
  distinctActions: number;
  trend: "up" | "down" | "flat";
}

export interface ProposalDraft {
  title: string;
  description: string;
  anchorSurface: string;
}

function parseProposalArray(raw: string): ProposalDraft[] {
  const trimmed = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: ProposalDraft[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.title !== "string" ||
      typeof candidate.description !== "string" ||
      typeof candidate.anchorSurface !== "string"
    ) {
      continue;
    }
    out.push({
      title: candidate.title.slice(0, 200),
      description: candidate.description.slice(0, 2000),
      anchorSurface: candidate.anchorSurface.slice(0, 64),
    });
    if (out.length >= MAX_PROPOSALS_PER_USER) break;
  }
  return out;
}

export async function callHarperForProposals(
  userId: string,
  surfaces: SurfaceSummary[],
): Promise<ProposalDraft[]> {
  const apiKey = process.env.OPENROUTER_API_KEY ?? "";
  if (!apiKey) {
    console.warn(`${LOG} OPENROUTER_API_KEY not set; skipping LLM call`);
    return [];
  }

  const baseUrl = "https://openrouter.ai/api/v1";
  const userPayload = JSON.stringify(surfaces.slice(0, 8));

  try {
    const outcome = await llmCall<string>({
      agent: "harper",
      task: "chat",
      conversationId: `kg-proposer-${userId}`,
      userId,
      invoke: async (rule) => {
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer":
              process.env.OPENROUTER_APP_URL ??
              "https://fintheon-solvys.vercel.app",
            "X-Title": process.env.OPENROUTER_APP_NAME ?? "Fintheon-AI-Gateway",
          },
          body: JSON.stringify({
            model: rule.model,
            messages: [
              { role: "system", content: PROPOSER_SYSTEM_PROMPT },
              { role: "user", content: userPayload },
            ],
            max_tokens: 1024,
            temperature: 0.4,
          }),
        });
        if (!response.ok) {
          throw new Error(`OpenRouter ${response.status}`);
        }
        const data = (await response.json()) as {
          choices?: { message?: { content?: string } }[];
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        return {
          result: data.choices?.[0]?.message?.content ?? "",
          input_tokens: data.usage?.prompt_tokens,
          output_tokens: data.usage?.completion_tokens,
        };
      },
    });

    return parseProposalArray(outcome.result);
  } catch (err) {
    console.error(`${LOG} LLM call failed for user ${userId}:`, err);
    return [];
  }
}
