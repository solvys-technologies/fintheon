// [claude-code 2026-03-11] Track 7A: Trading journal service — human psych + agent performance persistence
import { isPoolAvailable, query } from "../db/optimized.js";

export interface JournalEntry {
  id: number;
  userId: string;
  type: "human" | "agent";
  date: string;
  // Human psych fields
  erTrend?: number[];
  infractions?: string[];
  disciplineScore?: number;
  notes?: string;
  // Agent performance fields
  agentName?: string;
  proposalCount?: number;
  acceptedCount?: number;
  winRate?: number;
  avgRR?: number;
  totalPnl?: number;
  proposals?: AgentProposal[];
  createdAt: string;
  updatedAt: string;
}

export interface AgentProposal {
  id: string;
  agent: string;
  ticker: string;
  direction: "long" | "short";
  entry?: number;
  target?: number;
  stopLoss?: number;
  status: "proposed" | "accepted" | "rejected" | "expired";
  outcome?: "win" | "loss" | "breakeven" | null;
  pnl?: number;
  createdAt: string;
}

export interface CreateJournalEntryInput {
  type: "human" | "agent";
  date: string;
  erTrend?: number[];
  infractions?: string[];
  disciplineScore?: number;
  notes?: string;
  agentName?: string;
  proposalCount?: number;
  acceptedCount?: number;
  winRate?: number;
  avgRR?: number;
  totalPnl?: number;
  proposals?: AgentProposal[];
}

export interface JournalSummary {
  totalEntries: number;
  avgDisciplineScore: number;
  totalInfractions: number;
  avgWinRate: number;
  avgRR: number;
  totalAgentPnl: number;
  streakDays: number;
}

// In-memory store for dev
const isDev = process.env.NODE_ENV !== "production";
const memoryEntries: JournalEntry[] = [];
let memoryEntryId = 1;

export async function saveJournalEntry(
  userId: string,
  input: CreateJournalEntryInput,
): Promise<{ entryId: number }> {
  const now = new Date().toISOString();

  if (!isPoolAvailable()) {
    if (!isDev) throw new Error("Database unavailable for journal persistence");

    const entryId = memoryEntryId++;
    memoryEntries.push({
      id: entryId,
      userId,
      ...input,
      createdAt: now,
      updatedAt: now,
    });
    return { entryId };
  }

  const result = await query<{ id: number }>(
    `INSERT INTO journal_entries (
      user_id, type, date, er_trend, infractions, discipline_score, notes,
      agent_name, proposal_count, accepted_count, win_rate, avg_rr, total_pnl, proposals
    ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
    ON CONFLICT (user_id, type, date) DO UPDATE SET
      er_trend = EXCLUDED.er_trend,
      infractions = EXCLUDED.infractions,
      discipline_score = EXCLUDED.discipline_score,
      notes = EXCLUDED.notes,
      agent_name = EXCLUDED.agent_name,
      proposal_count = EXCLUDED.proposal_count,
      accepted_count = EXCLUDED.accepted_count,
      win_rate = EXCLUDED.win_rate,
      avg_rr = EXCLUDED.avg_rr,
      total_pnl = EXCLUDED.total_pnl,
      proposals = EXCLUDED.proposals,
      updated_at = NOW()
    RETURNING id`,
    [
      userId,
      input.type,
      input.date,
      input.erTrend ? JSON.stringify(input.erTrend) : null,
      input.infractions ? JSON.stringify(input.infractions) : null,
      input.disciplineScore ?? null,
      input.notes ?? null,
      input.agentName ?? null,
      input.proposalCount ?? null,
      input.acceptedCount ?? null,
      input.winRate ?? null,
      input.avgRR ?? null,
      input.totalPnl ?? null,
      input.proposals ? JSON.stringify(input.proposals) : null,
    ],
  );

  return { entryId: result.rows[0].id };
}

