// [claude-code 2026-04-19] S24-T1: lexicon_keywords CRUD — approved keywords consumed by T2 scorer at runtime.
import { Hono } from "hono";
import { sql, isDatabaseAvailable } from "../../config/database.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("LexiconKeywords");

const SENTIMENTS = ["bullish", "bearish", "neutral"] as const;

export function createLexiconKeywordsRoutes(): Hono {
  const app = new Hono();

  // GET /api/lexicon/keywords?approved=true&sentiment=bearish&limit=500
  app.get("/", async (c) => {
    if (!isDatabaseAvailable()) return c.json({ keywords: [], count: 0 });
    const approvedParam = c.req.query("approved");
    const sentiment = c.req.query("sentiment");
    const limit = Math.min(parseInt(c.req.query("limit") ?? "500", 10), 2000);

    let rows;
    if (approvedParam !== undefined && sentiment) {
      rows = await sql`
        SELECT * FROM lexicon_keywords
        WHERE approved = ${approvedParam === "true"} AND sentiment = ${sentiment}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else if (approvedParam !== undefined) {
      rows = await sql`
        SELECT * FROM lexicon_keywords
        WHERE approved = ${approvedParam === "true"}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else if (sentiment) {
      rows = await sql`
        SELECT * FROM lexicon_keywords
        WHERE sentiment = ${sentiment}
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    } else {
      rows = await sql`
        SELECT * FROM lexicon_keywords
        ORDER BY created_at DESC LIMIT ${limit}
      `;
    }

    return c.json({ keywords: rows, count: rows.length });
  });

  // POST /api/lexicon/keywords — super admin direct-add (bypasses proposal queue)
  // Body: { keyword, phrasePattern?, sentiment, isMatrixFlip?, targetRegime?, requiresActionVerb?, expiresAt? }
  app.post("/", async (c) => {
    if (!isDatabaseAvailable()) return c.json({ error: "DB unavailable" }, 503);
    const body = await c.req.json().catch(() => null);
    if (!body?.keyword || !body?.sentiment) {
      return c.json({ error: "Missing fields: keyword, sentiment" }, 400);
    }
    if (!SENTIMENTS.includes(body.sentiment)) {
      return c.json(
        { error: `sentiment must be one of: ${SENTIMENTS.join(", ")}` },
        400,
      );
    }
    const addedBy =
      ((c.get as (k: string) => unknown)("email") as string | undefined) ??
      "api";
    const rows = await sql`
      INSERT INTO lexicon_keywords
        (keyword, phrase_pattern, sentiment, is_matrix_flip, target_regime, requires_action_verb, added_by, approved, expires_at)
      VALUES
        (${body.keyword}, ${body.phrasePattern ?? null}, ${body.sentiment},
         ${body.isMatrixFlip ?? false}, ${body.targetRegime ?? null},
         ${body.requiresActionVerb ?? true}, ${addedBy}, TRUE,
         ${body.expiresAt ?? null})
      ON CONFLICT ((LOWER(keyword))) DO UPDATE SET
         sentiment = EXCLUDED.sentiment,
         phrase_pattern = EXCLUDED.phrase_pattern,
         is_matrix_flip = EXCLUDED.is_matrix_flip,
         target_regime = EXCLUDED.target_regime,
         requires_action_verb = EXCLUDED.requires_action_verb,
         approved = TRUE,
         expires_at = EXCLUDED.expires_at
      RETURNING *
    `;
    log.info("Lexicon keyword upserted", { keyword: body.keyword });
    return c.json(rows[0] ?? null, 201);
  });

  // DELETE /api/lexicon/keywords/:id
  app.delete("/:id", async (c) => {
    if (!isDatabaseAvailable()) return c.json({ error: "DB unavailable" }, 503);
    const id = c.req.param("id");
    const rows = await sql`
      DELETE FROM lexicon_keywords WHERE id = ${id} RETURNING id
    `;
    if (rows.length === 0) return c.json({ error: "Not found" }, 404);
    return c.json({ deleted: rows[0].id });
  });

  return app;
}
