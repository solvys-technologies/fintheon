// [claude-code 2026-05-05] S59-T3: per-agent health dashboard route.
// Returns SOUL load status, REFLECT score, memory count, GEPA stats, persona health.
import { Hono } from "hono";
import { createLogger } from "../../lib/logger.js";
import type { AgentId } from "../../services/ai/soul/loader.js";

const log = createLogger("AgentHealth");

const AGENT_IDS: AgentId[] = ["harper", "oracle", "feucht", "consul", "herald"];
const AGENT_ROLES: Record<AgentId, string> = {
  harper: "CAO",
  oracle: "Forecaster",
  feucht: "Risk Manager",
  consul: "Quantitative",
  herald: "Contrarian",
};

interface AgentHealthEntry {
  agentId: AgentId;
  role: string;
  soulLoaded: boolean;
  soulVersion: number | null;
  nativeHomeIntact: boolean;
  reflectScore: number | null;
  reflectLastRun: string | null;
  memoryCount: number;
  gepaLastRun: string | null;
  gepaOpenPrs: number;
  personaHealth: "green" | "amber" | "red";
}

/* ------------------------------------------------------------------ */
/*  SOUL health check                                                   */
/* ------------------------------------------------------------------ */

async function checkSoul(agentId: AgentId): Promise<{
  soulLoaded: boolean;
  soulVersion: number | null;
  nativeHomeIntact: boolean;
}> {
  try {
    const { loadSoul } = await import("../../services/ai/soul/loader.js");
    const soul = await loadSoul(agentId);
    const identity = soul.identity;
    const nativeHomeIntact =
      typeof identity.name === "string" &&
      identity.name.length > 0 &&
      typeof identity.role === "string" &&
      identity.role.length > 0 &&
      typeof identity.self_description === "string" &&
      identity.self_description.length > 0;
    return {
      soulLoaded: true,
      soulVersion: soul.schema_version,
      nativeHomeIntact,
    };
  } catch (err) {
    log.warn(`SOUL load failed for ${agentId}`, { error: String(err) });
    return { soulLoaded: false, soulVersion: null, nativeHomeIntact: false };
  }
}

/* ------------------------------------------------------------------ */
/*  REFLECT health check                                                */
/* ------------------------------------------------------------------ */

interface ReflectSnapshot {
  reflectScore: number | null;
  reflectLastRun: string | null;
}

async function checkReflect(): Promise<ReflectSnapshot> {
  try {
    const { getLatestReflectReport } = await import(
      "../../services/autoresearch/reflect-engine.js"
    );
    const report = await getLatestReflectReport();
    if (!report) return { reflectScore: null, reflectLastRun: null };
    return {
      reflectScore: report.metrics?.scoreCalibration ?? null,
      reflectLastRun: report.generatedAt,
    };
  } catch (err) {
    log.warn("REFLECT check failed", { error: String(err) });
    return { reflectScore: null, reflectLastRun: null };
  }
}

/* ------------------------------------------------------------------ */
/*  GEPA health snapshot                                                */
/* ------------------------------------------------------------------ */

interface GepaSnapshot {
  gepaLastRun: string | null;
  gepaOpenPrs: number;
}

async function checkGepa(): Promise<GepaSnapshot> {
  try {
    const { loadGepaDiagnostics } = await import(
      "../../services/gepa/runner.js"
    );
    const diag = await loadGepaDiagnostics();
    return {
      gepaLastRun: diag.last_run_at,
      gepaOpenPrs: diag.evolutions_proposed_7d,
    };
  } catch (err) {
    log.warn("GEPA check failed", { error: String(err) });
    return { gepaLastRun: null, gepaOpenPrs: 0 };
  }
}

/* ------------------------------------------------------------------ */
/*  Memory count                                                        */
/* ------------------------------------------------------------------ */

async function countMemories(agentId: AgentId): Promise<number> {
  try {
    // Count directly via Supabase for efficiency instead of fetching all rows
    const { getSupabaseClient } = await import("../../config/supabase.js");
    const sb = getSupabaseClient();
    if (!sb) return 0;
    const { count, error } = await sb
      .from("agent_memory")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId);
    if (error) {
      log.warn(`Memory count failed for ${agentId}`, { error: error.message });
      return 0;
    }
    return count ?? 0;
  } catch (err) {
    log.warn(`Memory count error for ${agentId}`, { error: String(err) });
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/*  Persona health derivation                                           */
/* ------------------------------------------------------------------ */

function derivePersonaHealth(
  soulLoaded: boolean,
  nativeHomeIntact: boolean,
): "green" | "amber" | "red" {
  if (!soulLoaded) return "red";
  if (!nativeHomeIntact) return "amber";
  return "green";
}

/* ------------------------------------------------------------------ */
/*  Route                                                               */
/* ------------------------------------------------------------------ */

export function createApparatusRoutes(): Hono {
  const router = new Hono();

  router.get("/agent-health", async (c) => {
    const start = Date.now();

    const [souls, reflect, gepa] = await Promise.all([
      Promise.all(AGENT_IDS.map(async (id) => ({ id, ...(await checkSoul(id)) }))),
      checkReflect(),
      checkGepa(),
    ]);

    const memoryCounts = await Promise.all(
      AGENT_IDS.map(async (id) => ({ id, count: await countMemories(id) })),
    );

    const entryMap = new Map<AgentId, AgentHealthEntry>();

    for (const agentId of AGENT_IDS) {
      const soul = souls.find((s) => s.id === agentId)!;
      const memc = memoryCounts.find((m) => m.id === agentId)!;
      const personaHealth = derivePersonaHealth(
        soul.soulLoaded,
        soul.nativeHomeIntact,
      );
      entryMap.set(agentId, {
        agentId,
        role: AGENT_ROLES[agentId],
        soulLoaded: soul.soulLoaded,
        soulVersion: soul.soulVersion,
        nativeHomeIntact: soul.nativeHomeIntact,
        reflectScore: reflect.reflectScore,
        reflectLastRun: reflect.reflectLastRun,
        memoryCount: memc.count,
        gepaLastRun: gepa.gepaLastRun,
        gepaOpenPrs: gepa.gepaOpenPrs,
        personaHealth,
      });
    }

    const agents = AGENT_IDS.map((id) => entryMap.get(id)!);

    log.info("Agent health check", {
      elapsed: Date.now() - start,
      agents: agents.map((a) => `${a.agentId}:${a.personaHealth}`),
    });

    return c.json({ timestamp: new Date().toISOString(), agents });
  });

  return router;
}
