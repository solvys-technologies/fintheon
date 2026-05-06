// [claude-code 2026-05-06] S60-T5: Plane outbound relay route — dispatches to Plane with policy gate

import { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { relayToPlane, getDLQEntries } from "../../../services/integrations/plane/outbound-client.js";
import { evaluatePolicy, type PolicyAction } from "../../../services/integrations/plane/policy-gate.js";
import { isVerificationPassed, setVerificationResult, checkVerification } from "../../../services/integrations/plane/verification-gate.js";
import { createLogger } from "../../../lib/logger.js";

const log = createLogger("PlaneOutboundRoute");

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const outboundRequestSchema = z
  .object({
    incident_id: z.string().min(1),
    correlation_id: z.string().min(1),
    event_type: z.enum(["notify", "update", "fix_proposal", "deploy"]),
    status: z.enum(["open", "acknowledged", "resolved"]),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    evidence: z.record(z.string(), z.unknown()).optional(),
    actions: z.array(z.string()).optional(),
  })
  .strict();

const verificationUpdateSchema = z
  .object({
    frontendPass: z.boolean(),
    healthChecks: z.record(z.string(), z.boolean()),
    buildStatus: z.enum(["passed", "failed", "unknown"]).optional(),
    testResults: z
      .object({
        passed: z.number(),
        failed: z.number(),
        skipped: z.number(),
      })
      .optional(),
    deployTarget: z.string().optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Handler helpers
// ---------------------------------------------------------------------------

function getUserId(c: Context): string | null {
  const userId = c.get("userId") as string | undefined;
  if (!userId || userId === "anon") return null;
  return userId;
}

// ---------------------------------------------------------------------------
// Route factory
// ---------------------------------------------------------------------------

export function createPlaneOutboundRoute(): Hono {
  const router = new Hono();

  // POST /outbound — relay an outbound event to Plane with policy gate
  router.post("/outbound", async (c: Context) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 422);
    }

    const parsed = outboundRequestSchema.safeParse(body);
    if (!parsed.success) {
      log.warn("outbound schema validation failed", { issues: parsed.error.issues });
      return c.json({ error: "schema_validation_failed", issues: parsed.error.issues }, 422);
    }

    const req = parsed.data;
    const eventType = req.event_type as PolicyAction;

    // Evaluate policy gate before dispatching
    const policyDecision = evaluatePolicy(
      eventType,
      {
        severity: req.severity,
        confidence: 0.9, // Incoming requests from Plane assumed to have agent-vetted confidence
      },
      isVerificationPassed(),
    );

    if (!policyDecision.allowed) {
      return c.json(
        {
          status: "blocked",
          reason: policyDecision.reason,
          escalatedTo: policyDecision.action,
        },
        403,
      );
    }

    const result = await relayToPlane({
      incidentId: req.incident_id,
      correlationId: req.correlation_id,
      eventType: policyDecision.action ?? eventType,
      status: req.status,
      severity: req.severity,
      evidence: req.evidence,
      actions: req.actions,
    });

    if (!result.success) {
      return c.json(
        {
          status: "failed",
          eventId: result.eventId,
          retries: result.retries,
          dlq: result.dlq,
          error: result.error,
        },
        502,
      );
    }

    return c.json({
      status: "relayed",
      eventId: result.eventId,
      policyAction: policyDecision.action ?? eventType,
      escalated: policyDecision.escalated ?? false,
    });
  });

  // POST /outbound/verification — update verification gate state
  router.post("/outbound/verification", async (c: Context) => {
    const userId = getUserId(c);
    if (!userId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON" }, 422);
    }

    const parsed = verificationUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "schema_validation_failed", issues: parsed.error.issues }, 422);
    }

    const verificationResult = checkVerification(parsed.data);
    setVerificationResult(verificationResult);

    return c.json({
      status: "accepted",
      passed: verificationResult.passed,
      failures: verificationResult.failures,
      healthStatuses: verificationResult.healthStatuses,
    });
  });

  // GET /outbound/dql — inspection endpoint for dead letter queue
  router.get("/outbound/dql", async (c: Context) => {
    const entries = getDLQEntries();
    return c.json({ count: entries.length, entries });
  });

  return router;
}
