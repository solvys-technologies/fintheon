import { Hono } from "hono";

const REPO = "solvys-technologies/fintheon";
const GITHUB_RELEASES_API = `https://api.github.com/repos/${REPO}/releases`;
const GITHUB_RELEASE_BY_TAG_API = `https://api.github.com/repos/${REPO}/releases/tags`;
const GITHUB_LATEST_MANIFEST_URL = `https://github.com/${REPO}/releases/latest/download/latest-mac.yml`;
const GITHUB_LATEST_DOWNLOAD_URL = `https://github.com/${REPO}/releases/latest/download`;
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

interface DesktopRelease {
  version: string;
  tag: string;
  assetName: string;
  downloadUrl: string;
  sha256: string | null;
  sha512: string | null;
  size: number | null;
  releaseUrl: string;
  publishedAt: string | null;
}

type ReleaseArch = "arm64" | "x64";

let cachedReleaseByArch: Partial<
  Record<ReleaseArch, { release: DesktopRelease; fetchedAt: number }>
> = {};
let cachedManifest: { release: DesktopRelease; fetchedAt: number } | null =
  null;

function normalizeArch(value: string | undefined): ReleaseArch {
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

function getArchAssetName(version: string, arch: ReleaseArch): string {
  return `Fintheon-${version}-${arch}.dmg`;
}

function getUniversalAssetName(version: string): string {
  return `Fintheon-${version}-universal.dmg`;
}

function isCompatibleAssetName(
  assetName: string,
  version: string,
  arch: ReleaseArch,
): boolean {
  return (
    assetName === getArchAssetName(version, arch) ||
    assetName === getUniversalAssetName(version)
  );
}

function findCompatibleMacAsset(
  assets: GitHubAsset[],
  version: string,
  arch: ReleaseArch,
): GitHubAsset | undefined {
  const preferredNames = [
    getArchAssetName(version, arch),
    getUniversalAssetName(version),
  ];
  return preferredNames
    .map((name) => assets.find((asset) => asset.name === name))
    .find((asset): asset is GitHubAsset => Boolean(asset));
}

function readManifestValue(manifest: string, key: string): string | null {
  const match = manifest.match(
    new RegExp(`^${key}:\\s*['"]?([^\\r\\n'"]+)['"]?$`, "m"),
  );
  return match?.[1]?.trim() || null;
}

function readManifestFileValue(manifest: string, key: string): string | null {
  const match = manifest.match(
    new RegExp(`^\\s{4}${key}:\\s*['"]?([^\\r\\n'"]+)['"]?$`, "m"),
  );
  return match?.[1]?.trim() || null;
}

async function fetchLatestFromManifest(): Promise<DesktopRelease | null> {
  if (cachedManifest && Date.now() - cachedManifest.fetchedAt < CACHE_TTL_MS) {
    return cachedManifest.release;
  }

  const res = await fetch(GITHUB_LATEST_MANIFEST_URL, {
    headers: { "User-Agent": "Fintheon-Desktop-Updater" },
  });
  if (!res.ok) return null;

  const manifest = await res.text();
  const version = readManifestValue(manifest, "version");
  const assetName =
    readManifestFileValue(manifest, "url") ??
    readManifestValue(manifest, "path");
  const sha512 =
    readManifestFileValue(manifest, "sha512") ??
    readManifestValue(manifest, "sha512");
  if (!version || !assetName || !sha512) return null;

  const sizeText = readManifestFileValue(manifest, "size");
  const size = sizeText ? Number.parseInt(sizeText, 10) : null;
  const release = {
    version,
    tag: `v${version}`,
    assetName,
    downloadUrl: `${GITHUB_LATEST_DOWNLOAD_URL}/${encodeURIComponent(assetName)}`,
    sha256: null,
    sha512,
    size: Number.isFinite(size) ? size : null,
    releaseUrl: `https://github.com/${REPO}/releases/latest`,
    publishedAt: readManifestValue(manifest, "releaseDate"),
  };
  cachedManifest = { release, fetchedAt: Date.now() };
  return release;
}

function mergeReleaseAndManifest(
  release: GitHubRelease,
  asset: GitHubAsset,
  version: string,
  manifest: DesktopRelease | null,
): DesktopRelease {
  const manifestMatches =
    manifest?.version === version && manifest.assetName === asset.name;
  return {
    version,
    tag: release.tag_name,
    assetName: asset.name,
    downloadUrl: asset.browser_download_url,
    sha256: readSha256(asset),
    sha512: manifestMatches ? manifest.sha512 : null,
    size: asset.size ?? (manifestMatches ? manifest.size : null),
    releaseUrl: release.html_url,
    publishedAt: release.published_at ?? manifest?.publishedAt ?? null,
  };
}

async function fetchLatestRelease(
  arch: ReleaseArch,
): Promise<DesktopRelease | null> {
  const cachedRelease = cachedReleaseByArch[arch];
  if (cachedRelease && Date.now() - cachedRelease.fetchedAt < CACHE_TTL_MS) {
    return cachedRelease.release;
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "Cache-Control": "no-cache",
    "User-Agent": "Fintheon-Desktop-Updater",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  const manifest = await fetchLatestFromManifest().catch(() => null);

  const res = await fetch(GITHUB_RELEASES_API, { headers });
  if (res.ok) {
    const releases = (await res.json()) as GitHubRelease[];
    const latest = releases.find(
      (release) =>
        !release.draft &&
        !release.prerelease &&
        /^v\d+\.\d+\.\d+$/.test(release.tag_name),
    );
    const version = latest ? normalizeVersion(latest.tag_name) : null;
    const asset =
      latest && version
        ? findCompatibleMacAsset(latest.assets, version, arch)
        : undefined;
    if (latest && version && asset) {
      const release = mergeReleaseAndManifest(latest, asset, version, manifest);
      if (
        !release.sha256 &&
        !release.sha512 &&
        manifest?.version === version &&
        manifest.assetName === asset.name
      ) {
        cachedReleaseByArch[arch] = {
          release: manifest,
          fetchedAt: Date.now(),
        };
        return manifest;
      }
      cachedReleaseByArch[arch] = { release, fetchedAt: Date.now() };
      return release;
    }
  }

  if (manifest?.version) {
    const tagRes = await fetch(
      `${GITHUB_RELEASE_BY_TAG_API}/v${manifest.version}`,
      {
        headers,
      },
    );
    if (tagRes.ok) {
      const tagged = (await tagRes.json()) as GitHubRelease;
      const asset = findCompatibleMacAsset(
        tagged.assets,
        manifest.version,
        arch,
      );
      if (asset) {
        const release = mergeReleaseAndManifest(
          tagged,
          asset,
          manifest.version,
          manifest,
        );
        cachedReleaseByArch[arch] = { release, fetchedAt: Date.now() };
        return release;
      }
    }
  }

  const release = manifest;
  if (
    !release ||
    !isCompatibleAssetName(release.assetName, release.version, arch)
  ) {
    return null;
  }

  cachedReleaseByArch[arch] = { release, fetchedAt: Date.now() };
  return release;
}

export function createDesktopUpdateRoutes(): Hono {
  const router = new Hono();

  router.get("/latest", async (c) => {
    const platform = c.req.query("platform") ?? "darwin";
    if (platform !== "darwin") {
      return c.json({ ok: false, reason: "unsupported platform" }, 400);
    }

    const arch = normalizeArch(c.req.query("arch"));
    const release = await fetchLatestRelease(arch);
    if (!release) {
      return c.json({ ok: false, reason: "latest release unavailable" }, 503);
    }

    return c.json({
      ok: true,
      version: release.version,
      tag: release.tag,
      assetName: release.assetName,
      downloadUrl: release.downloadUrl,
      sha256: release.sha256,
      sha512: release.sha512,
      size: release.size,
      releaseUrl: release.releaseUrl,
      publishedAt: release.publishedAt,
    });
  });

  return router;
}
