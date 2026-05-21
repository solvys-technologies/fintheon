import { z } from "zod";

export const ToolPermissionSchema = z.enum(["required", "optional", "prohibited"]);
export type ToolPermission = z.infer<typeof ToolPermissionSchema>;

export const AgentCapabilityProfileSchema = z.object({
  agent_id: z.string().min(1),
  responsibilities: z.array(z.string().min(1)),
  required_tools: z.array(z.string()),
  optional_tools: z.array(z.string()),
  prohibited_tools: z.array(z.string()),
  handoff_targets: z.array(z.string()),
});

export const RegistryEnforcementResultSchema = z.object({
  allowed: z.boolean(),
  reason: z.string(),
});

export type AgentCapabilityProfile = z.infer<typeof AgentCapabilityProfileSchema>;
export type RegistryEnforcementResult = z.infer<typeof RegistryEnforcementResultSchema>;
