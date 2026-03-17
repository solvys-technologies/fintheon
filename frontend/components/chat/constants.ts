/**
 * Chat Constants
 * Constants used in chat interface
 */

export const SUGGESTION_CHIPS = [
  { label: "Run the Dawn Dispatch", prompt: "Run the Dawn Dispatch" },
  { label: "Give me The Weekly Tribune", prompt: "Give me The Weekly Tribune" },
  { label: "Let's do a psych eval", prompt: "Let's do a psych eval" },
  { label: "How's my ER this week?", prompt: "How's my ER this week?" },
  { label: "Update my Blindspots", prompt: "Update my Blindspots" },
];

export const THINKING_TERMS = [
  "finagling",
  "polagaling",
  "doodling",
  "tinkering",
  "pondering",
  "mulling",
  "ruminating",
  "contemplating",
  "considering",
  "weighing",
  "deliberating",
  "reflecting",
  "analyzing",
  "assessing",
  "evaluating",
  "bullish momentum",
  "uptrend confirmation",
  "breakout potential",
  "accumulation phase",
  "support holding",
  "resistance breaking",
  "volume expansion",
  "liquidity building",
  "risk-on sentiment",
  "fundamental strength",
  "earnings beat",
  "guidance raise",
  "positive catalyst",
  "momentum building",
];

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
