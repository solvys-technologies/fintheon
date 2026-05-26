import { ChevronDown, PanelRightOpen, Users } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { PanelIcon } from "../layout/PanelToggleGroup";
import {
  NARRATIVE_SURFACE_OPTIONS,
  type NarrativeSurfaceMode,
} from "../narrative/narrative-surface-options";

interface NarrativeAnalysisDropdownProps {
  open: boolean;
  currentMode: NarrativeSurfaceMode;
  showDeskRail: boolean;
  researchRailOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectMode: (mode: NarrativeSurfaceMode) => void;
  onToggleDeskRail: () => void;
  onToggleResearchRail: () => void;
}

export function NarrativeAnalysisDropdown({
  open,
  currentMode,
  showDeskRail,
  researchRailOpen,
  onOpenChange,
  onSelectMode,
  onToggleDeskRail,
  onToggleResearchRail,
}: NarrativeAnalysisDropdownProps) {
  const current =
    NARRATIVE_SURFACE_OPTIONS.find((option) => option.id === currentMode) ??
    NARRATIVE_SURFACE_OPTIONS[0];
  const CurrentIcon = current.icon;

  return (
    <div className="relative flex items-center gap-1">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 hover:-translate-y-px ${
          open
            ? "border border-[color-mix(in_srgb,var(--fintheon-accent)_28%,transparent)] text-[var(--fintheon-accent)]"
            : "border border-transparent text-[color-mix(in_srgb,var(--fintheon-accent)_45%,transparent)] hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_5%,transparent)] hover:text-[color-mix(in_srgb,var(--fintheon-accent)_72%,transparent)]"
        }`}
        title={`Analysis: ${current.label}`}
        aria-label={`Analysis dropdown: ${current.label}`}
      >
        <CurrentIcon size={14} />
        <span className="fintheon-zen-label">{current.label}</span>
        <ChevronDown
          size={12}
          className={`opacity-60 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <RailToggleButton
        active={showDeskRail}
        icon={<Users size={14} />}
        title={showDeskRail ? "Hide Desk" : "Show Desk"}
        onClick={() => {
          onToggleDeskRail();
          onOpenChange(false);
        }}
      />
      <RailToggleButton
        active={researchRailOpen}
        icon={<PanelIcon side="right" active={researchRailOpen} />}
        title={researchRailOpen ? "Hide Research Rail" : "Show Research Rail"}
        onClick={() => {
          onToggleResearchRail();
          onOpenChange(false);
        }}
      />

      {open ? (
        <div
          className="fintheon-popover-surface narrative-analysis-menu t-dropdown is-open absolute right-0 top-[calc(100%+8px)] z-50 overflow-y-auto p-1"
          data-origin="top-right"
        >
          {NARRATIVE_SURFACE_OPTIONS.map((option, index) => (
            <div key={option.id}>
              {index > 0 ? <DropdownRuler /> : null}
              <AnalysisChoice
                active={currentMode === option.id}
                icon={option.icon}
                label={option.label}
                description={option.description}
                staggerIndex={index}
                onClick={() => {
                  onSelectMode(option.id);
                  onOpenChange(false);
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function RailToggleButton({
  active,
  icon,
  title,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={title}
      aria-pressed={active}
      title={title}
      className={`grid h-8 w-8 place-items-center rounded-md border text-[color-mix(in_srgb,var(--fintheon-accent)_50%,transparent)] transition-all duration-200 hover:-translate-y-px hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_5%,transparent)] hover:text-[color-mix(in_srgb,var(--fintheon-accent)_78%,transparent)] ${
        active
          ? "border-[color-mix(in_srgb,var(--fintheon-accent)_28%,transparent)] bg-[color-mix(in_srgb,var(--fintheon-accent)_8%,transparent)] text-[var(--fintheon-accent)]"
          : "border-transparent"
      }`}
    >
      {icon}
    </button>
  );
}

function AnalysisChoice({
  active,
  icon: Icon,
  label,
  description,
  staggerIndex = 0,
  onClick,
}: {
  active: boolean;
  icon: typeof PanelRightOpen;
  label: string;
  description: string;
  staggerIndex?: number;
  onClick: () => void;
}) {
  const style = {
    "--narrative-fade-delay": `${staggerIndex * 35}ms`,
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={`narrative-fade-item group flex w-full items-start gap-2.5 rounded-[4px] border border-transparent px-2.5 py-2 text-left transition-all duration-200 hover:-translate-y-px ${
        active
          ? "border-[color-mix(in_srgb,var(--fintheon-accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--fintheon-accent)_8%,transparent)] text-[var(--fintheon-accent)]"
          : "text-[color-mix(in_srgb,var(--fintheon-text)_54%,transparent)] hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_5%,transparent)] hover:text-[color-mix(in_srgb,var(--fintheon-text)_82%,transparent)]"
      }`}
    >
      <Icon
        size={14}
        className="mt-0.5 shrink-0 transition-transform duration-200 group-hover:scale-105"
      />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em]">
          {label}
        </span>
        <span className="mt-0.5 block text-[10px] leading-snug text-[color-mix(in_srgb,var(--fintheon-text)_38%,transparent)] line-clamp-2">
          {description}
        </span>
      </span>
    </button>
  );
}

function DropdownRuler() {
  return (
    <div
      className="mx-2 h-px"
      style={{
        background:
          "linear-gradient(90deg, transparent, color-mix(in srgb, var(--fintheon-accent) 14%, transparent), transparent)",
      }}
    />
  );
}
