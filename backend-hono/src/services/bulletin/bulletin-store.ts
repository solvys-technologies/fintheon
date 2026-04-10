// [claude-code 2026-03-31] S12-T1: Bulletin board store — DB + in-memory fallback
import { sql, isDatabaseAvailable } from "../../config/database.js";
import type { BulletinPost, BulletinPostInput } from "../../types/bulletin.js";

const MEMORY_CAP = 500;
const memoryPosts = new Map<string, BulletinPost>();

function mapRowToPost(row: Record<string, unknown>): BulletinPost {
  return {
    id: String(row.id),
    authorId: String(row.author_id),
    authorAgent: (row.author_agent as string) ?? null,
    deskId: (row.desk_id as string) ?? null,
    content: String(row.content),
    contentParts: (row.content_parts as BulletinPost["contentParts"]) ?? null,
    parentId: (row.parent_id as string) ?? null,
    voteUp: Number(row.vote_up ?? 0),
    voteDown: Number(row.vote_down ?? 0),
    voteCheck: Number(row.vote_check ?? 0),
    voteX: Number(row.vote_x ?? 0),
    promotedToProposal: Boolean(row.promoted_to_proposal),
    createdAt: String(row.created_at),
  };
}

export async function createPost(
  input: BulletinPostInput,
): Promise<BulletinPost> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  if (isDatabaseAvailable()) {
    const result = await sql`
      INSERT INTO peer_bulletin (
        id, author_id, author_agent, desk_id, content, content_parts, parent_id
      ) VALUES (
        ${id},
        ${input.authorId},
        ${input.authorAgent ?? null},
        ${input.deskId ?? null},
        ${input.content},
        ${input.contentParts ? JSON.stringify(input.contentParts) : null}::jsonb,
        ${input.parentId ?? null}
      )
      RETURNING *
    `;
    return mapRowToPost(result[0]);
  }

  const post: BulletinPost = {
    id,
    authorId: input.authorId,
    authorAgent: input.authorAgent ?? null,
    deskId: input.deskId ?? null,
    content: input.content,
    contentParts: input.contentParts ?? null,
    parentId: input.parentId ?? null,
    voteUp: 0,
    voteDown: 0,
    voteCheck: 0,
    voteX: 0,
    promotedToProposal: false,
    createdAt: now,
  };
  memoryPosts.set(id, post);
  if (memoryPosts.size > MEMORY_CAP) {
    const oldest = memoryPosts.keys().next().value;
    if (oldest) memoryPosts.delete(oldest);
  }
  return post;
}

export async function listPosts(filter?: {
  deskId?: string;
  limit?: number;
  offset?: number;
}): Promise<BulletinPost[]> {
  const limit = filter?.limit ?? 50;
  const offset = filter?.offset ?? 0;

  if (isDatabaseAvailable()) {
    if (filter?.deskId) {
      const result = await sql`
        SELECT * FROM peer_bulletin
        WHERE parent_id IS NULL AND desk_id = ${filter.deskId}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      return result.map(mapRowToPost);
    }
    const result = await sql`
      SELECT * FROM peer_bulletin
      WHERE parent_id IS NULL
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    return result.map(mapRowToPost);
  }

  let posts = Array.from(memoryPosts.values()).filter((p) => !p.parentId);
  if (filter?.deskId) posts = posts.filter((p) => p.deskId === filter.deskId);
  return posts
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
    .slice(offset, offset + limit);
}

export async function getPost(id: string): Promise<BulletinPost | null> {
  if (isDatabaseAvailable()) {
    const result = await sql`SELECT * FROM peer_bulletin WHERE id = ${id}`;
    if (result.length === 0) return null;
    return mapRowToPost(result[0]);
  }
  return memoryPosts.get(id) ?? null;
}

export async function getPostReplies(
  parentId: string,
): Promise<BulletinPost[]> {
  if (isDatabaseAvailable()) {
    const result = await sql`
      SELECT * FROM peer_bulletin
      WHERE parent_id = ${parentId}
      ORDER BY created_at ASC
    `;
    return result.map(mapRowToPost);
  }

  return Array.from(memoryPosts.values())
    .filter((p) => p.parentId === parentId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
}

export async function deletePost(id: string, userId: string): Promise<boolean> {
  if (isDatabaseAvailable()) {
    const result = await sql`
      DELETE FROM peer_bulletin
      WHERE id = ${id} AND author_id = ${userId}
      RETURNING id
    `;
    return result.length > 0;
  }

  const post = memoryPosts.get(id);
  if (!post || post.authorId !== userId) return false;
  memoryPosts.delete(id);
  return true;
}
