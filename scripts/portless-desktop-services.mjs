#!/usr/bin/env node
// [claude-code 2026-05-27] Register Desktop backend services with Portless.
import { spawnSync } from "node:child_process";

const services = [
  { name: "fintheon", port: 8080, health: "http://fintheon.test/healthz" },
  {
    name: "hermes.fintheon",
    port: 8318,
    health: "http://hermes.fintheon.test/healthz",
  },
  {
    name: "news.fintheon",
    port: 8082,
    health: "http://news.fintheon.test/healthz",
  },
];

const command = process.argv[2] ?? "sync";

function run(args, options = {}) {
  const result = spawnSync("portless", args, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.error?.code === "ENOENT") {
    console.error(
      "Portless is not installed. Run `bun install`, then `bun run portless:desktop:install`.",
    );
    process.exit(1);
  }
  if (result.status !== 0 && !options.allowFail)
    process.exit(result.status ?? 1);
  return result;
}

function sync() {
  run(["proxy", "start", "--no-tls", "--tld", "test"]);
  for (const service of services) {
    run(["alias", service.name, String(service.port), "--force"]);
    console.log(`registered ${service.name}.test -> localhost:${service.port}`);
  }
  run(["hosts", "sync"]);
  run(["list"]);
}

function status() {
  const result = run(["list"], { capture: true, allowFail: true });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  for (const service of services) {
    console.log(`${service.name}.test health: ${service.health}`);
  }
}

if (command === "sync") sync();
else if (command === "status") status();
else {
  console.error(
    "Usage: node scripts/portless-desktop-services.mjs [sync|status]",
  );
  process.exit(1);
}
