// [claude-code 2026-03-24] T2 — Time-of-day trading quotes
import React, { useMemo } from "react";

const QUOTES: Record<string, string[]> = {
  morning: [
    "The opening bell rewards the prepared mind.",
    "Dawn breaks — and so does yesterday's resistance.",
    "Markets open for those who arrived early.",
    "The first hour belongs to the disciplined.",
  ],
  premarket: [
    "Fortune favors the disciplined.",
    "Position before the crowd. Execute with the crowd.",
    "Pre-market whispers become session shouts.",
    "Read the tape. Trust the setup. Enter clean.",
  ],
  midday: [
    "Patience is the trader's sharpest weapon.",
    "Midday chop is where amateurs bleed edge.",
    "The best trade is often no trade at all.",
    "Let the noise settle. The signal will emerge.",
  ],
  afternoon: [
    "The close reveals what the open concealed.",
    "Afternoon reversals reward those who waited.",
    "The final hour writes the day's verdict.",
    "Smart money moves when retail looks away.",
  ],
  evening: [
    "Review the day. Sharpen the blade.",
    "Every loss is tuition. Every win is data.",
    "The journal is mightier than the indicator.",
    "Tonight's preparation is tomorrow's edge.",
  ],
  night: [
    "While others sleep, strategy compounds.",
    "Markets close. Minds don't.",
    "The next session is already being shaped.",
    "Rest well — tomorrow's volatility awaits.",
  ],
};

function getTimeSlot(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 9) return "morning";
  if (hour >= 9 && hour < 11) return "premarket";
  if (hour >= 11 && hour < 14) return "midday";
  if (hour >= 14 && hour < 16) return "afternoon";
  if (hour >= 16 && hour < 20) return "evening";
  return "night";
}

export const TimeQuote: React.FC = () => {
  const quote = useMemo(() => {
    const slot = getTimeSlot();
    const pool = QUOTES[slot];
    return pool[Math.floor(Math.random() * pool.length)];
  }, []);

  return (
    <p
      className="text-sm italic text-[#c79f4a]/60"
      style={{ fontFamily: "'Cinzel', 'Georgia', serif" }}
    >
      "{quote}"
    </p>
  );
};
