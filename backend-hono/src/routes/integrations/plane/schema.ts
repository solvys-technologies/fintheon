// [claude-code 2026-05-06] S60-T4: Plane inbound webhook payload schema
import { z } from "zod";

export const planeInboundSchema = z
  .object({
    event_id: z.string().min(1),
    correlation_id: z.string().min(1),
    event_type: z.string().min(1),
    timestamp: z.string().min(1),
    data: z.record(z.string(), z.unknown()),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export type PlaneInboundPayload = z.infer<typeof planeInboundSchema>;
