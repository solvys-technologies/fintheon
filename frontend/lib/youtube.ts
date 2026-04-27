// [claude-code 2026-04-27] S46.4/H: YouTube URL detection helpers for the
// miniplayer. Recognises youtube.com / youtu.be / youtube-nocookie.com and
// extracts the 11-char video ID from /watch?v=, /embed/, /shorts/, or the
// short host path.
//
// Returns null for non-YouTube URLs — caller falls back to opening in a new
// tab. NEVER use this to whitelist publishers — the publisher-blocklist still
// runs at the persist boundary; even YouTube channels of banned publishers
// don't reach the feed.

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function extractYouTubeVideoId(
  url: string | null | undefined,
): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (!YT_HOSTS.has(host)) return null;

  // youtu.be/<id>
  if (host.endsWith("youtu.be")) {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0] ?? "";
    return VIDEO_ID.test(id) ? id : null;
  }

  // youtube.com/watch?v=<id>
  const v = parsed.searchParams.get("v");
  if (v && VIDEO_ID.test(v)) return v;

  // youtube.com/embed/<id>, /shorts/<id>, /live/<id>, /v/<id>
  const path = parsed.pathname.split("/").filter(Boolean);
  if (path.length >= 2) {
    const [head, id] = path;
    if (
      ["embed", "shorts", "live", "v"].includes(head) &&
      typeof id === "string" &&
      VIDEO_ID.test(id)
    ) {
      return id;
    }
  }
  return null;
}

export function buildYouTubeEmbed(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`;
}

// Bloomberg Originals YouTube channel — used ONLY as the idle/homepage embed
// for the miniplayer. Never as a polling source. Channel ID verified from
// the official Bloomberg Originals YouTube channel (UC handle).
export const BLOOMBERG_ORIGINALS_CHANNEL_ID = "UCqRhOzHM-c6L1JV-CV2j2_g";

export function bloombergOriginalsHomepage(): string {
  // YouTube playlist-of-uploads convention: UU prefix replaces the UC channel ID.
  const playlistId = `UU${BLOOMBERG_ORIGINALS_CHANNEL_ID.slice(2)}`;
  return `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}&rel=0&modestbranding=1`;
}
