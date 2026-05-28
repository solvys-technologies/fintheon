import { Hono } from "hono";
import { z } from "zod";
import {
  createChartEvidenceRequest,
  listChartEvidenceRequests,
} from "../../services/file-room/chart-evidence.js";
import { requestChartEvidence } from "../../services/chart-evidence/capture-runner.js";
import {
  fulfillArtifact,
  getArtifactsForMemo,
} from "../../services/chart-evidence/artifact-store.js";

const requestSchema = z.object({
  deskId: z.string().trim().max(120).optional(),
  title: z.string().trim().min(1).max(160),
  symbol: z.string().trim().min(1).max(20),
  timeframe: z.string().trim().max(32).optional(),
  sourceUrl: z.string().trim().max(500).optional(),
  memoId: z.string().trim().max(120).optional(),
});

const evidenceRequestSchema = z.object({
  ticker: z.string().trim().min(1).max(20),
  timeframe: z.string().trim().max(32).optional(),
  source: z.string().trim().max(120).optional(),
  requestedBy: z.string().trim().max(120).optional(),
  memoId: z.string().trim().max(120).optional(),
  deskId: z.string().trim().max(120).optional(),
});

const fulfillSchema = z.object({
  path: z.string().trim().min(1).max(500),
  url: z.string().trim().max(500).optional(),
  deskId: z.string().trim().max(120).optional(),
});

export function createChartEvidenceRoutes(): Hono {
  const app = new Hono();

  // Legacy endpoints
  app.get("/requests", async (c) => {
    const deskId = c.req.query("deskId") || undefined;
    const requests = await listChartEvidenceRequests(deskId);
    return c.json({ ok: true, requests, count: requests.length });
  });

  app.post("/requests", async (c) => {
    const parsed = requestSchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return c.json(
        { ok: false, error: "Invalid chart request", details: parsed.error.flatten() },
        400,
      );
    }
    const request = await createChartEvidenceRequest(parsed.data);
    return c.json({ ok: true, request }, 201);
  });

  // New endpoints: capture runner
  app.post("/request", async (c) => {
    const parsed = evidenceRequestSchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return c.json(
        { ok: false, error: "Invalid evidence request", details: parsed.error.flatten() },
        400,
      );
    }
    const artifact = await requestChartEvidence(
      parsed.data,
      parsed.data.deskId,
    );
    return c.json({ ok: true, artifact }, 201);
  });

  app.get("/:memoId", async (c) => {
    const memoId = c.req.param("memoId");
    const deskId = c.req.query("deskId") || "priced-in-capital";
    const artifacts = await getArtifactsForMemo(memoId, deskId);
    return c.json({ ok: true, artifacts, count: artifacts.length });
  });

  app.post("/:id/fulfill", async (c) => {
    const id = c.req.param("id");
    const parsed = fulfillSchema.safeParse(
      await c.req.json().catch(() => ({})),
    );
    if (!parsed.success) {
      return c.json(
        { ok: false, error: "Invalid fulfill payload", details: parsed.error.flatten() },
        400,
      );
    }
    const deskId = parsed.data.deskId ?? "priced-in-capital";
    const artifact = await fulfillArtifact(
      id,
      deskId,
      parsed.data.path,
      parsed.data.url ?? null,
    );
    if (!artifact) return c.json({ ok: false, error: "Artifact not found" }, 404);
    return c.json({ ok: true, artifact });
  });

  return app;
}
