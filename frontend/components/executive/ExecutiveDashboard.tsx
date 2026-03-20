// [claude-code 2026-03-11] T8: Tale of the Tape label for Sun+Mon<7AM, show only first brief item
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useBackend } from '../../lib/backend';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import { useSchedule } from '../../contexts/ScheduleContext';
import type { ExecutiveKpi } from './mockExecutiveData';
import type { TradeIdeaDetail } from '../../lib/riskflow-feed';
import { KanbanTitle } from '../ui/KanbanTitle';
import { ExpandableTapeItem } from './ExpandableTapeItem';
import { SessionCalendarList } from './SessionCalendarList';
import TradeIdeaModal from '../TradeIdeaModal';
import { RegimeCard } from '../dashboard/RegimeCard';
import { RegimeTrackerModal } from '../regimes/RegimeTrackerModal';
import { SetupGuideCard, shouldShowSetupGuide } from '../onboarding/SetupGuideCard';
import { RefreshCw } from 'lucide-react';
import { AutoRefreshToggle } from '../ui/AutoRefreshToggle';
import { useSettings } from '../../contexts/SettingsContext';

const DASHBOARD_PAGES = ['Briefing', 'RiskFlow'];

function briefTypeToLabel(bt: string): string {
  switch (bt) {
    case 'MDB': return 'Dawn Dispatch';
    case 'ADB': return 'Midday Dispatch';
    case 'PMDB': return 'Dusk Dispatch';
    case 'TOTT': return 'The Weekly Tribune';
    default: return 'Latest Brief';
  }
}

