import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useBackend } from "../../lib/backend";
import { useToast } from "../../contexts/ToastContext";
import { KanbanTitle } from "../ui/KanbanTitle";

const API_BASE =
  (import.meta as any).env?.VITE_API_URL || "http://localhost:8080";

export function DeskBriefingPanel() {
  const backend = useBackend();
  const { addToast } = useToast();
  const [briefText, setBriefText] = useState("");
  const [briefLabel, setBriefLabel] = useState(getBriefLabel);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadBrief = useCallback(async () => {
    try {
      const response = await backend.data.getMdbBrief();
      setBriefText(response.items[0]?.detail ?? "");
      setBriefLabel(
        response.briefType
          ? briefTypeToLabel(response.briefType)
          : getBriefLabel(),
      );
    } catch (error) {
      console.warn("[Desk] Brief fetch failed:", error);
    } finally {
      setIsLoaded(true);
    }
  }, [backend]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (cancelled) return;
      await loadBrief();
    }
    void load();
    const interval = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [loadBrief]);

  const refreshBrief = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      const apiBase = API_BASE.replace(/\/$/, "");
      const response = await fetch(`${apiBase}/api/data/brief/ensure-current`, {
        method: "POST",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = (await response.json().catch(() => null)) as {
        content?: string;
        briefType?: string;
        generated?: boolean;
      } | null;
      if (!payload?.content) {
        await loadBrief();
        return;
      }
      setBriefText(payload.content);
      setBriefLabel(
        payload.briefType
          ? briefTypeToLabel(payload.briefType)
          : getBriefLabel(),
      );
      addToast(
        payload.generated ? "Brief generated" : "Brief is current",
        "success",
      );
    } catch (error) {
      console.warn("[Desk] Brief refresh failed:", error);
      addToast("Brief refresh failed", "error");
    } finally {
      setIsRefreshing(false);
    }
  }, [addToast, isRefreshing, loadBrief]);

  return (
    <section className="flex min-h-0 flex-col overflow-hidden px-2 py-1">
      <KanbanTitle
        title={briefLabel}
        tone="gold"
        headerRight={
          <button
            type="button"
            onClick={refreshBrief}
            disabled={isRefreshing}
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)] disabled:opacity-40"
            title="Refresh brief"
            aria-label="Refresh brief"
          >
            <RefreshCw
              className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        }
      />
      <div className="prose prose-sm prose-invert mt-2 min-h-0 flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-[var(--fintheon-text)]/85 prose-headings:text-xs prose-headings:uppercase prose-headings:tracking-wider prose-headings:text-[var(--fintheon-accent)] prose-strong:text-[var(--fintheon-text)] prose-a:text-[var(--fintheon-accent)] prose-li:text-[var(--fintheon-text)]/75 prose-code:rounded-[2px] prose-code:bg-[var(--fintheon-accent)]/10 prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[11px] prose-hr:border-[var(--fintheon-accent)]/10">
        {briefText ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{briefText}</ReactMarkdown>
        ) : (
          <span className="italic text-[var(--fintheon-text)]/30">
            {isLoaded ? "Awaiting AI-generated brief..." : "Loading brief..."}
          </span>
        )}
      </div>
    </section>
  );
}

function briefTypeToLabel(briefType: string): string {
  if (briefType === "MDB") return "Dawn Dispatch";
  if (briefType === "ADB") return "Midday Dispatch";
  if (briefType === "PMDB") return "Dusk Dispatch";
  if (briefType === "TWT") return "The Weekly Tribune";
  return "Latest Brief";
}

function getBriefLabel() {
  const now = new Date();
  const day = now.getDay();
  const minuteOfDay = now.getHours() * 60 + now.getMinutes();
  if (
    (day === 0 && minuteOfDay >= 17 * 60) ||
    (day === 1 && now.getHours() < 7)
  )
    return "The Weekly Tribune";
  if (minuteOfDay < 6 * 60 + 30 || minuteOfDay >= 17 * 60 + 30)
    return "Dusk Dispatch";
  if (minuteOfDay >= 11 * 60) return "Midday Dispatch";
  return "Dawn Dispatch";
}
