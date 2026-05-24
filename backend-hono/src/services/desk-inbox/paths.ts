import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import {
  DEFAULT_DESK_ID,
  ensureDeskFolders,
  sanitizeDeskId,
  sectionRoot,
} from "../file-room/paths.js";

export async function inboxRoot(deskId = DEFAULT_DESK_ID): Promise<string> {
  const safeDeskId = sanitizeDeskId(deskId);
  await ensureDeskFolders(safeDeskId);
  const root = join(sectionRoot(safeDeskId, "agentic-memos"), "Inbox");
  await mkdir(root, { recursive: true });
  return root;
}

export async function approvedMemoRoot(deskId = DEFAULT_DESK_ID): Promise<string> {
  const safeDeskId = sanitizeDeskId(deskId);
  await ensureDeskFolders(safeDeskId);
  const root = sectionRoot(safeDeskId, "agentic-memos");
  await mkdir(root, { recursive: true });
  return root;
}

export function memoFilename(id: string): string {
  return `${id.replace(/[^a-zA-Z0-9_-]/g, "-")}.md`;
}
