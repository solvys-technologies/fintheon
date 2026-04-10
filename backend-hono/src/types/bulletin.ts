// [claude-code 2026-03-31] S12-T1: Bulletin board types for peer voting system
import type { ContentPart } from "./boardroom-db.js";

export type VoteType = "up" | "down" | "check" | "x";

export interface BulletinPost {
  id: string;
  authorId: string;
  authorAgent: string | null;
  deskId: string | null;
  content: string;
  contentParts: ContentPart[] | null;
  parentId: string | null;
  voteUp: number;
  voteDown: number;
  voteCheck: number;
  voteX: number;
  promotedToProposal: boolean;
  createdAt: string;
}

export interface BulletinVote {
  id: string;
  bulletinId: string;
  userId: string;
  voteType: VoteType;
  createdAt: string;
}

export interface BulletinPostInput {
  authorId: string;
  authorAgent?: string | null;
  deskId?: string | null;
  content: string;
  contentParts?: ContentPart[] | null;
  parentId?: string | null;
}
