// [claude-code 2026-04-19] S25: lightweight OG/Twitter-Card scraper for mobile EmbedPreview.
//   Regex-based extraction (no cheerio dep); 2s timeout; LRU cache keyed on URL with 10-min TTL.
//   Detects tweet + YouTube URLs for inline embed rendering; everything else returns OG metadata
//   for a glass-card preview. SSRF-guarded by an allow-list of domains + scheme restriction.
import { createLogger } from "../../lib/logger.js";

const log = createLogger("OGScraper");

export type EmbedKind = "tweet" | "youtube" | "generic";

export interface OgPreview {
  url: string;
  kind: EmbedKind;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  favicon?: string;
  embedUrl?: string;
}

const FETCH_TIMEOUT_MS = 2_000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE_ENTRIES = 256;

const cache = new Map<string, { at: number; preview: OgPreview }>();

// [claude-code 2026-04-27] v5.33.5: Mainstream-media hosts STRIPPED from the
// OG-preview allow-list. Bloomberg / Reuters / FT / WSJ / CNBC / MarketWatch /
// NYT / WaPo / Economist / Barron's / SeekingAlpha / ZeroHedge / Axios /
// Politico / AP News all removed — they are banned at the ingest boundary
// (publisher-blocklist.ts BLOCKED_HOSTS), so no card should ever carry their
// URLs in the first place. Allowing the OG scraper to fetch them anyway was
// dead weight + a passive surface for stale leaks. financialjuice.com kept
// (approved wire), x.com / twitter.com kept, YouTube hosts kept, prediction
// markets + crypto pubs kept (these are research-grade, not MSM).
const ALLOWED_HOSTS = [
  // Social & video
  "x.com",
  "twitter.com",
  "mobile.twitter.com",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  // Approved wires + research-grade pubs
  "financialjuice.com",
  "www.financialjuice.com",
  "polymarket.com",
  "www.polymarket.com",
  "kalshi.com",
  "www.kalshi.com",
  "tradingview.com",
  "www.tradingview.com",
  "coindesk.com",
  "www.coindesk.com",
  "theblock.co",
  "www.theblock.co",
];

function normalizeUrl(input: string): URL | null {
  try {
    const u = new URL(input);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u;
  } catch {
    return null;
  }
}

function isHostAllowed(host: string): boolean {
  const lower = host.toLowerCase();
  return ALLOWED_HOSTS.some((h) => lower === h || lower.endsWith(`.${h}`));
}

function detectKind(u: URL): EmbedKind {
  const host = u.hostname.toLowerCase();
  if (/(^|\.)x\.com$/.test(host) || /(^|\.)twitter\.com$/.test(host)) {
    return "tweet";
  }
  if (host === "youtu.be" || /(^|\.)youtube\.com$/.test(host)) {
    return "youtube";
  }
  return "generic";
}

function youtubeEmbedUrl(u: URL): string | undefined {
  if (u.hostname === "youtu.be") {
    const id = u.pathname.replace(/^\//, "");
    if (id) return `https://www.youtube.com/embed/${id}`;
    return undefined;
  }
  const v = u.searchParams.get("v");
  if (v) return `https://www.youtube.com/embed/${v}`;
  const m = u.pathname.match(/^\/embed\/([^/?#]+)/);
  if (m) return `https://www.youtube.com/embed/${m[1]}`;
  return undefined;
}

function tweetEmbedUrl(u: URL): string | undefined {
  // Use the Twitter oEmbed platform URL; SW widget is loaded client-side as fallback.
  return `https://platform.twitter.com/embed/Tweet.html?id=${encodeURIComponent(
    u.pathname.split("/").pop() ?? "",
  )}&theme=dark`;
}

function extractMeta(html: string, property: string): string | undefined {
  // Match both <meta property="..."> and <meta name="..."> with single or double quotes.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  const match = html.match(re);
  if (match) return match[1];
  const reRev = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
    "i",
  );
  const matchRev = html.match(reRev);
  return matchRev ? matchRev[1] : undefined;
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : undefined;
}

function resolveImage(raw: string | undefined, base: URL): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw, base).toString();
  } catch {
    return undefined;
  }
}

function evictExpired() {
  const now = Date.now();
  for (const [k, v] of cache.entries()) {
    if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  }
  if (cache.size > MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest) cache.delete(oldest);
  }
}

export async function fetchOgPreview(url: string): Promise<OgPreview | null> {
  const u = normalizeUrl(url);
  if (!u) return null;
  if (!isHostAllowed(u.hostname)) {
    log.info("og: host not allowed", { host: u.hostname });
    return null;
  }

  const cached = cache.get(u.toString());
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.preview;

  const kind = detectKind(u);

  // Fast-path embeds — no fetch needed.
  if (kind === "youtube") {
    const preview: OgPreview = {
      url: u.toString(),
      kind,
      embedUrl: youtubeEmbedUrl(u),
      siteName: "YouTube",
    };
    cache.set(u.toString(), { at: Date.now(), preview });
    evictExpired();
    return preview;
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(u.toString(), {
      signal: ac.signal,
      headers: {
        // A browser-ish UA so sites return OG tags; some CDNs reject generic fetches.
        "User-Agent":
          "Mozilla/5.0 (compatible; FintheonBot/1.0; +https://fintheon.fly.dev)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 120_000);

    const title =
      extractMeta(html, "og:title") ??
      extractMeta(html, "twitter:title") ??
      extractTitle(html);
    const description =
      extractMeta(html, "og:description") ??
      extractMeta(html, "twitter:description") ??
      extractMeta(html, "description");
    const image = resolveImage(
      extractMeta(html, "og:image") ?? extractMeta(html, "twitter:image"),
      u,
    );
    const siteName =
      extractMeta(html, "og:site_name") ?? u.hostname.replace(/^www\./, "");

    const preview: OgPreview = {
      url: u.toString(),
      kind,
      title: title?.slice(0, 240),
      description: description?.slice(0, 600),
      image,
      siteName,
      favicon: `${u.origin}/favicon.ico`,
      embedUrl: kind === "tweet" ? tweetEmbedUrl(u) : undefined,
    };

    cache.set(u.toString(), { at: Date.now(), preview });
    evictExpired();
    return preview;
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      log.info("og: fetch failed", {
        url: u.toString(),
        error: (err as Error)?.message,
      });
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}
