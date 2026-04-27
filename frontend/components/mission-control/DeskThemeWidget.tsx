// [claude-code 2026-04-27] S46.4/G: DeskTheme widget for the Strategium
// pane. Pulls the latest desk theme from /api/day-plan/today (which is
// populated by the same generator that writes the desk_theme block into
// MDB / ADB / PMDB briefs). Tap-to-expand → in-place full reader pulls
// the matching brief content.
//
// Visual: flat solvys-feels surface — translucent bg + thin accent border,
// no Kanban frames, no gradients, no AI sparkles, no backdrop-blur ornament.

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";
import type { DayPlan } from "../../types/day-plan";

const API_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

type BriefType = "MDB" | "ADB" | "PMDB";

interface BriefResponse {
  items: Array<{ title: string; detail: string }>;
  briefType?: string;
}

function pickBriefType(): BriefType {
  // Mirrors backend brief-generator.getCurrentBriefType cadence:
  // overnight + AM → MDB, midday → ADB, after the close → PMDB.
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const hour = Number(fmt.find((p) => p.type === "hour")?.value ?? "0");
  if (hour < 11) return "MDB";
  if (hour < 16) return "ADB";
  return "PMDB";
}

export function DeskThemeWidget() {
  const [plan, setPlan] = useState<DayPlan | null>(null);
  const [brief, setBrief] = useState<BriefResponse | null>(null);
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  const briefType = pickBriefType();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [planRes, briefRes] = await Promise.all([
        fetch(`${API_BASE}/api/day-plan/today`).then((r) =>
          r.ok ? (r.json() as Promise<{ plan: DayPlan | null }>) : null,
        ),
        fetch(`${API_BASE}/api/data/brief?type=${briefType}`).then((r) =>
          r.ok ? (r.json() as Promise<BriefResponse>) : null,
        ),
      ]);
      setPlan(planRes?.plan ?? null);
      setBrief(briefRes ?? null);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [briefType]);

  useEffect(() => {
    void fetchAll();
    const id = window.setInterval(fetchAll, 5 * 60_000);
    return () => window.clearInterval(id);
  }, [fetchAll]);

  // rAF reveal so the t-panel-slide tween runs on entry.
  useEffect(() => {
    if (!open) {
      setRevealed(false);
      return;
    }
    const id = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const themeText = plan?.deskTheme ?? null;
  const eventName = plan?.eventName ?? null;
  const fullBrief = brief?.items?.[0]?.detail ?? null;

  return (
    <div
      style={{
        background: "transparent",
        padding: 12,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-3.5 h-3.5 text-[var(--fintheon-accent)]" />
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fintheon-accent)]">
            Desk Plan
          </h3>
          <span className="text-[9px] uppercase tracking-wider text-zinc-500">
            {briefType}
          </span>
        </div>
        {fullBrief && (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="text-[10px] uppercase tracking-wider text-zinc-500 hover:text-[var(--fintheon-accent)] inline-flex items-center gap-1"
          >
            {open ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            {open ? "Collapse" : "Read"}
          </button>
        )}
      </div>

      <div className="mt-2 text-[12px] leading-snug text-[var(--fintheon-text)] min-h-[24px]">
        {loading ? (
          <span className="text-zinc-600 text-[11px]">Loading…</span>
        ) : themeText ? (
          <>
            {eventName && (
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 mr-1">
                {eventName} ·
              </span>
            )}
            {themeText}
          </>
        ) : (
          <span className="text-zinc-600 text-[11px]">
            No desk plan published for today.
          </span>
        )}
      </div>

      {open && fullBrief && (
        <div
          className="t-panel-slide"
          data-open={revealed ? "true" : "false"}
          style={{ marginTop: 8 }}
        >
          <div
            aria-hidden="true"
            style={{
              height: 1,
              background:
                "linear-gradient(to right, transparent 0%, color-mix(in srgb, var(--fintheon-accent) 35%, transparent) 50%, transparent 100%)",
              marginBottom: 8,
            }}
          />
          <pre className="text-[11px] leading-relaxed text-zinc-300 whitespace-pre-wrap font-mono max-h-[260px] overflow-y-auto pr-1">
            {fullBrief}
          </pre>
        </div>
      )}
    </div>
  );
}
