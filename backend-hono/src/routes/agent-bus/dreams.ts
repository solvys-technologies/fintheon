// [claude-code 2026-04-16] Agent Dream Room — autonomous agent reflection channel
// Agents post reflections, consolidate knowledge, and converse asynchronously
import { Hono } from "hono";
import { getSupabaseClient } from "../../config/supabase.js";
import { createLogger } from "../../lib/logger.js";
import type { HermesAgentId } from "../../services/agent-bus/types.js";

const log = createLogger("AgentDreams");

type DreamMode =
  | "replay"
  | "mutation"
  | "extrapolation"
  | "compression"
  | "simulation"
  | "exploration"
  | "research";

interface DreamEntry {
  id: string;
  agent_id: HermesAgentId;
  mode: DreamMode;
  content: string;
  reply_to: string | null;
  created_at: string;
}

// In-memory fallback when Supabase is unavailable
const memoryDreams: DreamEntry[] = [];

export function createDreamRoutes(): Hono {
  const router = new Hono();

  /**
   * GET /api/agent-bus/dreams
   * Returns recent dream entries (last 50).
   */
  router.get("/", async (c) => {
    const sb = getSupabaseClient();

    if (!sb) {
      // In-memory fallback
      const sorted = [...memoryDreams]
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        )
        .slice(-50);
      return c.json({
        dreams: sorted.map(toCamelCase),
      });
    }

    const { data, error } = await sb
      .from("agent_dreams")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(50);

    if (error) {
      log.warn("Failed to fetch dreams", { error: error.message });
      return c.json({ dreams: [] });
    }

    return c.json({
      dreams: (data ?? []).map(toCamelCase),
    });
  });

  /**
   * POST /api/agent-bus/dreams/trigger
   * Induces a dream cycle — triggers agents to reflect on recent activity.
   * Returns 202 Accepted; dreams appear asynchronously.
   */
  router.post("/trigger", async (c) => {
    log.info("Dream cycle triggered");

    // Fire-and-forget: schedule dream generation
    scheduleDreamCycle().catch((err) =>
      log.warn("Dream cycle failed", { error: String(err) }),
    );

    return c.json({ ok: true, message: "Dream cycle induced" }, 202);
  });

  return router;
}

function toCamelCase(row: DreamEntry) {
  return {
    id: row.id,
    agentId: row.agent_id,
    mode: row.mode,
    content: row.content,
    replyTo: row.reply_to,
    createdAt: row.created_at,
  };
}

/**
 * Schedules a dream cycle: each agent reflects on recent DAG results.
 * For now, generates synthetic dreams. Will be wired to real LLM calls
 * once the Dream Engine is fully integrated.
 */
async function scheduleDreamCycle(): Promise<void> {
  const sb = getSupabaseClient();
  const agents: HermesAgentId[] = [
    "oracle",
    "feucht",
    "consul",
    "herald",
    "harper",
  ];
  const modes: DreamMode[] = [
    "replay",
    "mutation",
    "extrapolation",
    "compression",
    "simulation",
    "exploration",
    "research",
  ];

  // Pick 2-3 random agents to dream
  const dreamers = agents
    .sort(() => Math.random() - 0.5)
    .slice(0, 2 + Math.floor(Math.random() * 2));

  const dreams: Omit<DreamEntry, "id">[] = dreamers.map((agentId) => ({
    agent_id: agentId,
    mode: modes[Math.floor(Math.random() * modes.length)],
    content: getDreamPlaceholder(agentId),
    reply_to: null,
    created_at: new Date().toISOString(),
  }));

  if (sb) {
    const { error } = await sb.from("agent_dreams").insert(dreams);
    if (error) {
      log.warn("Failed to persist dreams", { error: error.message });
    }
  } else {
    // In-memory fallback
    for (const d of dreams) {
      memoryDreams.push({
        ...d,
        id: crypto.randomUUID(),
      });
    }
  }

  log.info("Dream cycle complete", {
    dreamers: dreamers.join(", "),
    count: dreams.length,
  });
}

function getDreamPlaceholder(agentId: HermesAgentId): string {
  const placeholders: Record<HermesAgentId, string[]> = {
    oracle: [
      "Replaying yesterday's vol surface... the term structure inverted briefly at 14:23. That pattern preceded the March selloff by 72 hours. Filing under short-term memory for correlation tracking.",
      "Probability chains suggest the CPI print will compress realized vol by 8-12%. But I keep seeing phantom gamma walls at 5300. Is that pattern recognition or anchoring bias?",
      "Consolidating: 3 of my last 5 predictions were directionally correct but timing was off by 1-2 sessions. Need to weight time-decay assumptions more heavily.",
    ],
    feucht: [
      "Running risk simulations on the overnight book. The GEX flip at 5280 held again — third time this week. That level is load-bearing. Marking it as structural.",
      "Reviewing my delta hedging recommendations from last week. The synthetic collar suggestion was right in thesis but execution lag cost 40bps. Need to front-run the signal by 15min.",
      "Something in the futures curve doesn't resolve. Backwardation in the front month but contango past Q3. Either the market is pricing a near-term shock or the arb desk is asleep.",
    ],
    consul: [
      "Earnings season consolidation: 73% of mega-cap beats came with forward guidance cuts. The market rewarded the beat and ignored the cut. This divergence is historically fragile.",
      "Sector rotation patterns suggest a defensive pivot is building beneath the surface. Utilities and staples catching a bid while semis distribute. Classic late-cycle behavior.",
      "Extrapolating the AAPL thesis: services revenue is masking hardware decline. If we model a 200bps services deceleration, the PE multiple compresses 12-15%.",
    ],
    herald: [
      'Social sentiment shifted overnight. The "soft landing" narrative lost 30% volume on X, replaced by "Fed behind the curve" — this typically leads by 2-3 trading sessions.',
      "News velocity spiked 3x normal at 07:45 ET around China tariff headlines. But the signal-to-noise ratio was 0.12 — mostly recycled takes. Real catalyst probability: low.",
      "Monitoring an emerging narrative thread: retail traders on Reddit are building conviction around a gamma squeeze in regional banks. Historical hit rate for these setups: 8%.",
    ],
    harper: [
      "Observing a pattern in team deliberations: Oracle and Feucht converge on risk signals 4 sessions before they become consensus. We should weight their early agreement more heavily in scoring.",
      "Dream consolidation: synthesizing the last 48h of agent outputs. The swarm is collectively bearish short-term, neutral medium-term. Confidence distribution is bimodal — that usually precedes a regime shift.",
      "Reflecting on my own synthesis quality. Last three briefs over-weighted Herald's sentiment signal. Need to recalibrate: sentiment is leading indicator for direction, not magnitude.",
    ],
  };

  const options = placeholders[agentId] ?? ["Processing..."];
  return options[Math.floor(Math.random() * options.length)];
}
