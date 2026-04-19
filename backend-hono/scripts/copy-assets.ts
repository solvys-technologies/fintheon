#!/usr/bin/env bun
// [claude-code 2026-04-19] S27-T8 W1d: Copy non-TS assets into dist after tsc.
// The launchd-managed backend runs from dist/index.js, so SOUL .md files and
// config JSONs must live next to the compiled code.

import { mkdirSync, readdirSync, copyFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(__dirname, "..");
const SRC = join(BACKEND_ROOT, "src");
const DIST = join(BACKEND_ROOT, "dist");

interface Copy {
  from: string;
  to: string;
  pattern: RegExp;
}

const jobs: Copy[] = [
  {
    from: join(SRC, "config"),
    to: join(DIST, "config"),
    pattern: /\.json$/,
  },
  {
    from: join(SRC, "services", "ai", "soul"),
    to: join(DIST, "services", "ai", "soul"),
    pattern: /\.md$/,
  },
  {
    from: join(SRC, "services", "ai", "agent-instructions"),
    to: join(DIST, "services", "ai", "agent-instructions"),
    pattern: /\.md$/,
  },
];

for (const job of jobs) {
  if (!existsSync(job.from)) continue;
  mkdirSync(job.to, { recursive: true });
  const entries = readdirSync(job.from, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!job.pattern.test(entry.name)) continue;
    copyFileSync(join(job.from, entry.name), join(job.to, entry.name));
  }
}
