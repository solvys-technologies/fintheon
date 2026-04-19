// [claude-code 2026-04-19] S27-T10 W2e: Skills route — extended with Skills Hub registry surface.
// [claude-code 2026-03-31] S13-T2: Skills route — trade plan generation via Claude Computer Use
import { Hono } from "hono";
import {
  generateTradePlan,
  enrichProposalWithTradePlan,
  isComputerUseAvailable,
  isComputerUseReady,
} from "../../services/skills/tradingview-trade-plan.js";
import { getProposal } from "../../services/autopilot/proposal-service.js";
import { listAllSkills } from "../../services/skills/registry.js";
import { importSkillFromHub } from "../../services/skills/importer.js";

export function createSkillsRoutes(): Hono {
  const app = new Hono();

  // GET /api/skills — Skills Hub registry (5 desks + imported). Introspection path for Harper.
  app.get("/", async (c) => {
    const skills = await listAllSkills();
    return c.json({
      count: skills.length,
      skills: skills.map((s) => ({
        id: s.manifest.id,
        name: s.manifest.name,
        version: s.manifest.version,
        description: s.manifest.description,
        origin: s.origin,
        path: s.path,
        permissions: s.manifest.permissions,
        tools: s.manifest.tools,
        soul: s.manifest.soul,
        scan_status: s.status ?? null,
      })),
    });
  });

  // POST /api/skills/import — accept a hub URL + trigger importSkillFromHub.
  app.post("/import", async (c) => {
    const body = await c.req
      .json<{ hub_url: string; version?: string }>()
      .catch(() => null);
    if (!body?.hub_url) {
      return c.json({ error: "hub_url is required" }, 400);
    }
    try {
      const result = await importSkillFromHub(body.hub_url, {
        version: body.version,
      });
      return c.json(result, result.status === "rejected" ? 422 : 200);
    } catch (err) {
      return c.json({ error: String(err) }, 500);
    }
  });

  // GET /api/skills/trade-plan/status — check Computer Use availability
  app.get("/trade-plan/status", async (c) => {
    const ready = await isComputerUseReady();
    return c.json({
      available: isComputerUseAvailable(),
      ready,
    });
  });

  // POST /api/skills/trade-plan — generate a trade plan
  app.post("/trade-plan", async (c) => {
    const body = await c.req.json<{
      instrument: string;
      direction: "long" | "short";
      context?: string;
    }>();

    if (!body.instrument || !body.direction) {
      return c.json({ error: "instrument and direction are required" }, 400);
    }

    if (!isComputerUseAvailable()) {
      return c.json({
        plan: null,
        reason: "Computer Use not enabled (set ENABLE_COMPUTER_USE=true)",
      });
    }

    const plan = await generateTradePlan(
      body.instrument,
      body.direction,
      body.context,
    );
    return c.json({ plan });
  });

  // POST /api/skills/trade-plan/enrich — enrich existing proposal with trade plan
  app.post("/trade-plan/enrich", async (c) => {
    const body = await c.req.json<{ proposalId: string }>();

    if (!body.proposalId) {
      return c.json({ error: "proposalId is required" }, 400);
    }

    const proposal = await getProposal(body.proposalId);
    if (!proposal) {
      return c.json({ error: "Proposal not found" }, 404);
    }

    if (!isComputerUseAvailable()) {
      return c.json({ proposal: null, reason: "Computer Use not enabled" });
    }

    const direction =
      proposal.direction === "flat" ? "long" : proposal.direction;
    const plan = await generateTradePlan(
      proposal.instrument,
      direction,
      proposal.rationale,
    );

    if (!plan) {
      return c.json({ proposal: null, reason: "Trade plan generation failed" });
    }

    const enriched = await enrichProposalWithTradePlan(body.proposalId, plan);
    return c.json({ proposal: enriched });
  });

  return app;
}
