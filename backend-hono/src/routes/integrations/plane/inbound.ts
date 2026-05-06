// [claude-code 2026-05-06] S60-T4: Plane inbound signed webhook route handler
import { Hono } from "hono";
import type { Context } from "hono";
import { createHash } from "node:crypto";
import { planeInboundSchema } from "./schema.js";
import { verifyPlaneSignature } from "../../../services/integrations/plane/signature.js";
import { replayCache } from "../../../services/integrations/plane/replay-cache.js";
import { idempotencyStore } from "../../../services/integrations/plane/idempotency-store.js";
import { processInboundEvent } from "../../../services/integrations/plane/inbound-processor.js";
import { createLogger } from "../../../lib/logger.js";

const log = createLogger("PlaneInbound");

export function createPlaneInboundRoute(): Hono {
  const router = new Hono();

  router.post("/inbound", async (c: Context) => {
    const rawBody = await c.req.text();

    const sigHeader =
      c.req.header("X-Plane-Signature") ||
      c.req.header("X-Hub-Signature-256");
    const timestamp = c.req.header("X-Plane-Timestamp");
    const keyId = c.req.header("X-Plane-Key-Id") || "default";

    if (!sigHeader || !timestamp) {
      log.warn("plane inbound missing signature headers");
      return c.json({ error: "missing_signature_headers" }, 401);
    }

    const verification = verifyPlaneSignature({
      rawBody,
      signatureHeader: sigHeader,
      timestamp,
      keyId,
    });

    if (!verification.valid) {
      if (verification.reason === "stale_timestamp") {
        return c.json({ error: "stale_timestamp" }, 408);
      }
      log.warn("plane inbound signature failed", {
        reason: verification.reason ?? "unknown",
        keyId,
      });
      return c.json({ error: "signature_verification_failed" }, 401);
    }

    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      return c.json({ error: "invalid_json" }, 422);
    }

    const parsed = planeInboundSchema.safeParse(rawPayload);
    if (!parsed.success) {
      log.warn("plane inbound schema failure", {
        issues: parsed.error.issues,
      });
      return c.json(
        {
          error: "schema_validation_failed",
          issues: parsed.error.issues,
        },
        422,
      );
    }

    const payload = parsed.data;

    const replayKey = `${keyId}:${payload.event_id}:${timestamp}`;
    if (replayCache.has(replayKey)) {
      log.info("plane inbound replay blocked", { eventId: payload.event_id });
      return c.json(
        { status: "duplicate", reason: "replay", eventId: payload.event_id },
        200,
      );
    }
    replayCache.set(replayKey);

    const payloadHash = createHash("sha256").update(rawBody).digest("hex");
    const idempotencyKey = `${payload.correlation_id}:${payloadHash}`;
    const dedupResult = idempotencyStore.get(idempotencyKey);
    if (dedupResult.isDuplicate) {
      log.info("plane inbound idempotent no-op", {
        correlationId: payload.correlation_id,
      });
      return c.json(
        {
          status: "duplicate",
          reason: "idempotent",
          original: dedupResult.storedResponse,
        },
        200,
      );
    }

    const result = await processInboundEvent(payload);
    idempotencyStore.set(idempotencyKey, {
      eventId: result.eventId,
      processedAt: result.receivedAt,
    });

    return c.json({ status: "accepted", event: result }, 202);
  });

  return router;
}
