// [claude-code 2026-03-12] Renamed user-facing label "Trading Journal" → "Performance"
// [claude-code 2026-03-11] Track 7A: TradingJournal — Human/Agent toggle tabs
import { useState, useEffect, useCallback } from 'react';
import { BookOpen, User, Bot, RefreshCw } from 'lucide-react';
import { useBackend } from '../../lib/backend';
import { AutoRefreshToggle } from '../ui/AutoRefreshToggle';
import { HumanPsychTab } from './HumanPsychTab';
import { AgentPerformanceTab } from './AgentPerformanceTab';
import type { JournalEntryItem, JournalSummaryResponse } from '../../lib/services';

type JournalTab = 'human' | 'agent';

export function TradingJournal() {
  const backend = useBackend();
  const [activeTab, setActiveTab] = useState<JournalTab>('human');
  const [entries, setEntries] = useState<JournalEntryItem[]>([]);
  const [summary, setSummary] = useState<JournalSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, summaryRes] = await Promise.all([
        backend.journal.listEntries({ limit: 30 }),
        backend.journal.getSummary(30),
      ]);
      setEntries(entriesRes.entries);
      setSummary(summaryRes);
    } catch (err) {
      console.warn('Failed to fetch journal data:', err);
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const tabs: { key: JournalTab; label: string; icon: typeof User }[] = [
    { key: 'human', label: 'Human', icon: User },
    { key: 'agent', label: 'Agent', icon: Bot },
  ];

  return (
    <div className="bg-[var(--fintheon-bg)] h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--fintheon-accent)]/10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-[var(--fintheon-accent)]" />
          <span className="text-sm font-semibold text-[var(--fintheon-text)]">Performance</span>
        </div>
        <div className="flex items-center gap-1">
          <AutoRefreshToggle />
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--fintheon-muted)] ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex px-3 pt-2 gap-1">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[var(--fintheon-accent)] text-black'
                  : 'bg-[var(--fintheon-surface)] text-[var(--fintheon-muted)] hover:text-[var(--fintheon-text)] border border-[var(--fintheon-accent)]/10'
              }`}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {loading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-[10px] text-[var(--fintheon-muted)]">
            Loading journal...
          </div>
        ) : activeTab === 'human' ? (
          <HumanPsychTab entries={entries} onRefresh={fetchData} />
        ) : (
          <AgentPerformanceTab entries={entries} summary={summary} />
        )}
      </div>
    </div>
  );
}
