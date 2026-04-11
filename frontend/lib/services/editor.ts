/**
 * Document, Research, and Bulletin Services
 */

import ApiClient from "../apiClient";

// Document types (S12-T2: TipTap editor)
export interface DocumentRecord {
  id: string;
  title: string;
  content: Record<string, unknown>;
  authorId: string;
  deskId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export class DocumentService {
  constructor(private client: ApiClient) {}

  async createDocument(data: {
    title: string;
    deskId?: string;
    tags?: string[];
  }): Promise<{ document: DocumentRecord }> {
    return this.client.post("/api/documents", data);
  }

  async listDocuments(params?: {
    search?: string;
    tags?: string[];
    deskId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ documents: DocumentRecord[] }> {
    const query = new URLSearchParams();
    if (params?.search) query.set("search", params.search);
    if (params?.tags?.length) query.set("tags", params.tags.join(","));
    if (params?.deskId) query.set("deskId", params.deskId);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return this.client.get(`/api/documents${qs ? "?" + qs : ""}`);
  }

  async getDocument(id: string): Promise<{ document: DocumentRecord }> {
    return this.client.get(`/api/documents/${id}`);
  }

  async updateDocument(
    id: string,
    data: {
      title?: string;
      content?: Record<string, unknown>;
      tags?: string[];
    },
  ): Promise<{ document: DocumentRecord }> {
    return this.client.put(`/api/documents/${id}`, data);
  }

  async deleteDocument(id: string): Promise<{ ok: boolean }> {
    return this.client.delete(`/api/documents/${id}`);
  }
}

// Research task types
export interface ResearchTask {
  id: string;
  title: string;
  narrative: string | null;
  assignedTo: string | null;
  assignedAgent: string | null;
  deskId: string | null;
  status: "pending" | "active" | "deep-dive" | "complete";
  findings: Record<string, unknown> | null;
  dueDate: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ResearchTaskInput {
  title: string;
  narrative?: string | null;
  assignedTo?: string | null;
  assignedAgent?: string | null;
  deskId?: string | null;
  dueDate?: string | null;
  createdBy: string;
}

export class ResearchService {
  constructor(private client: ApiClient) {}

  async createTask(data: ResearchTaskInput): Promise<{ task: ResearchTask }> {
    return this.client.post("/api/research/tasks", data);
  }

  async listTasks(params?: {
    deskId?: string;
    status?: string;
    assignedTo?: string;
  }): Promise<{ tasks: ResearchTask[] }> {
    const query = new URLSearchParams();
    if (params?.deskId) query.set("deskId", params.deskId);
    if (params?.status) query.set("status", params.status);
    if (params?.assignedTo) query.set("assignedTo", params.assignedTo);
    const qs = query.toString();
    return this.client.get(`/api/research/tasks${qs ? "?" + qs : ""}`);
  }

  async getTask(id: string): Promise<{ task: ResearchTask }> {
    return this.client.get(`/api/research/tasks/${id}`);
  }

  async updateTask(
    id: string,
    data: { status?: string; findings?: Record<string, unknown> },
  ): Promise<{ task: ResearchTask }> {
    return this.client.put(`/api/research/tasks/${id}`, data);
  }

  async assignTask(
    id: string,
    userId: string,
    agentName?: string,
  ): Promise<{ task: ResearchTask }> {
    return this.client.post(`/api/research/tasks/${id}/assign`, {
      userId,
      agentName,
    });
  }

  async deleteTask(id: string): Promise<{ ok: boolean }> {
    return this.client.delete(`/api/research/tasks/${id}`);
  }
}

// Bulletin Service (S12-T1)
export class BulletinService {
  constructor(private client: ApiClient) {}

  async createPost(data: {
    content: string;
    authorAgent?: string;
    deskId?: string;
    contentParts?: unknown[];
    parentId?: string;
  }): Promise<{ post: any }> {
    return this.client.post("/api/bulletin", data);
  }

  async listPosts(params?: {
    deskId?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ posts: any[] }> {
    const query = new URLSearchParams();
    if (params?.deskId) query.set("deskId", params.deskId);
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    const qs = query.toString();
    return this.client.get(`/api/bulletin${qs ? "?" + qs : ""}`);
  }

  async getPost(id: string): Promise<{ post: any }> {
    return this.client.get(`/api/bulletin/${id}`);
  }

  async getPostReplies(id: string): Promise<{ replies: any[] }> {
    return this.client.get(`/api/bulletin/${id}/replies`);
  }

  async deletePost(id: string): Promise<{ ok: boolean }> {
    return this.client.delete(`/api/bulletin/${id}`);
  }

  async castVote(bulletinId: string, voteType: string): Promise<{ vote: any }> {
    return this.client.post(`/api/bulletin/${bulletinId}/vote`, { voteType });
  }

  async getVotes(bulletinId: string): Promise<{ votes: any[] }> {
    return this.client.get(`/api/bulletin/${bulletinId}/votes`);
  }
}

// Sticky Bulletin types
export interface StickyBulletinData {
  tradingNotes: string;
  eventOfWeek: string;
  antilagTimes: Array<{
    time: string;
    dayOfWeek: number;
    instrument: string;
    notes: string;
    createdAt: string;
  }>;
  updatedAt: string;
}

export interface AntilagAggregate {
  time: string;
  dayOfWeek: number;
  count: number;
  instruments: string[];
}

export class StickyBulletinService {
  constructor(private client: ApiClient) {}

  async get(): Promise<{ data: StickyBulletinData }> {
    return this.client.get("/api/sticky-bulletin");
  }

  async save(data: {
    tradingNotes?: string;
    eventOfWeek?: string;
  }): Promise<{ ok: boolean }> {
    return this.client.put("/api/sticky-bulletin", data);
  }

  async addAntilagTime(entry: {
    time: string;
    dayOfWeek: number;
    instrument: string;
    notes: string;
  }): Promise<{ ok: boolean }> {
    return this.client.post("/api/sticky-bulletin/antilag", entry);
  }

  async getAntilagAggregates(): Promise<{ aggregates: AntilagAggregate[] }> {
    return this.client.get("/api/sticky-bulletin/antilag/aggregates");
  }
}
