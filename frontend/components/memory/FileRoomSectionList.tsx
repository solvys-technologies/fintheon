import { Bot, ChartCandlestick, ChevronDown, FileText } from "lucide-react";
import type {
  FileRoomItem,
  FileRoomSection,
} from "../../lib/services/file-room";
import {
  formatItemMeta,
  formatSectionMeta,
  sectionLabel,
} from "./file-room-format";

interface FileRoomSectionListProps {
  sections: FileRoomSection[];
  expandedIds: Set<string>;
  selectedId: string | null;
  onToggle: (id: string) => void;
  onSelect: (item: FileRoomItem) => void;
}

export function FileRoomSectionList({
  sections,
  expandedIds,
  selectedId,
  onToggle,
  onSelect,
}: FileRoomSectionListProps) {
  return (
    <div className="space-y-2 p-3">
      {sections.map((section) => {
        const isExpanded = expandedIds.has(section.id);
        return (
          <section
            key={section.id}
            className="overflow-hidden rounded-md border border-[color-mix(in_srgb,var(--fintheon-accent)_10%,transparent)] bg-[color-mix(in_srgb,var(--fintheon-surface)_84%,var(--fintheon-bg))]"
          >
            <button
              type="button"
              aria-expanded={isExpanded}
              onClick={() => onToggle(section.id)}
              className="group grid w-full grid-cols-[16px_1fr_auto_auto] items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_6%,transparent)]"
            >
              <SectionIcon id={section.id} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[color-mix(in_srgb,var(--fintheon-text)_88%,transparent)]">
                    {section.title}
                  </span>
                  <span className="rounded border border-[color-mix(in_srgb,var(--fintheon-accent)_13%,transparent)] px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[color-mix(in_srgb,var(--fintheon-accent)_54%,transparent)]">
                    {sectionLabel(section.id)}
                  </span>
                </span>
                <span className="mt-1 block truncate text-[10px] text-[color-mix(in_srgb,var(--fintheon-text)_35%,transparent)]">
                  {formatSectionMeta(section.items.length, section.description)}
                </span>
              </span>
              <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[color-mix(in_srgb,var(--fintheon-text)_24%,transparent)]">
                {isExpanded ? "Open" : "Closed"}
              </span>
              <ChevronDown
                size={14}
                className={`text-[color-mix(in_srgb,var(--fintheon-text)_30%,transparent)] transition-transform ${isExpanded ? "" : "-rotate-90"}`}
              />
            </button>
            {isExpanded ? (
              <div className="border-t border-[color-mix(in_srgb,var(--fintheon-accent)_8%,transparent)]">
                {section.items.length === 0 ? (
                  <p className="px-11 py-3 text-[10px] text-[color-mix(in_srgb,var(--fintheon-text)_25%,transparent)]">
                    No documents
                  </p>
                ) : (
                  section.items.map((item) => (
                    <DocumentRow
                      key={item.id}
                      item={item}
                      isSelected={selectedId === item.id}
                      onSelect={() => onSelect(item)}
                    />
                  ))
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function DocumentRow({
  item,
  isSelected,
  onSelect,
}: {
  item: FileRoomItem;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`grid w-full grid-cols-[1fr_auto] gap-3 border-t border-[color-mix(in_srgb,var(--fintheon-accent)_7%,transparent)] px-3.5 py-2.5 text-left first:border-t-0 transition-colors ${
        isSelected
          ? "bg-[color-mix(in_srgb,var(--fintheon-accent)_10%,transparent)] text-[var(--fintheon-text)]"
          : "text-[color-mix(in_srgb,var(--fintheon-text)_62%,transparent)] hover:bg-[color-mix(in_srgb,var(--fintheon-accent)_5%,transparent)]"
      }`}
    >
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium">
          {item.title}
        </span>
        <span className="mt-1 block truncate text-[10px] text-[color-mix(in_srgb,var(--fintheon-text)_34%,transparent)]">
          {item.summary}
        </span>
      </span>
      <span className="self-start pt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[color-mix(in_srgb,var(--fintheon-text)_28%,transparent)]">
        {formatItemMeta(item)}
      </span>
    </button>
  );
}

function SectionIcon({ id }: { id: string }) {
  const className =
    "shrink-0 text-[color-mix(in_srgb,var(--fintheon-accent)_62%,transparent)]";
  if (id === "agent-souls") return <Bot size={15} className={className} />;
  if (id === "chart-evidence")
    return <ChartCandlestick size={15} className={className} />;
  return <FileText size={15} className={className} />;
}
