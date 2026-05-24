import { readdir, readFile, stat } from "node:fs/promises";
import { basename, extname, join, relative } from "node:path";
import {
  DEFAULT_DESK_ID,
  DEFAULT_DESK_NAME,
  SECTION_COPY,
  SECTION_FOLDERS,
  deskRoot,
  ensureDeskFolders,
  fileRoomRoot,
  sectionRoot,
  sanitizeDeskId,
} from "./paths.js";
import {
  boundedExcerpt,
  parseMarkdown,
  splitList,
  summarizeMarkdown,
} from "./markdown.js";
import { readSoulDetail, readSoulItems } from "./soul-reader.js";
import type {
  FileRoomIndex,
  FileRoomItem,
  FileRoomItemDetail,
  FileRoomSection,
  FileRoomSectionId,
} from "./types.js";

const FILE_CAP = 80;
const FILE_EXTENSIONS = new Set([".md", ".pdf", ".url", ".webloc", ".json"]);

export async function listFileRoom(deskId = DEFAULT_DESK_ID): Promise<FileRoomIndex> {
  const safeDeskId = sanitizeDeskId(deskId);
  await ensureDeskFolders(safeDeskId);
  const sections = await Promise.all(
    (Object.keys(SECTION_FOLDERS) as FileRoomSectionId[]).map((sectionId) =>
      readSection(safeDeskId, sectionId),
    ),
  );
  return {
    desk: { id: safeDeskId, name: DEFAULT_DESK_NAME },
    root: fileRoomRoot(),
    sections,
  };
}

export async function readFileRoomItem(
  itemId: string,
  deskId = DEFAULT_DESK_ID,
): Promise<FileRoomItemDetail | null> {
  const safeDeskId = sanitizeDeskId(deskId);
  if (itemId.startsWith("agent-souls:")) return readSoulDetail(safeDeskId, itemId);
  const index = await listFileRoom(safeDeskId);
  const item = index.sections.flatMap((section) => section.items).find((entry) => entry.id === itemId);
  if (!item) return null;
  const raw = await readFile(join(deskRoot(safeDeskId), item.path), "utf8").catch(() => "");
  return { ...item, content: raw };
}

async function readSection(
  deskId: string,
  sectionId: FileRoomSectionId,
): Promise<FileRoomSection> {
  if (sectionId === "agent-souls") {
    return buildSection(sectionId, await readSoulItems(deskId));
  }
  const root = sectionRoot(deskId, sectionId);
  const files = await collectFiles(root);
  const items = await Promise.all(
    files.slice(0, FILE_CAP).map((path) => readItem(deskId, sectionId, path)),
  );
  return buildSection(sectionId, items.filter(Boolean) as FileRoomItem[]);
}

function buildSection(
  sectionId: FileRoomSectionId,
  items: FileRoomItem[],
): FileRoomSection {
  return {
    id: sectionId,
    title: SECTION_FOLDERS[sectionId],
    description: SECTION_COPY[sectionId],
    items: items.sort(sortItems),
  };
}

async function readItem(
  deskId: string,
  sectionId: FileRoomSectionId,
  path: string,
): Promise<FileRoomItem | null> {
  const meta = await stat(path).catch(() => null);
  if (!meta?.isFile()) return null;
  const ext = extname(path).toLowerCase();
  const raw = ext === ".md" || ext === ".url" || ext === ".json"
    ? await readFile(path, "utf8").catch(() => "")
    : "";
  const parsed = parseMarkdown(raw);
  const rel = relative(deskRoot(deskId), path);
  return {
    id: `${sectionId}:${Buffer.from(rel).toString("base64url")}`,
    sectionId,
    deskId,
    title: parsed.frontmatter.title || basename(path, ext),
    kind: inferKind(ext, sectionId, raw),
    path: rel,
    summary: parsed.frontmatter.summary || summarizeMarkdown(parsed.body || raw),
    excerpt: ext === ".md" ? boundedExcerpt(parsed.body) : boundedExcerpt(raw || basename(path)),
    tags: splitList(parsed.frontmatter.tags),
    tickers: splitList(parsed.frontmatter.tickers),
    sourceRefs: splitList(parsed.frontmatter.sourceRefs),
    createdAt: parsed.frontmatter.createdAt || meta.birthtime.toISOString(),
    updatedAt: parsed.frontmatter.updatedAt || meta.mtime.toISOString(),
  };
}

async function collectFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const out: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (entry.name === "Inbox") continue;
    const full = join(root, entry.name);
    if (entry.isDirectory()) out.push(...(await collectFiles(full)));
    if (entry.isFile() && FILE_EXTENSIONS.has(extname(entry.name).toLowerCase())) out.push(full);
  }
  return out;
}

function inferKind(ext: string, sectionId: FileRoomSectionId, raw: string): FileRoomItem["kind"] {
  if (sectionId === "chart-evidence") return "chart";
  if (ext === ".pdf") return "pdf";
  if (raw.includes("notion.so") || raw.includes("notion.site")) return "notion";
  if (ext === ".url" || ext === ".webloc") return "url";
  if (ext === ".md") return "markdown";
  return "unknown";
}

function sortItems(a: FileRoomItem, b: FileRoomItem): number {
  const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
  const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
  return bTime - aTime || a.title.localeCompare(b.title);
}
