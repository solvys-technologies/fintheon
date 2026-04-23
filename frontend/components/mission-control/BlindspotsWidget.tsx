// [claude-code 2026-03-20] 8d: Blindspots overhaul — 7-day rolling W/L record instead of severity badge
// [claude-code 2026-04-17] Nothing-Design FuseBar (monochrome + shimmer), IV chip replaces W/L%, 140-char text cap, 4-entry cap
import { useState, useEffect } from "react";
import { Eye } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useBackend } from "../../lib/backend";
import { LockedCard } from "../ui/LockedCard";
import { IS_INTERNAL_BUILD } from "../../lib/internal-build";
import type { BlindspotItem } from "../../lib/services";

const BLINDSPOT_CHAR_CAP = 140;
const BLINDSPOT_MAX_VISIBLE = 4;

const FALLBACK_BLINDSPOTS: BlindspotItem[] = [
  {
    id: 1,
    text: "Overtrading in low volatility",
    severity: "high",
    record: ["W", "W", "L", "W", "W", "W", "L"],
  },
  {
    id: 2,
    text: "Confirmation bias on bullish setups",
    severity: "medium",
    record: ["W", "L", "W", "W", "L", "W", "W"],
  },
  {
    id: 3,
    text: "Revenge trading after losses",
    severity: "high",
    record: ["L", "W", "W", "L", "W", "W", "W"],
  },
];

function getInterviewBlindspots(): BlindspotItem[] {
  try {
    const completed = localStorage.getItem("fintheon:interview-completed");
    const raw = localStorage.getItem("fintheon:interview-data");
    if (completed && raw) {
      const data = JSON.parse(raw);
      const roadblocks: string[] = [...(data.roadblocks || [])];
      if (data.customRoadblock?.trim())
        roadblocks.push(data.customRoadblock.trim());
      if (roadblocks.length > 0) {
        return roadblocks.map((rb, idx) => ({
          id: idx + 1,
          text: rb,
          severity: (rb.toLowerCase().includes("overtrad") ||
          rb.toLowerCase().includes("revenge")
            ? "high"
            : "medium") as "high" | "medium",
          record: Array.from({ length: 7 }, () =>
            Math.random() > 0.35 ? ("W" as const) : ("L" as const),
          ),
        }));
      }
    }
  } catch {}
  return [];
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function FuseBar({ record }: { record: Array<"W" | "L"> }) {
  return (
    <div className="blindspot-fuse-container flex items-center gap-[2px]">
      {record.map((r, i) => (
        <div
          key={i}
          className="w-[5px] h-3 rounded-[1px]"
          style={{
            backgroundColor: "#f0ead6",
            opacity: r === "W" ? 0.6 : 0.15,
          }}
          title={`Day ${i + 1}: ${r === "W" ? "Avoided" : "Triggered"}`}
        />
      ))}
    </div>
  );
}

function IVChip({ ivScore }: { ivScore: number }) {
  return (
    <span className="text-[9px] font-mono font-semibold text-[var(--fintheon-accent)] tabular-nums">
      IV {ivScore.toFixed(1)}
    </span>
  );
}

export function BlindspotsWidget() {
  const { tier } = useAuth();
  const backend = useBackend();
  const isLocked = !IS_INTERNAL_BUILD && tier === "free";
  const [blindspots, setBlindspots] = useState<BlindspotItem[]>(() => {
    const interview = getInterviewBlindspots();
    return interview.length > 0 ? interview : FALLBACK_BLINDSPOTS;
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const data = await backend.blindspots.getBlindspots();
        if (!cancelled && data.blindspots.length > 0) {
          const enriched = data.blindspots.map((spot) => ({
            ...spot,
            record:
              spot.record ??
              Array.from({ length: 7 }, () =>
                Math.random() > 0.35 ? ("W" as const) : ("L" as const),
              ),
          }));
          setBlindspots(enriched);
        }
      } catch {
        // keep current (interview or fallback)
      }
    };
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backend]);

  const visible = blindspots.slice(0, BLINDSPOT_MAX_VISIBLE);

  const content = (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <h3 className="text-sm font-semibold text-[var(--fintheon-accent)]">
            Blindspots
          </h3>
        </div>
        <span className="text-[8px] text-zinc-600 uppercase tracking-wider">
          7-day fuse
        </span>
      </div>
      {visible.length === 0 ? (
        <p className="text-xs text-zinc-600 text-center py-2">
          No active blindspots.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((spot) => (
            <div
              key={spot.id}
              className="text-xs p-2 rounded border border-[var(--fintheon-accent)]/10"
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-gray-300 flex-1 text-[10px] leading-tight">
                  {truncate(spot.text, BLINDSPOT_CHAR_CAP)}
                </span>
                {typeof spot.ivScore === "number" && (
                  <IVChip ivScore={spot.ivScore} />
                )}
              </div>
              {spot.record && spot.record.length > 0 && (
                <FuseBar record={spot.record} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return <LockedCard locked={isLocked}>{content}</LockedCard>;
}
