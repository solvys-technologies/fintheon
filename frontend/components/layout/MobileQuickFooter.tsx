import { MessageCircle, Newspaper, Stadium, Users } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { FadingRuler } from "../shared/FadingRuler";
import type { SurfaceNavTab } from "../../lib/surface-capabilities";

type MobileConsiliumView = "chat" | "forum" | "arbitrum";

interface MobileQuickFooterProps {
  activeTab: SurfaceNavTab;
  activeConsiliumView: MobileConsiliumView;
  style?: CSSProperties;
  onTabChange: (tab: SurfaceNavTab) => void;
  onConsiliumView: (view: MobileConsiliumView) => void;
}

export function MobileQuickFooter({
  activeTab,
  activeConsiliumView,
  style,
  onTabChange,
  onConsiliumView,
}: MobileQuickFooterProps) {
  const footerStyle: CSSProperties = {
    ...style,
    paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 18px)",
  };

  return (
    <footer
      className="relative z-10 shrink-0 bg-[var(--fintheon-surface)] px-3 pt-2 md:hidden"
      data-mobile-quick-footer="true"
      style={footerStyle}
    >
      <FadingRuler className="opacity-45" />
      <nav
        className="grid h-[52px] grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] items-center"
        aria-label="Mobile quick access"
      >
        <FooterButton
          label="Desk"
          active={activeTab === "dashboard"}
          icon={<Users className="h-4 w-4" />}
          onClick={() => onTabChange("dashboard")}
        />
        <FadingRuler orientation="vertical" className="h-7 opacity-35" />
        <FooterButton
          label="Chat"
          active={activeTab === "analysis" && activeConsiliumView === "chat"}
          icon={<MessageCircle className="h-4 w-4" />}
          onClick={() => onConsiliumView("chat")}
        />
        <FadingRuler orientation="vertical" className="h-7 opacity-35" />
        <FooterButton
          label="Forum"
          active={activeTab === "analysis" && activeConsiliumView === "forum"}
          icon={<Stadium className="h-4 w-4" />}
          onClick={() => onConsiliumView("forum")}
        />
        <FadingRuler orientation="vertical" className="h-7 opacity-35" />
        <FooterButton
          label="RiskFlow"
          active={activeTab === "riskflow"}
          icon={<Newspaper className="h-4 w-4" />}
          onClick={() => onTabChange("riskflow")}
        />
      </nav>
    </footer>
  );
}

function FooterButton({
  label,
  active,
  icon,
  onClick,
}: {
  label: string;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-[6px] text-[9px] font-semibold uppercase tracking-[0.12em] transition-[color,transform,filter] active:scale-[0.97] ${
        active
          ? "text-[var(--fintheon-accent)]"
          : "text-[var(--fintheon-text)]/48 hover:text-[var(--fintheon-text)]/72"
      }`}
    >
      <span
        className={active ? "drop-shadow-[0_0_8px_rgba(199,159,74,.24)]" : ""}
      >
        {icon}
      </span>
      <span className="max-w-full truncate">{label}</span>
    </button>
  );
}
