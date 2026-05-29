import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Landmark, MessageCircle, Stadium } from "lucide-react";
import { ArbitrumGlyph } from "../icons/ArbitrumGlyph";
import { ChatSidebar } from "../chat/ChatSidebar";
import { ArbitrumChamber } from "../arbitrum/ArbitrumChamber";
import { ProxVoiceForum } from "../proxvoice/ProxVoiceForum";
import { FadingRuler } from "../shared/FadingRuler";

export type ConsiliumLiteView = "chat" | "forum" | "arbitrum";

export function ConsiliumLite() {
  const [view, setView] = useState<ConsiliumLiteView>("chat");

  useEffect(() => {
    const handler = (event: Event) => {
      const next = (event as CustomEvent<{ view?: ConsiliumLiteView }>).detail
        ?.view;
      if (next === "chat" || next === "forum" || next === "arbitrum") {
        setView(next);
      }
    };
    window.addEventListener("fintheon:consilium-lite-view", handler);
    return () =>
      window.removeEventListener("fintheon:consilium-lite-view", handler);
  }, []);

  const selectView = (next: ConsiliumLiteView) => {
    setView(next);
    window.dispatchEvent(
      new CustomEvent("fintheon:consilium-lite-view-changed", {
        detail: { view: next },
      }),
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--fintheon-bg)]">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[var(--fintheon-accent)]/10 px-3">
        <div className="flex min-w-0 items-center gap-1.5 pr-1">
          <Landmark className="h-3.5 w-3.5 text-[var(--fintheon-accent)]" />
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-[var(--fintheon-accent)] sm:inline">
            Consilium
          </span>
        </div>
        <FadingRuler orientation="vertical" className="h-5" />
        <LiteButton
          label="Chat"
          selected={view === "chat"}
          onClick={() => selectView("chat")}
          icon={<MessageCircle className="h-3.5 w-3.5" />}
        />
        <LiteButton
          label="Forum"
          selected={view === "forum"}
          onClick={() => selectView("forum")}
          icon={<Stadium className="h-3.5 w-3.5" />}
        />
        <LiteButton
          label="Arbitrum"
          selected={view === "arbitrum"}
          onClick={() => selectView("arbitrum")}
          icon={<ArbitrumGlyph size={14} />}
        />
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">
        {view === "chat" ? (
          <ChatSidebar compact={false} />
        ) : view === "forum" ? (
          <ProxVoiceForum />
        ) : (
          <div className="h-full overflow-y-auto px-3 py-3">
            <ArbitrumChamber />
          </div>
        )}
      </div>
    </div>
  );
}

function LiteButton({
  label,
  selected,
  icon,
  onClick,
}: {
  label: string;
  selected: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex h-7 items-center gap-1.5 rounded-[4px] border px-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
        selected
          ? "border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]"
          : "border-transparent text-[var(--fintheon-muted)]/55 hover:border-[var(--fintheon-accent)]/15 hover:text-[var(--fintheon-text)]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
