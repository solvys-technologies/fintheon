// [claude-code 2026-05-07] S61-T2: Capability registry runtime — Zod-validated agent profiles
import { z } from "zod";

export const ToolPermissionSchema = z.enum([
  "required",
  "optional",
  "prohibited",
]);

export type ToolPermission = z.infer<typeof ToolPermissionSchema>;

export const AgentCapabilityProfileSchema = z.object({
  agent_id: z.enum(["harper", "oracle", "feucht", "consul", "herald"]),
  responsibilities: z.array(z.string().min(1)),
  required_tools: z.array(z.string().min(1)),
  optional_tools: z.array(z.string().min(1)),
  prohibited_tools: z.array(z.string().min(1)),
  handoff_targets: z.array(z.string().min(1)),
});

export type AgentCapabilityProfile = z.infer<
  typeof AgentCapabilityProfileSchema
>;

export const RegistryEnforcementResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
});

export type RegistryEnforcementResult = z.infer<
  typeof RegistryEnforcementResultSchema
>;
