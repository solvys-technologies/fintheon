// [claude-code 2026-05-13] Lockout state types
export interface LockoutState {
  locked: boolean;
  until: string | null; // ISO timestamp
  remaining: number | null; // seconds remaining
  reason?: string;
}
