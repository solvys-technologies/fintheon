// [claude-code 2026-03-16] Spotlight tour + blindspots interview v7.9
// [claude-code 2026-03-12] Renamed "Trading Journal" -> "Performance" in tour + What's New
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Sparkles } from 'lucide-react';
import { SpotlightOverlay } from './SpotlightOverlay';
import { TourTooltip } from './TourTooltip';
import { BlindspotsInterview } from './BlindspotsInterview';
import { SetupWizard } from './SetupWizard';
import { useSettings } from '../../contexts/SettingsContext';

const TOUR_STORAGE_KEY = 'fintheon:tour-completed';
const LAST_VERSION_KEY = 'fintheon:last-seen-version';
const INTERVIEW_STORAGE_KEY = 'fintheon:interview-completed';
const INTERVIEW_DATA_KEY = 'fintheon:interview-data';
const CURRENT_VERSION = '7.9.0';
const WHATS_NEW_TIMEOUT_MS = 30_000;

interface TourStep {
  title: string;
  description: string;
  target: string;
  targetSelector: string;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: 'Dashboard',
    description: 'Your daily briefing, economic calendar, KPIs, and action tape. Start each session here.',
    target: 'executive',
    targetSelector: '[data-tour-target="executive"]',
  },
  {
    title: 'RiskFlow',
    description: 'Real-time news and event feed scored by the IV engine. Headlines flow in automatically from X, RSS, and Notion trade ideas.',
    target: 'news',
    targetSelector: '[data-tour-target="riskflow"]',
  },
  {
    title: 'Chat',
    description: 'Talk to your AI analysts. Use skills like /brief, /validate, /report, or /psych_assist. Drag RiskFlow items into chat for context.',
    target: 'analysis',
    targetSelector: '[data-tour-target="chat"]',
  },
  {
    title: 'Economic Calendar',
    description: 'TradingView calendar with country filters, importance levels, earnings, dividends, and IPOs.',
    target: 'econ',
    targetSelector: '[data-tour-target="econ"]',
  },
  {
    title: 'Performance',
    description: 'Two tabs — Human (ER trend, infractions, discipline score) and Agent (proposal tracker, win rate, R:R).',
    target: 'earnings',
    targetSelector: '[data-tour-target="performance"]',
  },
  {
    title: 'Narrative Map',
    description: 'Build and track market narratives with visual flows and MiroFish integration.',
    target: 'narrative',
    targetSelector: '[data-tour-target="narrative"]',
  },
  {
    title: 'Strategium',
    description: 'Compact widgets: ER monitor, blindspots, account tracker, algo status, session calendar. Rearrange with the gear icon.',
    target: 'mission-control',
    targetSelector: '[data-tour-target="strategium"]',
  },
  {
    title: 'Toolbar',
    description: 'IV score, VIX ticker, voice control, and chat toggle live in the top toolbar. Drag items to reorder.',
    target: 'toolbar',
    targetSelector: '[data-tour-target="toolbar"]',
  },
];

const WHATS_NEW_ITEMS = [
  'Spotlight-guided onboarding tour with smooth transitions',
  'Blindspots interview — personalized trader profile setup',
  'Narrative Map canvas with MiroFish integration',
  'IV prediction layer on Narrative Flow',
  'Setup wizard for backend dependency checks',
  'Auto-refresh toggle for all polling widgets',
];

type Phase = 'tour' | 'interview' | 'setup' | 'done';

