const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

export interface FileRoomDesk {
  id: string;
  name: string;
}

export interface FileRoomItem {
  id: string;
  sectionId: string;
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
  id: string;
  title: string;
  description: string;
  items: FileRoomItem[];
}

export interface FileRoomIndex {
  desk: FileRoomDesk;
  root: string;
  sections: FileRoomSection[];
}

export async function fetchFileRoom(deskId?: string): Promise<FileRoomIndex> {
  const params = deskId ? `?deskId=${encodeURIComponent(deskId)}` : "";
  const response = await fetch(`${API_BASE}/api/file-room${params}`);
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `File Room ${response.status}`);
  if (!data?.fileRoom) throw new Error("Empty file room response.");
  return data.fileRoom as FileRoomIndex;
}
