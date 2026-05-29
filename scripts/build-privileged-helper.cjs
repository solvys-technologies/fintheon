const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const label = "io.pricedinresearch.fintheon.blocker-helper";
const source = path.join(
  root,
  "electron",
  "privileged-helper",
  "fintheon-blocker-helper.c",
);
const outputDir =
  process.argv[2] || path.join(root, "electron", "privileged-helper", "build");
const targetArch = process.argv[3] || "";
const output = path.join(outputDir, label);

function clangArchArgs(arch) {
  if (arch === "x64") return ["-arch", "x86_64"];
  if (arch === "arm64") return ["-arch", "arm64"];
  if (arch === "universal") return ["-arch", "x86_64", "-arch", "arm64"];
  return [];
}

fs.mkdirSync(outputDir, { recursive: true });
execFileSync(
  "/usr/bin/clang",
  [
    "-O2",
    "-Wall",
    "-Wextra",
    ...clangArchArgs(targetArch),
    "-o",
    output,
    source,
  ],
  { stdio: "inherit" },
);
fs.chmodSync(output, 0o755);

const plistSource = path.join(
  root,
  "electron",
  "privileged-helper",
  `${label}.plist`,
);
fs.copyFileSync(plistSource, path.join(outputDir, `${label}.plist`));

console.log(`built ${output}${targetArch ? ` (${targetArch})` : ""}`);