export function FirstTimeTour({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [phase, setPhase] = useState<Phase>('done');
  const [step, setStep] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const settings = useSettings();
  const measureTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Check if tour should show on mount
  useEffect(() => {
    const completed = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!completed) {
      setPhase('tour');
      // Navigate to first tab
      onNavigate?.(TOUR_STEPS[0].target);
    }
  }, []);

  // Measure spotlight target whenever step changes
  useEffect(() => {
    if (phase !== 'tour') return;
    const current = TOUR_STEPS[step];
    if (!current) return;

    // Navigate to the tab for this step
    onNavigate?.(current.target);

    // Measure after navigation settles
    clearTimeout(measureTimer.current);
    measureTimer.current = setTimeout(() => {
      const el = document.querySelector(current.targetSelector);
      if (el) {
        const r = el.getBoundingClientRect();
        setSpotlightRect({ x: r.x, y: r.y, width: r.width, height: r.height });
      } else {
        setSpotlightRect(null);
      }
    }, 200);

    return () => clearTimeout(measureTimer.current);
  }, [step, phase, onNavigate]);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    localStorage.setItem(LAST_VERSION_KEY, CURRENT_VERSION);
    // Check if interview is already done
    const interviewDone = localStorage.getItem(INTERVIEW_STORAGE_KEY);
    if (!interviewDone) {
      setPhase('interview');
    } else {
      setPhase('setup');
    }
  }, []);

  const goNext = useCallback(() => {
    if (step < TOUR_STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeTour();
    }
  }, [step, completeTour]);

  const goPrev = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const handleInterviewComplete = useCallback(
    (data: { name: string; discord: string; instruments: string[]; roadblocks: string[]; customRoadblock: string; dailyTarget: string; weeklyGoal: string; accountSize: string }) => {
      // Merge custom roadblock
      const allRoadblocks = [...data.roadblocks];
      if (data.customRoadblock.trim()) allRoadblocks.push(data.customRoadblock.trim());

      // Save to localStorage
      localStorage.setItem(INTERVIEW_STORAGE_KEY, 'true');
      localStorage.setItem(INTERVIEW_DATA_KEY, JSON.stringify(data));

      // Save to SettingsContext
      settings.setTraderName(data.name);
      settings.setDiscordUsername(data.discord);
      settings.setInstrumentsTraded(data.instruments);
      settings.setTradingRoadblocks(allRoadblocks);
      settings.setTradingGoals(`Daily: $${data.dailyTarget}, Weekly: $${data.weeklyGoal}, Account: $${data.accountSize}`);
      settings.setInterviewCompleted(true);

      // Fire-and-forget POST to backend
      fetch('/api/blindspots/interview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          roadblocks: allRoadblocks,
          goals: `Daily: $${data.dailyTarget}, Weekly: $${data.weeklyGoal}, Account: $${data.accountSize}`,
          instruments: data.instruments,
          discord: data.discord,
        }),
      }).catch(() => {});

      // Post roadblocks as blindspots
      fetch('/api/blindspots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blindspots: allRoadblocks.map((rb) => ({
            text: rb,
            severity: rb.toLowerCase().includes('overtrad') || rb.toLowerCase().includes('revenge') ? 'high' : 'medium',
          })),
        }),
      }).catch(() => {});

      setPhase('setup');
    },
    [settings]
  );

  const handleInterviewSkip = useCallback(() => {
    localStorage.setItem(INTERVIEW_STORAGE_KEY, 'skipped');
    setPhase('setup');
  }, []);

  // Tour phase: spotlight + tooltip
  if (phase === 'tour') {
    const current = TOUR_STEPS[step];
    return (
      <SpotlightOverlay
        targetSelector={current.targetSelector}
        visible={true}
        onClose={completeTour}
      >
        <TourTooltip
          targetRect={spotlightRect}
          step={current}
          stepIndex={step}
          totalSteps={TOUR_STEPS.length}
          onNext={goNext}
          onPrev={goPrev}
          onSkip={completeTour}
        />
      </SpotlightOverlay>
    );
  }

  // Interview phase
  if (phase === 'interview') {
    return (
      <BlindspotsInterview
        visible={true}
        onComplete={handleInterviewComplete}
        onSkip={handleInterviewSkip}
        initialName={settings.traderName}
      />
    );
  }

  // Setup phase
  if (phase === 'setup') {
    return (
      <SetupWizard
        visible={true}
        onClose={() => setPhase('done')}
      />
    );
  }

  return null;
}

/** "What's New" button -- appears in toolbar for 30s after detecting a version update */
export function WhatsNewButton() {
  const [visible, setVisible] = useState(false);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    const lastVersion = localStorage.getItem(LAST_VERSION_KEY);
    const tourDone = localStorage.getItem(TOUR_STORAGE_KEY);

    if (tourDone && lastVersion && lastVersion !== CURRENT_VERSION) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        localStorage.setItem(LAST_VERSION_KEY, CURRENT_VERSION);
      }, WHATS_NEW_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }

    if (tourDone && !lastVersion) {
      localStorage.setItem(LAST_VERSION_KEY, CURRENT_VERSION);
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowPanel(!showPanel)}
        className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium bg-[var(--fintheon-accent)]/15 border border-[var(--fintheon-accent)]/30 text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/25 transition-colors animate-pulse"
      >
        <Sparkles className="w-3 h-3" />
        Welcome to the Pantheon
      </button>

      {showPanel && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-[#0c0a06] border border-[var(--fintheon-accent)]/20 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--fintheon-accent)]/10">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--fintheon-accent)] uppercase tracking-wider">
                v{CURRENT_VERSION}
              </span>
              <button
                onClick={() => {
                  setShowPanel(false);
                  setVisible(false);
                  localStorage.setItem(LAST_VERSION_KEY, CURRENT_VERSION);
                }}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={12} />
              </button>
            </div>
          </div>
          <div className="px-4 py-3 space-y-2">
            {WHATS_NEW_ITEMS.map((item, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-[var(--fintheon-accent)] text-xs mt-0.5">-</span>
                <span className="text-xs text-gray-400 leading-relaxed">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
