import {
  BookOpen,
  Bot,
  CalendarDays,
  LayoutDashboard,
  PlusCircle,
  RefreshCw,
  User,
} from "lucide-react";

type JournalTab = "human" | "agent";
type PerformanceView = "dashboard" | "calendar";

interface PerformanceToolbarProps {
  activeTab: JournalTab;
  view: PerformanceView;
  isRefreshing: boolean;
  projectxStatus: string;
  onRefresh: () => void;
  onTabChange: (tab: JournalTab) => void;
  onViewChange: (view: PerformanceView) => void;
  onAddAccount: () => void;
}

const tabs: { key: JournalTab; label: string; icon: typeof User }[] = [
  { key: "human", label: "Human", icon: User },
  { key: "agent", label: "Agent", icon: Bot },
];

const views: { key: PerformanceView; label: string; icon: typeof User }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
];

export function PerformanceToolbar({
  activeTab,
  view,
  isRefreshing,
  projectxStatus,
  onRefresh,
  onTabChange,
  onViewChange,
  onAddAccount,
}: PerformanceToolbarProps) {
  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <span className="text-sm font-semibold text-[var(--fintheon-text)]">
            Performance
          </span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 transition-colors"
          title={`ProjectX: ${projectxStatus}`}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 text-[var(--fintheon-accent)] ${
              isRefreshing ? "animate-spin" : ""
            }`}
          />
        </button>
      </div>
      <div className="flex items-center px-3 pt-2 pb-1 gap-1">
        {tabs.map((tab) => (
          <ModeButton
            key={tab.key}
            icon={tab.icon}
            label={tab.label}
            active={activeTab === tab.key}
            onClick={() => onTabChange(tab.key)}
          />
        ))}
        <div className="w-px h-4 bg-(--fintheon-accent)/20 mx-0.5" />
        {views.map((item) => (
          <ModeButton
            key={item.key}
            icon={item.icon}
            label={item.label}
            active={view === item.key}
            onClick={() => onViewChange(item.key)}
          />
        ))}
        <button
          onClick={onAddAccount}
          className="ml-auto flex items-center gap-1 px-2 py-1 text-[10px] text-(--fintheon-accent) hover:text-(--fintheon-text) transition-colors"
          title="Add account"
        >
          <PlusCircle className="w-3 h-3" />
          Account
        </button>
      </div>
    </>
  );
}

function ModeButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof User;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
        active
          ? "bg-(--fintheon-accent) text-black"
          : "bg-(--fintheon-surface) text-(--fintheon-muted) hover:text-(--fintheon-text) border border-(--fintheon-accent)/10"
      }`}
    >
      <Icon className="w-3 h-3" />
      {label}
    </button>
  );
}
