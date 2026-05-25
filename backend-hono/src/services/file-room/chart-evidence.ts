import { writeFile, readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { sanitizeDeskId, sectionRoot, ensureDeskFolders } from "./paths.js";
import { parseMarkdown, stringifyMarkdown } from "./markdown.js";

export interface ChartEvidenceRequest {
  deskId?: string;
  title: string;
  symbol: string;
  timeframe?: string;
  sourceUrl?: string;
  memoId?: string;
}

export interface ChartEvidenceItem extends ChartEvidenceRequest {
  id: string;
  deskId: string;
  status: "pending_capture" | "captured";
  createdAt: string;
  updatedAt: string;
}

export async function createChartEvidenceRequest(
  input: ChartEvidenceRequest,
): Promise<ChartEvidenceItem> {
  const deskId = sanitizeDeskId(input.deskId || "priced-in-capital");
  await ensureDeskFolders(deskId);
  const id = `chart-${Date.now()}-${hash(input.symbol).slice(0, 8)}`;
  const now = new Date().toISOString();
  const item: ChartEvidenceItem = {
    ...input,
    id,
    deskId,
    status: "pending_capture",
    createdAt: now,
    updatedAt: now,
  };
  const body = [
    `# ${input.title}`,
    "",
    `Symbol: ${input.symbol}`,
    `Timeframe: ${input.timeframe || "unspecified"}`,
    input.sourceUrl ? `Source: ${input.sourceUrl}` : "",
    "",
    "Capture status: pending_capture",
  ]
    .filter(Boolean)
    .join("\n");
  await writeFile(
    join(sectionRoot(deskId, "chart-evidence"), `${id}.md`),
    stringifyMarkdown(
      {
        id,
        title: input.title,
        status: item.status,
        symbol: input.symbol,
        timeframe: input.timeframe || null,
        sourceUrl: input.sourceUrl || null,
        memoId: input.memoId || null,
        createdAt: now,
        updatedAt: now,
      },
      body,
    ),
    "utf8",
  );
  return item;
}

export async function listChartEvidenceRequests(
  deskId = "priced-in-capital",
): Promise<ChartEvidenceItem[]> {
  const root = sectionRoot(sanitizeDeskId(deskId), "chart-evidence");
  const files = await readdir(root, { withFileTypes: true }).catch(() => []);
  const items = await Promise.all(
    files
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map(async (entry) => {
        const raw = await readFile(join(root, entry.name), "utf8");
        const parsed = parseMarkdown(raw);
        return {
          id: parsed.frontmatter.id || entry.name.replace(/\.md$/, ""),
          deskId,
          title: parsed.frontmatter.title || "Chart evidence",
          symbol: parsed.frontmatter.symbol || "",
          timeframe: parsed.frontmatter.timeframe,
          sourceUrl: parsed.frontmatter.sourceUrl,
          memoId: parsed.frontmatter.memoId,
          status:
            parsed.frontmatter.status === "captured" ? "captured" : "pending_capture",
          createdAt: parsed.frontmatter.createdAt || "",
          updatedAt: parsed.frontmatter.updatedAt || "",
        } satisfies ChartEvidenceItem;
      }),
  );
  return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
