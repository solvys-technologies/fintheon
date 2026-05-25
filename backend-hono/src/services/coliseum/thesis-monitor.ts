import * as bulletinStore from "../bulletin/bulletin-store.js";
import { getColiseumClient } from "./db.js";
import { readForecast, updateForecastStatus } from "./forecasts.js";
import type { DeskForecast } from "./types.js";

interface MonitorResult {
  forecast: DeskForecast;
  previousStatus: string;
  nextStatus: string;
  alert: string | null;
  reasons: string[];
}

interface RiskFlowEvidence {
  id: string;
  headline: string;
  summary: string;
  publishedAt: string | null;
  ivScore: number;
}

export async function runForecastMonitor(id: string): Promise<MonitorResult> {
  const forecast = await readForecast(id);
  const evidence = await readAttachedEvidence(forecast);
  const nextStatus = decideStatus(forecast, evidence);
  const reasons = buildReasons(forecast, evidence, nextStatus);

  if (nextStatus === forecast.status) {
    return {
      forecast,
      previousStatus: forecast.status,
      nextStatus,
      alert: null,
      reasons,
    };
  }

  const updated = await updateForecastStatus(forecast.id, nextStatus);
  const alert = alertLabel(nextStatus);
  if (alert) await emitMonitorAlert(updated, alert);
  return {
    forecast: updated,
    previousStatus: forecast.status,
    nextStatus,
    alert,
    reasons,
  };
}

async function readAttachedEvidence(
  forecast: DeskForecast,
): Promise<RiskFlowEvidence[]> {
  const ids = forecast.catalysts.map((item) => item.riskflowItemId);
  if (ids.length === 0) return [];

  const { data, error } = await getColiseumClient()
    .from("scored_riskflow_items")
    .select("id, headline, summary, published_at, created_at, iv_score")
    .in("id", ids);

  if (error) throw new Error(`Forecast evidence failed: ${error.message}`);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    headline: String(row.headline ?? ""),
    summary: String(row.summary ?? ""),
    publishedAt: row.published_at
      ? String(row.published_at)
      : row.created_at
        ? String(row.created_at)
        : null,
    ivScore: Number(row.iv_score ?? 0),
  }));
}

function decideStatus(
  forecast: DeskForecast,
  evidence: RiskFlowEvidence[],
): string {
  if (isExpired(forecast)) return "expired";
  if (matchesValidationRule(forecast, evidence)) return "thesis_proven";
  if (hasMarketReferenceBreak(forecast)) return "gaining_support";
  if (hasFreshEvidenceSupport(evidence)) return "gaining_support";
  if (forecast.status === "published") return "watching";
  return forecast.status;
}

function matchesValidationRule(
  forecast: DeskForecast,
  evidence: RiskFlowEvidence[],
): boolean {
  const tokens = forecast.validationRule
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 5)
    .slice(0, 8);
  if (tokens.length === 0) return false;

  const haystack = evidence
    .map((item) => `${item.headline} ${item.summary}`.toLowerCase())
    .join("\n");
  return tokens.filter((token) => haystack.includes(token)).length >= 2;
}

function hasFreshEvidenceSupport(evidence: RiskFlowEvidence[]): boolean {
  const cutoff = Date.now() - 72 * 60 * 60 * 1000;
  const freshHighIv = evidence.filter((item) => {
    const timestamp = item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
    return timestamp >= cutoff && item.ivScore >= 7;
  });
  return freshHighIv.length >= 2;
}

function hasMarketReferenceBreak(forecast: DeskForecast): boolean {
  return forecast.marketReferences.some((ref) => {
    const value = Number(String(ref.priceOrOdds ?? "").replace(/[^0-9.]/g, ""));
    return Number.isFinite(value) && value >= 70;
  });
}

function isExpired(forecast: DeskForecast): boolean {
  if (!forecast.expiresAt) return false;
  const expiry = new Date(forecast.expiresAt).getTime();
  return Number.isFinite(expiry) && expiry < Date.now();
}

function buildReasons(
  forecast: DeskForecast,
  evidence: RiskFlowEvidence[],
  status: string,
): string[] {
  return [
    `${evidence.length} attached RiskFlow catalysts checked.`,
    forecast.marketReferences.length
      ? `${forecast.marketReferences.length} read-only market references checked.`
      : "No prediction-market reference attached.",
    status === "expired" ? "Forecast passed its expiry timestamp." : "",
    status === "thesis_proven"
      ? "Validation language matched attached evidence."
      : "",
  ].filter(Boolean);
}

function alertLabel(status: string): string | null {
  if (status === "gaining_support") return "Thesis gaining support";
  if (status === "thesis_proven") return "Thesis proven";
  if (status === "invalidated") return "Thesis invalidated";
  return null;
}

async function emitMonitorAlert(
  forecast: DeskForecast,
  label: string,
): Promise<void> {
  await bulletinStore.createPost({
    authorId: "coliseum-monitor",
    authorAgent: "Herald",
    deskId: forecast.deskId,
    content: `${label}: ${forecast.title}`,
    contentParts: null,
    parentId: null,
  });
}
