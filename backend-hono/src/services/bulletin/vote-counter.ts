// [claude-code 2026-03-31] S12-T1: Vote counter — upsert votes + auto-promote to proposal
import { sql, isDatabaseAvailable } from '../../config/database.js'
import type { BulletinPost, BulletinVote, VoteType } from '../../types/bulletin.js'
import { getPost } from './bulletin-store.js'

const VOTE_THRESHOLD = parseInt(process.env.BULLETIN_VOTE_THRESHOLD ?? '3', 10)

// In-memory fallback
const memoryVotes = new Map<string, BulletinVote>()

function voteKey(bulletinId: string, userId: string): string {
  return `${bulletinId}:${userId}`
}

function mapRowToVote(row: Record<string, unknown>): BulletinVote {
  return {
    id: String(row.id),
    bulletinId: String(row.bulletin_id),
    userId: String(row.user_id),
    voteType: String(row.vote_type) as VoteType,
    createdAt: String(row.created_at),
  }
}

export async function castVote(
  bulletinId: string,
  userId: string,
  voteType: VoteType,
): Promise<BulletinVote> {
  const id = crypto.randomUUID()
  const now = new Date().toISOString()

  if (isDatabaseAvailable()) {
    // Upsert vote (UNIQUE on bulletin_id + user_id)
    const prev = await sql`
      SELECT vote_type FROM bulletin_votes
      WHERE bulletin_id = ${bulletinId} AND user_id = ${userId}
    `
    const oldType = prev.length > 0 ? (String(prev[0].vote_type) as VoteType) : null

    if (oldType) {
      // Update existing vote — decrement old, increment new
      await sql`
        UPDATE bulletin_votes
        SET vote_type = ${voteType}, created_at = NOW()
        WHERE bulletin_id = ${bulletinId} AND user_id = ${userId}
      `
      const decCol = `vote_${oldType}` as const
      const incCol = `vote_${voteType}` as const
      if (oldType !== voteType) {
        // Decrement old vote column
        if (oldType === 'up') await sql`UPDATE peer_bulletin SET vote_up = GREATEST(vote_up - 1, 0) WHERE id = ${bulletinId}`
        else if (oldType === 'down') await sql`UPDATE peer_bulletin SET vote_down = GREATEST(vote_down - 1, 0) WHERE id = ${bulletinId}`
        else if (oldType === 'check') await sql`UPDATE peer_bulletin SET vote_check = GREATEST(vote_check - 1, 0) WHERE id = ${bulletinId}`
        else if (oldType === 'x') await sql`UPDATE peer_bulletin SET vote_x = GREATEST(vote_x - 1, 0) WHERE id = ${bulletinId}`
        // Increment new vote column
        if (voteType === 'up') await sql`UPDATE peer_bulletin SET vote_up = vote_up + 1 WHERE id = ${bulletinId}`
        else if (voteType === 'down') await sql`UPDATE peer_bulletin SET vote_down = vote_down + 1 WHERE id = ${bulletinId}`
        else if (voteType === 'check') await sql`UPDATE peer_bulletin SET vote_check = vote_check + 1 WHERE id = ${bulletinId}`
        else if (voteType === 'x') await sql`UPDATE peer_bulletin SET vote_x = vote_x + 1 WHERE id = ${bulletinId}`
      }
    } else {
      // Insert new vote
      await sql`
        INSERT INTO bulletin_votes (id, bulletin_id, user_id, vote_type)
        VALUES (${id}, ${bulletinId}, ${userId}, ${voteType})
      `
      if (voteType === 'up') await sql`UPDATE peer_bulletin SET vote_up = vote_up + 1 WHERE id = ${bulletinId}`
      else if (voteType === 'down') await sql`UPDATE peer_bulletin SET vote_down = vote_down + 1 WHERE id = ${bulletinId}`
      else if (voteType === 'check') await sql`UPDATE peer_bulletin SET vote_check = vote_check + 1 WHERE id = ${bulletinId}`
      else if (voteType === 'x') await sql`UPDATE peer_bulletin SET vote_x = vote_x + 1 WHERE id = ${bulletinId}`
    }

    await checkAndPromote(bulletinId)

    const result = await sql`
      SELECT * FROM bulletin_votes
      WHERE bulletin_id = ${bulletinId} AND user_id = ${userId}
    `
    return mapRowToVote(result[0])
  }

  // In-memory fallback
  const key = voteKey(bulletinId, userId)
  const existing = memoryVotes.get(key)
  const vote: BulletinVote = {
    id: existing?.id ?? id,
    bulletinId,
    userId,
    voteType,
    createdAt: now,
  }
  memoryVotes.set(key, vote)

  // Update in-memory post vote counts (simplified)
  // We'd need access to the memory store — import getPost
  const post = await getPost(bulletinId)
  if (post) {
    if (existing && existing.voteType !== voteType) {
      // Decrement old
      if (existing.voteType === 'up') post.voteUp = Math.max(0, post.voteUp - 1)
      else if (existing.voteType === 'down') post.voteDown = Math.max(0, post.voteDown - 1)
      else if (existing.voteType === 'check') post.voteCheck = Math.max(0, post.voteCheck - 1)
      else if (existing.voteType === 'x') post.voteX = Math.max(0, post.voteX - 1)
    }
    if (!existing || existing.voteType !== voteType) {
      if (voteType === 'up') post.voteUp++
      else if (voteType === 'down') post.voteDown++
      else if (voteType === 'check') post.voteCheck++
      else if (voteType === 'x') post.voteX++
    }
    await checkAndPromote(bulletinId)
  }

  return vote
}

