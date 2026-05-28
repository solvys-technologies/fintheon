import { createLogger } from "../../lib/logger.js";
import { storeArtifact } from "./artifact-store.js";
import type { ChartArtifact, ChartEvidenceRequest } from "./types.js";

const log = createLogger("ChartCaptureRunner");

export async function requestChartEvidence(
  request: ChartEvidenceRequest,
  deskId = "priced-in-capital",
): Promise<ChartArtifact> {
  try {
    const artifact = await storeArtifact({
      id: "",
      ticker: request.ticker,
      timeframe: request.timeframe ?? "1D",
      source: request.source ?? "chart-evidence",
      capturedAt: null,
      path: null,
      url: null,
      status: "pending",
      memoId: request.memoId ?? null,
      deskId: request.deskId ?? deskId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    log.info("Chart evidence request created", {
      id: artifact.id,
      ticker: artifact.ticker,
    });
    return artifact;
  } catch (err) {
    log.warn("Chart evidence request failed, returning unavailable artifact", {
      ticker: request.ticker,
      err: String(err),
    });
    return unavailableArtifact(request, deskId);
  }
}

function unavailableArtifact(
  request: ChartEvidenceRequest,
  deskId: string,
): ChartArtifact {
  const now = new Date().toISOString();
  return {
    id: `unavailable-${Date.now()}`,
    ticker: request.ticker,
    timeframe: request.timeframe ?? "1D",
    source: request.source ?? "chart-evidence",
    capturedAt: null,
    path: null,
    url: null,
    status: "unavailable",
    memoId: request.memoId ?? null,
    deskId: request.deskId ?? deskId,
    createdAt: now,
    updatedAt: now,
  };
}
