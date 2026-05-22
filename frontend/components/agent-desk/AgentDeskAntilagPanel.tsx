import { useEffect, useState } from "react";
import { Activity, Radio } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface AntilagEvent {
  instrument: string;
  triggeredAt: string;
  barometerSpikeCount: number;
  barometers: Record<string, { spiked: boolean }>;
}

interface AntilagSummary {
  activeCount: number;
  latestEvent: AntilagEvent | null;
  instruments: string[];
  barometerMix: Array<{ mix: string; count: number }>;
}

export function AgentDeskAntilagPanel() {
  const [summary, setSummary] = useState<AntilagSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      try {
        const res = await fetch(`${API_BASE}/api/agent-desk/antilag/summary`);
        if (!res.ok) return;
        const data = (await res.json()) as AntilagSummary;
        if (!cancelled) setSummary(data);
      } catch {
        if (!cancelled) setSummary(null);
      }
    }
    void loadSummary();
    const id = window.setInterval(loadSummary, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const latest = summary?.latestEvent ?? null;
  const mix = summary?.barometerMix[0]?.mix ?? "No mix";
  const label = latest ? formatTime(latest.triggeredAt) : "Inactive";

  return (
    <div
      className="rounded border p-2.5 space-y-2"
      style={{
        borderColor: "rgba(212, 175, 55, 0.16)",
        backgroundColor: "rgba(199, 159, 74, 0.06)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Radio className="h-3 w-3 text-[var(--fintheon-accent)]" />
          <span className="text-[10px] font-semibold uppercase tracking-normal text-[var(--fintheon-text)]">
            Antilag
          </span>
        </div>
        <span className="text-[10px] tabular-nums text-[var(--fintheon-accent)]">
          {summary?.activeCount ?? 0}/5d
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <Metric label="Instrument" value={latest?.instrument ?? "NQ"} />
        <Metric label="Latest" value={label} />
        <Metric
          label="Barometers"
          value={latest ? `${latest.barometerSpikeCount}/3` : "0/3"}
        />
        <Metric label="Mix" value={compactMix(mix)} />
      </div>

      {latest && (
        <div className="flex items-center gap-1 text-[10px] text-gray-400">
          <Activity className="h-3 w-3 text-[var(--fintheon-accent)]" />
          <span>NQ timing window logged</span>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-gray-500">{label}</div>
      <div className="truncate font-medium text-gray-200">{value}</div>
    </div>
  );
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Inactive";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function compactMix(value: string): string {
  return value.replace(/US/g, "");
}

