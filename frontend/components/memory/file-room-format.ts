import type {
  FileRoomItem,
  FileRoomItemDetail,
} from "../../lib/services/file-room";

const FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---\n?/;

export function cleanDocumentContent(item: FileRoomItemDetail): string {
  if (item.kind === "pdf") {
    return `# ${item.title}\n\nPDF artifact stored at \`${item.path}\`.`;
  }
  const content = (item.content || item.excerpt || "").replace(
    FRONTMATTER_PATTERN,
    "",
  );
  if (content.trim()) return content.trim();
  return `# ${item.title}\n\n${item.summary || "No readable text available."}`;
}

export function formatSectionMeta(count: number, description: string): string {
  const noun = count === 1 ? "document" : "documents";
  return `${count} ${noun} · ${description}`;
}

export function formatItemMeta(item: FileRoomItem): string {
  const date = formatDate(item.updatedAt);
  const tickers = item.tickers.length ? ` · ${item.tickers.join(", ")}` : "";
  return `${item.kind}${tickers} · ${date}`;
}

export function sectionLabel(id: string): string {
  if (id === "agentic-memos") return "Memo";
  if (id === "weekly-tribune") return "Tribune";
  if (id === "narrative-summaries") return "Narrative";
  if (id === "chart-evidence") return "Chart";
  if (id === "agent-souls") return "SOUL";
  return "File";
}

function formatDate(value: string | null): string {
  if (!value) return "undated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "undated";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
