// [claude-code 2026-03-11] Public blindspots endpoint — agent-controllable via ER monitoring
import { Hono } from "hono";

export function createBlindspotsRoutes() {
  const router = new Hono();

  // GET /api/blindspots — returns current blindspots from DB
  router.get("/", async (c) => {
    try {
      const { sql, isDatabaseAvailable } =
        await import("../config/database.js");

      if (!isDatabaseAvailable() || !sql) {
        return c.json({ blindspots: [], source: "defaults" });
      }

      // Try psych_assist_profiles first (agent-managed)
      const profiles = await sql`
        SELECT blind_spots FROM psych_assist_profiles
        ORDER BY updated_at DESC NULLS LAST
        LIMIT 1
      `.catch(() => []);

      if (
        profiles.length > 0 &&
        Array.isArray(profiles[0].blind_spots) &&
        profiles[0].blind_spots.length > 0
      ) {
        const spots = profiles[0].blind_spots.map(
          (text: string, idx: number) => ({
            id: idx + 1,
            text: typeof text === "string" ? text : String(text),
            severity:
              text.toLowerCase?.().includes("overtrad") ||
              text.toLowerCase?.().includes("revenge")
                ? "high"
                : "medium",
          }),
        );
        return c.json({ blindspots: spots, source: "psych-profile" });
      }

      // Fallback: pull from latest risk assessment blind_spot_alerts
      const assessments = await sql`
        SELECT blind_spot_alerts FROM risk_assessments
        WHERE blind_spot_alerts IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 3
      `.catch(() => []);

      const allAlerts: string[] = [];
      for (const row of assessments) {
        if (Array.isArray(row.blind_spot_alerts)) {
          for (const alert of row.blind_spot_alerts) {
            const text = typeof alert === "string" ? alert : String(alert);
            if (!allAlerts.includes(text)) allAlerts.push(text);
          }
        }
      }

      if (allAlerts.length > 0) {
        const spots = allAlerts.slice(0, 5).map((text, idx) => ({
          id: idx + 1,
          text,
          severity:
            text.toLowerCase().includes("overtrad") ||
            text.toLowerCase().includes("revenge")
              ? "high"
              : "medium",
        }));
        return c.json({ blindspots: spots, source: "risk-assessments" });
      }

      return c.json({ blindspots: [], source: "empty" });
    } catch (err) {
      console.error("[blindspots] Error:", err);
      return c.json({ blindspots: [], source: "error" });
    }
  });

  // POST /api/blindspots — agent updates blindspots
  router.post("/", async (c) => {
    try {
      const body = await c.req.json();
      const items = Array.isArray(body.blindspots) ? body.blindspots : [];

      const { sql, isDatabaseAvailable } =
        await import("../config/database.js");
      if (!isDatabaseAvailable() || !sql) {
        return c.json({ ok: false, error: "Database unavailable" }, 503);
      }

      const texts = items
        .map((item: string | { text: string }) =>
          typeof item === "string" ? item : item.text,
        )
        .filter(Boolean);

      // Upsert into psych_assist_profiles for the default user
      await sql`
        INSERT INTO psych_assist_profiles (user_id, blind_spots, updated_at)
        VALUES ('local', ${JSON.stringify(texts)}::jsonb, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          blind_spots = ${JSON.stringify(texts)}::jsonb,
          updated_at = NOW()
      `;

      return c.json({ ok: true, count: texts.length });
    } catch (err) {
      console.error("[blindspots] POST error:", err);
      return c.json({ ok: false, error: "Failed to update" }, 500);
    }
  });

  // POST /api/blindspots/interview — save interview profile data
  router.post("/interview", async (c) => {
    try {
      const body = await c.req.json();
      const { name, roadblocks, goals, instruments, discord } = body;

      const { sql, isDatabaseAvailable } =
        await import("../config/database.js");
      if (!isDatabaseAvailable() || !sql) {
        return c.json({ ok: true, stored: "local-only" });
      }

      const blindSpots = Array.isArray(roadblocks) ? roadblocks : [];

      await sql`
        INSERT INTO psych_assist_profiles (user_id, blind_spots, orientation_complete, updated_at)
        VALUES ('local', ${JSON.stringify(blindSpots)}::jsonb, true, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          blind_spots = ${JSON.stringify(blindSpots)}::jsonb,
          orientation_complete = true,
          updated_at = NOW()
      `;

      return c.json({
        ok: true,
        profile: {
          name,
          instruments,
          goals,
          discord,
          roadblockCount: blindSpots.length,
        },
      });
    } catch (err) {
      console.error("[blindspots/interview] Error:", err);
      return c.json({ ok: false, error: "Failed to save interview" }, 500);
    }
  });

  return router;
}
