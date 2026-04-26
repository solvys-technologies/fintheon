// [claude-code 2026-04-26] S35-T12: OpenRouter stripped per TP — voice
// sentiment now routes through invokeAgent (VProxy → Ollama Cloud → Nous,
// all free). No more OPENROUTER_API_KEY dependency.
// [claude-code 2026-03-14] (legacy) Voice sentiment via OpenRouter (Opus 4.6).
import { invokeAgent } from "./strands/invoke-helper.js";

export interface SentimentAnalysisInput {
  transcript: string;
  context?: string;
}

export interface SentimentAnalysisResult {
  sentiment: number; // -1.0 (very negative) to +1.0 (very positive)
  confidence: number; // 0.0 to 1.0
  keywords: string[];
  tiltIndicators: string[];
  summary: string;
  provider: "strands" | "fallback";
}

const TILT_KEYWORDS = [
  "fuck",
  "shit",
  "damn",
  "stupid",
  "idiot",
  "hate",
  "rigged",
  "unfair",
  "revenge",
  "double down",
  "all in",
  "cant believe",
  "always happens",
  "never works",
  "should have",
  "why did i",
  "im done",
];

function fallbackSentiment(transcript: string): SentimentAnalysisResult {
  const lower = transcript.toLowerCase();
  const foundKeywords = TILT_KEYWORDS.filter((kw) => lower.includes(kw));
  const negativityRatio =
    foundKeywords.length / Math.max(transcript.split(/\s+/).length, 1);
  const sentiment = Math.max(-1, -negativityRatio * 10);

  return {
    sentiment: foundKeywords.length > 0 ? sentiment : 0,
    confidence: 0.3,
    keywords: foundKeywords,
    tiltIndicators: foundKeywords.length > 0 ? ["aggressive_language"] : [],
    summary:
      foundKeywords.length > 0
        ? `Detected ${foundKeywords.length} tilt indicator(s): ${foundKeywords.join(", ")}`
        : "No tilt indicators detected",
    provider: "fallback",
  };
}

export async function analyzeSentiment(
  input: SentimentAnalysisInput,
): Promise<SentimentAnalysisResult> {
  if (!input.transcript.trim()) {
    return {
      sentiment: 0,
      confidence: 0,
      keywords: [],
      tiltIndicators: [],
      summary: "Empty transcript",
      provider: "fallback",
    };
  }

  try {
    const systemPrompt = `You are a trading psychology sentiment analyzer. Analyze the trader's speech for emotional state and tilt indicators.

Return JSON only (no markdown fences):
{
  "sentiment": <number from -1.0 (very negative/tilted) to +1.0 (very positive/composed)>,
  "confidence": <number 0.0-1.0>,
  "keywords": [<detected emotional keywords>],
  "tiltIndicators": [<categories: "aggressive_language", "revenge_trading", "overconfidence", "desperation", "frustration", "panic", "self_blame">],
  "summary": "<one sentence assessment>"
}

Tilt indicators to watch for:
- Profanity or aggressive language
- Revenge trading intent ("double down", "make it back")
- Overconfidence ("can't lose", "guaranteed")
- Desperation ("all in", "last chance")
- Self-blame loops ("why did I", "so stupid")
- Market blame ("rigged", "manipulation")`;

    const userMessage = input.context
      ? `Context: ${input.context}\n\nTrader speech: "${input.transcript}"`
      : `Trader speech: "${input.transcript}"`;

    const { text } = await invokeAgent({
      systemPrompt,
      userPrompt: userMessage,
    });
    const cleaned = text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "");
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    const jsonSlice =
      firstBrace >= 0 && lastBrace > firstBrace
        ? cleaned.slice(firstBrace, lastBrace + 1)
        : cleaned;
    const parsed = JSON.parse(jsonSlice) as {
      sentiment: number;
      confidence: number;
      keywords: string[];
      tiltIndicators: string[];
      summary: string;
    };

    return {
      sentiment: Math.max(-1, Math.min(1, parsed.sentiment)),
      confidence: Math.max(0, Math.min(1, parsed.confidence)),
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      tiltIndicators: Array.isArray(parsed.tiltIndicators)
        ? parsed.tiltIndicators
        : [],
      summary: parsed.summary || "Analysis complete",
      provider: "strands",
    };
  } catch (err) {
    console.error("[VoiceSentiment] Analysis failed, using fallback:", err);
    return fallbackSentiment(input.transcript);
  }
}
