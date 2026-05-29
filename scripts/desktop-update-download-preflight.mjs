#!/usr/bin/env node
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
);
const explicitEndpoint = process.env.FINTHEON_UPDATE_CHECK_URL || "";
const endpointBase =
  process.env.FINTHEON_UPDATE_BASE_URL ||
  "https://fintheon.fly.dev/api/desktop/update/latest";
const expectedVersion = process.env.FINTHEON_EXPECTED_VERSION || pkg.version;
const expectedAppId = "io.pricedinresearch.fintheon";
const verifyArchs = explicitEndpoint
  ? [null]
  : (process.env.FINTHEON_VERIFY_ARCHES || "arm64,x64")
      .split(",")
      .map((arch) => arch.trim())
      .filter(Boolean);

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function endpointForArch(arch) {
  if (explicitEndpoint) return explicitEndpoint;
  const url = new URL(endpointBase);
  url.searchParams.set("platform", "darwin");
  url.searchParams.set("arch", arch);
  return url.toString();
}

function expectedAssetsForArch(arch) {
  if (!arch) return null;
  return new Set([
    `Fintheon-${expectedVersion}-${arch}.dmg`,
    `Fintheon-${expectedVersion}-universal.dmg`,
  ]);
}

function hashFile(filePath, algorithm, encoding) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(algorithm);
    const stream = fs.createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest(encoding)));
  });
}

function runQuiet(command, args) {
  return execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function readBundleId(appPath) {
  return runQuiet("plutil", [
    "-extract",
    "CFBundleIdentifier",
    "raw",
    "-o",
    "-",
    path.join(appPath, "Contents", "Info.plist"),
  ]).trim();
}

function verifyDownloadedDmg(dmgPath) {
  const mountDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "fintheon-dmg-mount-"),
  );
  let mounted = false;

  try {
    runQuiet("hdiutil", [
      "attach",
      dmgPath,
      "-nobrowse",
      "-readonly",
      "-quiet",
      "-mountpoint",
      mountDir,
    ]);
    mounted = true;

    const appPath = path.join(mountDir, "Fintheon.app");
    if (!fs.existsSync(appPath)) {
      throw new Error("downloaded DMG does not contain Fintheon.app");
    }
    const bundleId = readBundleId(appPath);
    if (bundleId !== expectedAppId) {
      throw new Error(
        `downloaded app bundle id ${bundleId} != ${expectedAppId}`,
      );
    }

    runQuiet("codesign", [
      "--verify",
      "--deep",
      "--strict",
      "--verbose=2",
      appPath,
    ]);

    const requireGatekeeper = process.env.FINTHEON_REQUIRE_GATEKEEPER === "1";
    try {
      runQuiet("spctl", ["-a", "-vv", "-t", "exec", appPath]);
      runQuiet("spctl", ["-a", "-vv", "-t", "open", dmgPath]);
      console.log("PASS: Gatekeeper accepted downloaded DMG");
    } catch (error) {
      const detail =
        error?.stderr?.toString?.() || error?.message || String(error);
      if (requireGatekeeper) {
        throw new Error(`Gatekeeper rejected downloaded DMG: ${detail}`);
      }
      console.warn(
        "WARN: Gatekeeper rejected unsigned/ad-hoc DMG; app seal still verified. Sprint 100 covers Developer ID signing/notarization.",
      );
    }

    console.log("PASS: downloaded DMG contains a sealed Fintheon.app");
  } finally {
    if (mounted) {
      try {
        runQuiet("hdiutil", ["detach", mountDir, "-quiet"]);
      } catch {
        // best effort cleanup only
      }
    }
    fs.rmSync(mountDir, { recursive: true, force: true });
  }
}

async function main() {
  for (const arch of verifyArchs) {
    await verifyEndpoint(arch);
  }
}

async function verifyEndpoint(arch) {
  const endpoint = endpointForArch(arch);
  const archLabel = arch ?? "explicit";
  console.log(`Checking deployed update endpoint [${archLabel}]: ${endpoint}`);
  const updateRes = await fetch(endpoint, {
    headers: { "User-Agent": "Fintheon-Desktop-Release-Preflight" },
  });
  if (!updateRes.ok) fail(`update endpoint returned HTTP ${updateRes.status}`);

  const update = await updateRes.json();
  if (!update?.ok)
    fail(`update endpoint is not ok: ${update?.reason ?? "unknown"}`);
  if (update.version !== expectedVersion) {
    fail(`update version ${update.version} != expected ${expectedVersion}`);
  }
  const expectedAssets = expectedAssetsForArch(arch);
  if (expectedAssets && !expectedAssets.has(update.assetName)) {
    fail(
      `update asset ${update.assetName} is not valid for ${archLabel}; expected one of ${Array.from(
        expectedAssets,
      ).join(", ")}`,
    );
  }
  if (!update.downloadUrl) fail("update endpoint did not return downloadUrl");
  if (!update.sha256 && !update.sha512)
    fail("update endpoint did not return a checksum");

  const downloadUrl = String(update.downloadUrl);
  if (
    !/^https:\/\/github\.com\/solvys-technologies\/fintheon\/releases\//.test(
      downloadUrl,
    )
  ) {
    fail(`downloadUrl is not the expected GitHub release URL: ${downloadUrl}`);
  }

  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "fintheon-dmg-preflight-"),
  );
  const tempPath = path.join(tempDir, update.assetName);
  try {
    console.log(`Downloading DMG: ${downloadUrl}`);
    const dmgRes = await fetch(downloadUrl, {
      headers: { "User-Agent": "Fintheon-Desktop-Release-Preflight" },
      redirect: "follow",
    });
    if (!dmgRes.ok || !dmgRes.body) {
      fail(`DMG download returned HTTP ${dmgRes.status}`);
    }

    const out = fs.createWriteStream(tempPath);
    let bytes = 0;
    await new Promise((resolve, reject) => {
      dmgRes.body
        .pipeTo(
          new WritableStream({
            write(chunk) {
              bytes += chunk.byteLength;
              out.write(Buffer.from(chunk));
            },
            close() {
              out.end(resolve);
            },
            abort(error) {
              out.destroy(error);
              reject(error);
            },
          }),
        )
        .catch(reject);
      out.on("error", reject);
    });

    if (bytes <= 1024 * 1024)
      fail(`downloaded DMG is too small: ${bytes} bytes`);
    if (update.size && bytes !== update.size) {
      fail(`downloaded DMG size ${bytes} != endpoint size ${update.size}`);
    }

    const checksum = update.sha256
      ? { algorithm: "sha256", encoding: "hex", expected: update.sha256 }
      : { algorithm: "sha512", encoding: "base64", expected: update.sha512 };
    const actual = await hashFile(
      tempPath,
      checksum.algorithm,
      checksum.encoding,
    );
    if (actual !== checksum.expected) {
      fail(`${checksum.algorithm} checksum mismatch for downloaded DMG`);
    }

    verifyDownloadedDmg(tempPath);

    console.log(
      `PASS: deployed endpoint produced downloadable ${update.assetName} for ${archLabel} (${bytes} bytes, ${checksum.algorithm} verified)`,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => fail(error?.message ?? String(error)));
