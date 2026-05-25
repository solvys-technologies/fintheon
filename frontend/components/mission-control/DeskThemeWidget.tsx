// [codex 2026-05-25] Strategium Desk Plan now reuses the canonical DayCard widget.
import { DayCard } from "../narrative/DayCard";

export function DeskThemeWidget() {
  return (
    <div className="flex h-full min-h-0 flex-col p-3">
      <DayCard bare className="min-h-0 flex-1" />
    </div>
  );
}
