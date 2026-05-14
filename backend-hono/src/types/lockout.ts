// [claude-code 2026-05-13] Lockout state types
// [claude-code 2026-05-13] S64 T3: Extended with autoReleaseAt, reason, scheduledBy
export interface LockoutState {
  locked: boolean;
  until: string | null; // ISO timestamp
  remaining: number | null; // seconds remaining
  reason?: string;
  autoReleaseAt?: string; // ISO timestamp when auto-unlock fires
  scheduledBy?: "desk_plan" | "manual" | "system";
}
