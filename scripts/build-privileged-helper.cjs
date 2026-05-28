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
const output = path.join(outputDir, label);

fs.mkdirSync(outputDir, { recursive: true });
execFileSync(
  "/usr/bin/clang",
  ["-O2", "-Wall", "-Wextra", "-o", output, source],
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

console.log(`built ${output}`);
