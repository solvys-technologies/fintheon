// [claude-code 2026-03-05] Add filter tabs: All, High, Medium, Proposals
// [claude-code 2026-03-10] Dropdown filters (Priority + Source), X/FJ filter, X CLI status dot.
// [claude-code 2026-03-10] T3: critical severity support in labels, points, color display
// [claude-code 2026-03-12] Card overhaul: SVG logos replace source text, remove Neutral bias,
//   right-justify cyclical badge, fix point scoring, match sidebar card design
import { useEffect, useState, useMemo } from 'react';
import { Bell, BellOff, ExternalLink, TrendingUp, TrendingDown } from 'lucide-react';
import { useRiskFlow } from '../../contexts/RiskFlowContext';
import { useSourceStatus } from '../../hooks/useSourceStatus';
import { SEVERITY_CONFIG } from '../../lib/severity-config';

type PriorityFilter = 'all' | 'high' | 'medium';
type SourceFilter = 'all' | 'notion' | 'twitter';

type FlowTag = 'Commentary' | 'Econ' | 'Geopol';
type FlowBias = 'Bullish' | 'Bearish' | 'Neutral';
type FlowCycle = 'Cyclical' | 'Counter-cyclical';

const ECON_KEYWORDS = [
  'cpi', 'ppi', 'inflation', 'jobs', 'payroll', 'nfp', 'gdp', 'rate', 'fomc',
  'fed', 'yield', 'bond', 'claims', 'retail sales', 'pce', 'umich', 'consumer sentiment',
];

const GEOPOL_KEYWORDS = [
  'war', 'geopolitical', 'sanction', 'tariff', 'military', 'border', 'opec',
  'iran', 'china', 'russia', 'ukraine', 'conflict', 'election', 'embargo',
  'attack', 'strike', 'bomb', 'missile', 'naval', 'tanker', 'oil port', 'invasion',
];

const BULLISH_KEYWORDS = [
  'beat', 'beats', 'rally', 'surge', 'gain', 'gains', 'up', 'cooling inflation',
  'below expectations', 'bullish', 'upgrade', 'easing',
];

const BEARISH_KEYWORDS = [
  'miss', 'misses', 'drop', 'selloff', 'fall', 'falls', 'down', 'crisis', 'downgrade',
  'hot inflation', 'above expectations', 'recession', 'panic', 'risk', 'collapse',
  'attack', 'war', 'strike', 'bomb',
];

function classifyTag(text: string): FlowTag {
  const lower = text.toLowerCase();
  if (GEOPOL_KEYWORDS.some((kw) => lower.includes(kw))) return 'Geopol';
  if (ECON_KEYWORDS.some((kw) => lower.includes(kw))) return 'Econ';
  return 'Commentary';
}

function classifyBias(text: string, direction?: 'long' | 'short' | 'neutral'): FlowBias {
  if (direction === 'long') return 'Bullish';
  if (direction === 'short') return 'Bearish';
  const lower = text.toLowerCase();
  const bull = BULLISH_KEYWORDS.some((kw) => lower.includes(kw));
  const bear = BEARISH_KEYWORDS.some((kw) => lower.includes(kw));
  if (bull && !bear) return 'Bullish';
  if (bear && !bull) return 'Bearish';
  return 'Neutral';
}

function classifyCycle(tag: FlowTag): FlowCycle {
  return tag === 'Commentary' ? 'Cyclical' : 'Counter-cyclical';
}

function impliedPoints(
  severity: 'critical' | 'high' | 'medium' | 'low',
  tag: FlowTag
): number {
  const base = severity === 'critical' ? 30 : severity === 'high' ? 22 : severity === 'medium' ? 12 : 6;
  const multiplier = tag === 'Geopol' ? 1.6 : tag === 'Econ' ? 1.3 : 1.0;
  return Number((base * multiplier).toFixed(0));
}

// ── SVG Source Logos ──────────────────────────────────────────────────────────

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="X">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function NotionLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-label="Notion">
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L18.45 2.29c-.42-.326-.98-.7-2.055-.607L3.62 2.87c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.887c-.56.046-.747.326-.747.933zm14.337.745c.093.42 0 .84-.42.886l-.7.14v10.264c-.607.327-1.167.514-1.634.514-.747 0-.933-.234-1.494-.934l-4.577-7.186v6.952l1.447.327s0 .84-1.167.84l-3.22.187c-.093-.187 0-.653.327-.746l.84-.233V9.854L7.46 9.76c-.093-.42.14-1.026.793-1.073l3.453-.233 4.763 7.28v-6.44l-1.214-.14c-.093-.513.28-.886.747-.933zM2.667 1.21l13.728-1.027c1.68-.14 2.1.093 2.8.606l3.874 2.707c.466.326.606.746.606 1.26v15.7c0 .933-.326 1.493-1.494 1.586l-15.457.933c-.84.047-1.26-.093-1.727-.653L1.88 19.01c-.513-.653-.746-1.166-.746-1.86V2.89c0-.84.373-1.54 1.54-1.68z" />
    </svg>
  );
}

