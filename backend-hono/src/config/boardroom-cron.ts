/**
 * Boardroom Cron Job Configuration
 *
 * Schedule definitions for PIC agent boardroom standup meetings.
 * These configurations can be used with the schedule_cronjob tool.
 *
 * Timezone: America/New_York (Eastern Time)
 * Schedule format: Standard cron "minute hour day month weekday"
 */

export interface CronScheduleConfig {
  /** Unique identifier for the cron job */
  id: string;
  /** Human-readable description */
  description: string;
  /** Cron expression (minute hour day month weekday) */
  cronExpression: string;
  /** Timezone for schedule execution */
  timezone: string;
  /** Whether this job is enabled */
  enabled: boolean;
  /** Additional metadata */
  metadata?: {
    /** Window duration in minutes */
    windowMinutes?: number;
    /** Trigger type */
    triggerType: "scheduled" | "event-driven";
    /** Target agents */
    targetAgents?: string[];
  };
}

/**
 * Morning Standup Schedule
 *
 * Window: 7:30 AM - 9:30 AM Eastern Time, weekdays only (Mon-Fri)
 *
 * The standup uses multiple cron entries to cover the 2-hour window:
 * - 7:30 AM: Initial standup trigger
 * - 8:00 AM: First check-in
 * - 8:30 AM: Second check-in
 * - 9:00 AM: Third check-in
 * - 9:30 AM: Final standup wrap-up
 *
 * Agents "clock in" and discuss market preparation, overnight moves,
 * and key levels to watch for the trading day.
 */
export const MORNING_STANDUP_SCHEDULES: CronScheduleConfig[] = [
  {
    id: "boardroom-standup-7-30",
    description: "Morning Standup - Initial (7:30 AM ET)",
    cronExpression: "30 7 * * 1-5",
    timezone: "America/New_York",
    enabled: true,
    metadata: {
      windowMinutes: 30,
      triggerType: "scheduled",
      targetAgents: ["Harper-Opus", "Feucht", "Consul", "Oracle"],
    },
  },
  {
    id: "boardroom-standup-8-00",
    description: "Morning Standup - Check-in (8:00 AM ET)",
    cronExpression: "0 8 * * 1-5",
    timezone: "America/New_York",
    enabled: true,
    metadata: {
      windowMinutes: 30,
      triggerType: "scheduled",
      targetAgents: ["Harper-Opus", "Feucht", "Consul", "Oracle"],
    },
  },
  {
    id: "boardroom-standup-8-30",
    description: "Morning Standup - Check-in (8:30 AM ET)",
    cronExpression: "30 8 * * 1-5",
    timezone: "America/New_York",
    enabled: true,
    metadata: {
      windowMinutes: 30,
      triggerType: "scheduled",
      targetAgents: ["Harper-Opus", "Feucht", "Consul", "Oracle"],
    },
  },
  {
    id: "boardroom-standup-9-00",
    description: "Morning Standup - Check-in (9:00 AM ET)",
    cronExpression: "0 9 * * 1-5",
    timezone: "America/New_York",
    enabled: true,
    metadata: {
      windowMinutes: 30,
      triggerType: "scheduled",
      targetAgents: ["Harper-Opus", "Feucht", "Consul", "Oracle"],
    },
  },
  {
    id: "boardroom-standup-9-30",
    description: "Morning Standup - Wrap-up (9:30 AM ET)",
    cronExpression: "30 9 * * 1-5",
    timezone: "America/New_York",
    enabled: true,
    metadata: {
      windowMinutes: 30,
      triggerType: "scheduled",
      targetAgents: ["Harper-Opus", "Feucht", "Consul", "Oracle"],
    },
  },
];

/**
 * Alternative: Single cron expression for every 30 minutes during standup window
 *
 * This can be used if you prefer a single job that runs at 7:30, 8:00, 8:30, 9:00, 9:30
 * Note: This requires the job handler to manage the 2-hour window internally
 */
export const MORNING_STANDUP_COMPACT: CronScheduleConfig = {
  id: "boardroom-standup-compact",
  description:
    "Morning Standup - Every 30 min (7:30 AM - 9:30 AM ET, weekdays)",
  cronExpression: "0,30 7-9 * * 1-5",
  timezone: "America/New_York",
  enabled: false, // Disabled by default; use individual schedules above
  metadata: {
    windowMinutes: 120, // Full 2-hour window
    triggerType: "scheduled",
    targetAgents: ["Harper-Opus", "Feucht", "Consul", "Oracle"],
  },
};

/**
 * All boardroom cron schedules
 * Export as a flat array for easy iteration and scheduling
 */
export const ALL_BOARDROOM_SCHEDULES: CronScheduleConfig[] = [
  ...MORNING_STANDUP_SCHEDULES,
  // MORNING_STANDUP_COMPACT, // Uncomment to enable compact mode
];

/**
 * Environment variable keys for cron configuration
 * These can be set to override default schedules
 */
export const BOARDROOM_CRON_ENV_KEYS = {
  /** Main cron expression for boardroom meeting schedule */
  CRON: "HERMES_BOARDROOM_CRON",
  /** Timezone for boardroom schedules */
  TIMEZONE: "HERMES_BOARDROOM_TZ",
  /** Meeting window duration in minutes */
  WINDOW_MINUTES: "BOARDROOM_MEETING_WINDOW_MINUTES",
} as const;

/**
 * Default timezone for all boardroom operations
 */
export const DEFAULT_TIMEZONE = "America/New_York";

/**
 * Weekday cron pattern (Monday = 1, Friday = 5)
 */
export const WEEKDAY_PATTERN = "1-5";

/**
 * Helper to get schedule by ID
 */
export function getScheduleById(id: string): CronScheduleConfig | undefined {
  return ALL_BOARDROOM_SCHEDULES.find((s) => s.id === id);
}

/**
 * Helper to get enabled schedules only
 */
export function getEnabledSchedules(): CronScheduleConfig[] {
  return ALL_BOARDROOM_SCHEDULES.filter((s) => s.enabled);
}

/**
 * Helper to build schedule_cronjob tool parameters
 * @param scheduleId - The ID of the schedule to use
 * @returns Parameters object for schedule_cronjob tool, or undefined if not found
 */
export function buildScheduleCronjobParams(
  scheduleId: string,
): { cron_spec: string; description: string; timezone?: string } | undefined {
  const schedule = getScheduleById(scheduleId);
  if (!schedule) return undefined;

  return {
    cron_spec: schedule.cronExpression,
    description: schedule.description,
    timezone: schedule.timezone,
  };
}
