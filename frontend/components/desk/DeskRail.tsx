import { useState } from "react";
import { BookOpen, Inbox, ShieldAlert, Users } from "lucide-react";
import { cn } from "../../lib/utils";
import { RiskSignalCards } from "../narrative/RiskSignalCards";
import { DeskPlansFeed } from "./DeskPlansFeed";
import { DeskInboxFeed } from "./DeskInboxFeed";

type DeskRailTab = "plans" | "signals" | "inbox";

export function DeskRail() {
  const [activeTab, setActiveTab] = useState<DeskRailTab>("plans");

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[var(--fintheon-bg)] text-[var(--fintheon-text)]">
      <header className="border-b border-[var(--fintheon-accent)]/10 px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="h-4 w-4 shrink-0 text-[var(--fintheon-accent)]/70" />
            <div className="min-w-0">
              <p className="font-mono text-[9px] text-[var(--fintheon-accent)]/60">
                Desk
              </p>
              <h1 className="mt-1 text-[12px] font-semibold text-[var(--fintheon-text)]/88">
                Plans & Signals
              </h1>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1">
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
            <DeskRailTabButton
              icon={Inbox}
              label="Inbox"
              selected={activeTab === "inbox"}
              onClick={() => setActiveTab("inbox")}
            />
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab === "plans" ? (
          <DeskPlansFeed compact maxItems={8} />
        ) : activeTab === "inbox" ? (
          <DeskInboxFeed />
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
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-[4px] border px-2 text-[10px] font-semibold transition-colors",
        selected
          ? "border-[color-mix(in_srgb,var(--fintheon-accent)_34%,transparent)] bg-transparent text-[var(--fintheon-accent)]"
          : "border-transparent bg-transparent text-[color-mix(in_srgb,var(--fintheon-muted)_45%,transparent)] hover:border-[color-mix(in_srgb,var(--fintheon-accent)_16%,transparent)] hover:text-[color-mix(in_srgb,var(--fintheon-text)_72%,transparent)]",
      )}
      aria-pressed={selected}
    >
      <Icon className="h-3 w-3" />
      {label}
    </button>
  );
}
