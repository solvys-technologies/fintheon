import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import type { FileRoomItem } from "./types.js";
import {
  boundedExcerpt,
  parseMarkdown,
  summarizeMarkdown,
} from "./markdown.js";

const SOUL_DIR = join(dirname(fileURLToPath(import.meta.url)), "../ai/soul");

export async function readSoulItems(deskId: string): Promise<FileRoomItem[]> {
  const entries = await readdir(SOUL_DIR, { withFileTypes: true }).catch(
    () => [],
  );
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => join(SOUL_DIR, entry.name));

  return Promise.all(
    files.map(async (path) => {
      const raw = await readFile(path, "utf8").catch(() => "");
      const meta = await stat(path).catch(() => null);
      const parsed = parseMarkdown(raw);
      const agentId = path.split("/").pop()?.replace(/\.md$/, "") ?? "agent";
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
  const path = join(SOUL_DIR, `${agentId}.md`);
  const raw = await readFile(path, "utf8").catch(() => null);
  if (!raw) return null;
  const [item] = (await readSoulItems(deskId)).filter(
    (entry) => entry.id === itemId,
  );
  if (!item) return null;
  return { ...item, content: raw };
}
