// [claude-code 2026-05-16] S68-T3: Filter bar — All Themes / Active Only / theme dropdown

import { useState, useCallback } from "react";
import type { Theme } from "../../hooks/useThemes";

export type FilterMode = "all" | "active" | "theme";

interface NarrativeFlowFilterBarProps {
  themes: Theme[];
  activeFilter: FilterMode;
  selectedThemeId: string | null;
  onFilterChange: (mode: FilterMode, themeId?: string) => void;
}

const FILTER_PILLS: { mode: FilterMode; label: string }[] = [
  { mode: "all", label: "All Themes" },
  { mode: "active", label: "Active Only" },
];

export function NarrativeFlowFilterBar({
  themes,
  activeFilter,
  selectedThemeId,
  onFilterChange,
}: NarrativeFlowFilterBarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handlePill = useCallback(
    (mode: FilterMode) => {
      setDropdownOpen(false);
      onFilterChange(mode);
    },
    [onFilterChange],
  );

  const handleThemeSelect = useCallback(
    (themeId: string) => {
      setDropdownOpen(false);
      onFilterChange("theme", themeId);
    },
    [onFilterChange],
  );

  const selectedThemeName =
    selectedThemeId && activeFilter === "theme"
      ? themes.find((t) => t.id === selectedThemeId)?.name ?? "Select Theme"
      : "Select Theme";

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      {FILTER_PILLS.map(({ mode, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => handlePill(mode)}
          className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors"
          style={{
            backgroundColor:
              activeFilter === mode
                ? "rgba(199,159,74,0.15)"
                : "rgba(199,159,74,0.05)",
            color:
              activeFilter === mode
                ? "var(--fintheon-accent)"
                : "var(--fintheon-muted)",
            border:
              activeFilter === mode
                ? "1px solid rgba(199,159,74,0.3)"
                : "1px solid rgba(199,159,74,0.08)",
          }}
        >
          {label}
        </button>
      ))}

      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen((v) => !v)}
          className="text-[10px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors"
          style={{
            backgroundColor:
              activeFilter === "theme"
                ? "rgba(199,159,74,0.15)"
                : "rgba(199,159,74,0.05)",
            color:
              activeFilter === "theme"
                ? "var(--fintheon-accent)"
                : "var(--fintheon-muted)",
            border:
              activeFilter === "theme"
                ? "1px solid rgba(199,159,74,0.3)"
                : "1px solid rgba(199,159,74,0.08)",
          }}
        >
          {selectedThemeName}
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setDropdownOpen(false)}
            />
            <div
              className="absolute top-full left-0 mt-1 z-20 min-w-[180px] rounded-lg overflow-hidden"
              style={{
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                backgroundColor: "rgba(10,9,5,0.92)",
                border: "1px solid rgba(199,159,74,0.15)",
              }}
            >
              {themes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleThemeSelect(t.id)}
                  className="w-full text-left px-3 py-2 text-[11px] transition-colors hover:bg-[var(--fintheon-accent)]/10"
                  style={{
                    color:
                      selectedThemeId === t.id && activeFilter === "theme"
                        ? "var(--fintheon-accent)"
                        : "var(--fintheon-text)",
                  }}
                >
                  {t.name}
                </button>
              ))}
              {themes.length === 0 && (
                <div className="px-3 py-2 text-[10px] text-[var(--fintheon-muted)]/40">
                  No themes available
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
