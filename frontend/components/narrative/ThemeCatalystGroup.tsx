// [claude-code 2026-05-16] S68-T5: Hover lift on frosted-glass container

import { useMemo, useState } from "react";
import type { CatalystCard as CatalystCardType } from "../../lib/narrative-types";
import type { Theme, ThemeStatus } from "../../hooks/useThemes";
import { ThemeHeader } from "./ThemeHeader";
import CatalystCardComponent from "./CatalystCard";
import type { DriftBubbleData } from "./DriftBubble";

interface ThemeCatalystGroupProps {
  theme: Theme;
  catalysts: CatalystCardType[];
  selectedId?: string | null;
  onSelect: (id: string) => void;
  drift?: DriftBubbleData;
}

const SEVERITY_RANK: Record<string, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function ThemeCatalystGroup({
  theme,
  catalysts,
  selectedId,
  onSelect,
  drift,
}: ThemeCatalystGroupProps) {
  const [isHovered, setIsHovered] = useState(false);

  const sorted = useMemo(
    () =>
      [...catalysts].sort(
        (a, b) =>
          (SEVERITY_RANK[b.severity] ?? 0) -
          (SEVERITY_RANK[a.severity] ?? 0),
      ),
    [catalysts],
  );

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="rounded-lg overflow-hidden"
      style={{
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        backgroundColor: "rgba(10,9,5,0.68)",
        border: isHovered
          ? "1px solid rgba(199,159,74,0.25)"
          : "1px solid rgba(199,159,74,0.12)",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        boxShadow: isHovered ? "0 4px 20px rgba(0,0,0,0.3)" : "0 0 0 transparent",
      }}
    >
      <ThemeHeader
        name={theme.name}
        ipv={theme.ipv}
        status={theme.status as ThemeStatus}
        drift={drift}
      />
      {sorted.length > 0 ? (
        <div className="flex flex-col gap-1.5 px-3 pb-3">
          {sorted.map((c) => (
            <CatalystCardComponent
              key={c.id}
              catalyst={c}
              onSelect={onSelect}
              selected={selectedId === c.id}
            />
          ))}
        </div>
      ) : (
        <div className="px-3 pb-3 text-[10px] text-[var(--fintheon-muted)]/40 text-center">
          No catalysts for this theme
        </div>
      )}
    </div>
  );
}
