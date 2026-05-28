// [Codex 2026-05-27] S102 desk forecasting model section.
export type FileRoomSectionId =
  | "forecasting-models"
  | "weekly-tribune"
  | "agentic-memos"
  | "narrative-tags"
  | "narrative-workspaces"
  | "narrative-summaries"
  | "uploads"
  | "chart-evidence"
  | "agent-souls";

export interface FileRoomDesk {
  id: string;
  name: string;
}

export interface FileRoomItem {
  id: string;
  sectionId: FileRoomSectionId;
  deskId: string;
  title: string;
  kind: "markdown" | "pdf" | "notion" | "url" | "soul" | "chart" | "unknown";
  path: string;
  summary: string;
  excerpt: string;
  tags: string[];
  tickers: string[];
  sourceRefs: string[];
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FileRoomSection {
  id: FileRoomSectionId;
  title: string;
  description: string;
  items: FileRoomItem[];
}

export interface FileRoomIndex {
  desk: FileRoomDesk;
  root: string;
  sections: FileRoomSection[];
}

export interface FileRoomItemDetail extends FileRoomItem {
  content: string;
}
