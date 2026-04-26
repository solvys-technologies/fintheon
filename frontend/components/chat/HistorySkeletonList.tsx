// [claude-code 2026-04-25] S42-T7 mount-time perf. Static gray-line outline shown in
// FintheonThread while a stored conversationId hydrates from the backend. No spinner,
// no glassmorphic surface — flat outlines matching the user/assistant bubble layout.
import { type FC } from "react";

interface SkeletonRow {
  side: "left" | "right";
  width: string;
}

const ROWS: SkeletonRow[] = [
  { side: "right", width: "w-44" },
  { side: "left", width: "w-72" },
  { side: "right", width: "w-32" },
  { side: "left", width: "w-60" },
];

export const HistorySkeletonList: FC = () => (
  <div className="space-y-4 mb-8" aria-hidden="true" data-skeleton="history">
    {ROWS.map((row, i) => (
      <div
        key={i}
        className={
          row.side === "right" ? "flex justify-end" : "flex justify-start"
        }
      >
        <div
          className={
            "h-9 rounded-lg border border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-accent)]/[0.04] " +
            row.width
          }
        />
      </div>
    ))}
  </div>
);
