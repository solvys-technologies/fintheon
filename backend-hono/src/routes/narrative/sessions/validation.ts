import { z } from "zod";

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/)
  .optional();

const linkSchema = z.object({
  url: z.string().trim().url(),
  title: z.string().trim().max(240).nullable().optional(),
  source: z.string().trim().max(80).nullable().optional(),
  summary: z.string().trim().max(1200).nullable().optional(),
});

const tagSchema = z.object({
  tag: z.string().trim().min(1).max(80),
  confidence: z.number().min(0).max(1).default(1),
  source: z.string().trim().max(80).default("human"),
});

export const createSessionSchema = z.object({
  deskId: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  color: colorSchema,
  query: z.string().trim().max(1200).default(""),
  reasoningLevel: z.enum(["quick", "standard", "deep", "max"]).default("standard"),
  catalystIds: z.array(z.string().trim().min(1)).max(12),
  links: z.array(linkSchema).max(12).default([]),
  tags: z.array(tagSchema).max(16).default([]),
});

export const updateSessionSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  color: colorSchema,
  status: z.string().trim().min(1).max(40).optional(),
});

const catalystSchema = z.object({
  riskflowItemId: z.string().trim().min(1),
  role: z.string().trim().min(1).max(40).optional(),
  conflictScore: z.number().nullable().optional(),
  conflictLabel: z.string().trim().max(120).nullable().optional(),
});

export const attachCatalystsSchema = z.object({
  catalystIds: z.array(z.string().trim().min(1)).max(24).default([]),
  catalysts: z.array(catalystSchema).max(24).default([]),
});

export const messageSchema = z.object({
  role: z.string().trim().min(1).max(40),
  content: z.string().trim().min(1).max(12000),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

export const artifactSchema = z.object({
  payload: z.record(z.string(), z.unknown()),
});
