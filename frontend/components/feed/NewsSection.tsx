// [claude-code 2026-03-05] Add filter tabs: All, High, Medium, Proposals
// [claude-code 2026-03-10] Dropdown filters (Priority + Source), X/FJ filter, X CLI status dot.
// [claude-code 2026-03-26] T4: Replace inline cards with RiskFlowDetailCard, remove dead helpers
import { useEffect, useState, useMemo } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import { useSourceStatus } from '../../hooks/useSourceStatus';
import { useBackend } from '../../lib/backend';
import { RiskFlowDetailCard } from './RiskFlowDetailCard';

type PriorityFilter = 'all' | 'high' | 'medium';
type SourceFilter = 'all' | 'notion' | 'twitter';

export function NewsSection() {
  const { alerts, markAllSeen, isSeen } = useRiskFlow();
  const sourceStatus = useSourceStatus();
  const backend = useBackend();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showProposals, setShowProposals] = useState(false);

  useEffect(() => {
    markAllSeen(alerts.slice(0, 50).map((a) => a.id));
  }, [alerts, markAllSeen]);

  const requestNotifications = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      setNotificationsEnabled(permission === 'granted');
      if (permission === 'granted') {
        new Notification('Fintheon RiskFlow Alerts', {
          body: 'You will now receive notifications for breaking RiskFlow events',
          icon: '/favicon.ico',
        });
      }
    }
  };

  const handleGenerateNote = async (itemId: string) => {
    try {
      const rawId = itemId.replace('backend-', '');
      await backend.riskflow.refresh(); // Trigger backend refresh as proxy for note generation
      console.log('[RiskFlow] Note generation requested for:', rawId);
    } catch (err) {
      console.warn('[RiskFlow] Failed to generate note:', err);
    }
  };

  const highCount = alerts.filter((a) => a.severity === 'high').length;
  const medCount = alerts.filter((a) => a.severity === 'medium').length;
  const proposalCount = alerts.filter((a) => a.source === 'notion-trade-idea').length;

  const items = useMemo(() => {
    if (showProposals) return alerts.slice(0, 50).filter((a) => a.source === 'notion-trade-idea');
    let base = alerts.slice(0, 50);
    if (priorityFilter === 'high') base = base.filter((a) => a.severity === 'high');
    else if (priorityFilter === 'medium') base = base.filter((a) => a.severity === 'medium');
    if (sourceFilter === 'notion') base = base.filter((a) => a.source === 'notion-trade-idea' || (a.source as string).toLowerCase().includes('notion'));
    else if (sourceFilter === 'twitter') base = base.filter((a) => (a.source as string) === 'TwitterCli' || (a.source as string) === 'FinancialJuice' || (a.source as string).toLowerCase().includes('twitter'));
    return base;
  }, [alerts, priorityFilter, sourceFilter, showProposals]);

  return (
    <div className="h-full overflow-y-auto px-5 pt-4 pb-4">
      <div className="flex items-center justify-between mb-2 mt-1">
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.12em]">
          <span className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${sourceStatus.twitterCli ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            <span className={sourceStatus.twitterCli ? 'text-emerald-400/90' : 'text-zinc-500'}>X CLI</span>
          </span>
        </div>
        <button
          onClick={requestNotifications}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-[var(--fintheon-accent)] transition-colors px-2 py-1"
        >
          {notificationsEnabled ? (
            <Bell className="w-3.5 h-3.5" />
          ) : (
            <BellOff className="w-3.5 h-3.5" />
          )}
          {notificationsEnabled ? 'Notifications On' : 'Notifications'}
        </button>
      </div>

      {/* Filter row: Priority dropdown + Source dropdown + Proposals tab */}
      <div className="flex items-center gap-2 mb-3">
        <select
          value={showProposals ? 'all' : priorityFilter}
          onChange={(e) => { setShowProposals(false); setPriorityFilter(e.target.value as PriorityFilter); }}
          className="text-[10px] px-2 py-1 rounded bg-[var(--fintheon-bg)] border border-zinc-800 text-zinc-400 focus:outline-none focus:border-[var(--fintheon-accent)]/40 cursor-pointer"
        >
          <option value="all">Priority: All ({alerts.length})</option>
          <option value="high">High ({highCount})</option>
          <option value="medium">Medium ({medCount})</option>
        </select>
        <select
          value={showProposals ? 'all' : sourceFilter}
          onChange={(e) => { setShowProposals(false); setSourceFilter(e.target.value as SourceFilter); }}
          className="text-[10px] px-2 py-1 rounded bg-[var(--fintheon-bg)] border border-zinc-800 text-zinc-400 focus:outline-none focus:border-[var(--fintheon-accent)]/40 cursor-pointer"
        >
          <option value="all">Source: All</option>
          <option value="twitter">X / FJ</option>
        </select>
        <button
          onClick={() => setShowProposals((v) => !v)}
          className={`text-[10px] px-2.5 py-1 rounded transition-colors border ${
            showProposals
              ? 'bg-[var(--fintheon-accent)]/20 text-[var(--fintheon-accent)] border-[var(--fintheon-accent)]/40'
              : 'text-zinc-500 hover:text-[var(--fintheon-accent)] border-transparent'
          }`}
        >
          Proposals{proposalCount > 0 ? ` (${proposalCount})` : ''}
        </button>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center text-gray-500 py-12">
            <p>No RiskFlow items available</p>
            <p className="text-xs mt-2">Live feed is currently empty or disconnected</p>
          </div>
        ) : (
          items.map((item) => (
            <RiskFlowDetailCard
              key={item.id}
              alert={item}
              seen={isSeen(item.id)}
              onGenerateNote={handleGenerateNote}
            />
          ))
        )}
      </div>

      {/* Fintheon animation for high-severity rows */}
      <style>{`
        @keyframes riskflow-pulse {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: inset 0 0 12px rgba(239, 68, 68, 0.08); }
        }
        .riskflow-fintheon-row { animation: riskflow-pulse 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
