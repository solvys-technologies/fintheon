// [claude-code 2026-04-23] S30-T2: SessionJournal — consolidated daily psychology record
// Replaces the three-card session block + Hermes summary + user notes with one row per day.
// All 0.0-10.0 decimal scores (TP-locked); submitted via PUT /api/session-journal.

export interface SessionJournal {
  id: string;
  userId: string;
  /** YYYY-MM-DD — one row per trader per day. */
  date: string;
  /** Integer tally of infractions logged during the session. */
  infractions: number;
  /** Self-reported discipline on a 0.0-10.0 scale (step 0.1). */
  disciplineScore: number;
  /** Self-reported emotional control on a 0.0-10.0 scale (step 0.1). */
  emotionalControl: number;
  /** Auto-generated Hermes recap; read-only on the client. */
  hermesSummary: string | null;
  /** Free-form trader notes. */
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Client-side draft: same shape minus server-owned fields. */
export type SessionJournalDraft = Pick<
  SessionJournal,
  "date" | "infractions" | "disciplineScore" | "emotionalControl" | "notes"
>;
