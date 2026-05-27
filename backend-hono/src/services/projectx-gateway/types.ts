import { z } from "zod";

export const ProjectXProvider = "projectx" as const;

const ProjectXUserNameSchema = z.string().trim().min(1).max(255);

export const ProjectXConnectSchema = z
  .object({
    userName: ProjectXUserNameSchema.optional(),
    username: ProjectXUserNameSchema.optional(),
    apiKey: z.string().trim().min(20).max(4096),
    activeAccountId: z.string().trim().max(80).optional(),
  })
  .transform((input, ctx) => {
    const username = input.userName ?? input.username;
    if (!username) {
      ctx.addIssue({
        code: "custom",
        path: ["userName"],
        message: "ProjectX userName is required",
      });
      return z.NEVER;
    }
    return {
      username,
      apiKey: input.apiKey,
      activeAccountId: input.activeAccountId,
    };
  });

export const ProjectXSyncSchema = z.object({
  mode: z.enum(["manual", "active", "fallback", "calendar"]).default("manual"),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export const ProjectXTradesQuerySchema = z.object({
  from: z.string().trim(),
  to: z.string().trim(),
  origin: z.enum(["all", "user", "autopilot"]).optional().default("all"),
});

export const ProjectXAuthResponseSchema = z.object({
  token: z.string().optional(),
  success: z.boolean().optional(),
  errorCode: z.number().optional(),
  errorMessage: z.string().nullable().optional(),
});

export const ProjectXAccountSchema = z
  .object({
    id: z.number(),
    name: z.string().default("ProjectX"),
    balance: z.number().optional(),
    canTrade: z.boolean().optional(),
    isVisible: z.boolean().optional(),
    simulated: z.boolean().optional(),
  })
  .passthrough();

export const ProjectXTradeSchema = z
  .object({
    id: z.number(),
    accountId: z.number(),
    contractId: z.string(),
    creationTimestamp: z.string(),
    price: z.number(),
    profitAndLoss: z.number().nullable().optional(),
    fees: z.number().nullable().optional(),
    side: z.number(),
    size: z.number(),
    voided: z.boolean().optional(),
    orderId: z.number().nullable().optional(),
  })
  .passthrough();

export interface ProjectXCredentials {
  userId: string;
  username?: string;
  apiKey?: string;
  activeAccountId?: string;
  source: "env" | "db" | "local";
}

export interface CanonicalTrade {
  id: string;
  userId: string;
  accountId: string;
  contract: string;
  entryAt: string;
  exitAt: string | null;
  side: "long" | "short";
  qty: number;
  entryPrice: number;
  exitPrice: number | null;
  realizedPnl: number;
  fees: number;
  origin: "user" | "autopilot";
  rawPayload: Record<string, unknown>;
}

export type ProjectXAccount = z.infer<typeof ProjectXAccountSchema>;
export type ProjectXTrade = z.infer<typeof ProjectXTradeSchema>;
export type ProjectXConnectInput = z.infer<typeof ProjectXConnectSchema>;
export type ProjectXSyncInput = z.infer<typeof ProjectXSyncSchema>;
