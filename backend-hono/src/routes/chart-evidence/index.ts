import { Hono } from "hono";
import { z } from "zod";
import {
  createChartEvidenceRequest,
  listChartEvidenceRequests,
} from "../../services/file-room/chart-evidence.js";

const requestSchema = z.object({
  deskId: z.string().trim().max(120).optional(),
  title: z.string().trim().min(1).max(160),
  symbol: z.string().trim().min(1).max(20),
  timeframe: z.string().trim().max(32).optional(),
  sourceUrl: z.string().trim().max(500).optional(),
  memoId: z.string().trim().max(120).optional(),
});

export function createChartEvidenceRoutes(): Hono {
  const app = new Hono();

  app.get("/requests", async (c) => {
    const deskId = c.req.query("deskId") || undefined;
    const requests = await listChartEvidenceRequests(deskId);
    return c.json({ ok: true, requests, count: requests.length });
  });

  app.post("/requests", async (c) => {
    const parsed = requestSchema.safeParse(await c.req.json().catch(() => ({})));
    if (!parsed.success) {
      return c.json({ ok: false, error: "Invalid chart request", details: parsed.error.flatten() }, 400);
    }
    const request = await createChartEvidenceRequest(parsed.data);
    return c.json({ ok: true, request }, 201);
  });

  return app;
}
