import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  deskVaultsRoot,
  fallbackDeskVaultsRoot,
  sanitizeVaultSlug,
} from "../obsidian-vaults/paths.js";
import type { FileRoomSectionId } from "./types.js";

export const DEFAULT_DESK_ID = "priced-in-capital";
export const DEFAULT_DESK_NAME = "Priced In Capital";

export const SECTION_FOLDERS: Record<FileRoomSectionId, string> = {
  "weekly-tribune": "Weekly Tribune",
  "agentic-memos": "Agentic Memos",
  "narrative-tags": "Narrative Tags",
  "narrative-workspaces": "Narrative Workspaces",
  "narrative-summaries": "NarrativeFlow Summaries",
  uploads: "Uploads",
  "chart-evidence": "Chart Evidence",
  "agent-souls": "Agent SOUL Files",
};

export const SECTION_COPY: Record<FileRoomSectionId, string> = {
  "weekly-tribune": "Weekly market dispatches and Tribune artifacts",
  "agentic-memos": "Harper-authored memo approvals and published memos",
  "narrative-tags": "Narrative tags, thesis labels, and desk fit metadata",
  "narrative-workspaces": "NarrativeFlow workspace summaries and artifacts",
  "narrative-summaries": "NarrativeFlow session summaries and desk snapshots",
  uploads: "Trader uploads, PDFs, and Notion wiki links",
  "chart-evidence": "Captured or requested chart screenshots",
  "agent-souls": "Agent operating files from the Apparatus",
};

export function fileRoomRoot(): string {
  if (process.env.FINTHEON_FILE_ROOM_PATH) {
    return resolve(process.env.FINTHEON_FILE_ROOM_PATH);
  }
  return deskVaultsRoot() ?? fallbackDeskVaultsRoot();
}

export function deskRoot(deskId = DEFAULT_DESK_ID): string {
  return join(fileRoomRoot(), sanitizeDeskId(deskId));
}

export function sectionRoot(
  deskId: string,
  sectionId: FileRoomSectionId,
): string {
  return join(deskRoot(deskId), SECTION_FOLDERS[sectionId]);
}

export async function ensureDeskFolders(
  deskId = DEFAULT_DESK_ID,
): Promise<void> {
  await mkdir(deskRoot(deskId), { recursive: true });
  await Promise.all(
    Object.keys(SECTION_FOLDERS)
      .filter((id) => id !== "agent-souls")
      .map((id) =>
        mkdir(sectionRoot(deskId, id as FileRoomSectionId), {
          recursive: true,
        }),
      ),
  );
}

export async function ensureDeskVault(input: {
  id?: string | null;
  name?: string | null;
  slug?: string | null;
  color?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  const slug = sanitizeDeskId(input.slug || input.id || DEFAULT_DESK_ID);
  await ensureDeskFolders(slug);
  const readme = join(deskRoot(slug), "README.md");
  if (existsSync(readme)) return;
  await writeFile(
    readme,
    [
      "---",
      `type: "desk-vault"`,
      `desk_id: ${JSON.stringify(input.id ?? slug)}`,
      `desk_slug: ${JSON.stringify(slug)}`,
      `desk_name: ${JSON.stringify(input.name ?? DEFAULT_DESK_NAME)}`,
      `created_by: ${JSON.stringify(input.createdBy ?? "system")}`,
      `color: ${JSON.stringify(input.color ?? "#c79f4a")}`,
      `created_at: ${JSON.stringify(new Date().toISOString())}`,
      `tags: ["fintheon", "desk-vault"]`,
      "---",
      "",
      `# ${input.name ?? DEFAULT_DESK_NAME} Desk Vault`,
      "",
      "This vault stores desk-scoped NarrativeFlow workspaces, narrative tags, memos, uploads, chart evidence, and agent operating files.",
    ].join("\n"),
  );
}

export function sanitizeDeskId(value: string): string {
  return sanitizeVaultSlug(value) || DEFAULT_DESK_ID;
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
