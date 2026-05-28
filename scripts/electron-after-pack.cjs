const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );

  const helperDir = path.join(appPath, "Contents", "Library", "LaunchServices");
  fs.mkdirSync(helperDir, { recursive: true });
  execFileSync(
    process.execPath,
    [path.join(__dirname, "build-privileged-helper.cjs"), helperDir],
    { stdio: "inherit" },
  );

  if (process.env.FINTHEON_AD_HOC_SIGN_MAC !== "true") return;
  execFileSync(
    "/usr/bin/codesign",
    ["--force", "--deep", "--sign", "-", appPath],
    {
      stdio: "inherit",
    },
  );
};
