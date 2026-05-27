import { Hono } from "hono";

const REPO = "solvys-technologies/fintheon";
const GITHUB_RELEASES_API = `https://api.github.com/repos/${REPO}/releases`;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  digest?: string | null;
  size?: number | null;
}

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  published_at?: string | null;
  assets: GitHubAsset[];
}

let cachedRelease: { release: GitHubRelease; fetchedAt: number } | null = null;

function normalizeArch(value: string | undefined): "arm64" | "x64" {
  if (value === "x64" || value === "amd64") return "x64";
  return "arm64";
}

function normalizeVersion(tag: string): string {
  return tag.replace(/^v/, "");
}

function readSha256(asset: GitHubAsset): string | null {
  const digest = asset.digest ?? "";
  if (digest.startsWith("sha256:")) return digest.slice("sha256:".length);
  return null;
}

async function fetchLatestRelease(): Promise<GitHubRelease | null> {
  if (cachedRelease && Date.now() - cachedRelease.fetchedAt < CACHE_TTL_MS) {
    return cachedRelease.release;
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "Fintheon-Desktop-Updater",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(GITHUB_RELEASES_API, { headers });
  if (!res.ok) return null;

  const releases = (await res.json()) as GitHubRelease[];
  const latest = releases.find(
    (release) =>
      !release.draft &&
      !release.prerelease &&
      /^v\d+\.\d+\.\d+$/.test(release.tag_name),
  );
  if (!latest) return null;

  cachedRelease = { release: latest, fetchedAt: Date.now() };
  return latest;
}

export function createDesktopUpdateRoutes(): Hono {
  const router = new Hono();

  router.get("/latest", async (c) => {
    const platform = c.req.query("platform") ?? "darwin";
    if (platform !== "darwin") {
      return c.json({ ok: false, reason: "unsupported platform" }, 400);
    }

    const release = await fetchLatestRelease();
    if (!release) {
      return c.json({ ok: false, reason: "latest release unavailable" }, 503);
    }

    const version = normalizeVersion(release.tag_name);
    const arch = normalizeArch(c.req.query("arch"));
    const assetName = `Fintheon-${version}-${arch}.dmg`;
    const asset = release.assets.find((item) => item.name === assetName);

    if (!asset) {
      return c.json(
        {
          ok: false,
          version,
          tag: release.tag_name,
          assetName,
          reason: "release asset unavailable",
        },
        404,
      );
    }

    return c.json({
      ok: true,
      version,
      tag: release.tag_name,
      assetName,
      downloadUrl: asset.browser_download_url,
      sha256: readSha256(asset),
      size: asset.size ?? null,
      releaseUrl: release.html_url,
      publishedAt: release.published_at ?? null,
    });
  });

  return router;
}
