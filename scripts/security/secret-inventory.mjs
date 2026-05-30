#!/usr/bin/env node
// [claude-code 2026-05-30] Redacted secret inventory for S121.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";

const mode = readArg("mode") ?? "current";
const refs = (readArg("refs") ?? "")
  .split(",")
  .map((v) => v.trim())
  .filter(Boolean);
const format = readArg("format") ?? "text";
const maxBytes = Number(readArg("max-bytes") ?? 1_500_000);

const skipParts = [
  ".git/",
  ".agents/",
  ".claude/skills/",
  ".claude/takeover-import/",
  ".vercel/",
  "node_modules/",
  "dist/",
  "desktop-dist/",
  "Video Footage/",
  "backend-hono/logs/",
  "memory/file-room/",
];
const binaryExtensions =
  /\.(png|jpe?g|gif|webp|icns|ico|dmg|zip|pdf|mp4|mov|woff2?)$/i;

const tokenPatterns = [
  ["github-token", /\bgh[pousr]_[A-Za-z0-9_]{30,}\b/g],
  ["openrouter-key", /\bsk-or-v1-[A-Za-z0-9_-]{20,}\b/g],
  ["anthropic-key", /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g],
  ["openai-compatible-key", /\bsk-(?:proj-)?[A-Za-z0-9][A-Za-z0-9_-]{28,}\b/g],
  ["private-key-block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ["database-url", /\b(?:postgres(?:ql)?|mysql|redis):\/\/[^:\s/]+:[^@\s]+@/gi],
];

const assignmentPattern =
  /^\s*(?:-\s*)?(?:export\s+)?(?:const\s+|let\s+|var\s+)?([A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*)\s*[:=]\s*["']?([^"'\s#]+)/gim;
const jwtPattern =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const secretKeyPattern =
  /(?:^|_)(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)(?:_|$)/;

const findings = [];

if (mode === "current") scanCurrent();
else if (mode === "refs") scanRefs(refs.length > 0 ? refs : ["HEAD"]);
else die(`Unknown mode: ${mode}`);

const reportable = findings.filter((finding) => finding.reportable);
writeOutput({ mode, refs, findings, reportableCount: reportable.length });
process.exit(reportable.length > 0 ? 1 : 0);

function scanCurrent() {
  const files = git([
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .split("\0")
    .filter(Boolean);
  for (const path of files) {
    if (shouldSkip(path) || !existsSync(path)) continue;
    const stat = statSync(path);
    if (!stat.isFile() || stat.size > maxBytes) continue;
    scanText({ scope: "current", path, text: readFileSync(path, "utf8") });
  }
}

function scanRefs(refNames) {
  for (const ref of refNames) {
    const files = git(["ls-tree", "-r", "--name-only", ref])
      .split("\n")
      .filter(Boolean);
    for (const path of files) {
      if (shouldSkip(path)) continue;
      const result = spawnSync("git", ["show", `${ref}:${path}`], {
        encoding: "utf8",
        maxBuffer: maxBytes,
      });
      if (result.status !== 0 || !result.stdout) continue;
      scanText({ scope: ref, path, text: result.stdout });
    }
  }
}

function scanText({ scope, path, text }) {
  const lines = text.split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1;
    for (const [className, pattern] of tokenPatterns) {
      for (const match of line.matchAll(pattern)) {
        if (isPlaceholder(match[0])) continue;
        addFinding({ scope, path, lineNumber, className, value: match[0] });
      }
    }
    for (const match of line.matchAll(jwtPattern)) {
      const jwt = describeJwt(match[0]);
      addFinding({
        scope,
        path,
        lineNumber,
        className: jwt.className,
        value: match[0],
        reportable: jwt.reportable,
        key: jwt.key,
      });
    }
    for (const match of line.matchAll(assignmentPattern)) {
      const key = match[1];
      const value = match[2].trim().replace(/[,;]$/, "");
      if (isNonSecretKey(key)) continue;
      if (!secretKeyPattern.test(key)) continue;
      if (isPlaceholder(value)) continue;
      const jwt = value.startsWith("eyJ") ? describeJwt(value) : null;
      const isPublicKey = key.startsWith("VITE_") || key.includes("ANON_KEY");
      addFinding({
        scope,
        path,
        lineNumber,
        className: jwt?.className ?? "secret-assignment",
        value,
        key,
        reportable: jwt?.reportable ?? !isPublicKey,
      });
    }
  }
}

function addFinding({
  scope,
  path,
  lineNumber,
  className,
  value,
  key,
  reportable = true,
}) {
  findings.push({
    scope,
    path,
    line: lineNumber,
    className,
    key: key ?? null,
    reportable,
    fingerprint: `sha256:${createHash("sha256").update(value).digest("hex").slice(0, 12)}`,
    length: value.length,
  });
}

function describeJwt(value) {
  const payload = decodeJwtPayload(value);
  if (payload?.role === "anon") {
    return {
      className: "public-supabase-anon-jwt",
      reportable: false,
      key: "SUPABASE_ANON_KEY",
    };
  }
  if (payload?.role === "service_role") {
    return {
      className: "supabase-service-role-jwt",
      reportable: true,
      key: "SUPABASE_SERVICE_ROLE_KEY",
    };
  }
  return { className: "jwt-like-token", reportable: true, key: null };
}

function decodeJwtPayload(value) {
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload.padEnd(Math.ceil(payload.length / 4) * 4, "=");
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function isPlaceholder(value) {
  const normalized = value.trim();
  if (!normalized || normalized.length < 8) return true;
  if (
    /^(process\.env|import\.meta\.env|env\.|config\.|ctx\.|c\.env\()/i.test(
      normalized,
    )
  )
    return true;
  if (/^[A-Z0-9_]+$/.test(normalized)) return true;
  if (/^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)+$/.test(normalized)) return true;
  if (/^\{?\{?[A-Z0-9_]+\}?\}?$/.test(normalized)) return true;
  if (/^\$\(|^\$\{[^}]+:?[-=]?.*\}$/.test(normalized)) return true;
  if (/\$\{[A-Z0-9_]+/.test(normalized)) return true;
  if (/\/\/[^:@/]+:(?:password|pass|postgres|example)@/i.test(normalized))
    return true;
  if (/\/\/[^:@/]+:[^@/]+@(?:localhost|127\.0\.0\.1)/i.test(normalized))
    return true;
  if (/^\$\{\{\s*secrets\./i.test(normalized)) return true;
  if (/^\$[A-Z0-9_]+$/.test(normalized)) return true;
  if (/^<[^>]+>$/.test(normalized)) return true;
  return /^(your-|example|placeholder|changeme|redacted|disabled|null|undefined|false|true)|YOUR_|test-key|very-long|managed-token|bearer_token|connection_string_here/i.test(
    normalized,
  );
}

function isNonSecretKey(key) {
  return /(?:_STATUS|_FALLBACK|_VAR|_TOKENS)$/.test(key);
}

function shouldSkip(path) {
  if (binaryExtensions.test(path)) return true;
  return skipParts.some((part) => path.includes(part));
}

function git(args) {
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0)
    die(result.stderr.trim() || `git ${args.join(" ")} failed`);
  return result.stdout;
}

function readArg(name) {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0) return process.argv[index + 1];
  return null;
}

function writeOutput(payload) {
  if (format === "json") {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(
    `secret inventory mode=${payload.mode} reportable=${payload.reportableCount}`,
  );
  for (const finding of payload.findings) {
    const level = finding.reportable ? "report" : "info";
    const key = finding.key ? ` key=${finding.key}` : "";
    console.log(
      `${level} ${finding.scope}:${finding.path}:${finding.line} ${finding.className}${key} ${finding.fingerprint} length=${finding.length}`,
    );
  }
}

function die(message) {
  console.error(message);
  process.exit(2);
}
