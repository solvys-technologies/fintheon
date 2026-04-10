import { GrokHeadlineRequest } from "../types/news-analysis.js";

const headlineSchema = `
[
  {
    "id": "string (match input id)",
    "parsed": {
      "entity": "string",
      "action": "string",
      "target": "string",
      "magnitude": number | null,
      "unit": "string | null",
      "symbols": ["SYM"],
      "isBreaking": boolean,
      "urgency": "immediate" | "high" | "normal",
      "direction": "up" | "down" | "mixed" | null,
      "eventType": "string | null",
      "tags": ["string"],
      "marketReaction": {
        "direction": "up" | "down" | "mixed",
        "intensity": "mild" | "moderate" | "severe"
      } | null,
      "numbers": {
        "actual": number | null,
        "actualText": "string | null",
        "forecast": number | null,
        "forecastText": "string | null",
        "previous": number | null,
        "previousText": "string | null",
        "unit": "string | null"
      },
      "confidence": number
    },
    "hotPrint": {
      "type": "string",
      "actual": number,
      "forecast": number,
      "previous": number | null,
      "deviation": number,
      "direction": "above" | "below",
      "impact": "low" | "medium" | "high",
      "tradingImplication": "string"
    } | null
  }
]`.trim();

const hotPrintSchema = `
{
  "isEconomicData": boolean,
  "eventType": "CPI|PPI|NFP|GDP|Retail|Other",
  "actual": number | null,
  "forecast": number | null,
  "previous": number | null,
  "unit": "string | null",
  "deviation": number | null,
  "direction": "above" | "below" | null,
  "isHot": boolean,
  "reason": "string"
}`.trim();

const formatItemsForPrompt = (items: GrokHeadlineRequest[]) =>
  items
    .map(
      (item, idx) =>
        `[${idx + 1}] ID=${item.id}\nSOURCE=${item.source}\nHEADLINE=${item.headline}\nBODY=${item.body ?? ""}`,
    )
    .join("\n\n");

export const buildHeadlineParsePrompt = (items: GrokHeadlineRequest[]) => {
  const header = `You are a financial news parser. Given up to 10 headlines, extract structured data exactly in the JSON schema provided.`;
  const constraints = [
    "Never invent IDs.",
    "Return an array with the same order as inputs.",
    "Use null when a field is missing.",
    "Confidence must be between 0 and 1.",
    "Magnitude numbers must be numeric without text units.",
  ]
    .map((rule, i) => `${i + 1}. ${rule}`)
    .join("\n");

  return `${header}

Rules:
${constraints}

Inputs:
${formatItemsForPrompt(items)}

Respond with valid JSON matching this schema:
${headlineSchema}`;
};

export const buildHotPrintPrompt = (text: string) => {
  const instructions = `Determine if the text describes an economic data release (CPI, PPI, NFP, GDP, Retail Sales, etc.). Extract actual, forecast, previous values and units if present.`;
  return `${instructions}

Text:
${text}

Return strict JSON matching:
${hotPrintSchema}`;
};
