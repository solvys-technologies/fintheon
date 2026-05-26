const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const REPO = "solvys-technologies/fintheon";
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

function runProcess(command, args, options = {}) {
  return new Promise((resolveProcess) => {
    const child = spawn(command, args, {
      ...options,
      env: { ...process.env, PATH: buildPath(), ...(options.env || {}) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (data) => {
      if (options.stdoutFile) {
        options.stdoutFile.write(data);
        return;
      }
      stdout += String(data);
    });
    child.stderr.on("data", (data) => {
      stderr += String(data);
    });
    child.on("error", (error) => {
      resolveProcess({ ok: false, code: null, stdout, stderr, error });
    });
    child.on("close", (code) => {
      resolveProcess({ ok: code === 0, code, stdout, stderr });
    });
  });
}

function getDmgName(version) {
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

function createUpdateManager({
  app,
  getCurrentApiBase,
  getMainWindow,
  releasesLatestUrl,
  remoteBackendUrl,
}) {
  let downloadedAsset = null;
  let downloadInFlight = null;

  function emit(channel, payload) {
    const win = getMainWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send(channel, payload);
  }

  function getAssetPaths(version) {
    const updateDir = path.join(app.getPath("userData"), UPDATE_DIR);
    const assetName = getDmgName(version);
    return {
      updateDir,
      assetName,
      dmgPath: path.join(updateDir, assetName),
      tempPath: path.join(updateDir, `${assetName}.tmp`),
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
      const base = (getCurrentApiBase() || remoteBackendUrl).replace(/\/$/, "");
      const res = await fetch(`${base}/api/version/check`);
      if (!res.ok) throw new Error(`version check ${res.status}`);
      const data = await res.json();
      const latest = normalizeVersion(data.latest);
      const hasUpdate =
        Boolean(latest) &&
        data.updateAvailable === true &&
        isNewerThan(latest, app.getVersion());
      if (hasUpdate) downloadUpdateInBackground(latest);
      return {
        ok: true,
        current: data.current ?? app.getVersion(),
        latest: latest || null,
        updateAvailable: hasUpdate,
        downloadUrl: releasesLatestUrl,
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
    const cleanVersion = normalizeVersion(version);
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
    const tag = `v${normalizeVersion(version)}`;
    const paths = getAssetPaths(version);
    fs.mkdirSync(paths.updateDir, { recursive: true });
    fs.rmSync(paths.tempPath, { force: true });
    if (isUsableFile(paths.dmgPath)) {
      return {
        version,
        tag,
        assetName: paths.assetName,
        dmgPath: paths.dmgPath,
      };
    }

    const ghAuth = await runProcess("gh", ["auth", "status"]);
    if (!ghAuth.ok) throw new Error("gh CLI is not authenticated");

    const download = await runProcess("gh", [
      "release",
      "download",
      tag,
      "--repo",
      REPO,
      "--pattern",
      paths.assetName,
      "--output",
      paths.dmgPath,
      "--clobber",
    ]);
    if (download.ok && isUsableFile(paths.dmgPath)) {
      return {
        version,
        tag,
        assetName: paths.assetName,
        dmgPath: paths.dmgPath,
      };
    }

    const assetApi = await runProcess("gh", [
      "release",
      "view",
      tag,
      "--repo",
      REPO,
      "--json",
      "assets",
      "--jq",
      `.assets[] | select(.name == "${paths.assetName}") | .apiUrl`,
    ]);
    const apiUrl = assetApi.stdout.trim();
    if (!assetApi.ok || !apiUrl) throw new Error("release asset not found");

    const out = fs.createWriteStream(paths.tempPath);
    const apiDownload = await runProcess(
      "gh",
      ["api", apiUrl, "-H", "Accept: application/octet-stream"],
      { stdoutFile: out },
    );
    await new Promise((resolveStream) => out.end(resolveStream));
    if (!apiDownload.ok || !isUsableFile(paths.tempPath)) {
      fs.rmSync(paths.tempPath, { force: true });
      throw new Error("release asset API download failed");
    }
    fs.renameSync(paths.tempPath, paths.dmgPath);
    return { version, tag, assetName: paths.assetName, dmgPath: paths.dmgPath };
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

  return {
    checkForDesktopUpdate,
    downloadUpdate,
    installUpdate,
  };
}

module.exports = { createUpdateManager };
