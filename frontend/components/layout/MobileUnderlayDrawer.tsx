import { useRef, type ReactNode } from "react";
import {
  Bell,
  Bot,
  CalendarDays,
  LogOut,
  MessageCircle,
  Newspaper,
  Settings,
  Users,
} from "lucide-react";
import { ArbitrumGlyph } from "../icons/ArbitrumGlyph";
import { useDND } from "../../contexts/DNDContext";
import { useServerNotifications } from "../../contexts/NotificationsContext";
import { useAuth } from "../../contexts/AuthContext";
import { useSettings } from "../../contexts/SettingsContext";
import type { SurfaceNavTab } from "../../lib/surface-capabilities";

interface MobileUnderlayDrawerProps {
  open: boolean;
  activeTab: SurfaceNavTab;
  onClose: () => void;
  onTabChange: (tab: SurfaceNavTab) => void;
  onConsiliumView: (view: "chat" | "arbitrum") => void;
  onNotificationCenterToggle: () => void;
  onLogout: () => void;
}

export function MobileUnderlayDrawer({
  open,
  activeTab,
  onClose,
  onTabChange,
  onConsiliumView,
  onNotificationCenterToggle,
  onLogout,
}: MobileUnderlayDrawerProps) {
  const { queueCount } = useDND();
  const { user } = useAuth();
  const { traderName } = useSettings();
  const { unreadCount } = useServerNotifications();
  const badgeCount = queueCount + unreadCount;
  const greetingName = traderName || user?.email?.split("@")[0] || "Operator";
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const runAndClose = (action: () => void) => {
    action();
    onClose();
  };

  const handleTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    swipeStartRef.current = touch
      ? { x: touch.clientX, y: touch.clientY }
      : null;
  };

  const handleTouchEnd = (event: React.TouchEvent<HTMLElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaX < -44 && deltaY < 42) onClose();
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-0 md:hidden">
      <aside
        aria-hidden={!open}
        data-mobile-underlay-drawer={open ? "open" : "closed"}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={`pointer-events-auto absolute bottom-2.5 left-2.5 top-[calc(env(safe-area-inset-top)+10px)] flex w-[min(300px,calc(100vw-72px))] flex-col overflow-hidden rounded-[16px] border border-[var(--fintheon-accent)]/12 px-2 py-3 shadow-[16px_0_34px_rgba(0,0,0,0.34)] transition-[transform,opacity] duration-[330ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${
          open
            ? "translate-x-0 opacity-100"
            : "-translate-x-[calc(100%+20px)] opacity-70"
        }`}
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--fintheon-surface) 78%, #8b887a 22%), color-mix(in srgb, var(--fintheon-bg) 76%, #6f6b5f 24%))",
          backdropFilter: "blur(18px) saturate(1.12)",
          WebkitBackdropFilter: "blur(18px) saturate(1.12)",
        }}
      >
        <div className="px-3 pb-4 pt-1">
          <p className="text-[16px] font-semibold uppercase tracking-[0.2em] text-[var(--fintheon-accent)]">
            Fintheon
          </p>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-[var(--fintheon-text)]/48">
            Desk ready, {greetingName}
          </p>
        </div>

        <nav
          className="flex flex-1 flex-col gap-1"
          aria-label="Mobile navigation"
        >
          <DrawerRow
            label="Desk"
            active={activeTab === "dashboard"}
            icon={<Users className="h-4 w-4" />}
            onClick={() => runAndClose(() => onTabChange("dashboard"))}
          />
          <DrawerRow
            label="RiskFlow"
            active={activeTab === "riskflow"}
            icon={<Newspaper className="h-4 w-4" />}
            onClick={() => runAndClose(() => onTabChange("riskflow"))}
          />
          <DrawerRow
            label="Calendar"
            active={activeTab === "econ"}
            icon={<CalendarDays className="h-4 w-4" />}
            onClick={() => runAndClose(() => onTabChange("econ"))}
          />
          <DrawerRow
            label="Chat"
            active={activeTab === "analysis"}
            icon={<MessageCircle className="h-4 w-4" />}
            onClick={() => runAndClose(() => onConsiliumView("chat"))}
          />
          <DrawerRow
            label="Arbitrum"
            active={activeTab === "analysis"}
            icon={<ArbitrumGlyph size={16} />}
            onClick={() => runAndClose(() => onConsiliumView("arbitrum"))}
          />
          <DrawerRow
            label="Desk Ops"
            active={activeTab === "desk-ops"}
            icon={<Bot className="h-4 w-4" />}
            onClick={() => runAndClose(() => onTabChange("desk-ops"))}
          />
          <DrawerRow
            label="Settings"
            active={activeTab === "settings"}
            icon={<Settings className="h-4 w-4" />}
            onClick={() => runAndClose(() => onTabChange("settings"))}
          />
        </nav>

        <div className="mt-3 space-y-1 border-t border-[var(--fintheon-accent)]/10 pt-2">
          {badgeCount > 0 ? (
            <DrawerRow
              label="Alerts"
              active={false}
              badgeCount={badgeCount}
              icon={<Bell className="h-4 w-4" />}
              onClick={() => runAndClose(onNotificationCenterToggle)}
            />
          ) : null}
          <DrawerRow
            label="Log out"
            active={false}
            danger
            icon={<LogOut className="h-4 w-4" />}
            onClick={() => runAndClose(onLogout)}
          />
        </div>
      </aside>
    </div>
  );
}

function DrawerRow({
  label,
  icon,
  active,
  danger,
  badgeCount = 0,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  active: boolean;
  danger?: boolean;
  badgeCount?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-12 w-full items-center gap-3 rounded-[6px] border px-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] transition-[background,border-color,color,transform] active:scale-[0.98] ${
        active
          ? "border-[var(--fintheon-accent)]/32 bg-[var(--fintheon-accent)]/13 text-[var(--fintheon-accent)]"
          : danger
            ? "border-transparent text-red-400/70 hover:border-red-400/25 hover:bg-red-500/8 hover:text-red-400"
            : "border-transparent text-[var(--fintheon-text)]/72 hover:border-[var(--fintheon-accent)]/18 hover:bg-black/12 hover:text-[var(--fintheon-text)]"
      }`}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-black/18 text-[var(--fintheon-accent)]/82">
        {icon}
      </span>
      <span className="min-w-0 truncate">{label}</span>
      {badgeCount > 0 ? (
        <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-red-500/85 px-1 text-[9px] font-bold text-white">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </button>
  );
}
