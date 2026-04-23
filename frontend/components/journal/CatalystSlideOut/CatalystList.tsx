import type { CatalystItem } from "./hooks/useCatalystsByDate.js";
import { CatalystListItem } from "./CatalystListItem.js";
import { EmptyState } from "./EmptyState.js";

interface CatalystListProps {
  catalysts: CatalystItem[];
  isLoading: boolean;
  selectionLabel: string;
}

function groupByDate(items: CatalystItem[]): [string, CatalystItem[]][] {
  const map = new Map<string, CatalystItem[]>();
  for (const item of items) {
    const key = item.publishedAt ? item.publishedAt.slice(0, 10) : "unknown";
    const arr = map.get(key) ?? [];
    arr.push(item);
    map.set(key, arr);
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function formatDateHeader(dateStr: string): string {
  if (dateStr === "unknown") return "Unknown date";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function CatalystList({
  catalysts,
  isLoading,
  selectionLabel,
}: CatalystListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <span
          className="text-[12px]"
          style={{
            color: "rgba(240, 234, 214, 0.3)",
            fontFamily: "var(--font-mono)",
          }}
        >
          loading…
        </span>
      </div>
    );
  }

  if (catalysts.length === 0) {
    return <EmptyState selectionLabel={selectionLabel} />;
  }

  const groups = groupByDate(catalysts);

  return (
    <div className="px-4 py-3 space-y-4">
      {groups.map(([date, items]) => (
        <div key={date}>
          <div className="flex items-center gap-2 mb-2">
            <span
              className="text-[10px] uppercase tracking-widest font-bold"
              style={{
                color: "rgba(199, 159, 74, 0.5)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {formatDateHeader(date)}
            </span>
            <div
              className="flex-1 h-px"
              style={{ backgroundColor: "#c79f4a15" }}
            />
            <span
              className="text-[10px]"
              style={{
                color: "rgba(240, 234, 214, 0.2)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {items.length}
            </span>
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <CatalystListItem key={item.id} item={item} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
