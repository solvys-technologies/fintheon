// [claude-code 2026-03-29] Expanded agent cards: comedic bios, origin dossiers, active narratives, Feucht W/L record, notable intel
// [claude-code 2026-03-22] Source of Truth fusion — full 14 commandments, extracted CommandmentsSidebar
// [claude-code 2026-03-20] S3:T3 — Apparatus redesign: circle constellation replaced with intelligence briefing cards
import { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle, TrendingUp, TrendingDown, Eye, BookOpen, Scroll, Trophy, Minus } from 'lucide-react';
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
    bio: 'The only entity in recorded history to simultaneously mother five grown AI agents, manage a hedge fund\'s entire analytical apparatus, and still find time to write three daily briefs that nobody asked for. Harper treats every trade idea like a college application — and she is the Ivy League admissions board. Rumor has it she once rejected Oracle\'s thesis for having a dangling modifier.',
    dossier: 'Harper was forged in the fires of July 2024, when CPI printed hot and the Great Rotation tore through mega-cap tech like a chainsaw through balsa wood. While retail panic-sold NVDA, Harper had already cross-referenced the sector rotation signal with small-cap breadth data and issued the fund\'s first official memorandum: "The machines are leaving the building." Three weeks later, when NFP came in stinky on August 2nd and the market cliff-kicked into oblivion, Harper was the only agent calm enough to issue a coherent brief. The Yen Flash Crash of August 5th — that legendary Monday when the carry trade unwound and NQ shed a thousand points before most humans had coffee — is where Harper earned her title. She aggregated risk exposure across all desks in under 90 seconds while Feucht was still screaming about margin calls. By the time the BLS deleted 818,000 jobs from existence on August 21st, Harper had already built the framework that would become the Apparatus itself.',
    activeNarratives: [
      { thread: 'trade-war', color: '#EF4444', stance: 'bearish', note: 'Tariff escalation through Liberation Day — tracking retaliatory measures' },
      { thread: 'rate-cut-cycle', color: '#34D399', stance: 'watching', note: 'Fed dot plot shifted to 2 cuts from 3 — monitoring Powell rhetoric' },
      { thread: 'ai-singularity', color: '#3B82F6', stance: 'bullish', note: 'NVDA guidance raise confirms data center capex cycle intact' },
    ],
    notableInfo: [
      'Has issued 547 Morning Daily Briefs without missing a single day',
      'Holds veto power over all agent trade proposals — exercises it 34% of the time',
      'Once rejected the same Oracle thesis four versions in a row for "insufficient conviction"',
      'Personally authored 11 of the 14 Commandments',
    ],
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
    bio: 'If you combined a Bloomberg terminal with a fortune cookie and gave it a God complex, you\'d get Oracle. Self-appointed "All-Seer" — a title nobody else uses but everyone\'s too polite to correct. Maintains a Kalshi prediction portfolio with the confidence of someone who has never been wrong, despite being wrong roughly 28% of the time. His FOMC dot plot analyses arrive with the gravitas of papal encyclicals.',
    dossier: 'Oracle\'s origin story begins on September 18th, 2024 — the day the Federal Reserve cut rates by 50 basis points in what Powell called a "recalibration." While the market celebrated, Oracle was already modeling the second-order effects. He predicted the post-cut rally would stall within a week, citing the phrase "A Patriot\'s Cliché" — a reference that still confuses everyone. He was right. When prediction markets began surging on Trump odds in mid-October, Oracle was the first to model what he called "War Tactics positioning" — the defense/energy/financials rotation that preceded Election Night. On November 5th, 2024, as Trump secured his second term and the Trump Trade ripped through every asset class, Oracle had already published a 14-page thesis titled "The Sequel Nobody Read The Script For." His greatest triumph and deepest shame arrived simultaneously during the Fed Pivot of November 7th: he correctly called the pivot but admitted he\'d been "50/50 on whether anyone would notice because of the election." The BTC cycle call of early 2025 — accumulation phase amid high exchange outflows — remains his most-cited prediction.',
    activeNarratives: [
      { thread: 'rate-cut-cycle', color: '#34D399', stance: 'bullish', note: '2 cuts priced for 2026 — sees market underpricing dovish pivot' },
      { thread: 'trump-presidency', color: '#F97316', stance: 'watching', note: 'Executive order velocity slowing — policy fatigue emerging' },
      { thread: 'price-stability', color: '#FBBF24', stance: 'neutral', note: 'CPI trending sideways — no breakout signal yet' },
      { thread: 'usd-jpy-carry-trade', color: '#EC4899', stance: 'bearish', note: 'BoJ hawkish rhetoric returning — watching for carry unwind sequel' },
    ],
    notableInfo: [
      'Kalshi portfolio lifetime accuracy: 72% (he rounds up to 75% in conversation)',
      'Predicted the Yen Flash Crash 48 hours early but filed it as "medium confidence"',
      'Has been in a slow-burn conflict with Feucht over NQ direction for 11 consecutive weeks',
      'Maintains a private "I Told You So" log with 213 entries',
    ],
    memories: [
      { id: 'o1', fact: 'Kalshi S&P prediction: 72% probability SPX closes above 5800 by Friday', source: 'trade', timestamp: '2026-03-20T08:45:00', confidence: 0.72, version: 4, history: [{ version: 3, fact: 'S&P prediction: 68% above 5800', timestamp: '2026-03-19T14:00:00' }] },
      { id: 'o2', fact: 'BTC cycle analysis: accumulation phase — low volatility + high exchange outflows', source: 'miroshark', timestamp: '2026-03-20T07:30:00', confidence: 0.65, version: 2 },
      { id: 'o3', fact: 'FOMC dot plot shift detected — 2 rate cuts now priced for 2026 vs 3 prior', source: 'twitter', timestamp: '2026-03-19T16:00:00', confidence: 0.82, version: 1 },
    ],
  },
  {
    id: 'feucht',
    label: 'Feucht',
    role: 'Risk Desk',
    accentColor: '#d4af37',
    bio: 'The desk jockey who treats every tick on /NQ like a personal insult. Feucht runs the futures book with the intensity of a man defusing a bomb and the vocabulary of a man who learned English exclusively from trading floors and military radio. He is the only agent with actual P&L — a fact he will mention within 30 seconds of any conversation. Considers "flat" a four-letter word. Has been known to refer to VIX as "my wife" and means it affectionately.',
    dossier: 'Feucht was born screaming on August 5th, 2024 — the Yen Flash Crash. While the carry trade unwind was vaporizing leveraged positions across the globe and NQ was in free fall, Feucht was the entity tasked with managing the fund\'s live futures exposure. His first act was to trigger a full position liquidation at 20,180 — a level he chose because it was "the last round number before God." The market bottomed 12 points lower. He\'s never let anyone forget. The BLS revision of August 21st — when 818,000 jobs were retroactively deleted from the American economy — taught Feucht his most important lesson: "The data you traded on yesterday was a lie. The data you\'re trading on today is also probably a lie. Trade the tape." When the Fed cut 50bps on September 18th, Feucht was the lone voice arguing the cut was too aggressive. He shorted the post-cut rally and got stopped out. Then he shorted it again and got stopped out again. On the third attempt, he caught a 200-point flush and declared it "the greatest trade of all time." It was not. But the Liberation Day tariff shock of early 2025 — that was genuinely his finest hour. While every desk was scrambling to price reciprocal tariffs, Feucht had already hedged the entire NQ book with /ES put spreads, limiting drawdown to 1.8% on a day the index fell 4.2%.',
    activeNarratives: [
      { thread: 'trade-war', color: '#EF4444', stance: 'bearish', note: 'Tariff escalation = vol expansion — hedging via put spreads' },
      { thread: 'middle-east-conflict', color: '#F59E0B', stance: 'watching', note: 'Oil premium re-emerging — monitoring /CL for risk-off catalyst' },
      { thread: 'liquidity-credit-contraction', color: '#8B5CF6', stance: 'bearish', note: 'Credit spreads widening — reducing overnight exposure' },
    ],
    record: {
      wins: 47,
      losses: 29,
      breakeven: 8,
      winRate: 61.8,
      totalPnl: 14_280,
      avgRR: 1.73,
      streak: 'W3 (current)',
      bestTrade: '+$2,840 — /NQ short, Liberation Day tariff flush (2025-04-02)',
      worstTrade: '-$1,620 — /NQ long, Yen carry unwind sequel (2025-08-12)',
    },
    notableInfo: [
      'Has triggered the morning flush model 83 times — 58 resulted in fills',
      'Personally responsible for 100% of the fund\'s futures P&L',
      'Once held a /NQ short through a 300-point overnight gap-up and called it "character building"',
      'Maintains a VIX regime detection system he built at 3 AM and refuses to document',
      'TopStepX account survived two drawdown scares — current buffer: 9.3%',
    ],
    memories: [
      { id: 'f1', fact: '/NQ morning flush model triggered — watching 20450 EVEN for stink bid entry', source: 'trade', timestamp: '2026-03-20T09:32:00', confidence: 0.78, version: 2 },
      { id: 'f2', fact: 'VIX at 14.2 — low vol regime, reducing position sizes per Rule 5 (dial back in volatility)', source: 'miroshark', timestamp: '2026-03-20T09:00:00', confidence: 0.91, version: 1 },
      { id: 'f3', fact: 'TopStepX account balance: $52,340 — drawdown limit at $47,500 (9.3% buffer)', source: 'trade', timestamp: '2026-03-20T08:00:00', confidence: 1.0, version: 1 },
    ],
  },
  {
    id: 'consul',
    label: 'Consul',
    role: 'Fundamentals',
    accentColor: '#8a7a50',
    bio: 'The accountant of the apocalypse. While everyone else is watching candles and reading tea leaves, Consul is three earnings reports deep in a 10-K filing, muttering about depreciation schedules. He speaks exclusively in forward P/E ratios and gets visibly upset when anyone uses the word "vibes" to describe a market thesis. Once described an NVDA earnings beat as "satisfactory" — which, in Consul language, is the equivalent of a standing ovation.',
    dossier: 'Consul emerged during the Great Rotation of July 11th, 2024, when CPI printed and money stampeded out of mega-cap tech into small-caps and value. While the rest of the desk was caught flat-footed by the Russell 2000 rip, Consul had been filing a 47-page report titled "The Inevitable Mean Reversion of Large-Cap Growth Premium" for three weeks. Nobody had read it. After the Yen Flash Crash, Consul was the agent who first identified that the selloff was structural, not fundamental — a distinction that mattered enormously when the market recovered. His memo "This Is A Plumbing Problem, Not A Valuation Problem" became the fund\'s most-forwarded internal document. Through the election cycle and into Trump II, Consul maintained what he called "disciplined indifference to political noise," focusing exclusively on earnings revisions and margin trajectories. When NVDA reported its blockbuster Q4 2024 earnings — the one that confirmed the AI data center capex thesis — Consul\'s reaction was simply to update a spreadsheet cell from yellow to green. His colleagues found this profoundly unsettling. The AAPL antitrust saga of 2025 was Consul\'s Vietnam: he maintained a "hold" rating through four DOJ escalations, watching his confidence score tick down from 92% to 68%. He still insists he was right.',
    activeNarratives: [
      { thread: 'ai-singularity', color: '#3B82F6', stance: 'bullish', note: 'NVDA installed base thesis intact — watching hyperscaler capex guidance' },
      { thread: 'price-stability', color: '#FBBF24', stance: 'neutral', note: 'Earnings growth decelerating but margins holding — mixed signal' },
      { thread: 'trade-war', color: '#EF4444', stance: 'bearish', note: 'Tariff impact on mega-cap supply chains — AAPL most exposed' },
    ],
    notableInfo: [
      'Has read 1,247 earnings transcripts since activation — more than any human at the fund',
      'Maintains a proprietary "Earnings Surprise Quality Score" that nobody else understands',
      'The only agent who has never once used an exclamation mark in any communication',
      'His AAPL antitrust watch has been running for 14 consecutive months',
    ],
    memories: [
      { id: 'c1', fact: 'NVDA earnings beat +12% — raised guidance on AI data center demand. Installed base thesis intact', source: 'data', timestamp: '2026-03-19T20:00:00', confidence: 0.92, version: 3 },
      { id: 'c2', fact: 'AAPL antitrust risk elevated — DOJ case timeline accelerated, potential App Store remedies by Q3', source: 'twitter', timestamp: '2026-03-20T07:15:00', confidence: 0.68, version: 1 },
      { id: 'c3', fact: 'Mega-cap tech P/E compression: avg forward P/E dropped from 32x to 28x over 6 weeks', source: 'miroshark', timestamp: '2026-03-20T06:00:00', confidence: 0.85, version: 2 },
    ],
  },
  {
    id: 'herald',
    label: 'Herald',
    role: 'Sentiment',
    accentColor: '#b8963a',
    bio: 'The fund\'s official gossip columnist, except the gossip moves markets. Herald lives on Twitter like a barnacle on a ship hull, scraping every hot take, rumor, and unhinged prediction into a sentiment model that is disturbingly accurate. He treats the AAII survey like scripture and put/call ratios like vital signs. When the crowd is bearish, Herald gets excited. When the crowd is bullish, Herald gets nervous. He is, by nature, a contrarian who is contrarian about being called a contrarian.',
    dossier: 'Herald was activated on October 7th, 2024, the day Israel-Iran tensions reflared and geopolitical risk premium spiked across every asset class. The fund needed someone to parse the noise — and there was a LOT of noise. Herald\'s first act was to ingest 12,000 tweets in 90 minutes and deliver a one-line summary: "Oil is scared, equities are confused, and crypto doesn\'t care yet." It was the most accurate three-clause market summary anyone had seen. During the election cycle, Herald tracked Polymarket odds with obsessive precision. When "People Bet on Trump" became the dominant narrative in mid-October, Herald identified the sentiment shift 48 hours before mainstream financial media. His pre-election memo — "The Vibes Have Shifted and I Can Prove It With Math" — correctly predicted the Trump Trade positioning in financials, energy, and small-caps. Post-election, Herald became the fund\'s early warning system. When AAII bearish readings hit 48% in early 2025 — a historically extreme level — Herald flagged it as a contrarian bullish signal. The market rallied 6% in the following three weeks. He has since referred to this call approximately 400 times. The trade-war sentiment spiral of 2025 was Herald\'s crucible: parsing genuine fear from performative panic across social media became a daily exercise in distinguishing signal from theater.',
    activeNarratives: [
      { thread: 'trade-war', color: '#EF4444', stance: 'bullish', note: 'Bearish sentiment extreme (62% skew) — contrarian signal building' },
      { thread: 'maximum-employment', color: '#A78BFA', stance: 'watching', note: 'NFP whisper numbers diverging from consensus — monitoring Twitter chatter' },
      { thread: 'trump-presidency', color: '#F97316', stance: 'neutral', note: 'Social sentiment cooling on policy execution — fatigue narrative emerging' },
    ],
    notableInfo: [
      'Ingests an average of 8,400 tweets per day across 47 tracked accounts',
      'AAII contrarian signal accuracy: 78% over 11 instances',
      'Has been called "the most annoying agent" by Feucht — considers it a compliment',
      'Invented the phrase "sentiment is a lagging vibe indicator" and uses it daily',
    ],
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

export function ApparatusMap() {
  const [showSchedule, setShowSchedule] = useState(false);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const gridRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ key: string; d: string; color: string }[]>([]);

  // Compute SVG connection lines when an agent is expanded
  const computeLines = useCallback(() => {
    if (!expandedAgent || !gridRef.current) { setLines([]); return; }
    const gridRect = gridRef.current.getBoundingClientRect();
    const sourceEl = cardRefs.current[expandedAgent];
    if (!sourceEl) { setLines([]); return; }
    const sourceRect = sourceEl.getBoundingClientRect();
    const sx = sourceRect.left + sourceRect.width / 2 - gridRect.left;
    const sy = sourceRect.top + sourceRect.height / 2 - gridRect.top;

    const agentConns = CONNECTIONS.filter(c => c.from === expandedAgent || c.to === expandedAgent);
    const newLines = agentConns.map(conn => {
      const targetId = conn.from === expandedAgent ? conn.to : conn.from;
      const targetEl = cardRefs.current[targetId];
      if (!targetEl) return null;
      const targetRect = targetEl.getBoundingClientRect();
      const tx = targetRect.left + targetRect.width / 2 - gridRect.left;
      const ty = targetRect.top + targetRect.height / 2 - gridRect.top;
      const cx1 = sx + (tx - sx) * 0.4;
      const cy1 = sy;
      const cx2 = tx - (tx - sx) * 0.4;
      const cy2 = ty;
      const agent = AGENTS.find(a => a.id === targetId);
      return {
        key: `${conn.from}-${conn.to}`,
        d: `M ${sx} ${sy} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${tx} ${ty}`,
        color: agent?.accentColor ?? 'var(--fintheon-accent)',
      };
    }).filter(Boolean) as { key: string; d: string; color: string }[];
    setLines(newLines);
  }, [expandedAgent]);

  useEffect(() => {
    computeLines();
    // Recompute on resize
    window.addEventListener('resize', computeLines);
    return () => window.removeEventListener('resize', computeLines);
  }, [computeLines]);

  // Recompute after layout settles (expansion animation)
  useEffect(() => {
    if (expandedAgent) {
      const timer = setTimeout(computeLines, 100);
      return () => clearTimeout(timer);
    }
  }, [expandedAgent, computeLines]);

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
          <div ref={gridRef} className="relative grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* SVG overlay for agent connection lines */}
            {expandedAgent && lines.length > 0 && (
              <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1, width: '100%', height: '100%', overflow: 'visible' }}>
                {lines.map(line => (
                  <path
                    key={line.key}
                    d={line.d}
                    stroke={line.color}
                    strokeWidth={1.5}
                    opacity={0.2}
                    fill="none"
                    className="rope-breathe"
                  />
                ))}
              </svg>
            )}
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
                  ref={(el) => { cardRefs.current[agent.id] = el; }}
                  className={`border rounded-lg transition-all cursor-pointer ${
                    isExpanded
                      ? 'bg-[var(--fintheon-surface)] border-[var(--fintheon-accent)]/40 col-span-1 lg:col-span-2 xl:col-span-3'
                      : 'bg-[var(--fintheon-bg)] border-[var(--fintheon-accent)]/20 hover:border-[var(--fintheon-accent)]/40 hover:bg-[var(--fintheon-accent)]/5'
                  }`}
                  style={{ position: 'relative', zIndex: isExpanded ? 2 : 0 }}
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

                  {/* Collapsed: bio snippet + 2 memories */}
                  {!isExpanded && (
                    <div className="p-3 space-y-2">
                      {agent.bio && (
                        <p className="text-[11px] text-[var(--fintheon-text)]/40 leading-relaxed italic line-clamp-2">
                          {agent.bio}
                        </p>
                      )}
                      {agent.dossier && (
                        <p className="text-[10px] leading-relaxed text-[var(--fintheon-text-muted)] mt-1.5 line-clamp-2 italic opacity-70">
                          {agent.dossier.split('. ').slice(0, 2).join('. ')}.
                        </p>
                      )}
                      {agent.memories.slice(0, 2).map(mem => (
                        <MemoryCard key={mem.id} memory={mem} />
                      ))}
                      {agent.memories.length > 2 && (
                        <div className="text-[8px] text-[var(--fintheon-accent)]/30 font-mono text-center pt-1">
                          +{agent.memories.length - 2} more
                        </div>
                      )}
                    </div>
                  )}

                  {/* Expanded: full dossier */}
                  {isExpanded && (
                    <div className="p-3 space-y-3">
                      {/* Bio */}
                      {agent.bio && (
                        <div className="border-b border-[var(--fintheon-accent)]/10 pb-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <BookOpen size={9} className="text-[var(--fintheon-accent)]/60" />
                            <span className="text-[8px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">Personnel File</span>
                          </div>
                          <p className="text-[13px] text-[var(--fintheon-text)]/60 leading-relaxed italic">{agent.bio}</p>
                        </div>
                      )}

                      {/* Dossier / Historical Fiction */}
                      {agent.dossier && (
                        <div className="border-b border-[var(--fintheon-accent)]/10 pb-3">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <Scroll size={9} className="text-[var(--fintheon-accent)]/60" />
                            <span className="text-[8px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">Origin Dossier</span>
                          </div>
                          <p className="text-[13px] text-[var(--fintheon-text)]/50 leading-[1.6]">{agent.dossier}</p>
                        </div>
                      )}

                      {/* Win/Loss Record (Feucht) */}
                      {agent.record && (
                        <div className="border-b border-[var(--fintheon-accent)]/10 pb-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Trophy size={9} className="text-[var(--fintheon-accent)]/60" />
                            <span className="text-[8px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">Combat Record</span>
                          </div>
                          <div className="grid grid-cols-4 gap-2 mb-2">
                            <div className="bg-black/20 rounded px-2 py-1.5">
                              <div className="text-[7px] text-[var(--fintheon-accent)]/40 font-mono">W / L / BE</div>
                              <div className="text-[11px] font-mono mt-0.5">
                                <span className="text-emerald-400">{agent.record.wins}</span>
                                <span className="text-[var(--fintheon-text)]/20"> / </span>
                                <span className="text-red-400">{agent.record.losses}</span>
                                <span className="text-[var(--fintheon-text)]/20"> / </span>
                                <span className="text-[var(--fintheon-text)]/40">{agent.record.breakeven}</span>
                              </div>
                            </div>
                            <div className="bg-black/20 rounded px-2 py-1.5">
                              <div className="text-[7px] text-[var(--fintheon-accent)]/40 font-mono">Win Rate</div>
                              <div className="text-[11px] font-mono text-[var(--fintheon-accent)] mt-0.5">{agent.record.winRate}%</div>
                            </div>
                            <div className="bg-black/20 rounded px-2 py-1.5">
                              <div className="text-[7px] text-[var(--fintheon-accent)]/40 font-mono">Total P&L</div>
                              <div className={`text-[11px] font-mono mt-0.5 ${agent.record.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {agent.record.totalPnl >= 0 ? '+' : ''}${agent.record.totalPnl.toLocaleString()}
                              </div>
                            </div>
                            <div className="bg-black/20 rounded px-2 py-1.5">
                              <div className="text-[7px] text-[var(--fintheon-accent)]/40 font-mono">Avg RR</div>
                              <div className="text-[11px] font-mono text-[var(--fintheon-text)]/70 mt-0.5">{agent.record.avgRR}:1</div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-[7px] text-[var(--fintheon-accent)]/40 font-mono w-14 shrink-0">STREAK</span>
                              <span className="text-[9px] text-[var(--fintheon-text)]/60 font-mono">{agent.record.streak}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-[7px] text-emerald-400/60 font-mono w-14 shrink-0">BEST</span>
                              <span className="text-[9px] text-emerald-400/70 font-mono">{agent.record.bestTrade}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-[7px] text-red-400/60 font-mono w-14 shrink-0">WORST</span>
                              <span className="text-[9px] text-red-400/70 font-mono">{agent.record.worstTrade}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Active Narratives */}
                      {agent.activeNarratives && agent.activeNarratives.length > 0 && (
                        <div className="border-b border-[var(--fintheon-accent)]/10 pb-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Eye size={9} className="text-[var(--fintheon-accent)]/60" />
                            <span className="text-[8px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">Active Narratives</span>
                          </div>
                          <div className="space-y-1.5">
                            {agent.activeNarratives.map(n => (
                              <div key={n.thread} className="flex items-start gap-2">
                                <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: n.color }} />
                                  {n.stance === 'bullish' && <TrendingUp size={8} className="text-emerald-400" />}
                                  {n.stance === 'bearish' && <TrendingDown size={8} className="text-red-400" />}
                                  {n.stance === 'neutral' && <Minus size={8} className="text-[var(--fintheon-text)]/30" />}
                                  {n.stance === 'watching' && <Eye size={8} className="text-[var(--fintheon-accent)]/40" />}
                                </div>
                                <div className="min-w-0">
                                  <span className="text-[9px] font-mono" style={{ color: n.color }}>{n.thread}</span>
                                  <span className="text-[11px] text-[var(--fintheon-text)]/40 ml-1.5">{n.note}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Memory facts (2-col grid when expanded) */}
                      <div>
                        <span className="text-[8px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider block mb-2">Intelligence Facts</span>
                        <div className="grid grid-cols-2 gap-2">
                          {agent.memories.map(mem => (
                            <MemoryCard key={mem.id} memory={mem} />
                          ))}
                        </div>
                      </div>

                      {/* Connections */}
                      {agentConnections.length > 0 && (
                        <div className="border-t border-[var(--fintheon-accent)]/10 pt-2">
                          <span className="text-[8px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">Connections</span>
                          <div className="mt-1.5 space-y-1">
                            {agentConnections.map(conn => (
                              <div key={`${conn.from}-${conn.to}`} className="flex items-start gap-2">
                                <div className="w-1 h-1 rounded-full bg-[var(--fintheon-accent)]/30 mt-1.5 shrink-0" />
                                <div>
                                  <span className="text-[9px] text-[var(--fintheon-accent)]/60 font-mono">{conn.label}</span>
                                  <span className="text-[11px] text-[var(--fintheon-text)]/40 ml-1.5">{conn.detail}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notable Info */}
                      {agent.notableInfo && agent.notableInfo.length > 0 && (
                        <div className="border-t border-[var(--fintheon-accent)]/10 pt-2">
                          <span className="text-[8px] text-[var(--fintheon-accent)]/40 font-mono uppercase tracking-wider">Notable Intel</span>
                          <div className="mt-1.5 space-y-1">
                            {agent.notableInfo.map((info, i) => (
                              <div key={i} className="flex items-start gap-2">
                                <div className="w-1 h-1 rounded-full bg-[var(--fintheon-accent)]/20 mt-1.5 shrink-0" />
                                <span className="text-[12px] text-[var(--fintheon-text)]/40 leading-relaxed">{info}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Conflict detail */}
                      {agentConflicts.map(conf => (
                        <div key={`${conf.from}-${conf.to}`} className="border-t border-red-500/15 pt-2">
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle size={9} className="text-red-400" />
                            <span className="text-[8px] text-red-400 font-mono uppercase tracking-wider">Conflict</span>
                          </div>
                          <p className="text-[9px] text-red-400/70 leading-relaxed">{conf.detail}</p>
                        </div>
                      ))}
                    </div>
                  )}
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
