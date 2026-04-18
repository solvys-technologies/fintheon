// [claude-code 2026-04-19] S24-T1: lexicon_proposals CRUD — T2 agent proposes keywords, TP approves, approval copies to lexicon_keywords.
import { Hono } from "hono";
import { sql, isDatabaseAvailable } from "../../config/database.js";
import { createLogger } from "../../lib/logger.js";
import { emitPushAndLog } from "../../services/notifications/emit.js";

const log = createLogger("LexiconProposals");

const SENTIMENTS = ["bullish", "bearish", "neutral"] as const;

export function createLexiconProposalRoutes(): Hono {
  const app = new Hono();

  // GET /api/lexicon/proposals?status=pending
  app.get("/", async (c) => {
    if (!isDatabaseAvailable()) return c.json({ proposals: [], count: 0 });
    const status = c.req.query("status");
    const limit = Math.min(parseInt(c.req.query("limit") ?? "100", 10), 500);

    const rows = status
      ? await sql`
          SELECT * FROM lexicon_proposals WHERE status = ${status}
          ORDER BY created_at DESC LIMIT ${limit}
        `
      : await sql`
          SELECT * FROM lexicon_proposals
          ORDER BY created_at DESC LIMIT ${limit}
        `;
    return c.json({ proposals: rows, count: rows.length });
  });

  // POST /api/lexicon/proposals — agent proposes new keyword
  app.post("/", async (c) => {
    if (!isDatabaseAvailable())
      return c.json({ error: "DB unavailable" }, 503);
    const body = await c.req.json().catch(() => null);
    if (!body?.keyword || !body?.sentiment || !body?.reason) {
      return c.json(
        { error: "Missing fields: keyword, sentiment, reason" },
        400,
      );
    }
    if (!SENTIMENTS.includes(body.sentiment)) {
      return c.json(
        { error: `sentiment must be one of: ${SENTIMENTS.join(", ")}` },
        400,
      );
    }
    const proposedBy =
      typeof body.proposedBy === "string"
        ? body.proposedBy
        : (((c.get as (k: string) => unknown)("email") as string | undefined) ??
          "api");

    const rows = await sql`
      INSERT INTO lexicon_proposals
        (keyword, phrase_pattern, sentiment, is_matrix_flip, target_regime,
         requires_action_verb, reason, evidence, proposed_by, status)
      VALUES
        (${body.keyword}, ${body.phrasePattern ?? null}, ${body.sentiment},
         ${body.isMatrixFlip ?? false}, ${body.targetRegime ?? null},
         ${body.requiresActionVerb ?? true}, ${body.reason},
         ${JSON.stringify(body.evidence ?? {})}::jsonb,
         ${proposedBy}, 'pending')
      RETURNING *
    `;
    const proposal = rows[0];
    if (!proposal) {
      return c.json({ error: "Insert failed" }, 500);
    }

    // Fire push — category lexiconProposals, severity high (respects quiet hours).
    await emitPushAndLog({
      userId: "all",
      category: "lexiconProposals",
      severity: "high",
      title: `Lexicon proposal: ${body.keyword}`,
      body: `${proposedBy} proposes "${body.keyword}" → ${body.sentiment}`,
      url: `/admin/approvals/lexicon/${proposal.id}`,
      fingerprint: `lexicon-proposal:${body.keyword.toLowerCase()}:${new Date().toISOString().slice(0, 13)}`,
      eventId: proposal.id,
      metadata: { proposalId: proposal.id, keyword: body.keyword },
    }).catch((err) => {
      log.warn("Lexicon proposal push failed (non-fatal)", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    log.info("Lexicon proposal created", {
      id: proposal.id,
      keyword: body.keyword,
      proposedBy,
    });
    return c.json(proposal, 201);
  });

  // POST /api/lexicon/proposals/:id/approve — copies to lexicon_keywords with approved=TRUE
  app.post("/:id/approve", async (c) => {
    if (!isDatabaseAvailable())
      return c.json({ error: "DB unavailable" }, 503);
    const id = c.req.param("id");
    const userId = (((c.get as (k: string) => unknown)("userId") as string | undefined) ?? null);

    const existing = await sql`
      SELECT * FROM lexicon_proposals WHERE id = ${id} LIMIT 1
    `;
    if (existing.length === 0) return c.json({ error: "Not found" }, 404);
    const row = existing[0];
    if (row.status !== "pending") {
      return c.json({ error: `Proposal already ${row.status}` }, 409);
    }

    // Copy to lexicon_keywords (approved=TRUE).
    await sql`
      INSERT INTO lexicon_keywords
        (keyword, phrase_pattern, sentiment, is_matrix_flip, target_regime,
         requires_action_verb, added_by, approved)
      VALUES
        (${row.keyword}, ${row.phrase_pattern}, ${row.sentiment},
         ${row.is_matrix_flip}, ${row.target_regime}, ${row.requires_action_verb},
         ${row.proposed_by}, TRUE)
      ON CONFLICT ((LOWER(keyword))) DO UPDATE SET
         sentiment = EXCLUDED.sentiment,
         phrase_pattern = EXCLUDED.phrase_pattern,
         is_matrix_flip = EXCLUDED.is_matrix_flip,
         target_regime = EXCLUDED.target_regime,
         requires_action_verb = EXCLUDED.requires_action_verb,
         approved = TRUE
    `;

    const updated = await sql`
      UPDATE lexicon_proposals
      SET status = 'approved', approved_by = ${userId}::uuid, decided_at = now(), applied_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    log.info("Lexicon proposal approved + applied", { id, keyword: row.keyword });
    return c.json(updated[0]);
  });

  // POST /api/lexicon/proposals/:id/deny
  app.post("/:id/deny", async (c) => {
    if (!isDatabaseAvailable())
      return c.json({ error: "DB unavailable" }, 503);
    const id = c.req.param("id");
    const userId = (((c.get as (k: string) => unknown)("userId") as string | undefined) ?? null);
    const rows = await sql`
      UPDATE lexicon_proposals
      SET status = 'denied', approved_by = ${userId}::uuid, decided_at = now()
      WHERE id = ${id} AND status = 'pending'
      RETURNING *
    `;
    if (rows.length === 0)
      return c.json({ error: "Not found or already decided" }, 404);
    return c.json(rows[0]);
  });

  return app;
}
