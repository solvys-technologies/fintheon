// [claude-code 2026-04-19] S25: GET /api/preview/og?url=… — server-side Open Graph/Twitter-Card
//   scraper for the mobile EmbedPreview. Mounted public (no auth) because the SW may invoke it
//   pre-login for push-tap previews, but access is gated by the domain allow-list in og-scraper.
import { Hono } from "hono";
import { fetchOgPreview } from "../services/preview/og-scraper.js";

export function createPreviewRoutes() {
  const app = new Hono();

  app.get("/og", async (c) => {
    const url = c.req.query("url");
    if (!url) return c.json({ error: "url query param required" }, 400);
    if (url.length > 2048) return c.json({ error: "url too long" }, 400);

    const preview = await fetchOgPreview(url);
    if (!preview) {
      return c.json({ error: "Preview unavailable" }, 404);
    }
    // Set a short client cache so repeated opens don't re-fetch.
    c.header("Cache-Control", "public, max-age=300");
    return c.json(preview);
  });

  return app;
}