export function ExecutiveDashboard() {
  const backend = useBackend();
  const { autoRefresh } = useSettings();
  const [activePage, setActivePage] = useState(0); // default to Briefing
  const containerRef = useRef<HTMLDivElement>(null);
  const [ntnText, setNtnText] = useState('');
  const { items: scheduleItems, loaded: scheduleLoaded } = useSchedule();
  const [kpis, setKpis] = useState<ExecutiveKpi[]>([]);
  const [ntnLoaded, setNtnLoaded] = useState(false);
  const [ntnRefreshing, setNtnRefreshing] = useState(false);
  const [kpisLoaded, setKpisLoaded] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(() => shouldShowSetupGuide());

  // Brief type: TOTT (Sun>=17:00 through Mon<7AM), MDB (<11AM), ADB (11AM-5:29PM), PMDB (5:30PM+)
  const getBriefLabel = () => {
    const now = new Date();
    const day = now.getDay();
    const h = now.getHours();
    const t = h * 60 + now.getMinutes();
    // TOTT: Sunday >= 17:00 through Monday < 07:00
    if ((day === 0 && t >= 17 * 60) || (day === 1 && h < 7)) return 'Tale of the Tape';
    if (t >= 17 * 60 + 30) return 'Post-Market Brief';
    if (t >= 11 * 60) return 'Afternoon Brief';
    return 'Morning Brief';
  };
  const [briefLabel, setBriefLabel] = useState(getBriefLabel);

  // Daily Brief from Notion — rotates MDB/ADB/PMDB, label from backend
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await backend.notion.getMdbBrief();
        if (cancelled) return;
        setNtnText(res.items[0]?.detail ?? '');
        if (res.briefType) setBriefLabel(briefTypeToLabel(res.briefType));
        else setBriefLabel(getBriefLabel());
      } catch (error) {
        console.warn('[Dashboard] Brief fetch failed:', error);
      } finally {
        if (!cancelled) setNtnLoaded(true);
      }
    };
    void load();
    const interval = setInterval(() => {
      if (!autoRefresh) return;
      void load();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backend, autoRefresh]);

  // Core KPIs from Notion Daily P&L database
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await backend.notion.getPerformance();
        if (cancelled) return;
        setKpis(res.kpis as ExecutiveKpi[]);
      } catch (error) {
        console.warn('[Dashboard] KPI fetch failed:', error);
        if (!cancelled) setKpis([]);
      } finally {
        if (!cancelled) setKpisLoaded(true);
      }
    };
    void load();
    const interval = setInterval(() => {
      if (!autoRefresh) return;
      void load();
    }, 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [backend, autoRefresh]);

  const refreshBrief = useCallback(async () => {
    setNtnRefreshing(true);
    try {
      const res = await backend.notion.getMdbBrief();
      setNtnText(res.items[0]?.detail ?? '');
      if (res.briefType) setBriefLabel(briefTypeToLabel(res.briefType));
    } catch (error) {
      console.warn('[Dashboard] Brief refresh failed:', error);
    } finally {
      setNtnRefreshing(false);
    }
  }, [backend]);

  // RiskFlow: same feed as RiskFlow panel and MinimalFeedSection (RiskFlowContext)
  const { alerts, markAllSeen, isSeen, notionPollStatus, refresh, refreshing } = useRiskFlow();
  const [selectedIdea, setSelectedIdea] = useState<TradeIdeaDetail | null>(null);
  const [showRegimeTracker, setShowRegimeTracker] = useState(false);
  const tapeAlerts = useMemo(() => alerts.slice(0, 50), [alerts]);

  useEffect(() => {
    markAllSeen(tapeAlerts.map((a) => a.id));
  }, [markAllSeen, tapeAlerts]);

  const scrollToPage = useCallback((idx: number) => {
    setActivePage(idx);
    const el = containerRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-dash-page]');
    if (pages[idx]) {
      pages[idx].scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Detect which page is in view on scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const pages = el.querySelectorAll('[data-dash-page]');
    const scrollTop = el.scrollTop;
    const containerH = el.clientHeight;
    let closest = 0;
    let minDist = Infinity;
    pages.forEach((page, idx) => {
      const rect = page.getBoundingClientRect();
      const elTop = rect.top - el.getBoundingClientRect().top;
      const dist = Math.abs(elTop);
      if (dist < minDist) {
        minDist = dist;
        closest = idx;
      }
    });
    setActivePage(closest);
  }, []);

  // Scroll to default page (Briefing) on mount
  useEffect(() => {
    const timer = setTimeout(() => scrollToPage(0), 50);
    return () => clearTimeout(timer);
  }, [scrollToPage]);

  return (
    <>
    {selectedIdea && (
      <TradeIdeaModal idea={selectedIdea} onClose={() => setSelectedIdea(null)} />
    )}
    {showRegimeTracker && (
      <RegimeTrackerModal onClose={() => setShowRegimeTracker(false)} />
    )}
    <div className="h-full w-full flex relative">
      {/* Main scrollable area */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scroll-smooth snap-y snap-mandatory"
      >
        {/* Page 1: Briefing (default) — NTK Brief + Session Calendar + Core KPIs + Action Tape */}
        <div data-dash-page="0" className="min-h-full snap-start p-5 flex flex-col">
          {/* Setup Guide — first-time onboarding */}
          {showSetupGuide && (
            <div className="shrink-0 mb-5">
              <SetupGuideCard onDismiss={() => setShowSetupGuide(false)} />
            </div>
          )}
          {/* Row 1: Need-to-Know Brief (left) + Session Calendar (right) */}
          <div className="shrink-0 grid grid-cols-1 xl:grid-cols-2 gap-6 mb-5" style={{ height: '380px' }}>
            {/* Need-to-Know Brief */}
            <div className="flex flex-col h-full min-h-0">
              <KanbanTitle
                title={briefLabel}
                tone="gold"
                headerRight={
                  <div className="flex items-center gap-1">
                    <AutoRefreshToggle size="xs" />
                    <button
                      type="button"
                      onClick={refreshBrief}
                      disabled={ntnRefreshing}
                      className="p-1 rounded hover:bg-[var(--fintheon-accent)]/10 text-zinc-500 hover:text-[var(--fintheon-accent)] transition-colors disabled:opacity-40"
                      title="Refresh brief"
                    >
                      <RefreshCw className={`w-3 h-3 ${ntnRefreshing ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                }
              />
              <textarea
                value={ntnText}
                readOnly
                className="mt-2 flex-1 min-h-0 w-full bg-[#0b0b08] px-4 py-3 text-sm text-gray-200 border-l-2 border-[var(--fintheon-accent)]/40 focus:outline-none focus:border-[var(--fintheon-accent)]"
                style={{ resize: 'vertical', minHeight: '80px' }}
                placeholder={ntnLoaded ? 'Awaiting AI-generated brief...' : 'Loading brief...'}
              />
              {ntnLoaded && !ntnText.trim() && (
                <p className="mt-2 text-xs text-zinc-500">
                  {notionPollStatus?.running
                    ? 'Notion connected. Awaiting brief…'
                    : 'No brief data available. Connect Notion/AI source to populate this field.'}
                </p>
              )}
            </div>

            {/* Session Calendar */}
            <div className="flex flex-col h-full min-h-0">
              <KanbanTitle
                title="Session Calendar"
                tone="cyan"
                headerRight={
                  <span className="text-[9px] tracking-[0.22em] uppercase border rounded-full px-2 py-0.5 text-[#67e8f9] border-[#06b6d4]/30">
                    Upcoming Events
                  </span>
                }
              />
              <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1 relative">
                {!scheduleLoaded ? (
                  <div className="text-xs text-zinc-500 py-3 px-1">Loading session calendar...</div>
                ) : scheduleItems.length === 0 ? (
                  <div className="text-xs text-zinc-500 py-3 px-1">
                    No economic events available. Start the backend or check Supabase connection.
                  </div>
                ) : (
                  <SessionCalendarList items={scheduleItems} />
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Core KPIs — single horizontal row, static */}
          <div className="shrink-0 mb-5">
            <KanbanTitle title="Core KPIs" tone="emerald" />
            {!kpisLoaded ? (
              <div className="mt-2 text-xs text-zinc-500 px-1 py-3">Loading KPI data...</div>
            ) : kpis.length === 0 ? (
              <div className="mt-2 text-xs text-zinc-500 px-1 py-3">
                No performance data connected.
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 xl:grid-cols-4 gap-3">
                {kpis.map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-[#0b0b08] px-4 py-3 border-l-2 border-[var(--fintheon-accent)]/35"
                  >
                    <div className="text-[10px] tracking-[0.2em] uppercase text-gray-500">{kpi.label}</div>
                    <div className="mt-1.5 text-2xl font-semibold text-white">{kpi.value}</div>
                    <div className="mt-1 text-xs text-gray-400">{kpi.meta}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Row 2.5: Regime Tracker preview */}
          <div className="shrink-0 mb-5">
            <RegimeCard onOpenTracker={() => setShowRegimeTracker(true)} />
          </div>

          {/* Row 3: RiskFlow — fills remaining space, expandable items, recency fade */}
          <div className="flex-1 min-h-0 flex flex-col">
            <KanbanTitle title="RiskFlow" tag="Alerts + Signals" tone="emerald" headerRight={
              <div className="flex items-center gap-1">
                <AutoRefreshToggle size="xs" />
                <button
                  type="button"
                  onClick={() => { void refresh(); }}
                  disabled={refreshing}
                  className="p-1 rounded hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
                  title="Refresh feeds"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            } />
            <div className="mt-2 flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5">
              {tapeAlerts.length === 0 ? (
                <div className="text-xs text-gray-500 px-1 py-4">No actions in the feed right now.</div>
              ) : (
                tapeAlerts.map((alert, idx) => {
                  const total = tapeAlerts.length;
                  const ratio = total <= 1 ? 0 : idx / (total - 1);
                  const baseOpacity = Math.max(0.3, 1 - ratio * 0.7);
                  const seen = isSeen(alert.id);
                  const opacity = seen ? Math.max(0.2, baseOpacity * 0.55) : baseOpacity;
                  const borderOpacity = Math.max(0.15, 0.4 - ratio * 0.25);
                  const isVivid = idx < 4 && !seen;

                  return (
                    <ExpandableTapeItem
                      key={alert.id}
                      alert={alert}
                      isVivid={isVivid}
                      opacity={opacity}
                      borderOpacity={borderOpacity}
                      seen={seen}
                      onOpenIdea={setSelectedIdea}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Page 2: Full RiskFlow */}
        <div data-dash-page="1" className="min-h-full snap-start p-5 flex flex-col">
          <KanbanTitle title="RiskFlow" tag="Full Feed" tone="emerald" headerRight={
              <div className="flex items-center gap-1">
                <AutoRefreshToggle size="xs" />
                <button
                  type="button"
                  onClick={() => { void refresh(); }}
                  disabled={refreshing}
                  className="p-1 rounded hover:bg-emerald-500/10 text-zinc-500 hover:text-emerald-400 transition-colors disabled:opacity-40"
                  title="Refresh feeds"
                >
                  <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
              </div>
            } />
          <div className="mt-3 flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5">
            {tapeAlerts.length === 0 ? (
              <div className="text-xs text-gray-500 px-1 py-8 text-center">No actions in the feed right now.</div>
            ) : (
              tapeAlerts.map((alert, idx) => {
                const total = tapeAlerts.length;
                const ratio = total <= 1 ? 0 : idx / (total - 1);
                const baseOpacity = Math.max(0.35, 1 - ratio * 0.65);
                const seen = isSeen(alert.id);
                const opacity = seen ? Math.max(0.25, baseOpacity * 0.6) : baseOpacity;
                const borderOpacity = Math.max(0.15, 0.4 - ratio * 0.25);
                const isVivid = idx < 6 && !seen;

                return (
                  <ExpandableTapeItem
                    key={alert.id}
                    alert={alert}
                    isVivid={isVivid}
                    opacity={opacity}
                    borderOpacity={borderOpacity}
                    seen={seen}
                    onOpenIdea={setSelectedIdea}
                  />
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Scroll-lock page indicators — vertical lines on the right */}
      <div className="shrink-0 w-6 flex flex-col items-center justify-center gap-3 py-8">
        {DASHBOARD_PAGES.map((label, idx) => (
          <button
            key={label}
            onClick={() => scrollToPage(idx)}
            className="group relative flex items-center justify-center"
            title={label}
          >
            <div
              className={`transition-all duration-300 rounded-full ${
                activePage === idx
                  ? 'w-[3px] h-8 bg-[var(--fintheon-accent)]'
                  : 'w-[2px] h-5 bg-gray-700 hover:bg-gray-500'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
    </>
  );
}
