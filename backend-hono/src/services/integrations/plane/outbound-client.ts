// [claude-code 2026-05-06] S60-T5: Plane outbound relay client with HMAC signing, retry/backoff, and DLQ

import { createHmac } from "node:crypto";
import { createLogger } from "../../../lib/logger.js";

const log = createLogger("PlaneOutbound");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaneOutboundPayload {
  incident_id: string;
  correlation_id: string;
  event_id: string;
  event_type: "notify" | "update" | "fix_proposal" | "deploy";
  status: "open" | "acknowledged" | "resolved";
  severity?: "low" | "medium" | "high" | "critical";
  evidence?: Record<string, unknown>;
  actions?: string[];
  metadata?: Record<string, unknown>;
}

export interface OutboundResult {
  success: boolean;
  eventId: string;
  statusCode?: number;
  retries: number;
  dlq: boolean;
  error?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 500,
  maxDelayMs: 30_000,
};

function getPlaneOutboundUrl(): string {
  return process.env.PLANE_OUTBOUND_URL || "http://localhost:8080/api/plane/mock-outbound";
}

function lookupSecret(keyId: string): string | null {
  const raw = process.env.PLANE_WEBHOOK_SECRETS;
  if (!raw) return null;
  try {
    const secrets = JSON.parse(raw) as Record<string, string>;
    return secrets[keyId] ?? null;
  } catch {
    return null;
  }
}

function getKeyId(): string {
  return process.env.PLANE_OUTBOUND_KEY_ID || "default";
}

// ---------------------------------------------------------------------------
// HMAC Signing (mirrors inbound signature.ts canonical form)
// ---------------------------------------------------------------------------

export interface OutboundSignature {
  headers: Record<string, string>;
}

export function signOutboundPayload(rawBody: string): OutboundSignature | null {
  const keyId = getKeyId();
  const secret = lookupSecret(keyId);
  if (!secret) {
    log.warn("no secret found for outbound signing", { keyId });
    return null;
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const canonical = `${timestamp}.${rawBody}`;
  const digest = createHmac("sha256", secret).update(canonical).digest("hex");

  return {
    headers: {
      "X-Plane-Timestamp": timestamp,
      "X-Plane-Key-Id": keyId,
      "X-Plane-Signature": `sha256=${digest}`,
      "Content-Type": "application/json",
    },
  };
}

// ---------------------------------------------------------------------------
// Exponential backoff + jitter
// ---------------------------------------------------------------------------

function backoffDelay(attempt: number, policy: RetryPolicy): number {
  const exponential = policy.baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, policy.maxDelayMs);
  const jitter = capped * (0.5 + Math.random() * 0.5);
  return Math.round(jitter);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// DLQ
// ---------------------------------------------------------------------------

interface DLQEntry {
  payload: PlaneOutboundPayload;
  failedAt: string;
  error: string;
  attempts: number;
}

const deadLetterQueue: DLQEntry[] = [];

function pushToDLQ(payload: PlaneOutboundPayload, error: string, attempts: number): void {
  const entry: DLQEntry = {
    payload,
    failedAt: new Date().toISOString(),
    error,
    attempts,
  };
  deadLetterQueue.push(entry);
  log.error("outbound DLQ entry written", {
    incidentId: payload.incident_id,
    eventId: payload.event_id,
    error,
    attempts,
    dlqSize: deadLetterQueue.length,
  });

  // Prevent unbounded growth
  if (deadLetterQueue.length > 1000) {
    deadLetterQueue.shift();
  }
}

export function getDLQEntries(): DLQEntry[] {
  return [...deadLetterQueue];
}

// ---------------------------------------------------------------------------
// Outbound send with retry
// ---------------------------------------------------------------------------

export async function sendOutbound(
  payload: PlaneOutboundPayload,
  retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY,
): Promise<OutboundResult> {
  const rawBody = JSON.stringify(payload);
  const signature = signOutboundPayload(rawBody);

  const url = getPlaneOutboundUrl();
  let lastError = "";

  for (let attempt = 0; attempt < retryPolicy.maxAttempts; attempt++) {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(signature?.headers ?? {}),
      };

      if (!signature) {
        headers["X-Plane-Signature"] = "unsigned";
        headers["X-Plane-Timestamp"] = String(Math.floor(Date.now() / 1000));
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15_000);

      const response = await fetch(url, {
        method: "POST",
        headers,
        body: rawBody,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        log.info("outbound relay accepted", {
          eventId: payload.event_id,
          attempt,
          statusCode: response.status,
        });
        return {
          success: true,
          eventId: payload.event_id,
          statusCode: response.status,
          retries: attempt,
          dlq: false,
        };
      }

      lastError = `HTTP ${response.status}: ${await response.text()}`;
      log.warn("outbound relay rejected", {
        eventId: payload.event_id,
        attempt,
        statusCode: response.status,
        error: lastError,
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      log.warn("outbound relay network error", {
        eventId: payload.event_id,
        attempt,
        error: lastError,
      });
    }

    if (attempt < retryPolicy.maxAttempts - 1) {
      const waitMs = backoffDelay(attempt, retryPolicy);
      log.info("outbound relay retrying", { eventId: payload.event_id, attempt, waitMs });
      await delay(waitMs);
    }
  }

  // Hard failure — push to DLQ
  pushToDLQ(payload, lastError, retryPolicy.maxAttempts);

  return {
    success: false,
    eventId: payload.event_id,
    retries: retryPolicy.maxAttempts,
    dlq: true,
    error: lastError,
  };
}

// ---------------------------------------------------------------------------
// High-level relay entry point
// ---------------------------------------------------------------------------

let relayCounter = 0;

export async function relayToPlane(
  incident: {
    incidentId: string;
    correlationId: string;
    eventType: PlaneOutboundPayload["event_type"];
    status: PlaneOutboundPayload["status"];
    severity?: PlaneOutboundPayload["severity"];
    evidence?: Record<string, unknown>;
    actions?: string[];
  },
): Promise<OutboundResult> {
  relayCounter++;
  const payload: PlaneOutboundPayload = {
    incident_id: incident.incidentId,
    correlation_id: incident.correlationId,
    event_id: `fnt-out-${relayCounter}-${Date.now()}`,
    event_type: incident.eventType,
    status: incident.status,
    severity: incident.severity,
    evidence: incident.evidence,
    actions: incident.actions,
    metadata: { source: "fintheon", relayCounter },
  };

  return sendOutbound(payload);
}

export function fireAndForget(incident: {
  incidentId: string;
  correlationId: string;
  eventType: PlaneOutboundPayload["event_type"];
  status: PlaneOutboundPayload["status"];
  severity?: PlaneOutboundPayload["severity"];
  evidence?: Record<string, unknown>;
  actions?: string[];
}): void {
  relayToPlane(incident).then((result) => {
    if (!result.success) {
      log.error("fire-and-forget relay failed", {
        eventId: result.eventId,
        error: result.error,
        dlq: result.dlq,
      });
    }
  });
}
