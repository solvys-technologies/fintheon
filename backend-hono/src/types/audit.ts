import { z } from "zod";

export const MutationContractSchema = z.object({
  agent_id: z.string(),
  tool_name: z.string(),
  tool_input: z.record(z.string(), z.unknown()),
  description: z.string(),
  surface: z.string().default("chat"),
  correlation_id: z.string(),
});

export const AuditDecisionSchema = z.object({
  decision: z.enum(["approved", "denied", "timed_out"]),
  reason: z.string().nullable(),
});

export const AuditRecordSchema = MutationContractSchema.extend({
  id: z.string().uuid().optional(),
  decision: z.enum(["approved", "denied", "timed_out"]),
  reason: z.string().nullable(),
  created_at: z.string().optional(),
  created_by: z.string().uuid().nullable().optional(),
  logged_at: z.string().optional(),
});

export const AuditQueryFiltersSchema = z.object({
  agentId: z.string().optional(),
  surface: z.string().optional(),
  decision: z.enum(["approved", "denied", "timed_out"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type MutationContract = z.infer<typeof MutationContractSchema>;
export type AuditDecision = z.infer<typeof AuditDecisionSchema>;
export type AuditRecord = z.infer<typeof AuditRecordSchema>;
export type AuditQueryFilters = z.infer<typeof AuditQueryFiltersSchema>;
