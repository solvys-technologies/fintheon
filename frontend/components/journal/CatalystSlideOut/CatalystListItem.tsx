import type { CatalystItem } from "./hooks/useCatalystsByDate.js";

const URGENCY_COLOR: Record<string, string> = {
  immediate: "#c79f4a",
  high: "#a0845f",
  normal: "rgba(240, 234, 214, 0.5)",
};

const URGENCY_BG: Record<string, string> = {
  immediate: "rgba(199, 159, 74, 0.12)",
  high: "rgba(160, 132, 95, 0.10)",
  normal: "rgba(240, 234, 214, 0.05)",
};

interface CatalystListItemProps {
  item: CatalystItem;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function CatalystListItem({ item }: CatalystListItemProps) {
  const urgencyColor = URGENCY_COLOR[item.urgency] ?? URGENCY_COLOR.normal;
  const urgencyBg = URGENCY_BG[item.urgency] ?? URGENCY_BG.normal;
  const timeLabel = formatTime(item.publishedAt);

  return (
    <div
      className="rounded-lg px-3 py-3 transition-all duration-200 hover:brightness-110"
      style={{
        border: `1px solid ${urgencyColor}30`,
        backgroundColor: urgencyBg,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span
          className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{
            color: urgencyColor,
            backgroundColor: `${urgencyColor}18`,
            fontFamily: "var(--font-mono)",
          }}
        >
          {item.urgency}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {item.source && (
            <span
              className="text-[10px]"
              style={{
                color: "rgba(240, 234, 214, 0.35)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {item.source}
            </span>
          )}
          {timeLabel && (
            <span
              className="text-[10px]"
              style={{
                color: "rgba(240, 234, 214, 0.25)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {timeLabel}
            </span>
          )}
        </div>
      </div>

      <p
        className="text-[13px] leading-snug"
        style={{ color: "#f0ead6", fontFamily: "var(--font-body)" }}
      >
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
            style={{ color: "inherit" }}
          >
            {item.headline}
          </a>
        ) : (
          item.headline
        )}
      </p>

      {item.symbols.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.symbols.slice(0, 5).map((sym) => (
            <span
              key={sym}
              className="text-[9px] px-1.5 py-0.5 rounded"
              style={{
                color: "#c79f4a80",
                backgroundColor: "#c79f4a10",
                fontFamily: "var(--font-mono)",
              }}
            >
              {sym}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
