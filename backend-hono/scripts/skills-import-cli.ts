#!/usr/bin/env bun
// [claude-code 2026-04-19] S27-T10 W2e: ad-hoc skill import CLI for TP.
//   Usage:
//     bun run skills:import <hub_url>
//     bun run skills:import --url=<hub_url> [--version=<v>]
//
//   Scanner blocks unsafe imports by default; exits non-zero on reject so CI can gate on it.

import { importSkillFromHub } from "../src/services/skills/importer.js";

function parseArgs(argv: string[]): { url: string; version?: string } {
  const out: { url: string; version?: string } = { url: "" };
  for (const arg of argv) {
    if (arg.startsWith("--url=")) out.url = arg.slice(6);
    else if (arg.startsWith("--version=")) out.version = arg.slice(10);
    else if (!arg.startsWith("--") && !out.url) out.url = arg;
  }
  return out;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error("usage: bun run skills:import <hub_url> [--version=x.y.z]");
    process.exit(1);
  }

  console.log(`[skills-import] resolving ${args.url}`);
  const result = await importSkillFromHub(args.url, { version: args.version });

  console.log(JSON.stringify(result, null, 2));

  if (result.status === "rejected") {
    console.error(`[skills-import] REJECTED ${result.skill_id}`);
    for (const reason of result.rejected_because) console.error(`  - ${reason}`);
    process.exit(2);
  }
  if (result.status === "warned") {
    console.warn(`[skills-import] WARNED ${result.skill_id} (imported)`);
  } else {
    console.log(`[skills-import] IMPORTED ${result.skill_id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
