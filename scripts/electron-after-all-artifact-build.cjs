const { execFileSync } = require("node:child_process");
const path = require("node:path");
const { assertNotaryReady } = require("./notary-helpers.cjs");

module.exports = async function afterAllArtifactBuild(context) {
  if (context.electronPlatformName !== "darwin") return context.artifactPaths;
  if (process.env.FINTHEON_NOTARIZE_MAC !== "true")
    return context.artifactPaths;

  const args = assertNotaryReady();
  const dmgPaths = context.artifactPaths.filter(
    (artifactPath) => path.extname(artifactPath) === ".dmg",
  );

  for (const dmgPath of dmgPaths) {
    execFileSync(
      "xcrun",
      ["notarytool", "submit", dmgPath, "--wait", ...args],
      {
        stdio: "inherit",
      },
    );
    execFileSync("xcrun", ["stapler", "staple", dmgPath], {
      stdio: "inherit",
    });
  }

  return context.artifactPaths;
};
