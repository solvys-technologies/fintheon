import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { FileRoomSectionId } from "./types.js";

export const DEFAULT_DESK_ID = "priced-in-capital";
export const DEFAULT_DESK_NAME = "Priced In Capital";

export const SECTION_FOLDERS: Record<FileRoomSectionId, string> = {
  "weekly-tribune": "Weekly Tribune",
  "agentic-memos": "Agentic Memos",
  "narrative-summaries": "NarrativeFlow Summaries",
  uploads: "Uploads",
  "chart-evidence": "Chart Evidence",
  "agent-souls": "Agent SOUL Files",
};

export const SECTION_COPY: Record<FileRoomSectionId, string> = {
  "weekly-tribune": "Weekly market dispatches and Tribune artifacts",
  "agentic-memos": "Harper-authored memo approvals and published memos",
  "narrative-summaries": "NarrativeFlow session summaries and desk snapshots",
  uploads: "Trader uploads, PDFs, and Notion wiki links",
  "chart-evidence": "Captured or requested chart screenshots",
  "agent-souls": "Agent operating files from the Apparatus",
};

export function fileRoomRoot(): string {
  if (process.env.FINTHEON_FILE_ROOM_PATH) {
    return resolve(process.env.FINTHEON_FILE_ROOM_PATH);
  }
  if (process.env.OBSIDIAN_VAULT_PATH) {
    return resolve(process.env.OBSIDIAN_VAULT_PATH, "Fintheon File Room");
  }
  return resolve(process.cwd(), "..", "memory", "file-room");
}

export function deskRoot(deskId = DEFAULT_DESK_ID): string {
  return join(fileRoomRoot(), "Desks", sanitizeDeskId(deskId));
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

export function sanitizeDeskId(value: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || DEFAULT_DESK_ID;
}

export function fileExists(path: string): boolean {
  return existsSync(path);
}
