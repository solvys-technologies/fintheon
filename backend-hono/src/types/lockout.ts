// [claude-code 2026-05-13] Lockout state types
// [claude-code 2026-05-13] S64 T3: Extended with autoReleaseAt, reason, scheduledBy
// [claude-code 2026-05-15] S66-T2: reason changed from string to discriminated union
export interface LockoutState {
  locked: boolean;
  until: string | null; // ISO timestamp
  remaining: number | null; // seconds remaining
  reason?: "desk_session" | "manual" | "system";
  autoReleaseAt?: string; // ISO timestamp when auto-unlock fires
  scheduledBy?: "desk_plan" | "manual" | "system";
}
