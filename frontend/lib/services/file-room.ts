import ApiClient from "../apiClient";

export interface FileRoomItem {
  id: string;
  sectionId: string;
  deskId: string;
  title: string;
  kind: string;
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
  desk: { id: string; name: string };
  root: string;
  sections: FileRoomSection[];
}

export interface FileRoomItemDetail extends FileRoomItem {
  content: string;
}

export class FileRoomService {
  constructor(private client: ApiClient) {}

  async list(deskId = "priced-in-capital"): Promise<FileRoomIndex> {
    const json = await this.client.get<{ fileRoom: FileRoomIndex }>(
      `/api/file-room?deskId=${encodeURIComponent(deskId)}`,
    );
    return json.fileRoom;
  }

  async getItem(id: string, deskId = "priced-in-capital"): Promise<FileRoomItemDetail> {
    const params = new URLSearchParams({ id, deskId });
    const json = await this.client.get<{ item: FileRoomItemDetail }>(
      `/api/file-room/item?${params}`,
    );
    return json.item;
  }
}
