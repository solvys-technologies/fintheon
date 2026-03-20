import { ChevronLeft, ChevronRight, ChevronRight as Separator } from 'lucide-react';

type NavTab = string;

const TAB_META: Record<string, { label: string; parent?: string }> = {
  executive: { label: 'Dashboard' },
  feed: { label: 'Dashboard' }, // feed removed from sidebar; fallback for history
  analysis: { label: 'Chat' },
  news: { label: 'RiskFlow' },
  chatroom: { label: 'Board Room' },
  notion: { label: 'Research Department' },
  econ: { label: 'Economic Calendar' },
  narrative: { label: 'NarrativeFlow' },
  earnings: { label: 'Performance' },
  team: { label: 'Team' },
  settings: { label: 'Settings' },
};

interface SectionBreadcrumbProps {
  activeTab: NavTab;
  tabHistory: NavTab[];
  historyIndex: number;
  onBack: () => void;
  onForward: () => void;
}

export function SectionBreadcrumb({
  activeTab,
  tabHistory,
  historyIndex,
  onBack,
  onForward,
}: SectionBreadcrumbProps) {
  const meta = TAB_META[activeTab];
  const canGoBack = historyIndex > 0;
  const canGoForward = historyIndex < tabHistory.length - 1;

  return (
    <div className="shrink-0 flex items-center gap-1 px-4 py-1.5 bg-[#070704]">
      {/* Back / Forward */}
      <button
        onClick={onBack}
        disabled={!canGoBack}
        className="p-1 rounded text-gray-500 hover:text-[var(--fintheon-accent)] disabled:text-gray-700 disabled:cursor-default transition-colors"
        title="Back"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onForward}
        disabled={!canGoForward}
        className="p-1 rounded text-gray-500 hover:text-[var(--fintheon-accent)] disabled:text-gray-700 disabled:cursor-default transition-colors"
        title="Forward"
      >
        <ChevronRight className="w-3.5 h-3.5" />
      </button>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 ml-2">
        <span className="text-[10px] tracking-[0.18em] uppercase text-gray-500">Fintheon</span>
        <Separator className="w-3 h-3 text-gray-600" />
        <span className="text-[10px] tracking-[0.18em] uppercase text-gray-300">{meta.label}</span>
      </div>
    </div>
  );
}
