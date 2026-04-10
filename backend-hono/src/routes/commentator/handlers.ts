// [claude-code 2026-03-26] S2-T3: Commentator CRUD handlers + speaker identify endpoint

import type { Context } from "hono";
import {
  getRegistry,
  addCommentator,
  updateCommentator,
  removeCommentator,
  getMultiplierForSpeaker,
} from "../../services/commentator/commentator-service.js";
import { extractSpeaker } from "../../services/commentator/speaker-extractor.js";
import { TIER_DEFAULT_MULTIPLIERS } from "../../types/commentator.js";

// GET /api/commentator/registry
export async function handleGetRegistry(c: Context) {
  const registry = await getRegistry();
  return c.json({ registry });
}

// POST /api/commentator
export async function handleAddCommentator(c: Context) {
  const body = await c.req.json<{
    name: string;
    aliases?: string[];
    tier: number;
    role?: string;
    institution?: string;
    weightMultiplier?: number;
  }>();

  if (!body.name || !body.tier) {
    return c.json({ error: "name and tier are required" }, 400);
  }
  if (body.tier < 1 || body.tier > 3) {
    return c.json({ error: "tier must be 1, 2, or 3" }, 400);
  }

  const tier = body.tier as 1 | 2 | 3;
  // New entries go to the bottom — get current max rank
  const currentRegistry = await getRegistry();
  const maxRank = currentRegistry.reduce(
    (max, e) => Math.max(max, e.rank ?? 0),
    0,
  );

  const entry = await addCommentator({
    name: body.name,
    aliases: body.aliases ?? [],
    tier,
    role: body.role,
    institution: body.institution,
    weightMultiplier: body.weightMultiplier ?? TIER_DEFAULT_MULTIPLIERS[tier],
    rank: maxRank + 1,
    active: true,
  });

  if (!entry) {
    return c.json({ error: "Failed to add commentator" }, 500);
  }
  return c.json({ entry }, 201);
}

// PUT /api/commentator/:id
export async function handleUpdateCommentator(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  const body = await c.req.json<Record<string, unknown>>();
  await updateCommentator(id, body);
  return c.json({ ok: true });
}

// DELETE /api/commentator/:id
export async function handleDeleteCommentator(c: Context) {
  const id = c.req.param("id");
  if (!id) return c.json({ error: "id is required" }, 400);

  await removeCommentator(id);
  return c.json({ ok: true });
}

// PUT /api/commentator/reorder — batch reorder from drag-and-drop { orderedIds: string[] }
export async function handleReorderCommentators(c: Context) {
  const body = await c.req.json<{ orderedIds: string[] }>();
  if (!body.orderedIds || !Array.isArray(body.orderedIds)) {
    return c.json({ error: "orderedIds array is required" }, 400);
  }

  const { reorderCommentators } =
    await import("../../services/supabase-service.js");
  await reorderCommentators(body.orderedIds);

  // Clear cache so next read picks up new order
  const { clearRegistryCache } =
    await import("../../services/commentator/commentator-service.js");
  clearRegistryCache();

  return c.json({ ok: true, count: body.orderedIds.length });
}

// POST /api/commentator/seed — seed default commentator roster (idempotent)
export async function handleSeedCommentators(c: Context) {
  const { seedDefaultCommentators } =
    await import("../../services/supabase-service.js");
  const seeded = await seedDefaultCommentators();
  return c.json({ seeded });
}

// POST /api/commentator/identify — test extraction: { headline } → { speaker, tier, multiplier }
export async function handleIdentifySpeaker(c: Context) {
  const body = await c.req.json<{ headline: string }>();
  if (!body.headline) {
    return c.json({ error: "headline is required" }, 400);
  }

  const extraction = extractSpeaker(body.headline);
  let tier: number | null = null;
  let multiplier = 0.8; // UNTAGGED default

  if (extraction.speaker) {
    multiplier = await getMultiplierForSpeaker(extraction.speaker);
    // Look up tier from registry if available
    const registry = await getRegistry();
    const { fuzzyMatchSpeaker } =
      await import("../../services/commentator/commentator-service.js");
    const match = fuzzyMatchSpeaker(extraction.speaker, registry);
    if (match) tier = match.tier;
  }

  return c.json({
    speaker: extraction.speaker,
    institution: extraction.institution,
    isOfficial: extraction.isOfficial,
    confidence: extraction.confidence,
    tier,
    multiplier,
  });
}
