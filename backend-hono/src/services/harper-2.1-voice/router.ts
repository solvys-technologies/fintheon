// [claude-code 2026-04-20] S21-T4: Voice intent router.
// Given the session's trigger + the latest transcript chunk, decide which agent
// should answer. PsychAssist + Performance-chat triggers stick with Coach.
// Voice Assistant triggers branch between Oracle (market Q) and Harper (general).
// When a non-default agent takes over, we return a `preamble` that the UI can
// announce: "I had the desk search the web, here's what we found:"

import type {
  Harper21VoicePrimaryAgent,
  Harper21VoiceRouteIntent,
  Harper21VoiceTrigger,
} from "./types.js";

const MARKET_VERBS =
  /\b(price|quote|level|iv|implied vol|vol|volume|earnings?|gex|gamma|delta|put|call|dte|chain|open interest|oi|flow|walls?|regime|session|gap|vix)\b/i;
const TICKER_PATTERN = /\b([A-Z]{2,5})\b/;
const GREETING = /^(hey|hi|hello|yo|okay|ok|so)\b/i;

export function routeIntent(
  trigger: Harper21VoiceTrigger,
  utterance: string,
): Harper21VoiceRouteIntent {
  const text = utterance.trim();

  if (trigger === "psych_assist") {
    return { agent: "coach", reason: "psych_assist trigger always uses Coach" };
  }

  if (trigger === "performance_chat") {
    // Market detour — allow Coach to hand off to Oracle mid-convo.
    if (looksLikeMarketQuestion(text)) {
      return {
        agent: "oracle",
        reason: "Coach handing off to Oracle for live market query",
        preamble: "I had the desk pull the market, here's what we found:",
      };
    }
    return { agent: "coach", reason: "performance_chat default" };
  }

  // voice_assistant: classify market Q vs general chat
  if (looksLikeMarketQuestion(text)) {
    return {
      agent: "oracle",
      reason: "market question detected — fast-voice path",
    };
  }
  return {
    agent: "harper",
    reason: "general voice assistant intent",
  };
}

function looksLikeMarketQuestion(text: string): boolean {
  const stripped = text.replace(GREETING, "").trim();
  if (!stripped) return false;
  const hasVerb = MARKET_VERBS.test(stripped);
  const tickerMatch = stripped.match(TICKER_PATTERN);
  const hasTicker =
    !!tickerMatch && !/^(I|IM|OK|YES|NO|AM|PM)$/i.test(tickerMatch[1]);
  return hasVerb || hasTicker;
}

export function agentLabel(agent: Harper21VoicePrimaryAgent): string {
  switch (agent) {
    case "coach":
      return "Coach";
    case "oracle":
      return "Oracle";
    case "harper":
      return "Harper";
  }
}
