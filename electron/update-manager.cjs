const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const UPDATE_DIR = "updates";

function normalizeVersion(version) {
  return String(version || "")
    .replace(/^v/, "")
    .trim();
}

function isNewerThan(candidate, current) {
  const parse = (value) =>
    normalizeVersion(value)
      .split(/[.-]/)
      .map((part) => Number.parseInt(part, 10))
      .map((part) => (Number.isFinite(part) ? part : 0));
  const next = parse(candidate);
  const old = parse(current);
  const length = Math.max(next.length, old.length);
  for (let index = 0; index < length; index += 1) {
    const nextPart = next[index] ?? 0;
    const oldPart = old[index] ?? 0;
    if (nextPart > oldPart) return true;
    if (nextPart < oldPart) return false;
  }
  return false;
}

function buildPath() {
  return [
    process.env.PATH || "",
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/bin",
    "/usr/sbin",
    "/sbin",
  ]
    .flatMap((entry) => entry.split(":"))
    .filter(Boolean)
    .filter((entry, index, entries) => entries.indexOf(entry) === index)
    .join(":");
}

function getDmgName(version, assetName) {
  if (assetName) return assetName;
  const suffix = process.arch === "arm64" ? "arm64" : "x64";
  return `Fintheon-${normalizeVersion(version)}-${suffix}.dmg`;
}

function isUsableFile(filePath) {
  try {
    return fs.statSync(filePath).size > 1024 * 1024;
  } catch {
    return false;
  }
}

function hashFile(filePath, algorithm = "sha256", encoding = "hex") {
  return new Promise((resolveHash, rejectHash) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    stream.on("error", rejectHash);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolveHash(hash.digest(encoding)));
  });
}

function getChecksum(update) {
  if (update?.sha256) {
    return { algorithm: "sha256", encoding: "hex", expected: update.sha256 };
  }
  if (update?.sha512) {
    return { algorithm: "sha512", encoding: "base64", expected: update.sha512 };
  }
  return null;
}

