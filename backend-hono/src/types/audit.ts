// [claude-code 2026-05-07] S61-T1: Shared mutation contract + audit logger types
import { z } from "zod";

export const AuditDecisionSchema = z.object({
  decision: z.enum(["approved", "denied", "timed_out"]),
  reason: z.string().nullish(),
});
export type AuditDecision = z.infer<typeof AuditDecisionSchema>;

export const MutationContractSchema = z.object({
  agent_id: z.string(),
  tool_name: z.string(),
  tool_input: z.record(z.string(), z.unknown()).default({}),
  description: z.string().nullish(),
  surface: z.string().default("chat"),
  correlation_id: z.string().nullish(),
});

export const AuditRecordSchema = MutationContractSchema.extend({
  id: z.number().optional(),
  decision: z.enum(["approved", "denied", "timed_out"]),
  reason: z.string().nullish(),
  created_at: z.string().optional(),
  created_by: z.string().optional(),
});
export type AuditRecord = z.infer<typeof AuditRecordSchema>;

export type AuditLogInput = Omit<
  AuditRecord,
  "created_by" | "created_at" | "id"
>;

export interface AuditQueryFilters {
  agentId?: string;
  surface?: string;
  decision?: string;
  limit?: number;
  offset?: number;
}
