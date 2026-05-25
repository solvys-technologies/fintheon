import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { sanitizeDeskId } from "../file-room/paths.js";
import { decodeInboxItem, draftFromInput, encodeInboxItem } from "./codec.js";
import { approvedMemoRoot, inboxRoot, memoFilename } from "./paths.js";
import type { DeskInboxItem, InboxDecision, MemoDraftInput } from "./types.js";

export async function listInboxItems(
  deskId = "priced-in-capital",
): Promise<DeskInboxItem[]> {
  const root = await inboxRoot(deskId);
  const files = await readdir(root, { withFileTypes: true }).catch(() => []);
  const items = await Promise.all(
    files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const id = entry.name.replace(/\.md$/, "");
        const raw = await readFile(join(root, entry.name), "utf8");
        return decodeInboxItem(raw, id);
      }),
  );
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createMemoDraft(
  input: MemoDraftInput,
): Promise<DeskInboxItem> {
  const deskId = sanitizeDeskId(input.deskId || "priced-in-capital");
  const id = `memo-${Date.now()}-${hash(input.title).slice(0, 8)}`;
  const item = draftFromInput({ ...input, deskId }, id);
  const root = await inboxRoot(deskId);
  await writeFile(join(root, memoFilename(id)), encodeInboxItem(item), "utf8");
  return item;
}

export async function approveInboxItem(
  decision: InboxDecision,
  deskId = "priced-in-capital",
): Promise<DeskInboxItem | null> {
  const current = await readInboxItem(decision.id, deskId);
  if (!current) return null;
  const updated = touch({ ...current, status: "approved" });
  const root = await inboxRoot(deskId);
  const approvedRoot = await approvedMemoRoot(deskId);
  await writeFile(join(root, memoFilename(updated.id)), encodeInboxItem(updated), "utf8");
  await writeFile(join(approvedRoot, memoFilename(updated.id)), encodeInboxItem(updated), "utf8");
  return updated;
}

export async function requestInboxChanges(
  decision: InboxDecision,
  deskId = "priced-in-capital",
): Promise<DeskInboxItem | null> {
  const current = await readInboxItem(decision.id, deskId);
  if (!current) return null;
  const note = decision.note?.trim();
  const body = note ? `${current.body}\n\n## Requested Changes\n${note}` : current.body;
  return writeUpdatedItem({ ...current, status: "changes_requested", body }, deskId);
}

export async function dismissInboxItem(
  decision: InboxDecision,
  deskId = "priced-in-capital",
): Promise<DeskInboxItem | null> {
  const current = await readInboxItem(decision.id, deskId);
  if (!current) return null;
  return writeUpdatedItem({ ...current, status: "dismissed" }, deskId);
}

export async function hasMemoForSourceRefs(
  sourceRefs: string[],
  deskId = "priced-in-capital",
): Promise<boolean> {
  if (sourceRefs.length === 0) return false;
  const refSet = new Set(sourceRefs);
  const items = await listInboxItems(deskId);
  return items.some((item) => item.sourceRefs.some((ref) => refSet.has(ref)));
}

async function readInboxItem(
  id: string,
  deskId: string,
): Promise<DeskInboxItem | null> {
  const root = await inboxRoot(deskId);
  const raw = await readFile(join(root, memoFilename(id)), "utf8").catch(() => null);
  if (!raw) return null;
  return decodeInboxItem(raw, id);
}

async function writeUpdatedItem(
  item: DeskInboxItem,
  deskId: string,
): Promise<DeskInboxItem> {
  const updated = touch(item);
  const root = await inboxRoot(deskId);
  await writeFile(join(root, memoFilename(updated.id)), encodeInboxItem(updated), "utf8");
  return updated;
}

function touch(item: DeskInboxItem): DeskInboxItem {
  return { ...item, updatedAt: new Date().toISOString() };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