function SourceIcon({ source, className }: { source: string; className?: string }) {
  const s = source.toLowerCase();
  if (s === 'notion-trade-idea' || s.includes('notion')) {
    return <NotionLogo className={className} />;
  }
  // Everything else (financial-juice, twitter, X CLI, etc.) → X logo
  return <XLogo className={className} />;
}

function CyclicalBadge({ cycle }: { cycle: FlowCycle }) {
  const isCyclical = cycle === 'Cyclical';
  return (
    <span
      className={`text-[9px] font-bold tracking-[0.12em] uppercase px-1.5 py-0.5 border ${
        isCyclical
          ? 'border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)]/80 bg-[var(--fintheon-accent)]/5'
          : 'border-violet-500/30 text-violet-400/80 bg-violet-500/5'
      }`}
    >
      {isCyclical ? 'Cyclical' : 'Counter-cyclical'}
    </span>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NewsSection() {
  const { alerts, markAllSeen, isSeen, notionPollStatus } = useRiskFlow();
  const sourceStatus = useSourceStatus();
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
        new Notification('PULSE RiskFlow Alerts', {
          body: 'You will now receive notifications for breaking RiskFlow events',
          icon: '/favicon.ico',
        });
      }
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
            <span className={`w-1.5 h-1.5 rounded-full ${notionPollStatus?.running ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
            <span className={notionPollStatus?.running ? 'text-emerald-400/90' : 'text-zinc-500'}>Notion</span>
          </span>
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
          <option value="notion">Notion</option>
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
          items.map((item) => {
            const seen = isSeen(item.id);
            const combinedText = `${item.headline} ${item.summary ?? ''} ${(item.tags || []).join(' ')}`;
            const tag = classifyTag(combinedText);
            const bias = classifyBias(combinedText, item.tradeIdea?.direction);
            const cycle = classifyCycle(tag);
            const pts = impliedPoints(item.severity, tag);
            const sev = SEVERITY_CONFIG[item.severity];
            const isHigh = item.severity === 'high' || item.severity === 'critical';
            const isBullish = bias === 'Bullish';
            const isBearish = bias === 'Bearish';
            return (
              <a
                key={item.id}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`group block bg-[var(--fintheon-bg)] border border-zinc-800/60 px-4 py-3 transition-colors hover:border-[var(--fintheon-accent)]/30 ${
                  seen ? 'opacity-60' : ''
                } ${isHigh ? 'riskflow-pulse-row' : ''}`}
              >
                {/* Row 1: Priority badge + Headline + Cyclical right-justified */}
                <div className="flex items-start gap-2">
                  <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${sev.bg} ${sev.text} ${sev.border} border ${sev.glow || ''} flex-shrink-0 mt-0.5`}>
                    {sev.label}
                  </span>
                  <p className={`flex-1 text-sm leading-snug font-medium ${
                    item.severity === 'critical' ? 'text-orange-300' : isHigh ? 'text-red-300' : 'text-zinc-200'
                  } group-hover:text-white transition-colors`}>
                    {item.headline}
                  </p>
                  <div className="flex-shrink-0 ml-2">
                    <CyclicalBadge cycle={cycle} />
                  </div>
                </div>

                {/* Row 2: Summary (if present) */}
                {item.summary && item.summary !== item.headline && (
                  <p className="text-[11px] text-zinc-500 line-clamp-2 mt-1.5 ml-8">{item.summary}</p>
                )}

                {/* Row 3: Source logo + time + direction + points + link */}
                <div className="flex items-center gap-2 mt-2 ml-8">
                  <SourceIcon source={item.source} className="w-3 h-3 text-zinc-500" />
                  <span className="text-[10px] text-zinc-600">{timeAgo(item.publishedAt)}</span>
                  <span className="text-zinc-700">&middot;</span>
                  <span className={`text-[10px] font-semibold ${isBullish ? 'text-emerald-400' : isBearish ? 'text-red-400' : 'text-zinc-600'}`}>
                    {isBullish ? <TrendingUp className="w-3 h-3 inline" /> : isBearish ? <TrendingDown className="w-3 h-3 inline" /> : null}
                    {bias !== 'Neutral' && <span className="ml-0.5">{bias}</span>}
                  </span>
                  <span className="text-zinc-700">&middot;</span>
                  <span className="text-[10px] text-zinc-500 tabular-nums">
                    /ES ±{pts} pts
                  </span>
                  <ExternalLink className="w-3 h-3 text-zinc-700 opacity-0 group-hover:opacity-100 transition-opacity ml-auto flex-shrink-0" />
                </div>
              </a>
            );
          })
        )}
      </div>

      {/* Pulse animation for high-severity rows */}
      <style>{`
        @keyframes riskflow-pulse {
          0%, 100% { box-shadow: none; }
          50% { box-shadow: inset 0 0 12px rgba(239, 68, 68, 0.08); }
        }
        .riskflow-pulse-row { animation: riskflow-pulse 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
