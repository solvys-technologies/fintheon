import { useState } from "react";
import { BookOpen, ShieldAlert } from "lucide-react";
import { cn } from "../../lib/utils";
import { RiskSignalCards } from "../narrative/RiskSignalCards";
import { DeskPlansFeed } from "./DeskPlansFeed";

type DeskRailTab = "plans" | "signals";

export function DeskRail() {
  const [activeTab, setActiveTab] = useState<DeskRailTab>("plans");

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--fintheon-bg)] text-[var(--fintheon-text)]">
      <header className="border-b border-[var(--fintheon-accent)]/10 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[9px] text-[var(--fintheon-accent)]/60">
              Desk
            </p>
            <h1 className="mt-1 text-[12px] font-semibold text-[var(--fintheon-text)]/88">
              Plans & Signals
            </h1>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-md border border-[var(--fintheon-accent)]/12 bg-black/20 p-1">
            <DeskRailTabButton
              icon={BookOpen}
              label="Plans"
              selected={activeTab === "plans"}
              onClick={() => setActiveTab("plans")}
            />
            <DeskRailTabButton
              icon={ShieldAlert}
              label="Signals"
              selected={activeTab === "signals"}
              onClick={() => setActiveTab("signals")}
            />
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "plans" ? (
          <DeskPlansFeed />
        ) : (
          <div className="h-full overflow-y-auto px-3 py-3">
            <RiskSignalCards compact />
          </div>
        )}
      </div>
    </section>
  );
}

function DeskRailTabButton({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: typeof BookOpen;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-[4px] px-2 text-[10px] font-semibold transition-colors",
        selected
          ? "bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]"
          : "text-[var(--fintheon-muted)]/45 hover:bg-[var(--fintheon-accent)]/5 hover:text-[var(--fintheon-text)]/72",
      )}
      aria-pressed={selected}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
