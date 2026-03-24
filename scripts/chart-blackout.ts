// [claude-code 2026-03-20] T5b: Blackout period check for TopStepX charting automation

/**
 * Returns true if current time is within the 8:30 AM - 12:00 PM EST blackout window.
 * During this period, automated charting should not run to avoid interfering with
 * active trading sessions.
 */
export function isBlackoutPeriod(): boolean {
  const now = new Date();

  // Format current time in America/New_York timezone
  const estParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(now);

  const hour = parseInt(estParts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(estParts.find((p) => p.type === 'minute')?.value || '0', 10);
  const totalMinutes = hour * 60 + minute;

  // Blackout: 8:30 AM (510 min) to 12:00 PM (720 min) EST
  return totalMinutes >= 510 && totalMinutes < 720;
}

// CLI entry: node scripts/chart-blackout.ts
if (typeof require !== 'undefined' && require.main === module) {
  const inBlackout = isBlackoutPeriod();
  console.log(JSON.stringify({ blackout: inBlackout, checkedAt: new Date().toISOString() }));
  process.exit(inBlackout ? 1 : 0);
}
