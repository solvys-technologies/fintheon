import { useEffect, useMemo, useState } from "react";
import { Check, Plus, RadioTower } from "lucide-react";
import { useNarrativeRiskFlowHeadlines } from "../../hooks/useNarrativeRiskFlowHeadlines";
import {
  createColiseumForecast,
  fetchColiseumForecasts,
  publishColiseumForecast,
  type ColiseumForecast,
} from "../../lib/coliseum-api";

const DIRECTIONS = ["bullish", "bearish", "neutral", "range", "event"];

export function DeskForecastsView() {
  const { headlines } = useNarrativeRiskFlowHeadlines();
  const [forecasts, setForecasts] = useState<ColiseumForecast[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    let cancelled = false;
    fetchColiseumForecasts()
      .then((items) => {
        if (!cancelled) setForecasts(items);
      })
      .catch((err) => {
        if (!cancelled) setStatus(err instanceof Error ? err.message : "Load failed.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const forecast = (
        event as CustomEvent<{ forecast?: ColiseumForecast }>
      ).detail?.forecast;
      if (!forecast) return;
      setForecasts((current) => [
        forecast,
        ...current.filter((item) => item.id !== forecast.id),
      ]);
      setIsCreating(false);
      setStatus("Draft saved by Harper.");
    };
    window.addEventListener("fintheon:narrative-forecast-created", handler);
    return () => {
      window.removeEventListener("fintheon:narrative-forecast-created", handler);
    };
  }, []);

  const selectedHeadlines = useMemo(
    () => headlines.filter((headline) => form.catalystIds.includes(headline.id)),
    [form.catalystIds, headlines],
  );

  async function handleCreate() {
    setStatus(null);
    try {
      const forecast = await createColiseumForecast({
        title: form.title,
        thesis: form.thesis,
        probability: form.probability ? Number(form.probability) : null,
        direction: form.direction || null,
        timeframe: form.timeframe,
        validationRule: form.validationRule,
        catalystIds: form.catalystIds,
        marketReferences: [],
      });
      setForecasts((current) => [forecast, ...current]);
      setForm(defaultForm());
      setIsCreating(false);
      setStatus("Draft saved.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Save failed.");
    }
  }

  async function handlePublish(id: string) {
    setStatus(null);
    try {
      const forecast = await publishColiseumForecast(id);
      setForecasts((current) =>
        current.map((item) => (item.id === id ? forecast : item)),
      );
      setStatus("Published.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Publish failed.");
    }
  }

  return (
    <div className="narrative-analysis-panel h-full overflow-y-auto bg-[var(--fintheon-bg)] px-4 py-4">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--fintheon-accent)]">
              Forecasts
            </p>
            <h2 className="mt-1 text-lg text-[var(--fintheon-text)]">
              Priced In Capital
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setIsCreating((value) => !value)}
            className="inline-flex h-8 items-center gap-2 rounded-[4px] px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:bg-[var(--fintheon-accent)]/8"
          >
            <Plus size={13} />
            New
          </button>
        </div>

        {status ? <p className="text-xs text-[var(--fintheon-muted)]">{status}</p> : null}

        {isCreating ? (
          <section className="fintheon-popover-surface t-panel-slide border border-[var(--fintheon-accent)]/14 bg-[var(--fintheon-panel)]/60 p-3" data-open="true">
            <div className="grid gap-2 md:grid-cols-2">
              <Field label="Title" value={form.title} onChange={(title) => setForm({ ...form, title })} />
              <Field label="Timeframe" value={form.timeframe} onChange={(timeframe) => setForm({ ...form, timeframe })} />
              <Field label="Probability" value={form.probability} onChange={(probability) => setForm({ ...form, probability })} />
              <label className="text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
                Direction
                <select
                  value={form.direction}
                  onChange={(event) => setForm({ ...form, direction: event.target.value })}
                  className="mt-1 h-9 w-full rounded-[4px] border border-[var(--fintheon-accent)]/14 bg-black/20 px-2 text-xs normal-case tracking-normal text-[var(--fintheon-text)] outline-none"
                >
                  <option value="">None</option>
                  {DIRECTIONS.map((direction) => (
                    <option key={direction} value={direction}>{direction}</option>
                  ))}
                </select>
              </label>
            </div>
            <TextArea label="Thesis" value={form.thesis} onChange={(thesis) => setForm({ ...form, thesis })} />
            <TextArea label="Validation" value={form.validationRule} onChange={(validationRule) => setForm({ ...form, validationRule })} />
            <div className="mt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
                RiskFlow catalysts {selectedHeadlines.length}/3
              </p>
              <div className="mt-2 grid gap-1 md:grid-cols-2">
                {headlines.slice(0, 8).map((headline) => {
                  const isSelected = form.catalystIds.includes(headline.id);
                  return (
                    <button
                      key={headline.id}
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        catalystIds: toggleId(form.catalystIds, headline.id),
                      })}
                      className={`min-h-10 rounded-[4px] px-2 py-1 text-left text-[11px] leading-4 transition ${
                        isSelected
                          ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
                          : "bg-white/[0.03] text-[var(--fintheon-text)]/78 hover:bg-[var(--fintheon-accent)]/8"
                      }`}
                    >
                      {headline.headline}
                    </button>
                  );
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={handleCreate}
              className="mt-3 inline-flex h-8 items-center gap-2 rounded-[4px] bg-[var(--fintheon-accent)] px-3 text-[10px] uppercase tracking-[0.12em] text-black"
            >
              <Check size={13} />
              Save draft
            </button>
          </section>
        ) : null}

        <div className="grid gap-2">
          {forecasts.length === 0 ? (
            <BetaState label="No forecasts yet." />
          ) : (
            forecasts.map((forecast) => (
              <article key={forecast.id} className="group border border-[var(--fintheon-accent)]/12 bg-white/[0.025] p-3 transition-all duration-200 hover:-translate-y-px hover:border-[var(--fintheon-accent)]/22 hover:bg-[var(--fintheon-accent)]/[0.035]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm text-[var(--fintheon-text)]">{forecast.title}</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--fintheon-muted)]">{forecast.thesis}</p>
                  </div>
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]">
                    {forecast.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--fintheon-muted)]">
                  <span>{forecast.catalysts.length} catalysts</span>
                  <span>{forecast.timeframe}</span>
                  {forecast.probability !== null ? <span>{forecast.probability}%</span> : null}
                </div>
                {forecast.status === "draft" ? (
                  <button
                    type="button"
                    onClick={() => handlePublish(forecast.id)}
                    className="mt-3 inline-flex h-7 items-center gap-2 rounded-[4px] px-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)] transition hover:bg-[var(--fintheon-accent)]/8"
                  >
                    <RadioTower size={12} />
                    Publish
                  </button>
                ) : null}
              </article>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function BetaState({ label }: { label: string }) {
  return (
    <div className="narrative-analysis-panel flex min-h-[52vh] items-center justify-center px-6 text-center text-xs leading-5 text-[var(--fintheon-muted)]">
      {label}
    </div>
  );
}

function Field({ label, value, onChange }: FieldProps) {
  return (
    <label className="text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-9 w-full rounded-[4px] border border-[var(--fintheon-accent)]/14 bg-black/20 px-2 text-xs normal-case tracking-normal text-[var(--fintheon-text)] outline-none"
      />
    </label>
  );
}

function TextArea({ label, value, onChange }: FieldProps) {
  return (
    <label className="mt-2 block text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]">
      {label}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 min-h-20 w-full resize-y rounded-[4px] border border-[var(--fintheon-accent)]/14 bg-black/20 px-2 py-2 text-xs normal-case leading-5 tracking-normal text-[var(--fintheon-text)] outline-none"
      />
    </label>
  );
}

function toggleId(ids: string[], id: string): string[] {
  if (ids.includes(id)) return ids.filter((value) => value !== id);
  return [...ids, id];
}

function defaultForm() {
  return {
    title: "",
    thesis: "",
    probability: "",
    direction: "",
    timeframe: "2-4 weeks",
    validationRule: "",
    catalystIds: [] as string[],
  };
}

interface FieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}
