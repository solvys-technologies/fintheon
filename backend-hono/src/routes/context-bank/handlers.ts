// [claude-code 2026-03-11] Context Bank route handlers
import type { Context } from "hono";
import {
  getCurrentSnapshot,
  getSnapshotByVersion,
  getCurrentVersion,
  submitDeskReport,
  getLatestDeskReports,
  getDeskReportHistory,
  getLatestBrief,
  submitBrief,
} from "../../services/context-bank/context-bank-service.js";
import {
  VALID_DESKS,
  VALID_AGENTS,
  type DeskId,
  type DeskReport,
  type ConsolidatedBrief,
} from "../../types/context-bank.js";

export function handleGetSnapshot(c: Context) {
  const versionParam = c.req.query("version");

  if (versionParam) {
    const version = parseInt(versionParam, 10);
    if (isNaN(version))
      return c.json({ error: "Invalid version parameter" }, 400);
    const snapshot = getSnapshotByVersion(version);
    if (!snapshot)
      return c.json(
        { error: `Version ${version} not found in ring buffer` },
        404,
      );
    return c.json(snapshot);
  }

  const snapshot = getCurrentSnapshot();
  if (!snapshot) {
    return c.json({
      version: 0,
      generatedAt: new Date().toISOString(),
      ageSeconds: 0,
      ivScores: {},
      vix: {
        level: 0,
        percentChange: 0,
        isSpike: false,
        spikeDirection: "none",
        regime: "low",
        staleMinutes: 999,
      },
      systemic: {
        score: 0,
        ivOverlay: 0,
        activeChains: 0,
        rhymeMatches: 0,
        creditSignals: 0,
        rationale: ["Context bank warming up"],
        timestamp: new Date().toISOString(),
      },
      breakingHeadlines: [],
      econCalendar: { events: [], surprises: [] },
      tradeIdeas: { active: [], pnlSummary: {} },
      fred: {},
      polymarket: { markets: [], fetchedAt: new Date().toISOString() },
      deskReports: [],
    });
  }

  return c.json(snapshot);
}

export function handleGetMeta(c: Context) {
  const snapshot = getCurrentSnapshot();
  return c.json({
    version: snapshot?.version ?? 0,
    generatedAt: snapshot?.generatedAt ?? null,
    ageSeconds: snapshot?.ageSeconds ?? 0,
    deskReportCount: snapshot?.deskReports.length ?? 0,
  });
}

export async function handleSubmitDeskReport(c: Context) {
  try {
    const body = await c.req.json();

    // Validate required fields
    if (!body.desk || !body.agent || !body.summary) {
      return c.json(
        { error: "Missing required fields: desk, agent, summary" },
        400,
      );
    }
    if (!VALID_DESKS.includes(body.desk)) {
      return c.json(
        {
          error: `Invalid desk: ${body.desk}. Must be one of: ${VALID_DESKS.join(", ")}`,
        },
        400,
      );
    }
    if (!VALID_AGENTS.includes(body.agent)) {
      return c.json(
        {
          error: `Invalid agent: ${body.agent}. Must be one of: ${VALID_AGENTS.join(", ")}`,
        },
        400,
      );
    }

    const report: DeskReport = {
      id: body.id ?? crypto.randomUUID(),
      desk: body.desk,
      agent: body.agent,
      snapshotVersion: body.snapshotVersion ?? getCurrentVersion(),
      timestamp: body.timestamp ?? new Date().toISOString(),
      summary: body.summary,
      alerts: Array.isArray(body.alerts) ? body.alerts : [],
      tradeIdeas: Array.isArray(body.tradeIdeas) ? body.tradeIdeas : undefined,
      riskFlags: Array.isArray(body.riskFlags) ? body.riskFlags : undefined,
      confidence:
        typeof body.confidence === "number"
          ? Math.max(0, Math.min(100, body.confidence))
          : 50,
      metadata: body.metadata,
    };

    submitDeskReport(report);
    return c.json({
      ok: true,
      id: report.id,
      snapshotVersion: report.snapshotVersion,
    });
  } catch (err) {
    return c.json({ error: "Invalid request body" }, 400);
  }
}

export function handleGetDeskReports(c: Context) {
  const reports = getLatestDeskReports();
  return c.json({ reports, count: reports.length });
}

export function handleGetDeskHistory(c: Context) {
  const desk = c.req.param("desk") as DeskId;
  if (!VALID_DESKS.includes(desk)) {
    return c.json({ error: `Invalid desk: ${desk}` }, 400);
  }

  const limit = parseInt(c.req.query("limit") ?? "10", 10);
  const reports = getDeskReportHistory(desk, limit);
  return c.json({ desk, reports, count: reports.length });
}

export function handleGetBrief(c: Context) {
  const brief = getLatestBrief();
  if (!brief) {
    return c.json({
      brief: null,
      message: "No consolidated brief available yet",
    });
  }
  return c.json({ brief });
}

export async function handleSubmitBrief(c: Context) {
  try {
    const body = await c.req.json();

    if (!body.executiveSummary) {
      return c.json({ error: "Missing required field: executiveSummary" }, 400);
    }

    const brief: ConsolidatedBrief = {
      id: body.id ?? crypto.randomUUID(),
      generatedAt: body.generatedAt ?? new Date().toISOString(),
      snapshotVersion: body.snapshotVersion ?? getCurrentVersion(),
      executiveSummary: body.executiveSummary,
      topAlerts: Array.isArray(body.topAlerts) ? body.topAlerts : [],
      topTradeIdeas: Array.isArray(body.topTradeIdeas)
        ? body.topTradeIdeas
        : [],
      riskMatrix: Array.isArray(body.riskMatrix) ? body.riskMatrix : [],
      approvalQueue: Array.isArray(body.approvalQueue)
        ? body.approvalQueue
        : [],
      deskReportIds: Array.isArray(body.deskReportIds)
        ? body.deskReportIds
        : [],
    };

    submitBrief(brief);
    return c.json({
      ok: true,
      id: brief.id,
      snapshotVersion: brief.snapshotVersion,
    });
  } catch (err) {
    return c.json({ error: "Invalid request body" }, 400);
  }
}
