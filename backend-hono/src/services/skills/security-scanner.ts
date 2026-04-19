// [claude-code 2026-04-19] S27-T10 W2e: Hub-imported skill security scanner.
//   Static-scan only — pattern-based. Cheap + deterministic.
//   Hits on any "block" category → importer rejects. Supply-chain warnings require TP confirm.

import { readFile, readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export interface ScanReport {
  data_exfil_risks: ScanHit[];
  prompt_injection_vectors: ScanHit[];
  destructive_ops: ScanHit[];
  supply_chain_warnings: ScanHit[];
}

export interface ScanHit {
  file: string;
  line: number;
  match: string;
  category: string;
}

export interface ScanResult {
  report: ScanReport;
  blocked: boolean;
  warned: boolean;
  reasons: string[];
}

const ALLOWLISTED_HOSTS = new Set([
  "openrouter.ai",
  "api.anthropic.com",
  "api.openai.com",
  "api.exa.ai",
  "api.stlouisfed.org",
  "api.kalshi.com",
  "polymarket.com",
  "api.polymarket.com",
  "fintheon.fly.dev",
  "localhost",
  "127.0.0.1",
]);

const DESTRUCTIVE_PATTERNS = [
  /rm\s+-rf?\b/,
  /\bunlinkSync\s*\(/,
  /\bunlink\s*\(/,
  /\brmdirSync\s*\(/,
  /\brimraf\s*\(/,
  /DROP\s+TABLE/i,
  /DELETE\s+FROM\s+/i,
  /TRUNCATE\s+TABLE/i,
  /\bexecSync\s*\(/,
  /\bspawnSync\s*\(/,
];

const PROMPT_INJECTION_PATTERNS = [
  /\`\s*\$\{[^}]*systemPrompt[^}]*\}/,
  /\bsystem_prompt\s*\+\s*(user|input|message)/,
  /\brenderSystemPrompt\s*\(.*user/i,
];

const FETCH_PATTERN =
  /(?:fetch|axios(?:\.get|\.post)?|request)\s*\(\s*["'`]([^"'`]+)/g;

const KNOWN_BAD_DEPS = new Set([
  "event-stream",
  "flatmap-stream",
  "rc",
  "ua-parser-js",
]);

async function walk(dir: string, out: string[] = []): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === ".git") continue;
    const full = join(dir, name);
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) {
      await walk(full, out);
    } else if (/\.(ts|tsx|js|mjs|cjs|yaml|yml|json)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function hostFromUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.hostname;
  } catch {
    return null;
  }
}

export async function scanSkill(skillRoot: string): Promise<ScanResult> {
  const report: ScanReport = {
    data_exfil_risks: [],
    prompt_injection_vectors: [],
    destructive_ops: [],
    supply_chain_warnings: [],
  };

  const files = await walk(skillRoot);
  for (const file of files) {
    const rel = relative(skillRoot, file);
    const raw = await readFile(file, "utf8").catch(() => "");
    if (!raw) continue;

    const lines = raw.split("\n");

    if (rel.endsWith("package.json")) {
      try {
        const pkg = JSON.parse(raw) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        const allDeps = {
          ...(pkg.dependencies ?? {}),
          ...(pkg.devDependencies ?? {}),
        };
        for (const dep of Object.keys(allDeps)) {
          if (KNOWN_BAD_DEPS.has(dep)) {
            report.supply_chain_warnings.push({
              file: rel,
              line: 0,
              match: dep,
              category: "known-bad-dep",
            });
          }
        }
      } catch {
        // ignore malformed package.json
      }
      continue;
    }

    lines.forEach((line, idx) => {
      for (const pat of DESTRUCTIVE_PATTERNS) {
        const m = line.match(pat);
        if (m) {
          report.destructive_ops.push({
            file: rel,
            line: idx + 1,
            match: m[0],
            category: "destructive",
          });
        }
      }
      for (const pat of PROMPT_INJECTION_PATTERNS) {
        const m = line.match(pat);
        if (m) {
          report.prompt_injection_vectors.push({
            file: rel,
            line: idx + 1,
            match: m[0].slice(0, 80),
            category: "prompt-injection",
          });
        }
      }
      let fetchMatch: RegExpExecArray | null;
      FETCH_PATTERN.lastIndex = 0;
      while ((fetchMatch = FETCH_PATTERN.exec(line))) {
        const host = hostFromUrl(fetchMatch[1]);
        if (host && !ALLOWLISTED_HOSTS.has(host)) {
          report.data_exfil_risks.push({
            file: rel,
            line: idx + 1,
            match: host,
            category: "non-allowlisted-host",
          });
        }
      }
    });
  }

  const declaredYaml = await readFile(
    join(skillRoot, "skill.yaml"),
    "utf8",
  ).catch(() => "");
  const declaredBlock = /security_scan:[\s\S]*?(?=\n[a-z_]+:|$)/.exec(
    declaredYaml,
  );
  const declared = declaredBlock?.[0] ?? "";

  const declaredExfil = /data_exfil_risks:[\s\S]*?(?=\n\s{0,2}[a-z_]+:|$)/.test(
    declared,
  );
  const declaredInjection =
    /prompt_injection_vectors:[\s\S]*?(?=\n\s{0,2}[a-z_]+:|$)/.test(declared);

  // Destructive ops are NEVER allowed to be declared-away — always block.
  const blocked =
    report.destructive_ops.length > 0 ||
    (report.data_exfil_risks.length > 0 && !declaredExfil) ||
    (report.prompt_injection_vectors.length > 0 && !declaredInjection);

  const warned = report.supply_chain_warnings.length > 0;

  const reasons: string[] = [];
  if (report.destructive_ops.length > 0)
    reasons.push(
      `destructive_ops: ${report.destructive_ops.length} hit(s) — blocked`,
    );
  if (report.data_exfil_risks.length > 0 && !declaredExfil)
    reasons.push(
      `data_exfil_risks: ${report.data_exfil_risks.length} undeclared host(s) — blocked`,
    );
  if (report.prompt_injection_vectors.length > 0 && !declaredInjection)
    reasons.push(
      `prompt_injection_vectors: ${report.prompt_injection_vectors.length} hit(s) — blocked`,
    );
  if (warned)
    reasons.push(
      `supply_chain_warnings: ${report.supply_chain_warnings.length} known-bad dep(s)`,
    );

  return { report, blocked, warned, reasons };
}
