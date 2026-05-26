import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import {
  deskVaultCandidates,
  riskFlowVaultCandidates,
} from "../obsidian-vaults/paths.js";
import type { MentionItem, MentionQuery } from "./mention-sources.js";

const VAULT_FILE_CAP = 120;

export async function readVaultNotes(
  query: MentionQuery,
): Promise<MentionItem[]> {
  const candidates = [
    ...riskFlowVaultCandidates(),
    ...deskVaultCandidates(query.deskId),
  ].filter((candidate) => existsSync(candidate.root));

  const seen = new Set<string>();
  const items: MentionItem[] = [];
  for (const candidate of candidates) {
    const files = await collectMarkdown(candidate.root, 3, VAULT_FILE_CAP);
    for (const file of files) {
      const rel = relative(candidate.baseRoot, file);
      if (seen.has(rel)) continue;
      seen.add(rel);
      items.push(await readVaultItem(file, rel, candidate.label));
    }
  }
  return items;
}

async function readVaultItem(
  file: string,
  rel: string,
  label: string,
): Promise<MentionItem> {
  const [raw, meta] = await Promise.all([
    readFile(file, "utf8").catch(() => ""),
    stat(file).catch(() => null),
  ]);
  const title =
    raw.match(/^#\s+(.+)$/m)?.[1]?.trim() ||
    file.split("/").pop() ||
    "Vault note";
  return {
    id: `vault:${rel}`,
    type: "vault",
    label: title,
    subtitle: label === "riskflow" ? "RiskFlow Main vault" : "Desk vault note",
    preview: rel,
    source: "obsidian",
    referenceId: rel,
    tags: ["vault", label],
    updatedAt: meta?.mtime.toISOString() ?? null,
  };
}

async function collectMarkdown(
  root: string,
  depth: number,
  cap: number,
): Promise<string[]> {
  if (depth < 0 || cap <= 0) return [];
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const entry of entries.sort(compareVaultEntries)) {
    if (out.length >= cap) break;
    if (entry.name.startsWith(".")) continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await collectMarkdown(full, depth - 1, cap - out.length)));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
  return out;
}

function compareVaultEntries(
  a: { name: string; isDirectory: () => boolean },
  b: { name: string; isDirectory: () => boolean },
): number {
  const score = (entry: { name: string; isDirectory: () => boolean }) => {
    if (entry.name === "Catalysts") return 0;
    if (entry.name === "Narrative Workspaces") return 1;
    if (entry.name === "Narrative Tags") return 2;
    if (/^\d{4}-\d{2}/.test(entry.name)) return 3;
    if (entry.name === "Index.md") return 4;
    return entry.isDirectory() ? 5 : 6;
  };
  return score(a) - score(b) || b.name.localeCompare(a.name);
}
