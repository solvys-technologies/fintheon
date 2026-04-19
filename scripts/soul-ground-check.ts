#!/usr/bin/env bun
// [claude-code 2026-04-19] S27-T8 W1d: SOUL drift guard.
//
// Fails CI when:
//   (a) a SOUL file's grounding.source_of_truth path does not resolve
//   (b) a SOUL file or its grounding.extra entry duplicates a paragraph from CLAUDE.md
//
// Paragraph = block of consecutive non-empty lines separated by blank lines.
// A duplicate is any paragraph >= MIN_PARA_LEN chars that appears verbatim in both
// CLAUDE.md and a SOUL file body OR a grounding.extra file.
//
// Usage: bun run scripts/soul-ground-check.ts

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const SOUL_DIR = join(
  REPO_ROOT,
  "backend-hono",
  "src",
  "services",
  "ai",
  "soul",
);

const MIN_PARA_LEN = 80; // ignore trivially-short shared tokens

interface Finding {
  kind: "missing-grounding" | "duplicate-paragraph" | "parse-error";
  file: string;
  detail: string;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN_PARA_LEN);
}

function splitFrontmatter(raw: string): { yaml: string; body: string } {
  if (!raw.startsWith("---\n") && !raw.startsWith("---\r\n")) {
    throw new Error("Missing opening '---'");
  }
  const lines = raw.split("\n");
  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) throw new Error("Missing closing '---'");
  return {
    yaml: lines.slice(1, endIdx).join("\n"),
    body: lines.slice(endIdx + 1).join("\n"),
  };
}

function extractGrounding(yaml: string): {
  source_of_truth?: string;
  extra: string[];
} {
  const sotMatch = yaml.match(/^\s*source_of_truth:\s*(.+)$/m);
  const source_of_truth = sotMatch ? sotMatch[1].trim() : undefined;

  // grounding:
  //   extra:
  //     - path1
  //     - path2
  const extra: string[] = [];
  const extraBlockMatch = yaml.match(/^\s*extra:\s*\n((?:\s{2,}-\s+.+\n?)+)/m);
  if (extraBlockMatch) {
    for (const line of extraBlockMatch[1].split("\n")) {
      const m = line.match(/^\s*-\s+(.+)\s*$/);
      if (m) extra.push(m[1].trim());
    }
  }
  return { source_of_truth, extra };
}

const findings: Finding[] = [];

const soulFiles = readdirSync(SOUL_DIR)
  .filter((f) => f.endsWith(".md") && f !== "README.md")
  .map((f) => join(SOUL_DIR, f));

if (soulFiles.length === 0) {
  console.error("No SOUL files found in", SOUL_DIR);
  process.exit(1);
}

// Collect CLAUDE.md paragraphs once, indexed by each SOUL's grounding path (they should all point at the same file).
const claudeParasByPath = new Map<string, Set<string>>();

for (const soulPath of soulFiles) {
  const raw = readFileSync(soulPath, "utf-8");
  let parts: { yaml: string; body: string };
  try {
    parts = splitFrontmatter(raw);
  } catch (err) {
    findings.push({
      kind: "parse-error",
      file: soulPath,
      detail: String(err),
    });
    continue;
  }

  const { source_of_truth, extra } = extractGrounding(parts.yaml);
  if (!source_of_truth) {
    findings.push({
      kind: "missing-grounding",
      file: soulPath,
      detail: "grounding.source_of_truth not set",
    });
    continue;
  }

  const claudeMdPath = resolve(dirname(soulPath), source_of_truth);
  let claudeParas = claudeParasByPath.get(claudeMdPath);
  if (!claudeParas) {
    try {
      const txt = readFileSync(claudeMdPath, "utf-8");
      claudeParas = new Set(splitParagraphs(txt));
      claudeParasByPath.set(claudeMdPath, claudeParas);
    } catch (err) {
      findings.push({
        kind: "missing-grounding",
        file: soulPath,
        detail: `source_of_truth path did not resolve: ${claudeMdPath} (${String(err)})`,
      });
      continue;
    }
  }

  // Check SOUL body
  for (const para of splitParagraphs(parts.body)) {
    if (claudeParas.has(para)) {
      findings.push({
        kind: "duplicate-paragraph",
        file: soulPath,
        detail: `SOUL body duplicates CLAUDE.md paragraph (${para.length} chars): "${para.slice(0, 80)}..."`,
      });
    }
  }

  // Check each extra file
  for (const extraPath of extra) {
    const abs = resolve(dirname(soulPath), extraPath);
    let extraText: string;
    try {
      extraText = readFileSync(abs, "utf-8");
    } catch (err) {
      findings.push({
        kind: "missing-grounding",
        file: soulPath,
        detail: `grounding.extra path did not resolve: ${abs} (${String(err)})`,
      });
      continue;
    }
    for (const para of splitParagraphs(extraText)) {
      if (claudeParas.has(para)) {
        findings.push({
          kind: "duplicate-paragraph",
          file: abs,
          detail: `Extra file duplicates CLAUDE.md paragraph (${para.length} chars): "${para.slice(0, 80)}..."`,
        });
      }
    }
  }
}

if (findings.length === 0) {
  console.log(
    `soul-ground-check: PASS — ${soulFiles.length} SOUL file(s) grounded cleanly on CLAUDE.md`,
  );
  process.exit(0);
}

console.error(`soul-ground-check: FAIL — ${findings.length} issue(s)`);
for (const f of findings) {
  console.error(`  [${f.kind}] ${f.file}`);
  console.error(`    ${f.detail}`);
}
process.exit(1);
