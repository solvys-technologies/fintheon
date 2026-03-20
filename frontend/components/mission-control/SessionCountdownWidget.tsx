// [claude-code 2026-03-05] Phase 5B: Session countdown timer — shows when next event is within 10 min
import { useEffect, useState } from 'react';
import { useSchedule } from '../../contexts/ScheduleContext';

/** Parse "HH:MM EventName" from title, combine with date field to get a Date */
function parseEventTime(title: string, dateStr?: string): Date | null {
  const match = title.match(/^(\d{1,2}):(\d{2})\b/);
  if (!match) return null;
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const base = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  base.setHours(hours, minutes, 0, 0);
  return base;
}

function stripTimePrefix(title: string): string {
  return title.replace(/^\d{1,2}:\d{2}\s*/, '');
}

const TEN_MINUTES_MS = 10 * 60 * 1000;

export function SessionCountdownWidget() {
  const { items } = useSchedule();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Find the next event within 10 minutes
  let nextEvent: { name: string; timeMs: number; diffMs: number } | null = null;

  for (const item of items) {
    const eventTime = parseEventTime(item.title, item.date);
    if (!eventTime) continue;
    const diff = eventTime.getTime() - now;
    if (diff > 0 && diff <= TEN_MINUTES_MS) {
      if (!nextEvent || diff < nextEvent.diffMs) {
        nextEvent = {
          name: stripTimePrefix(item.title),
          timeMs: eventTime.getTime(),
          diffMs: diff,
        };
      }
    }
  }

  if (!nextEvent) return null;

  const totalSecs = Math.max(0, Math.floor(nextEvent.diffMs / 1000));
  const mm = String(Math.floor(totalSecs / 60)).padStart(2, '0');
  const ss = String(totalSecs % 60).padStart(2, '0');

  // Urgency coloring: <2min = red, <5min = gold, else default
  const urgencyBorder = totalSecs < 120 ? 'border-red-500/60' : totalSecs < 300 ? 'border-[var(--fintheon-accent)]/60' : 'border-[var(--fintheon-accent)]/30';
  const urgencyText = totalSecs < 120 ? 'text-red-400' : totalSecs < 300 ? 'text-[var(--fintheon-accent)]' : 'text-[var(--fintheon-accent)]';

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 border ${urgencyBorder} bg-[var(--fintheon-surface)]`}>
      <span className="text-sm" role="img" aria-label="US flag">&#x1F1FA;&#x1F1F8;</span>
      <span className="text-[11px] text-zinc-300 truncate flex-1">{nextEvent.name}</span>
      <span className={`text-sm font-mono font-semibold tracking-wider ${urgencyText}`}>
        {mm}:{ss}
      </span>
    </div>
  );
}
