import { z } from "zod";
import { DESK_ARCHETYPES, FORECAST_DIRECTIONS } from "./types.js";

const nullableText = z.string().trim().max(240).nullable().optional();
const longText = z.string().trim().min(1).max(1200);

export const deskProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80),
    bio: z.string().trim().max(500).default(""),
    archetypes: z.array(z.enum(DESK_ARCHETYPES)).min(1).max(4),
    brokerClassification: nullableText,
    propFirmClassification: nullableText,
    affiliateUrl: z.string().trim().url().nullable().optional(),
    affiliateDisclosure: z.string().trim().max(500).nullable().optional(),
    affiliateRelationship: nullableText,
  })
  .refine(
    (value) =>
      !value.affiliateUrl || (value.affiliateDisclosure?.length ?? 0) >= 12,
    {
      message: "Affiliate URL requires disclosure text.",
      path: ["affiliateDisclosure"],
    },
  );

export const deskAgentStyleSchema = z.object({
  archetypeMix: z.array(z.enum(DESK_ARCHETYPES)).min(1).max(4),
  houseBias: nullableText,
  preferredEvidenceSources: z.array(z.string().trim().min(1).max(80)).max(8),
  riskPosture: nullableText,
  timeHorizon: nullableText,
  forbiddenClaims: z.array(z.string().trim().min(1).max(120)).max(8),
  customInstruction: z.string().trim().max(600).nullable().optional(),
});

export const marketReferenceSchema = z.object({
  venue: z.enum(["kalshi", "polymarket", "prediction-market", "other"]),
  marketTitle: z.string().trim().min(1).max(180),
  marketUrl: z.string().trim().url(),
  priceOrOdds: nullableText,
  expiry: z.string().datetime().nullable().optional(),
  fetchedAt: z.string().datetime().nullable().optional(),
});

export const forecastSchema = z.object({
  deskId: z.string().trim().nullable().optional(),
  narrativeSessionId: z.string().uuid().nullable().optional(),
  title: z.string().trim().min(1).max(120),
  thesis: longText,
  probability: z.number().min(0).max(100).nullable().optional(),
  direction: z.enum(FORECAST_DIRECTIONS).nullable().optional(),
  timeframe: z.string().trim().min(1).max(120),
  validationRule: z.string().trim().min(1).max(600),
  expiresAt: z.string().datetime().nullable().optional(),
  catalystIds: z.array(z.string().trim().min(1)).max(20).default([]),
  marketReferences: z.array(marketReferenceSchema).max(5).default([]),
});
