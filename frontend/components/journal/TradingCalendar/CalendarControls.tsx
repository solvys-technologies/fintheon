import type {
  CalendarVariant,
  CalendarGranularity,
  OriginFilter,
} from "./types";

interface CalendarControlsProps {
  variant: CalendarVariant;
  granularity: CalendarGranularity;
  origin: OriginFilter;
  onVariantChange: (v: CalendarVariant) => void;
  onGranularityChange: (g: CalendarGranularity) => void;
  onOriginChange: (o: OriginFilter) => void;
}

function SegmentedGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center border border-[var(--fintheon-accent)]/15 rounded overflow-hidden">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
            value === opt.value
              ? "bg-[var(--fintheon-accent)] text-black"
              : "text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)]"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function CalendarControls({
  variant,
  granularity,
  origin,
  onVariantChange,
  onGranularityChange,
  onOriginChange,
}: CalendarControlsProps) {
  return (
    <div className="flex items-center justify-between gap-2 px-1 py-1.5">
      <SegmentedGroup<CalendarVariant>
        options={[
          { label: "ProjectX", value: "projectx" },
          { label: "Solvys", value: "solvys" },
        ]}
        value={variant}
        onChange={onVariantChange}
      />

      <SegmentedGroup<CalendarGranularity>
        options={[
          { label: "Day", value: "day" },
          { label: "Week", value: "week" },
          { label: "Month", value: "month" },
        ]}
        value={granularity}
        onChange={onGranularityChange}
      />

      <SegmentedGroup<OriginFilter>
        options={[
          { label: "All", value: "all" },
          { label: "Human", value: "user" },
          { label: "Agentic", value: "autopilot" },
        ]}
        value={origin}
        onChange={onOriginChange}
      />
    </div>
  );
}
