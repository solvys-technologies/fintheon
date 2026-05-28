const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { assertNotaryReady } = require("./notary-helpers.cjs");

module.exports = async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  if (process.env.FINTHEON_NOTARIZE_MAC !== "true") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  if (!fs.existsSync(appPath)) {
    throw new Error(`Signed app bundle missing: ${appPath}`);
  }

  const args = assertNotaryReady();
  const zipPath = path.join(
    os.tmpdir(),
    `fintheon-${Date.now()}-${process.pid}.zip`,
  );

  try {
    execFileSync(
      "/usr/bin/ditto",
      ["-c", "-k", "--keepParent", appPath, zipPath],
      { stdio: "inherit" },
    );
    execFileSync(
      "xcrun",
      ["notarytool", "submit", zipPath, "--wait", ...args],
      {
        stdio: "inherit",
      },
    );
    execFileSync("xcrun", ["stapler", "staple", appPath], {
      stdio: "inherit",
    });
  } finally {
    fs.rmSync(zipPath, { force: true });
  }
};