export async function getVotes(bulletinId: string): Promise<BulletinVote[]> {
  if (isDatabaseAvailable()) {
    const result = await sql`
      SELECT * FROM bulletin_votes WHERE bulletin_id = ${bulletinId}
    `
    return result.map(mapRowToVote)
  }

  return Array.from(memoryVotes.values()).filter((v) => v.bulletinId === bulletinId)
}

export async function getUserVote(bulletinId: string, userId: string): Promise<VoteType | null> {
  if (isDatabaseAvailable()) {
    const result = await sql`
      SELECT vote_type FROM bulletin_votes
      WHERE bulletin_id = ${bulletinId} AND user_id = ${userId}
    `
    if (result.length === 0) return null
    return String(result[0].vote_type) as VoteType
  }

  const vote = memoryVotes.get(voteKey(bulletinId, userId))
  return vote?.voteType ?? null
}

export async function checkAndPromote(bulletinId: string): Promise<boolean> {
  const post = await getPost(bulletinId)
  if (!post || post.promotedToProposal) return false
  if (post.voteCheck < VOTE_THRESHOLD) return false

  try {
    const { createProposalFromBulletin } = await import('../autopilot/proposal-service.js')
    const proposal = await createProposalFromBulletin(post, 'system')

    // S13-T2: Fire-and-forget trade plan generation via Computer Use
    const { generateTradePlan, enrichProposalWithTradePlan, isComputerUseAvailable } = await import('../skills/tradingview-trade-plan.js')
    if (isComputerUseAvailable() && proposal.instrument !== 'UNKNOWN') {
      const direction = proposal.direction === 'flat' ? 'long' as const : proposal.direction
      generateTradePlan(proposal.instrument, direction, post.content)
        .then(plan => {
          if (plan) enrichProposalWithTradePlan(proposal.id, plan)
        })
        .catch(err => console.warn('[Bulletin] Trade plan generation failed (non-fatal)', String(err)))
    }

    if (isDatabaseAvailable()) {
      await sql`
        UPDATE peer_bulletin SET promoted_to_proposal = true WHERE id = ${bulletinId}
      `
    } else {
      post.promotedToProposal = true
    }

    console.log(`[Bulletin] Post ${bulletinId} promoted to proposal (${post.voteCheck} check votes)`)
    return true
  } catch (err) {
    console.error('[Bulletin] Promotion failed:', (err as Error).message)
    return false
  }
}