function createUpdateManager({
  app,
  getCurrentApiBase,
  getMainWindow,
  releasesLatestUrl,
  remoteBackendUrl,
}) {
  let downloadedAsset = null;
  let downloadInFlight = null;
  let latestUpdate = null;

  function emit(channel, payload) {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send(channel, payload);
  }

  function getAssetPaths(version, assetName) {
    const updateDir = path.join(app.getPath("userData"), UPDATE_DIR);
    const resolvedAssetName = getDmgName(version, assetName);
    return {
      updateDir,
      assetName: resolvedAssetName,
      dmgPath: path.join(updateDir, resolvedAssetName),
      tempPath: path.join(updateDir, `${resolvedAssetName}.tmp`),
    };
  }

  function getInstallerScriptPath() {
    const targetPath = path.join(
      app.getPath("userData"),
      "fintheon-install-update.sh",
    );
    const sourcePath = path.join(
      __dirname,
      "..",
      "scripts",
      "fintheon-install-update.sh",
    );
    if (!fs.existsSync(sourcePath) && fs.existsSync(targetPath))
      return targetPath;
    if (!fs.existsSync(sourcePath)) return null;
    fs.copyFileSync(sourcePath, targetPath);
    fs.chmodSync(targetPath, 0o755);
    return targetPath;
  }

  async function checkForDesktopUpdate() {
    try {
      const base = (
        process.env.FINTHEON_UPDATE_BASE_URL ||
        getCurrentApiBase() ||
        remoteBackendUrl
      ).replace(/\/$/, "");
      const arch = process.arch === "arm64" ? "arm64" : "x64";
      const res = await fetch(
        `${base}/api/desktop/update/latest?platform=darwin&arch=${arch}`,
      );
      if (!res.ok) throw new Error(`desktop update check ${res.status}`);
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.reason ?? "update unavailable");
      const latest = normalizeVersion(data.version);
      const hasUpdate =
        Boolean(latest) && isNewerThan(latest, app.getVersion());
      latestUpdate = hasUpdate ? { ...data, version: latest } : null;
      if (hasUpdate) downloadUpdateInBackground(latest);
      return {
        ok: true,
        current: app.getVersion(),
        latest: latest || null,
        updateAvailable: hasUpdate,
        downloadUrl: data.downloadUrl ?? releasesLatestUrl,
        downloaded:
          downloadedAsset?.version === latest &&
          isUsableFile(downloadedAsset.dmgPath),
        downloading: downloadInFlight?.version === latest,
      };
    } catch (error) {
      return {
        ok: false,
        updateAvailable: false,
        downloadUrl: releasesLatestUrl,
        reason: error?.message ?? "version check failed",
      };
    }
  }

  async function downloadUpdate(version) {
    const cleanVersion = normalizeVersion(version || latestUpdate?.version);
    if (!cleanVersion) return { ok: false, reason: "version is required" };
    if (
      downloadedAsset?.version === cleanVersion &&
      isUsableFile(downloadedAsset.dmgPath)
    ) {
      return { ok: true, ...downloadedAsset };
    }
    if (downloadInFlight?.version === cleanVersion) {
      try {
        const result = await downloadInFlight.promise;
        return { ok: true, ...result };
      } catch (error) {
        return {
          ok: false,
          version: cleanVersion,
          reason: error?.message ?? "download failed",
        };
      }
    }

    const promise = downloadUpdateAsset(cleanVersion);
    downloadInFlight = { version: cleanVersion, promise };
    try {
      const result = await promise;
      downloadedAsset = result;
      emit("update-downloaded", result);
      return { ok: true, ...result };
    } catch (error) {
      const payload = {
        version: cleanVersion,
        reason: error?.message ?? "download failed",
      };
      emit("update-download-failed", payload);
      return { ok: false, ...payload };
    } finally {
      if (downloadInFlight?.version === cleanVersion) downloadInFlight = null;
    }
  }

  function downloadUpdateInBackground(version) {
    void downloadUpdate(version);
  }

  async function downloadUpdateAsset(version) {
    const update = latestUpdate?.version === version ? latestUpdate : null;
    if (!update?.downloadUrl) throw new Error("download URL unavailable");
    const checksum = getChecksum(update);
    if (!checksum) throw new Error("download checksum unavailable");
    const tag = update.tag || `v${normalizeVersion(version)}`;
    const paths = getAssetPaths(version, update.assetName);
    fs.mkdirSync(paths.updateDir, { recursive: true });
    fs.rmSync(paths.tempPath, { force: true });
    if (isUsableFile(paths.dmgPath)) {
      const existingHash = await hashFile(
        paths.dmgPath,
        checksum.algorithm,
        checksum.encoding,
      );
      if (existingHash !== checksum.expected)
        fs.rmSync(paths.dmgPath, { force: true });
    }
    if (isUsableFile(paths.dmgPath)) {
      return {
        version,
        tag,
        assetName: paths.assetName,
        dmgPath: paths.dmgPath,
        sha256: update.sha256 ?? null,
        sha512: update.sha512 ?? null,
        size: update.size ?? null,
        releaseUrl: update.releaseUrl ?? releasesLatestUrl,
      };
    }

    const download = await fetch(update.downloadUrl);
    if (!download.ok || !download.body) {
      throw new Error(`download failed ${download.status}`);
    }
    const out = fs.createWriteStream(paths.tempPath);
    await new Promise((resolveStream, rejectStream) => {
      const reader = download.body.getReader();
      function pump() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              out.end(resolveStream);
              return;
            }
            out.write(Buffer.from(value), pump);
          })
          .catch(rejectStream);
      }
      out.on("error", rejectStream);
      pump();
    });
    if (!isUsableFile(paths.tempPath)) {
      fs.rmSync(paths.tempPath, { force: true });
      throw new Error("downloaded DMG is not usable");
    }
    const downloadedSize = fs.statSync(paths.tempPath).size;
    if (Number.isFinite(update.size) && downloadedSize !== update.size) {
      fs.rmSync(paths.tempPath, { force: true });
      throw new Error("downloaded DMG size mismatch");
    }
    const downloadedHash = await hashFile(
      paths.tempPath,
      checksum.algorithm,
      checksum.encoding,
    );
    if (downloadedHash !== checksum.expected) {
      fs.rmSync(paths.tempPath, { force: true });
      throw new Error("downloaded DMG checksum mismatch");
    }
    fs.renameSync(paths.tempPath, paths.dmgPath);
    return {
      version,
      tag,
      assetName: paths.assetName,
      dmgPath: paths.dmgPath,
      sha256: update.sha256 ?? null,
      sha512: update.sha512 ?? null,
      size: update.size ?? downloadedSize,
      releaseUrl: update.releaseUrl ?? releasesLatestUrl,
    };
  }

  async function installUpdate() {
    if (!downloadedAsset || !isUsableFile(downloadedAsset.dmgPath)) {
      return { ok: false, reason: "update is not downloaded yet" };
    }
    const scriptPath = getInstallerScriptPath();
    if (!scriptPath) return { ok: false, reason: "install script missing" };
    const child = spawn(
      "/bin/bash",
      [scriptPath, downloadedAsset.tag, downloadedAsset.dmgPath],
      {
        detached: true,
        stdio: "ignore",
        env: { ...process.env, HOME: os.homedir(), PATH: buildPath() },
      },
    );
    child.unref();
    setTimeout(() => app.quit(), 200);
    return { ok: true, installing: true, target: downloadedAsset.version };
  }

  function hasDownloadedUpdate() {
    return Boolean(downloadedAsset && isUsableFile(downloadedAsset.dmgPath));
  }

  return {
    checkForDesktopUpdate,
    downloadUpdate,
    installUpdate,
    hasDownloadedUpdate,
  };
}

module.exports = { createUpdateManager };
