// [claude-code 2026-04-15] Agent stream parser — JSON detection, suppression, KPI derivation
import type { HermesAgentId } from "../../backend-hono/src/services/agent-bus/types";

// ── Types ────────────────────────────────────────────────────────────────────

export interface KPISignals {
  direction?: "Bullish" | "Bearish" | "Neutral";
  confidence?: number;
  riskLevel?: "Low" | "Medium" | "High";
  summary?: string;
}

export interface ParsedAgentOutput {
  cleanText: string;
  extractedData: Record<string, unknown>[];
  kpiSignals: KPISignals;
}

export interface AggregateKPIs {
  consensusStrength: number; // 0-100
  directionalBias: "Bullish" | "Bearish" | "Neutral";
  riskPosture: "Defensive" | "Moderate" | "Aggressive";
}

// ── JSON detection regexes ───────────────────────────────────────────────────

const FENCED_JSON_RE = /```(?:json)?\s*\n([\s\S]*?)```/g;
const BARE_JSON_RE = /^\{[\s\S]*?\n\}/gm;

// ── Direction keywords ───────────────────────────────────────────────────────

const BULLISH_KEYS = ["bullish", "long", "upside", "buy", "rally", "bid"];
const BEARISH_KEYS = [
  "bearish",
  "short",
  "downside",
  "sell",
  "decline",
  "offer",
];

// ── Core functions ───────────────────────────────────────────────────────────

export function parseAgentText(text: string): ParsedAgentOutput {
  const extractedData: Record<string, unknown>[] = [];
  let cleanText = text;

  // Extract fenced JSON blocks
  cleanText = cleanText.replace(FENCED_JSON_RE, (_match, jsonStr: string) => {
    try {
      const parsed = JSON.parse(jsonStr.trim());
      extractedData.push(parsed);
      return "";
    } catch {
      return _match; // keep malformed blocks as-is
    }
  });

  // Extract bare JSON objects
  cleanText = cleanText.replace(BARE_JSON_RE, (match) => {
    try {
      const parsed = JSON.parse(match.trim());
      extractedData.push(parsed);
      return "";
    } catch {
      return match;
    }
  });

  // Clean up leftover blank lines from removals
  cleanText = cleanText.replace(/\n{3,}/g, "\n\n").trim();

  const kpiSignals = deriveSignalsFromData(extractedData, cleanText);

  return { cleanText, extractedData, kpiSignals };
}

function deriveSignalsFromData(
  data: Record<string, unknown>[],
  text: string,
): KPISignals {
  const signals: KPISignals = {};

  // Try to extract from parsed JSON first
  for (const obj of data) {
    if (!signals.direction) {
      const dir = obj.direction ?? obj.bias ?? obj.sentiment;
      if (typeof dir === "string") {
        const lower = dir.toLowerCase();
        if (BULLISH_KEYS.some((k) => lower.includes(k)))
          signals.direction = "Bullish";
        else if (BEARISH_KEYS.some((k) => lower.includes(k)))
          signals.direction = "Bearish";
        else signals.direction = "Neutral";
      }
    }
    if (signals.confidence === undefined) {
      const conf = obj.confidence ?? obj.conviction;
      if (typeof conf === "number") signals.confidence = conf;
    }
    if (!signals.riskLevel) {
      const risk = obj.risk ?? obj.riskLevel ?? obj.risk_level;
      if (typeof risk === "string") {
        const lower = risk.toLowerCase();
        if (lower.includes("high") || lower.includes("elevated"))
          signals.riskLevel = "High";
        else if (lower.includes("low") || lower.includes("calm"))
          signals.riskLevel = "Low";
        else signals.riskLevel = "Medium";
      }
    }
  }

  // Fallback: infer direction from text sentiment
  if (!signals.direction && text.length > 50) {
    const lower = text.toLowerCase();
    const bullishCount = BULLISH_KEYS.filter((k) => lower.includes(k)).length;
    const bearishCount = BEARISH_KEYS.filter((k) => lower.includes(k)).length;
    if (bullishCount > bearishCount + 1) signals.direction = "Bullish";
    else if (bearishCount > bullishCount + 1) signals.direction = "Bearish";
  }

  return signals;
}

// ── Aggregate KPIs across all agents ─────────────────────────────────────────

interface AgentOutput {
  agentId: HermesAgentId;
  text: string;
  status: "pending" | "streaming" | "complete" | "error";
}

export function deriveConsensusKPIs(
  allOutputs: Record<string, AgentOutput>,
): AggregateKPIs {
  const analysisAgents = ["oracle", "feucht", "consul", "herald"];
  const completed = analysisAgents.filter(
    (id) => allOutputs[id]?.status === "complete",
  );

  // Consensus Strength: % of analysis agents completed
  const consensusStrength = Math.round((completed.length / 4) * 100);

  // Directional Bias: majority vote from parsed text
  const directions: ("Bullish" | "Bearish" | "Neutral")[] = [];
  for (const id of completed) {
    const parsed = parseAgentText(allOutputs[id].text);
    if (parsed.kpiSignals.direction)
      directions.push(parsed.kpiSignals.direction);
  }
  const bullish = directions.filter((d) => d === "Bullish").length;
  const bearish = directions.filter((d) => d === "Bearish").length;
  let directionalBias: AggregateKPIs["directionalBias"] = "Neutral";
  if (bullish > bearish) directionalBias = "Bullish";
  else if (bearish > bullish) directionalBias = "Bearish";

  // Risk Posture: average of risk levels
  const riskMap = { Low: 1, Medium: 2, High: 3 } as const;
  const riskValues: number[] = [];
  for (const id of completed) {
    const parsed = parseAgentText(allOutputs[id].text);
    if (parsed.kpiSignals.riskLevel)
      riskValues.push(riskMap[parsed.kpiSignals.riskLevel]);
  }
  let riskPosture: AggregateKPIs["riskPosture"] = "Moderate";
  if (riskValues.length > 0) {
    const avg = riskValues.reduce((a, b) => a + b, 0) / riskValues.length;
    if (avg >= 2.3) riskPosture = "Defensive";
    else if (avg <= 1.7) riskPosture = "Aggressive";
  }

  return { consensusStrength, directionalBias, riskPosture };
}
