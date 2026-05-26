import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { FileRoomItem } from "./types.js";
import { sectionRoot } from "./paths.js";
import {
  boundedExcerpt,
  parseMarkdown,
  summarizeMarkdown,
} from "./markdown.js";

const SOUL_DIR = join(dirname(fileURLToPath(import.meta.url)), "../ai/soul");
const AGENT_DIR_TO_ID: Record<string, string> = {
  Harper: "harper",
  Oracle: "oracle",
  Feucht: "feucht",
  Consul: "consul",
  Herald: "herald",
};

export async function readSoulItems(deskId: string): Promise<FileRoomItem[]> {
  const files = await soulFiles(deskId);

  return Promise.all(
    files.map(async (path) => {
      const raw = await readFile(path, "utf8").catch(() => "");
      const meta = await stat(path).catch(() => null);
      const parsed = parseMarkdown(raw);
      const agentId = agentIdFromPath(path);
      const title = parsed.frontmatter.name || agentId;
      return {
        id: `agent-souls:${agentId}`,
        sectionId: "agent-souls",
        deskId,
        title,
        kind: "soul",
        path: relative(process.cwd(), path),
        summary: parsed.frontmatter.role || summarizeMarkdown(parsed.body),
        excerpt: boundedExcerpt(parsed.body),
        tags: ["agent-soul", agentId],
        tickers: [],
        sourceRefs: [],
        createdAt: meta?.birthtime.toISOString() ?? null,
        updatedAt: meta?.mtime.toISOString() ?? null,
      } satisfies FileRoomItem;
    }),
  );
}

export async function readSoulDetail(
  deskId: string,
  itemId: string,
): Promise<(FileRoomItem & { content: string }) | null> {
  const agentId = itemId.replace(/^agent-souls:/, "");
  const path = soulPath(deskId, agentId);
  const raw = await readFile(path, "utf8").catch(() => null);
  if (!raw) return null;
  const [item] = (await readSoulItems(deskId)).filter(
    (entry) => entry.id === itemId,
  );
  if (!item) return null;
  return { ...item, content: raw };
}

async function soulFiles(deskId: string): Promise<string[]> {
  const root = sectionRoot(deskId, "agent-souls");
  if (existsSync(root)) {
    const entries = await readdir(root, { withFileTypes: true }).catch(
      () => [],
    );
    const files = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, entry.name, "SOUL.md"))
      .filter((path) => existsSync(path));
    if (files.length > 0) return files;
  }

  const entries = await readdir(SOUL_DIR, { withFileTypes: true }).catch(
    () => [],
  );
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(SOUL_DIR, entry.name));
}

function soulPath(deskId: string, agentId: string): string {
  const root = sectionRoot(deskId, "agent-souls");
  const dir = Object.entries(AGENT_DIR_TO_ID).find(([, id]) => id === agentId);
  const fileroomPath = dir ? join(root, dir[0], "SOUL.md") : "";
  return fileroomPath && existsSync(fileroomPath)
    ? fileroomPath
    : join(SOUL_DIR, `${agentId}.md`);
}

function agentIdFromPath(path: string): string {
  const fileName = path.split("/").pop() ?? "";
  if (fileName !== "SOUL.md") return fileName.replace(/\.md$/, "");
  const dirName = path.split("/").at(-2) ?? "agent";
  return AGENT_DIR_TO_ID[dirName] ?? dirName.toLowerCase();
}
