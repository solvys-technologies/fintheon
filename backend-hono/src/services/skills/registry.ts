// [claude-code 2026-04-19] S27-T10 W2e: Skill registry — enumerates local + imported skills.
//   GET /api/skills reads this. Harper tool-call path introspects this to know what's available.

import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseSkillYaml, type SkillManifest } from "./yaml-parse.js";
import { getSupabaseClient } from "../../config/supabase.js";

const REPO_ROOT = resolve(new URL("../../../../", import.meta.url).pathname);
const SKILLS_ROOT = join(REPO_ROOT, "skills");

export interface SkillRegistryEntry {
  manifest: SkillManifest;
  origin: "local" | "imported";
  path: string;
  scan_report?: unknown;
  status?: string;
}

async function listSkillDirs(parent: string): Promise<string[]> {
  if (!existsSync(parent)) return [];
  const entries = await readdir(parent);
  const out: string[] = [];
  for (const name of entries) {
    if (name === "fixtures") continue;
    const full = join(parent, name);
    const s = await stat(full).catch(() => null);
    if (!s) continue;
    if (s.isDirectory() && existsSync(join(full, "skill.yaml"))) {
      out.push(full);
    }
  }
  return out;
}

async function readManifest(dir: string): Promise<SkillManifest | null> {
  try {
    const raw = await readFile(join(dir, "skill.yaml"), "utf8");
    return parseSkillYaml(raw);
  } catch (err) {
    console.warn(`[skills.registry] failed to parse ${dir}`, err);
    return null;
  }
}

export async function listLocalSkills(): Promise<SkillRegistryEntry[]> {
  const dirs = await listSkillDirs(SKILLS_ROOT);
  const out: SkillRegistryEntry[] = [];
  for (const d of dirs) {
    const manifest = await readManifest(d);
    if (!manifest) continue;
    out.push({ manifest, origin: "local", path: d });
  }
  return out;
}

export async function listImportedSkills(): Promise<SkillRegistryEntry[]> {
  const importedRoot = join(SKILLS_ROOT, "imported");
  const dirs = await listSkillDirs(importedRoot);
  const out: SkillRegistryEntry[] = [];
  for (const d of dirs) {
    const manifest = await readManifest(d);
    if (!manifest) continue;
    out.push({ manifest, origin: "imported", path: d });
  }
  return out;
}

export async function listAllSkills(): Promise<SkillRegistryEntry[]> {
  const [local, imported] = await Promise.all([
    listLocalSkills(),
    listImportedSkills(),
  ]);

  const byId = new Map<string, SkillRegistryEntry>();
  for (const entry of [...local, ...imported]) {
    byId.set(entry.manifest.id, entry);
  }

  const sb = getSupabaseClient();
  if (sb) {
    try {
      const { data } = await sb
        .from("skill_imports")
        .select("skill_id, version, status, scan_report, imported_at")
        .order("imported_at", { ascending: false });
      for (const row of data ?? []) {
        const existing = byId.get(row.skill_id as string);
        if (existing && existing.manifest.version === row.version) {
          existing.status = row.status as string;
          existing.scan_report = row.scan_report;
        }
      }
    } catch (err) {
      console.warn("[skills.registry] skill_imports read failed", err);
    }
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.manifest.id.localeCompare(b.manifest.id),
  );
}
