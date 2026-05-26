import type { RefObject } from "react";
import { Check, ChevronDown, GitBranch } from "lucide-react";
import {
  ALL_NARRATIVES_SLUG,
  hasAllNarratives,
  selectedNarrativeLabel,
  type NarrativeSelectionChip,
} from "./narrative-selection";

interface NarrativeComposerSelectorProps {
  buttonRef: RefObject<HTMLDivElement | null>;
  chips: NarrativeSelectionChip[];
  selectedSlugs?: Set<string>;
  isOpen: boolean;
  onToggleOpen: () => void;
  onSelect: (slug: string) => void;
}

export function NarrativeComposerSelector({
  buttonRef,
  chips,
  selectedSlugs,
  isOpen,
  onToggleOpen,
  onSelect,
}: NarrativeComposerSelectorProps) {
  const label = selectedNarrativeLabel(chips, selectedSlugs);
  const isAllSelected = hasAllNarratives(selectedSlugs);
  return (
    <div ref={buttonRef} className="relative">
      <button
        type="button"
        onClick={onToggleOpen}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] transition-colors ${
          isOpen
            ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
            : "text-zinc-500 hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
        }`}
        title="Select Narrative"
      >
        <GitBranch size={13} />
        <span className="max-w-[112px] truncate">{label ?? "Narrative"}</span>
        <ChevronDown size={10} className="opacity-55" />
      </button>
      {isOpen ? (
        <div
          role="menu"
          className="absolute bottom-10 left-0 z-50 w-64 overflow-hidden rounded-md border border-[var(--fintheon-accent)]/16 bg-[#0d0a06]"
        >
          <div className="border-b border-[var(--fintheon-accent)]/10 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-accent)]/70">
            Select Narrative
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {chips.map((chip) => (
              <NarrativeOption
                key={chip.slug}
                chip={chip}
                selected={
                  selectedSlugs?.has(chip.slug) ??
                  (chip.slug === ALL_NARRATIVES_SLUG && isAllSelected)
                }
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NarrativeOption({
  chip,
  selected,
  onSelect,
}: {
  chip: NarrativeSelectionChip;
  selected: boolean;
  onSelect: (slug: string) => void;
}) {
  const chipColor = chip.color ?? "var(--fintheon-accent)";
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={selected}
      onClick={() => onSelect(chip.slug)}
      className={`flex w-full items-center gap-2 rounded-[4px] px-2 py-2 text-left transition ${
        selected
          ? "text-[var(--fintheon-accent)]"
          : "text-[var(--fintheon-text)]/74 hover:bg-[var(--fintheon-accent)]/7 hover:text-[var(--fintheon-text)]"
      }`}
      style={selected ? { color: chipColor } : undefined}
    >
      {selected ? (
        <Check size={12} className="shrink-0" />
      ) : (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] bg-black/20">
          <span
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ backgroundColor: chipColor }}
          />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
        {chip.label}
      </span>
    </button>
  );
}
