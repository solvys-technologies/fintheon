// [claude-code 2026-03-22] Source of Truth fusion — full 14 commandments, extracted CommandmentsSidebar
// [claude-code 2026-03-20] S3:T3 — Apparatus redesign: circle constellation replaced with intelligence briefing cards
import { useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';
import { MemoryCard } from './MemoryCard';
import { CommandmentsSidebar } from './CommandmentsSidebar';
import type { AgentNode, AgentConnection, CronEntry, LiveActivity } from './types';

// ─── Agent Node Definitions ───────────────────────────────────────────
const AGENTS: AgentNode[] = [
  {
    id: 'harper',
    label: 'Harper',
    role: 'CAO',
    accentColor: '#c79f4a',
    memories: [
      { id: 'h1', fact: 'All Trade Ideas must flow through Harper for gatekeeper validation before H.E. approval', source: 'boardroom', timestamp: '2026-03-20T09:00:00', confidence: 1.0, version: 3, history: [{ version: 2, fact: 'Trade ideas route through Harper', timestamp: '2026-03-18T12:00:00' }] },
      { id: 'h2', fact: 'Morning Daily Brief delivered pre-market — macro overview + key levels + overnight moves', source: 'data', timestamp: '2026-03-20T06:30:00', confidence: 0.95, version: 2 },
      { id: 'h3', fact: 'Cross-desk risk aggregation flagged elevated NQ exposure — 3 concurrent positions', source: 'trade', timestamp: '2026-03-20T10:15:00', confidence: 0.88, version: 1 },
    ],
  },
  {
    id: 'oracle',
    label: 'Oracle',
    role: 'All-Seer',
    accentColor: '#a89060',
    memories: [
      { id: 'o1', fact: 'Kalshi S&P prediction: 72% probability SPX closes above 5800 by Friday', source: 'trade', timestamp: '2026-03-20T08:45:00', confidence: 0.72, version: 4, history: [{ version: 3, fact: 'S&P prediction: 68% above 5800', timestamp: '2026-03-19T14:00:00' }] },
      { id: 'o2', fact: 'BTC cycle analysis: accumulation phase — low volatility + high exchange outflows', source: 'mirofish', timestamp: '2026-03-20T07:30:00', confidence: 0.65, version: 2 },
      { id: 'o3', fact: 'FOMC dot plot shift detected — 2 rate cuts now priced for 2026 vs 3 prior', source: 'twitter', timestamp: '2026-03-19T16:00:00', confidence: 0.82, version: 1 },
    ],
  },
  {
    id: 'feucht',
    label: 'Feucht',
    role: 'Risk Desk',
    accentColor: '#d4af37',
    memories: [
      { id: 'f1', fact: '/NQ morning flush model triggered — watching 20450 EVEN for stink bid entry', source: 'trade', timestamp: '2026-03-20T09:32:00', confidence: 0.78, version: 2 },
      { id: 'f2', fact: 'VIX at 14.2 — low vol regime, reducing position sizes per Rule 5 (dial back in volatility)', source: 'mirofish', timestamp: '2026-03-20T09:00:00', confidence: 0.91, version: 1 },
      { id: 'f3', fact: 'TopStepX account balance: $52,340 — drawdown limit at $47,500 (9.3% buffer)', source: 'trade', timestamp: '2026-03-20T08:00:00', confidence: 1.0, version: 1 },
    ],
  },
  {
    id: 'consul',
    label: 'Consul',
    role: 'Fundamentals',
    accentColor: '#8a7a50',
    memories: [
      { id: 'c1', fact: 'NVDA earnings beat +12% — raised guidance on AI data center demand. Installed base thesis intact', source: 'data', timestamp: '2026-03-19T20:00:00', confidence: 0.92, version: 3 },
      { id: 'c2', fact: 'AAPL antitrust risk elevated — DOJ case timeline accelerated, potential App Store remedies by Q3', source: 'twitter', timestamp: '2026-03-20T07:15:00', confidence: 0.68, version: 1 },
      { id: 'c3', fact: 'Mega-cap tech P/E compression: avg forward P/E dropped from 32x to 28x over 6 weeks', source: 'mirofish', timestamp: '2026-03-20T06:00:00', confidence: 0.85, version: 2 },
    ],
  },
  {
    id: 'herald',
    label: 'Herald',
    role: 'Sentiment',
    accentColor: '#b8963a',
    memories: [
      { id: 'he1', fact: 'Twitter sentiment tracker: NQ bearish skew 62% — put/call ratio elevated at 1.4', source: 'twitter', timestamp: '2026-03-20T10:00:00', confidence: 0.74, version: 2 },
      { id: 'he2', fact: 'AAII survey: extreme bearish reading (48%) — historically contrarian bullish signal', source: 'data', timestamp: '2026-03-20T08:30:00', confidence: 0.81, version: 1 },
    ],
  },
];

// ─── Agent Connections ────────────────────────────────────────────────
const CONNECTIONS: AgentConnection[] = [
  { from: 'harper', to: 'oracle', type: 'context', label: 'Harper > Oracle', detail: 'Kalshi position approvals, prediction market oversight' },
  { from: 'harper', to: 'feucht', type: 'context', label: 'Harper > Feucht', detail: 'Trade idea validation, risk limit enforcement' },
  { from: 'harper', to: 'consul', type: 'context', label: 'Harper > Consul', detail: 'Fundamental thesis review, earnings calendar' },
  { from: 'harper', to: 'herald', type: 'context', label: 'Harper > Herald', detail: 'Sentiment alerts, daily brief inputs' },
  { from: 'oracle', to: 'consul', type: 'context', label: 'Oracle <> Consul', detail: 'Macro overlay: prediction markets informed by fundamental analysis' },
  { from: 'feucht', to: 'consul', type: 'context', label: 'Feucht <> Consul', detail: 'Earnings catalysts informing futures positioning' },
  { from: 'oracle', to: 'feucht', type: 'conflict', label: 'Oracle <> Feucht: NQ Direction', detail: 'Oracle sees SPX/NQ upside from prediction model; Feucht flagging elevated risk from VIX structure + morning flush pattern' },
];

// ─── Schedule Data ────────────────────────────────────────────────────
const CRON_SCHEDULE: CronEntry[] = [
  { agent: 'Harper', description: 'Morning Daily Brief', schedule: '6:00 AM ET' },
  { agent: 'Harper', description: 'Afternoon Daily Brief', schedule: '12:00 PM ET' },
  { agent: 'Harper', description: 'PM Daily Brief', schedule: '6:00 PM ET' },
  { agent: 'Oracle', description: 'Market scan window', schedule: '9:30 AM - 4:00 PM ET' },
  { agent: 'Feucht', description: 'Futures execution', schedule: '9:30 AM - 4:00 PM ET' },
  { agent: 'All Agents', description: 'Morning standup', schedule: '7:30 - 9:30 AM ET' },
];

const MOCK_ACTIVITY: LiveActivity[] = [
  { agent: 'Oracle', action: 'Scanning NQ futures — watching 20450 level', elapsed: '12s ago' },
  { agent: 'Harper', action: 'Aggregating cross-desk risk exposure', elapsed: '45s ago' },
  { agent: 'Herald', action: 'Ingesting Twitter sentiment batch (47 tweets)', elapsed: '2m ago' },
  { agent: 'Consul', action: 'Updating NVDA thesis post-earnings', elapsed: '8m ago' },
  { agent: 'Feucht', action: 'TopStepX position monitor — 2 active trades', elapsed: '15m ago' },
];

// ─── Conflict Detection ──────────────────────────────────────────────
const conflicts = CONNECTIONS.filter(c => c.type === 'conflict');

export function ApparatusPage() {
  const [showSchedule, setShowSchedule] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--fintheon-bg)] overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 px-4 py-3 border-b border-[var(--fintheon-accent)]/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-sm font-semibold text-[var(--fintheon-accent)] tracking-[0.15em] uppercase">Apparatus</h1>
          <span className="text-[9px] text-[var(--fintheon-text)]/30 font-mono">Intelligence Briefing</span>
        </div>
        <div className="flex items-center gap-2">
          {conflicts.map(c => (
            <div
              key={`${c.from}-${c.to}`}
              className="flex items-center gap-1.5 px-2 py-1 rounded border border-red-500/30 bg-red-500/5"
            >
              <AlertTriangle size={10} className="text-red-400" />
              <span className="text-[9px] text-red-400 font-mono">{c.label}</span>
            </div>
          ))}
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition-colors text-[10px] font-mono ${
              showSchedule
                ? 'border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/10 text-[var(--fintheon-accent)]'
                : 'border-[var(--fintheon-accent)]/15 text-[var(--fintheon-accent)]/50 hover:text-[var(--fintheon-accent)] hover:border-[var(--fintheon-accent)]/30'
            }`}
          >
            <Clock size={10} />
            Schedule
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left sidebar: Commandments (full 14 with Source of Truth metadata) */}
        <CommandmentsSidebar />

        {/* Center: Agent briefing cards grid */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {AGENTS.map(agent => {
              const isExpanded = expandedAgent === agent.id;
              const agentConflicts = conflicts.filter(
                c => c.from === agent.id || c.to === agent.id
              );
              const agentConnections = CONNECTIONS.filter(
                c => c.type === 'context' && (c.from === agent.id || c.to === agent.id)
              );

              return (
                <div
                  key={agent.id}
                  className={`border rounded-lg transition-all cursor-pointer ${
                    isExpanded
                      ? 'bg-[var(--fintheon-surface)] border-[var(--fintheon-accent)]/40 col-span-1 lg:col-span-2 xl:col-span-2'
                      : 'bg-[var(--fintheon-bg)] border-[var(--fintheon-accent)]/20 hover:border-[var(--fintheon-accent)]/40 hover:bg-[var(--fintheon-accent)]/5'
                  }`}
                  onClick={() => setExpandedAgent(prev => prev === agent.id ? null : agent.id)}
                >
                  {/* Card header */}
                  <div className="px-3 py-2.5 border-b border-[var(--fintheon-accent)]/10 flex items-center justify-between">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-semibold text-[var(--fintheon-text)] tracking-wide">{agent.label}</span>
                      <span className="text-[9px] text-[var(--fintheon-accent)]/50 font-mono uppercase">{agent.role}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {agentConflicts.length > 0 && (
                        <span className="text-[8px] text-red-400 font-mono border border-red-500/30 rounded px-1.5 py-0.5">
                          CONFLICT
                        </span>
                      )}
                      <span className="text-[8px] text-[var(--fintheon-accent)]/30 font-mono">
                        {agent.memories.length} facts
                      </span>
                    </div>
                  </div>

                  {/* Memory facts */}
                  <div className={`p-3 ${isExpanded ? 'grid grid-cols-2 gap-2' : 'space-y-2'}`}>
                    {(isExpanded ? agent.memories : agent.memories.slice(0, 2)).map(mem => (
                      <MemoryCard key={mem.id} memory={mem} />
                    ))}
                    {!isExpanded && agent.memories.length > 2 && (
                      <div className="text-[8px] text-[var(--fintheon-accent)]/30 font-mono text-center pt-1">
                        +{agent.memories.length - 2} more
                      </div>
                    )}
                  </div>

                  {/* Expanded: connections */}
                  {isExpanded && agentConnections.length > 0 && (
                    <div className="px-3 pb-3 border-t border-[var(--fintheon-accent)]/10 pt-2">
                      <span className="text-[8px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">Connections</span>
                      <div className="mt-1.5 space-y-1">
                        {agentConnections.map(conn => (
                          <div key={`${conn.from}-${conn.to}`} className="flex items-start gap-2">
                            <div className="w-1 h-1 rounded-full bg-[var(--fintheon-accent)]/30 mt-1.5 shrink-0" />
                            <div>
                              <span className="text-[9px] text-[var(--fintheon-accent)]/60 font-mono">{conn.label}</span>
                              <span className="text-[8px] text-[var(--fintheon-text)]/40 ml-1.5">{conn.detail}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expanded: conflict detail */}
                  {isExpanded && agentConflicts.map(conf => (
                    <div key={`${conf.from}-${conf.to}`} className="px-3 pb-3 border-t border-red-500/15 pt-2">
                      <div className="flex items-center gap-1.5 mb-1">
                        <AlertTriangle size={9} className="text-red-400" />
                        <span className="text-[8px] text-red-400 font-mono uppercase tracking-wider">Conflict</span>
                      </div>
                      <p className="text-[9px] text-red-400/70 leading-relaxed">{conf.detail}</p>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right sidebar: Schedule (conditional) */}
        {showSchedule && (
          <div className="w-[250px] shrink-0 border-l border-[var(--fintheon-accent)]/10 flex flex-col overflow-y-auto animate-fade-in-tab">
            <div className="p-3">
              <span className="text-[10px] font-semibold text-[var(--fintheon-accent)] tracking-[0.15em] uppercase block mb-2">
                Cron Schedule
              </span>
              <div className="space-y-1.5">
                {CRON_SCHEDULE.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <div className="w-1 h-1 rounded-full bg-[var(--fintheon-accent)]/40 mt-1.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-[9px] text-[var(--fintheon-text)]/70 font-mono">
                        <span className="text-[var(--fintheon-accent)]/80">{entry.agent}:</span> {entry.description}
                      </div>
                      <div className="text-[8px] text-[var(--fintheon-accent)]/30 font-mono">{entry.schedule}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 border-t border-[var(--fintheon-accent)]/10 flex-1">
              <span className="text-[10px] font-semibold text-[var(--fintheon-accent)] tracking-[0.15em] uppercase block mb-2">
                Live Activity
              </span>
              <div className="space-y-2">
                {MOCK_ACTIVITY.map((act, i) => (
                  <div key={i} className="flex items-start gap-2 py-1">
                    <div className="relative shrink-0 mt-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--fintheon-accent)]/60" />
                      {i === 0 && (
                        <div className="absolute inset-0 w-1.5 h-1.5 rounded-full bg-[var(--fintheon-accent)] animate-ping" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[9px] text-[var(--fintheon-text)]/60">
                        <span className="text-[var(--fintheon-accent)]/70 font-semibold">{act.agent}:</span>{' '}
                        {act.action}
                      </div>
                      <div className="text-[7px] text-[var(--fintheon-text)]/25 font-mono">{act.elapsed}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
