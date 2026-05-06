// [claude-code 2026-05-06] S60-T4: Normalize and process accepted Plane inbound events
import type { PlaneInboundPayload } from "../../../routes/integrations/plane/schema.js";
import { createLogger } from "../../../lib/logger.js";

const log = createLogger("PlaneInbound");

export interface NormalizedInboundEvent {
  eventId: string;
  correlationId: string;
  eventType: string;
  planeTimestamp: string;
  receivedAt: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown> | undefined;
  source: "plane";
}

export async function processInboundEvent(
  payload: PlaneInboundPayload,
): Promise<NormalizedInboundEvent> {
  const normalized: NormalizedInboundEvent = {
    eventId: payload.event_id,
    correlationId: payload.correlation_id,
    eventType: payload.event_type,
    planeTimestamp: payload.timestamp,
    receivedAt: new Date().toISOString(),
    data: payload.data as Record<string, unknown>,
    metadata: payload.metadata as Record<string, unknown> | undefined,
    source: "plane",
  };

  log.info("plane inbound event processed", {
    eventId: normalized.eventId,
    eventType: normalized.eventType,
    correlationId: normalized.correlationId,
  });

  return normalized;
}
