// [codex 2026-05-23] Runtime release awareness for Harper chat.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const PROJECT_ROOT = resolve(
  new URL(".", import.meta.url).pathname,
  "../../../..",
);

function shouldInjectReleaseContext(message: string): boolean {
  return /\b(latest|release|released|update|updates|version|changelog|demonstrate|show me where|what shipped)\b/i.test(
    message,
  );
}

function extractSummaries(source: string, limit = 5): string[] {
  const summaries: string[] = [];
  const regex = /summary:\s*\n\s*"([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) && summaries.length < limit) {
    summaries.push(match[1]);
  }
  return summaries;
}

async function readPackageVersion(): Promise<string> {
  try {
    const raw = await readFile(resolve(PROJECT_ROOT, "package.json"), "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    return parsed.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function buildReleaseContext(message: string): Promise<string> {
  if (!shouldInjectReleaseContext(message)) return "";

  const version = await readPackageVersion();
  let summaries: string[] = [];
  try {
    const changelog = await readFile(
      resolve(PROJECT_ROOT, "src/lib/changelog.ts"),
      "utf8",
    );
    summaries = extractSummaries(changelog);
  } catch {
    summaries = [];
  }

  return `

--- CURRENT RELEASE CONTEXT ---
Installed package version: v${version}.
Recent changelog entries:
${summaries.length ? summaries.map((s, i) => `${i + 1}. ${s}`).join("\n") : "- Changelog unavailable."}

Operational rule:
- Do not rely on stale embedded release notes. Treat the package version and changelog above as current.
- If TP asks to demonstrate a recent update, use app tools or browser_harness to show the relevant UI surface when possible. Do not recite source code as a substitute for the product behavior.
- If the update is not visible in UI, say which file or release note proves it and what UI proof is missing.
`;
}
