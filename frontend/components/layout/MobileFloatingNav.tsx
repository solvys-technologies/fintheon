import { useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  Landmark,
  LogOut,
  MessageCircle,
  Newspaper,
  Settings,
  Users,
  X,
} from "lucide-react";
import { ArbitrumGlyph } from "../icons/ArbitrumGlyph";
import { useDND } from "../../contexts/DNDContext";
import { useServerNotifications } from "../../contexts/NotificationsContext";
import type { SurfaceNavTab } from "../../lib/surface-capabilities";

type MenuMode = "nav" | "utility" | null;

interface MobileFloatingNavProps {
  activeTab: SurfaceNavTab;
  onTabChange: (tab: SurfaceNavTab) => void;
  onConsiliumView: (view: "chat" | "arbitrum") => void;
  onNotificationCenterToggle: () => void;
  onLogout: () => void;
}

export function MobileFloatingNav({
  activeTab,
  onTabChange,
  onConsiliumView,
  onNotificationCenterToggle,
  onLogout,
}: MobileFloatingNavProps) {
  const [mode, setMode] = useState<MenuMode>(null);
  const { queueCount } = useDND();
  const { unreadCount } = useServerNotifications();
  const badgeCount = queueCount + unreadCount;

  const openNav = mode === "nav";
  const openUtility = mode === "utility";
  const close = () => setMode(null);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 md:hidden">
      {mode && (
        <button
          type="button"
          className="pointer-events-auto absolute inset-0 bg-black/[0.15] backdrop-blur-[15px]"
          aria-label="Close mobile menu"
          onClick={close}
        />
      )}

      <div className="pointer-events-auto absolute left-3 top-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setMode(openNav ? null : "nav")}
          className="grid h-10 w-10 place-items-center rounded-md border border-[var(--fintheon-accent)]/30 bg-[var(--fintheon-accent)] text-black shadow-[0_0_22px_rgba(199,159,74,0.18)]"
          aria-label={openNav ? "Close navigation" : "Open navigation"}
        >
          {openNav ? <X className="h-4 w-4" /> : <Users className="h-4 w-4" />}
        </button>
        {openNav && (
          <FloatingList>
            <NavButton
              label="Desk"
              active={activeTab === "dashboard"}
              icon={<Users className="h-4 w-4" />}
              onClick={() => {
                onTabChange("dashboard");
                close();
              }}
            />
            <NavButton
              label="RiskFlow"
              active={activeTab === "riskflow"}
              icon={<Newspaper className="h-4 w-4" />}
              onClick={() => {
                onTabChange("riskflow");
                close();
              }}
            />
            <NavButton
              label="Calendar"
              active={activeTab === "econ"}
              icon={<CalendarDays className="h-4 w-4" />}
              onClick={() => {
                onTabChange("econ");
                close();
              }}
            />
            <NavButton
              label="Chat"
              active={activeTab === "analysis"}
              icon={<MessageCircle className="h-4 w-4" />}
              onClick={() => {
                onConsiliumView("chat");
                close();
              }}
            />
            <NavButton
              label="Arbitrum"
              active={activeTab === "analysis"}
              icon={<ArbitrumGlyph size={16} />}
              onClick={() => {
                onConsiliumView("arbitrum");
                close();
              }}
            />
          </FloatingList>
        )}
      </div>

      <div className="pointer-events-auto absolute bottom-3 left-3 flex flex-col-reverse gap-2">
        <button
          type="button"
          onClick={() => setMode(openUtility ? null : "utility")}
          className="relative grid h-10 w-10 place-items-center rounded-md border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-bg)] text-[var(--fintheon-accent)]"
          aria-label={openUtility ? "Close utilities" : "Open utilities"}
        >
          {openUtility ? (
            <X className="h-4 w-4" />
          ) : (
            <Landmark className="h-4 w-4" />
          )}
          {badgeCount > 0 && !openUtility ? (
            <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          ) : null}
        </button>
        {openUtility && (
          <FloatingList>
            <NavButton
              label="Alerts"
              active={false}
              badgeCount={badgeCount}
              icon={<Bell className="h-4 w-4" />}
              onClick={() => {
                onNotificationCenterToggle();
                close();
              }}
            />
            <NavButton
              label="Settings"
              active={activeTab === "settings"}
              icon={<Settings className="h-4 w-4" />}
              onClick={() => {
                onTabChange("settings");
                close();
              }}
            />
            <NavButton
              label="Log out"
              active={false}
              danger
              icon={<LogOut className="h-4 w-4" />}
              onClick={() => {
                onLogout();
                close();
              }}
            />
          </FloatingList>
        )}
      </div>
    </div>
  );
}

function FloatingList({ children }: { children: ReactNode }) {
  return (
    <div className="flex w-[154px] flex-col gap-1 rounded-md border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] p-1.5 shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
      {children}
    </div>
  );
}

function NavButton({
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
      className={`relative flex h-9 items-center gap-2 rounded-[4px] border px-2 text-left text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
        active
          ? "border-[var(--fintheon-accent)]/35 text-[var(--fintheon-accent)]"
          : danger
            ? "border-transparent text-red-400/70 hover:border-red-400/25 hover:text-red-400"
            : "border-transparent text-[var(--fintheon-muted)]/65 hover:border-[var(--fintheon-accent)]/15 hover:text-[var(--fintheon-text)]"
      }`}
    >
      <span className="grid h-5 w-5 place-items-center">{icon}</span>
      <span className="min-w-0 truncate">{label}</span>
      {badgeCount > 0 ? (
        <span className="ml-auto grid h-4 min-w-4 place-items-center rounded-full bg-red-500/85 px-1 text-[8px] text-white">
          {badgeCount > 9 ? "9+" : badgeCount}
        </span>
      ) : null}
    </button>
  );
}
