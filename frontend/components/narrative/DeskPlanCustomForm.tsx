import { useMemo, useState } from "react";
import { Filter, Plus, Save, X } from "lucide-react";
import { DAY_PLAN_REFETCH_EVENT } from "../../hooks/useDayPlan";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8080";
const MULTI_REFETCH_EVENT = "fintheon:day-plan-multi-refetch";

interface CountryOption {
  country: string;
  currency: string;
  flag: string;
}

const COUNTRIES: CountryOption[] = [
  { country: "US", currency: "USD", flag: "🇺🇸" },
  { country: "NZ", currency: "NZD", flag: "🇳🇿" },
  { country: "AU", currency: "AUD", flag: "🇦🇺" },
  { country: "JP", currency: "JPY", flag: "🇯🇵" },
  { country: "GB", currency: "GBP", flag: "🇬🇧" },
  { country: "EU", currency: "EUR", flag: "🇪🇺" },
  { country: "CA", currency: "CAD", flag: "🇨🇦" },
  { country: "CN", currency: "CNY", flag: "🇨🇳" },
];

interface DeskPlanCustomFormProps {
  countries: string[];
  selectedCountry: string;
  onCountryChange: (value: string) => void;
}

export function DeskPlanCustomForm({
  countries,
  selectedCountry,
  onCountryChange,
}: DeskPlanCustomFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState(() => initialForm());
  const country = COUNTRIES.find((item) => item.country === form.country) ?? COUNTRIES[0];
  const filterOptions = useMemo(
    () => ["ALL", ...countries.filter(Boolean).map((value) => value.toUpperCase())],
    [countries],
  );

  async function submit() {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/api/day-plan/custom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, currency: country.currency }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { plan?: { date?: string } };
      setMessage(`Saved ${json.plan?.date ?? form.date}`);
      window.dispatchEvent(new Event(DAY_PLAN_REFETCH_EVENT));
      window.dispatchEvent(new Event(MULTI_REFETCH_EVENT));
      window.setTimeout(() => setIsOpen(false), 900);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <span className="relative inline-flex items-center gap-1">
      <span className="inline-flex items-center gap-1 rounded px-1 py-0.5">
        <Filter className="w-3 h-3 text-[var(--fintheon-accent)]/70" />
        <select
          value={selectedCountry}
          onChange={(event) => onCountryChange(event.target.value)}
          className="bg-transparent text-[9px] uppercase outline-none"
          style={{ color: "var(--fintheon-muted, #908774)" }}
          title="Desk plan country"
        >
          {filterOptions.map((value) => {
            const option = COUNTRIES.find((item) => item.country === value);
            return (
              <option key={value} value={value}>
                {value === "ALL" ? "All" : `${option?.flag ?? ""} ${option?.currency ?? value}`}
              </option>
            );
          })}
        </select>
      </span>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        className="inline-flex h-5 w-5 items-center justify-center rounded text-[var(--fintheon-accent)]/80 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
        aria-label="Add desk plan"
        title="Add desk plan"
      >
        <Plus className="w-3 h-3" />
      </button>
      <div
        className={`absolute right-0 top-7 z-[80] w-[340px] origin-top-right rounded border border-[var(--fintheon-accent)]/20 bg-[#080705]/95 p-3 shadow-2xl backdrop-blur transition-all duration-200 ${
          isOpen
            ? "pointer-events-auto translate-y-0 opacity-100 scale-100"
            : "pointer-events-none -translate-y-1 opacity-0 scale-[0.98]"
        }`}
      >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
            Custom Plan
          </span>
          <button type="button" onClick={() => setIsOpen(false)} aria-label="Close">
            <X className="w-3 h-3 text-zinc-500" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Event" value={form.eventName} onChange={(eventName) => setForm({ ...form, eventName })} wide />
          <Field label="Date" type="date" value={form.date} onChange={(date) => setForm({ ...form, date })} />
          <Field label="Print" type="time" value={form.time} onChange={(time) => setForm({ ...form, time })} />
          <Field label="Start" type="time" value={form.startTime} onChange={(startTime) => setForm({ ...form, startTime })} />
          <Field label="End" type="time" value={form.endTime} onChange={(endTime) => setForm({ ...form, endTime })} />
          <label className="min-w-0">
            <span className="mb-1 block text-[9px] uppercase tracking-[0.12em] text-zinc-500">
              Country
            </span>
            <select
              value={form.country}
              onChange={(event) => setForm({ ...form, country: event.target.value })}
              className="h-8 w-full rounded border border-white/10 bg-black/40 px-2 text-[12px] text-[var(--fintheon-text)] outline-none"
            >
              {COUNTRIES.map((item) => (
                <option key={item.country} value={item.country}>
                  {item.flag} {item.currency}
                </option>
              ))}
            </select>
          </label>
          <Field label="Forecast" value={form.forecast} onChange={(forecast) => setForm({ ...form, forecast })} />
          <Field label="Prior" value={form.previous} onChange={(previous) => setForm({ ...form, previous })} />
          <Field label="Detail" value={form.detail} onChange={(detail) => setForm({ ...form, detail })} wide />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="truncate text-[10px] text-zinc-500">{message ?? "Forecast generated by Agentic Desk"}</span>
          <button
            type="button"
            onClick={submit}
            disabled={isSaving || form.eventName.trim().length < 2}
            className="inline-flex h-7 items-center gap-1 rounded border border-[var(--fintheon-accent)]/30 px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] disabled:opacity-40"
          >
            <Save className="w-3 h-3" />
            {isSaving ? "Saving" : "Save"}
          </button>
        </div>
      </div>
    </span>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  wide,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <span className="mb-1 block text-[9px] uppercase tracking-[0.12em] text-zinc-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded border border-white/10 bg-black/40 px-2 text-[12px] text-[var(--fintheon-text)] outline-none"
      />
    </label>
  );
}

function initialForm() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    eventName: "",
    date: tomorrow.toISOString().slice(0, 10),
    country: "US",
    category: "Economic",
    impact: "medium",
    time: "08:30",
    startTime: "07:45",
    endTime: "09:15",
    forecast: "",
    previous: "",
    detail: "",
  };
}
