// [claude-code 2026-03-05] Scrolling AI analysis ticker at bottom of Econ Calendar.
// [claude-code 2026-03-11] Track 6: Beat/miss inline text in ticker insights.
import { useMemo } from 'react';
import { useEconCalendar } from '../../contexts/EconCalendarContext';
import type { EconEventItem } from '../../lib/services';

function generateInsight(event: EconEventItem): string | null {
  if (!event.actual || !event.forecast) return null;

  const actual = parseFloat(event.actual);
  const forecast = parseFloat(event.forecast);
  if (isNaN(actual) || isNaN(forecast)) return null;

  const deviation = forecast !== 0 ? ((actual - forecast) / Math.abs(forecast)) * 100 : 0;
  const absDeviation = Math.abs(deviation);
  const isBeat = actual >= forecast;
  const beatMissLabel = isBeat ? 'BEAT' : 'MISS';
  const beatMissIcon = isBeat ? '\u2713' : '\u2717';

  if (absDeviation < 1) {
    return `${event.name}: In line (${event.actual} vs ${event.forecast} fcst) ${beatMissIcon} ${beatMissLabel}`;
  }

  const magnitude = absDeviation > 10 ? 'significantly' : absDeviation > 5 ? 'notably' : 'slightly';
  const direction = actual > forecast ? 'above' : 'below';

  return `${event.name}: ${event.actual} ${magnitude} ${direction} ${event.forecast} fcst (${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%) ${beatMissIcon} ${beatMissLabel}`;
}

function generateUpcomingAlert(event: EconEventItem): string {
  const impLabel = event.importance === 3 ? 'HIGH IMPACT' : event.importance === 2 ? 'MED IMPACT' : 'LOW';
  const time = event.time ? ` at ${event.time}` : '';
  return `Upcoming: ${event.name}${time} [${impLabel}] -- Fcst: ${event.forecast ?? 'N/A'}, Prev: ${event.previous ?? 'N/A'}`;
}

export function EconTickerFooter() {
  const { events } = useEconCalendar();

  const tickerItems = useMemo(() => {
    const items: string[] = [];

    // First: events with actuals (most recent first) — AI analysis with beat/miss
    const withActuals = events.filter((e) => e.actual).slice(0, 5);
    for (const event of withActuals) {
      const insight = generateInsight(event);
      if (insight) items.push(insight);
    }

    // Then: upcoming high-importance events without actuals
    const upcoming = events
      .filter((e) => !e.actual && e.importance >= 2)
      .slice(0, 5);
    for (const event of upcoming) {
      items.push(generateUpcomingAlert(event));
    }

    return items.length > 0 ? items : ['Economic calendar loading -- awaiting data from Notion...'];
  }, [events]);

  const tickerText = tickerItems.join('  \u2022  ');

  return (
    <div className="flex-shrink-0 h-7 border-t border-[var(--fintheon-accent)]/15 bg-[#080800] overflow-hidden relative">
      <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#080800] to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#080800] to-transparent z-10" />
      <div className="h-full flex items-center">
        <div className="animate-ticker whitespace-nowrap text-[10px] font-mono">
          <span className="text-[var(--fintheon-accent)]/70">{tickerText}</span>
          <span className="text-[var(--fintheon-accent)]/70 ml-16">{tickerText}</span>
        </div>
      </div>
    </div>
  );
}
