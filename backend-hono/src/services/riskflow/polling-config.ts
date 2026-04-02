export type PollingConfig = {
  interval: number;
  isHotHours: boolean;
};

/**
 * 24/7 round-robin cadence in ET:
 * - Weekday hot hours (8:00-10:59 ET): 60s
 * - All other times (including weekends): 180s
 */
export function getPollingConfig(now = new Date()): PollingConfig {
  const etNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = etNow.getHours();
  const day = etNow.getDay(); // 0 = Sunday, 6 = Saturday

  if (day === 0 || day === 6) {
    return { interval: 180_000, isHotHours: false };
  }

  const isHotHours = hour >= 8 && hour < 11;
  return {
    interval: isHotHours ? 60_000 : 180_000,
    isHotHours,
  };
}