export async function listJournalEntries(
  userId: string,
  options?: {
    type?: "human" | "agent";
    limit?: number;
    offset?: number;
    from?: string;
    to?: string;
  },
): Promise<{ entries: JournalEntry[]; total: number }> {
  const limit = Math.max(1, Math.min(100, options?.limit ?? 30));
  const offset = Math.max(0, options?.offset ?? 0);

  if (!isPoolAvailable()) {
    let filtered = memoryEntries.filter((e) => e.userId === userId);
    if (options?.type)
      filtered = filtered.filter((e) => e.type === options.type);
    if (options?.from)
      filtered = filtered.filter((e) => e.date >= options.from!);
    if (options?.to) filtered = filtered.filter((e) => e.date <= options.to!);
    filtered.sort((a, b) => b.date.localeCompare(a.date));
    return {
      entries: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }

  const conditions = ["user_id = $1"];
  const params: unknown[] = [userId];
  let paramIdx = 2;

  if (options?.type) {
    conditions.push(`type = $${paramIdx++}`);
    params.push(options.type);
  }
  if (options?.from) {
    conditions.push(`date >= $${paramIdx++}`);
    params.push(options.from);
  }
  if (options?.to) {
    conditions.push(`date <= $${paramIdx++}`);
    params.push(options.to);
  }

  const where = conditions.join(" AND ");

  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM journal_entries WHERE ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0]?.count ?? "0", 10);

  params.push(limit, offset);
  const result = await query<Record<string, unknown>>(
    `SELECT * FROM journal_entries WHERE ${where} ORDER BY date DESC LIMIT $${paramIdx++} OFFSET $${paramIdx}`,
    params,
  );

  const entries: JournalEntry[] = result.rows.map((row) => ({
    id: row.id as number,
    userId: row.user_id as string,
    type: row.type as "human" | "agent",
    date: row.date as string,
    erTrend: row.er_trend
      ? ((typeof row.er_trend === "string"
          ? JSON.parse(row.er_trend)
          : row.er_trend) as number[])
      : undefined,
    infractions: row.infractions
      ? ((typeof row.infractions === "string"
          ? JSON.parse(row.infractions)
          : row.infractions) as string[])
      : undefined,
    disciplineScore: row.discipline_score as number | undefined,
    notes: row.notes as string | undefined,
    agentName: row.agent_name as string | undefined,
    proposalCount: row.proposal_count as number | undefined,
    acceptedCount: row.accepted_count as number | undefined,
    winRate: row.win_rate as number | undefined,
    avgRR: row.avg_rr as number | undefined,
    totalPnl: row.total_pnl as number | undefined,
    proposals: row.proposals
      ? ((typeof row.proposals === "string"
          ? JSON.parse(row.proposals)
          : row.proposals) as AgentProposal[])
      : undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));

  return { entries, total };
}

export async function getJournalSummary(
  userId: string,
  options?: { days?: number },
): Promise<JournalSummary> {
  const days = options?.days ?? 30;
  const since = new Date(Date.now() - days * 86400000)
    .toISOString()
    .split("T")[0];

  if (!isPoolAvailable()) {
    const filtered = memoryEntries.filter(
      (e) => e.userId === userId && e.date >= since,
    );
    const human = filtered.filter((e) => e.type === "human");
    const agent = filtered.filter((e) => e.type === "agent");

    const avgDiscipline =
      human.length > 0
        ? human.reduce((s, e) => s + (e.disciplineScore ?? 0), 0) / human.length
        : 0;
    const totalInf = human.reduce(
      (s, e) => s + (e.infractions?.length ?? 0),
      0,
    );
    const avgWin =
      agent.length > 0
        ? agent.reduce((s, e) => s + (e.winRate ?? 0), 0) / agent.length
        : 0;
    const avgRR =
      agent.length > 0
        ? agent.reduce((s, e) => s + (e.avgRR ?? 0), 0) / agent.length
        : 0;
    const totalPnl = agent.reduce((s, e) => s + (e.totalPnl ?? 0), 0);

    // Streak: count consecutive days with entries
    const dates = [...new Set(filtered.map((e) => e.date))].sort().reverse();
    let streak = 0;
    const today = new Date().toISOString().split("T")[0];
    let checkDate = today;
    for (const d of dates) {
      if (d === checkDate) {
        streak++;
        const prev = new Date(checkDate);
        prev.setDate(prev.getDate() - 1);
        checkDate = prev.toISOString().split("T")[0];
      } else {
        break;
      }
    }

    return {
      totalEntries: filtered.length,
      avgDisciplineScore: Math.round(avgDiscipline * 10) / 10,
      totalInfractions: totalInf,
      avgWinRate: Math.round(avgWin * 10) / 10,
      avgRR: Math.round(avgRR * 100) / 100,
      totalAgentPnl: Math.round(totalPnl * 100) / 100,
      streakDays: streak,
    };
  }

  const result = await query<Record<string, unknown>>(
    `SELECT
      COUNT(*)::int AS total_entries,
      COALESCE(AVG(CASE WHEN type = 'human' THEN discipline_score END), 0) AS avg_discipline,
      COALESCE(SUM(CASE WHEN type = 'human' THEN jsonb_array_length(COALESCE(infractions, '[]'::jsonb)) END), 0)::int AS total_infractions,
      COALESCE(AVG(CASE WHEN type = 'agent' THEN win_rate END), 0) AS avg_win_rate,
      COALESCE(AVG(CASE WHEN type = 'agent' THEN avg_rr END), 0) AS avg_rr,
      COALESCE(SUM(CASE WHEN type = 'agent' THEN total_pnl ELSE 0 END), 0) AS total_pnl
    FROM journal_entries
    WHERE user_id = $1 AND date >= $2`,
    [userId, since],
  );

  const row = result.rows[0] ?? {};

  return {
    totalEntries: Number(row.total_entries ?? 0),
    avgDisciplineScore: Math.round(Number(row.avg_discipline ?? 0) * 10) / 10,
    totalInfractions: Number(row.total_infractions ?? 0),
    avgWinRate: Math.round(Number(row.avg_win_rate ?? 0) * 10) / 10,
    avgRR: Math.round(Number(row.avg_rr ?? 0) * 100) / 100,
    totalAgentPnl: Math.round(Number(row.total_pnl ?? 0) * 100) / 100,
    streakDays: 0, // TODO: compute from DB
  };
}
