// [claude-code 2026-04-18] S24-T4: Admin sub-tabs — Scoring / Approvals / Monitor
import { useState, type ReactNode } from "react";
import { SlidersHorizontal, Inbox, Activity } from "lucide-react";
import { RefinementEngine } from "../refinement/RefinementEngine";
import { ApprovalsPage } from "./ApprovalsPage";
import { MonitoringLoopCard } from "./MonitoringLoopCard";

type AdminSection = "scoring" | "approvals" | "monitor";

interface TabDef {
  id: AdminSection;
  label: string;
  Icon: typeof Inbox;
}

const TABS: TabDef[] = [
  { id: "scoring", label: "Scoring", Icon: SlidersHorizontal },
  { id: "approvals", label: "Approvals", Icon: Inbox },
  { id: "monitor", label: "Monitor", Icon: Activity },
];

function TabButton({
  tab,
  active,
  onClick,
  badge,
}: {
  tab: TabDef;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  const { Icon, label } = tab;
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        fontFamily: "var(--font-data)",
        fontSize: 11,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: active ? "var(--fintheon-accent)" : "var(--fintheon-muted)",
        background: active
          ? "color-mix(in srgb, var(--fintheon-accent) 8%, transparent)"
          : "transparent",
        border: `1px solid ${active ? "color-mix(in srgb, var(--fintheon-accent) 35%, transparent)" : "transparent"}`,
        borderRadius: 3,
        cursor: "pointer",
      }}
    >
      <Icon size={12} />
      {label}
      {typeof badge === "number" && badge > 0 && (
        <span
          style={{
            padding: "1px 6px",
            fontSize: 9,
            fontWeight: 700,
            color: "var(--fintheon-bg)",
            background: "var(--fintheon-accent)",
            borderRadius: 10,
          }}
        >
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}

interface AdminShellProps {
  initialSection?: AdminSection;
  approvalsBadge?: number;
}

export function AdminShell({
  initialSection = "scoring",
  approvalsBadge,
}: AdminShellProps) {
  const [section, setSection] = useState<AdminSection>(initialSection);

  const views: Record<AdminSection, ReactNode> = {
    scoring: <RefinementEngine />,
    approvals: <ApprovalsPage />,
    monitor: <MonitoringLoopCard />,
  };

  return (
    <div className="h-full w-full flex flex-col bg-[var(--fintheon-bg)]">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderBottom: "1px solid var(--fintheon-glass-border)",
        }}
      >
        {TABS.map((t) => (
          <TabButton
            key={t.id}
            tab={t}
            active={section === t.id}
            onClick={() => setSection(t.id)}
            badge={t.id === "approvals" ? approvalsBadge : undefined}
          />
        ))}
      </div>
      <div className="flex-1 min-h-0">{views[section]}</div>
    </div>
  );
}
