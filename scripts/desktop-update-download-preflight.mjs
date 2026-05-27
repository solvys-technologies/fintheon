#!/usr/bin/env node
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
const endpoint =
  process.env.FINTHEON_UPDATE_CHECK_URL ||
  "https://fintheon.fly.dev/api/desktop/update/latest?platform=darwin&arch=arm64";
const expectedVersion = process.env.FINTHEON_EXPECTED_VERSION || pkg.version;
const expectedAsset = `Fintheon-${expectedVersion}-arm64.dmg`;

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
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

async function main() {
  console.log(`Checking deployed update endpoint: ${endpoint}`);
  const updateRes = await fetch(endpoint, {
    headers: { "User-Agent": "Fintheon-Desktop-Release-Preflight" },
  });
  if (!updateRes.ok) fail(`update endpoint returned HTTP ${updateRes.status}`);

  const update = await updateRes.json();
  if (!update?.ok) fail(`update endpoint is not ok: ${update?.reason ?? "unknown"}`);
  if (update.version !== expectedVersion) {
    fail(`update version ${update.version} != expected ${expectedVersion}`);
  }
  if (update.assetName !== expectedAsset) {
    fail(`update asset ${update.assetName} != expected ${expectedAsset}`);
  }
  if (!update.downloadUrl) fail("update endpoint did not return downloadUrl");
  if (!update.sha256 && !update.sha512) fail("update endpoint did not return a checksum");

  const downloadUrl = String(update.downloadUrl);
  if (!/^https:\/\/github\.com\/solvys-technologies\/fintheon\/releases\//.test(downloadUrl)) {
    fail(`downloadUrl is not the expected GitHub release URL: ${downloadUrl}`);
  }

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "fintheon-dmg-preflight-"));
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

    if (bytes <= 1024 * 1024) fail(`downloaded DMG is too small: ${bytes} bytes`);
    if (update.size && bytes !== update.size) {
      fail(`downloaded DMG size ${bytes} != endpoint size ${update.size}`);
    }

    const checksum = update.sha256
      ? { algorithm: "sha256", encoding: "hex", expected: update.sha256 }
      : { algorithm: "sha512", encoding: "base64", expected: update.sha512 };
    const actual = await hashFile(tempPath, checksum.algorithm, checksum.encoding);
    if (actual !== checksum.expected) {
      fail(`${checksum.algorithm} checksum mismatch for downloaded DMG`);
    }

    console.log(
      `PASS: deployed endpoint produced downloadable ${update.assetName} (${bytes} bytes, ${checksum.algorithm} verified)`,
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => fail(error?.message ?? String(error)));
