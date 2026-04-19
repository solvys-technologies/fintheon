// [claude-code 2026-04-19] S27-T10 W2e: Hub skill importer.
//   Resolves a hub URL (http(s)/git tarball or local path), parses skill.yaml against the
//   agentskills.io Zod schema, runs the security scanner, and persists to skill_imports.
//
//   Hub URL shapes accepted:
//     - https://agentskills.io/skills/<id> → tarball
//     - git+https://github.com/<owner>/<repo>   → git clone (depth 1)
//     - ./path/to/local-skill-dir               → copy-in-place (used by smoke tests)

import { readFile, mkdir, cp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, isAbsolute } from "node:path";
import { tmpdir } from "node:os";
import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";
import { getSupabaseClient } from "../../config/supabase.js";
import { parseSkillYaml } from "./yaml-parse.js";
import { scanSkill, type ScanReport } from "./security-scanner.js";

const execFile = promisify(_execFile);

export type ImportStatus = "imported" | "rejected" | "warned";

export interface SkillImportResult {
  imported: boolean;
  skill_id: string;
  version: string;
  status: ImportStatus;
  scan_report: ScanReport;
  rejected_because: string[];
  dest_path?: string;
}

export interface ImportOptions {
  version?: string;
  trust_unsigned?: boolean;
  imported_by?: string;
}

function resolveLocalPath(hubUrl: string): string | null {
  if (
    hubUrl.startsWith("./") ||
    hubUrl.startsWith("../") ||
    isAbsolute(hubUrl)
  ) {
    const abs = resolve(hubUrl);
    return existsSync(abs) ? abs : null;
  }
  return null;
}

async function fetchTarball(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`hub fetch ${res.status}: ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const { writeFile } = await import("node:fs/promises");
  const tarPath = join(dest, "skill.tar.gz");
  await writeFile(tarPath, buffer);
  await execFile("tar", ["-xzf", tarPath, "-C", dest]);
}

async function cloneGit(url: string, dest: string): Promise<void> {
  const repo = url.replace(/^git\+/, "");
  await execFile("git", ["clone", "--depth", "1", repo, dest]);
}

async function resolveToDir(hubUrl: string): Promise<string> {
  const localPath = resolveLocalPath(hubUrl);
  if (localPath) return localPath;

  const stagingRoot = join(tmpdir(), `fintheon-skill-${Date.now()}`);
  await mkdir(stagingRoot, { recursive: true });

  if (hubUrl.startsWith("git+") || hubUrl.endsWith(".git")) {
    await cloneGit(hubUrl, stagingRoot);
  } else if (hubUrl.startsWith("http://") || hubUrl.startsWith("https://")) {
    await fetchTarball(hubUrl, stagingRoot);
  } else {
    throw new Error(`Unsupported hub URL scheme: ${hubUrl}`);
  }
  return stagingRoot;
}

async function persistAudit(args: {
  skill_id: string;
  version: string;
  source_url: string;
  scan_report: ScanReport;
  status: ImportStatus;
  imported_by?: string;
}): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  try {
    await sb.from("skill_imports").upsert(
      {
        skill_id: args.skill_id,
        version: args.version,
        source_url: args.source_url,
        scan_report: args.scan_report as unknown as Record<string, unknown>,
        status: args.status,
        imported_by: args.imported_by ?? null,
      },
      { onConflict: "skill_id,version" },
    );
  } catch (err) {
    console.warn("[skills.importer] audit persist failed", err);
  }
}

const REPO_ROOT = resolve(new URL("../../../../", import.meta.url).pathname);
const IMPORTED_ROOT = join(REPO_ROOT, "skills", "imported");

export async function importSkillFromHub(
  hubUrl: string,
  options?: ImportOptions,
): Promise<SkillImportResult> {
  const stagingDir = await resolveToDir(hubUrl);

  const manifestPath = join(stagingDir, "skill.yaml");
  if (!existsSync(manifestPath)) {
    throw new Error(`No skill.yaml at ${manifestPath}`);
  }
  const raw = await readFile(manifestPath, "utf8");
  const manifest = parseSkillYaml(raw);

  const scan = await scanSkill(stagingDir);

  const status: ImportStatus = scan.blocked
    ? "rejected"
    : scan.warned
      ? "warned"
      : "imported";

  let dest_path: string | undefined;
  if (!scan.blocked) {
    dest_path = join(IMPORTED_ROOT, manifest.id.replace(/[^a-z0-9_.-]/gi, "_"));
    await mkdir(dest_path, { recursive: true });
    await cp(stagingDir, dest_path, { recursive: true });
  } else {
    // Clean up staging on reject so we do not leave half-imports on disk.
    if (stagingDir.startsWith(tmpdir())) {
      await rm(stagingDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  await persistAudit({
    skill_id: manifest.id,
    version: options?.version ?? manifest.version,
    source_url: hubUrl,
    scan_report: scan.report,
    status,
    imported_by: options?.imported_by,
  });

  return {
    imported: status === "imported" || status === "warned",
    skill_id: manifest.id,
    version: options?.version ?? manifest.version,
    status,
    scan_report: scan.report,
    rejected_because: scan.reasons,
    dest_path,
  };
}
