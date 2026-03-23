// [claude-code 2026-03-22] Theme-consistent styling — CSS vars, no bg fills on filter pills
// [claude-code 2026-03-19] Vertical timeline of extracted agent events for Consilium
import { useState, useEffect } from 'react';
import { AgentBadge, type BoardroomAgent } from './AgentBadge';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080';

interface DevelopmentEvent {
  id: string;
  agent: BoardroomAgent;
  title: string;
  detail: string;
  category: DevelopmentCategory;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  relatedInstruments?: string[];
}

type DevelopmentCategory = 'risk_alert' | 'trade_idea' | 'regime_shift' | 'standup' | 'briefing' | 'insight' | 'market_event' | 'huddle';

const CATEGORY_STYLES: Record<DevelopmentCategory, string> = {
  risk_alert: 'border-red-500/30 text-red-400/80',
  trade_idea: 'border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]',
  regime_shift: 'border-amber-500/30 text-amber-400/80',
  standup: 'border-[var(--fintheon-accent)]/15 text-[var(--fintheon-text)]/40',
  briefing: 'border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]/80',
  insight: 'border-[var(--fintheon-accent)]/20 text-[var(--fintheon-text)]/60',
  market_event: 'border-amber-500/30 text-amber-400/80',
  huddle: 'border-red-500/30 text-red-400/80',
};

const FILTER_CATEGORIES: DevelopmentCategory[] = ['risk_alert', 'trade_idea', 'regime_shift', 'standup', 'briefing', 'huddle'];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function groupByDate(events: DevelopmentEvent[]): Record<string, DevelopmentEvent[]> {
  const groups: Record<string, DevelopmentEvent[]> = {};
  for (const ev of events) {
    const key = new Date(ev.timestamp).toDateString();
    if (!groups[key]) groups[key] = [];
    groups[key].push(ev);
  }
  return groups;
}

export function DevelopmentsTimeline() {
  const [events, setEvents] = useState<DevelopmentEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<DevelopmentCategory | null>(null);
  const [agentFilter, setAgentFilter] = useState<BoardroomAgent | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDevelopments = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (categoryFilter) params.set('category', categoryFilter);
        if (agentFilter) params.set('agent', agentFilter);
        const qs = params.toString();
        const res = await fetch(`${API_BASE}/api/boardroom/developments${qs ? `?${qs}` : ''}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setEvents(data.events || []);
      } catch {
        setEvents([]);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDevelopments();
  }, [categoryFilter, agentFilter]);

  const grouped = groupByDate(events);
  const dateKeys = Object.keys(grouped).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  return (
    <div className="flex h-full flex-col">
      {/* Category filter chips — no background fills */}
      <div className="flex flex-wrap gap-1.5 border-b border-[var(--fintheon-accent)]/10 bg-[var(--fintheon-bg)] px-4 py-2">
        {FILTER_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-wider transition-colors ${
              categoryFilter === cat
                ? 'border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]'
                : 'border-[var(--fintheon-accent)]/10 text-[var(--fintheon-text)]/30 hover:text-[var(--fintheon-text)]/60'
            }`}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Timeline body */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-xs text-[var(--fintheon-text)]/30">Loading developments...</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2">
            <span className="text-sm text-[var(--fintheon-accent)]/40">No developments found</span>
            <span className="text-xs text-[var(--fintheon-text)]/20">
              {categoryFilter ? 'Try clearing filters' : 'Developments will appear as agents report'}
            </span>
          </div>
        ) : (
          dateKeys.map((dateKey) => (
            <div key={dateKey} className="mb-4">
              <div className="mb-2 text-xs uppercase tracking-wider text-[var(--fintheon-accent)]">
                {formatDate(grouped[dateKey][0].timestamp)}
              </div>
              <div className="relative ml-3 border-l border-[var(--fintheon-accent)]/20 pl-4">
                {grouped[dateKey].map((ev) => (
                  <div key={ev.id} className="relative mb-3">
                    {/* Dot on timeline */}
                    <div className="absolute -left-[21px] top-2 flex items-center justify-center">
                      {ev.severity === 'critical' ? (
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
                      ) : ev.severity === 'warning' ? (
                        <span className="h-2 w-2 rounded-full bg-amber-500/70" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-[var(--fintheon-accent)]/30" />
                      )}
                    </div>

                    {/* Event card */}
                    <button
                      className="w-full rounded-lg border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] px-3 py-2.5 text-left transition-colors hover:border-[var(--fintheon-accent)]/25"
                      onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}
                    >
                      <div className="flex items-start gap-2">
                        <AgentBadge agent={ev.agent} size="sm" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-[var(--fintheon-text)]">{ev.title}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase ${CATEGORY_STYLES[ev.category]}`}>
                              {ev.category.replace('_', ' ')}
                            </span>
                          </div>
                          <span className="text-[10px] text-[var(--fintheon-text)]/30">{formatTime(ev.timestamp)}</span>
                        </div>
                      </div>

                      {/* Related instruments */}
                      {ev.relatedInstruments && ev.relatedInstruments.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {ev.relatedInstruments.map((inst) => (
                            <span key={inst} className="rounded border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-accent)]/5 px-1.5 py-0.5 text-[10px] text-[var(--fintheon-accent)]/70">
                              {inst}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Expanded detail */}
                      {expandedId === ev.id && (
                        <p className="mt-2 whitespace-pre-wrap border-t border-[var(--fintheon-accent)]/10 pt-2 text-xs leading-relaxed text-[var(--fintheon-text)]/60">
                          {ev.detail}
                        </p>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
