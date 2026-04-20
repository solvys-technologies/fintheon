// [claude-code 2026-03-16] Blindspots interview — 4-step onboarding questionnaire
import { useState, useCallback } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Check,
} from "@/components/shared/iso-icons";

interface InterviewData {
  name: string;
  discord: string;
  instruments: string[];
  roadblocks: string[];
  customRoadblock: string;
  dailyTarget: string;
  weeklyGoal: string;
  accountSize: string;
}

interface BlindspotsInterviewProps {
  visible: boolean;
  onComplete: (data: InterviewData) => void;
  onSkip: () => void;
  initialName?: string;
}

const INSTRUMENTS = ["Futures", "Crypto", "Equities", "Options", "Forex"];
const ROADBLOCKS = [
  "Overtrading",
  "Revenge trading",
  "FOMO",
  "Fear of loss",
  "Inconsistency",
  "Over-leveraging",
];

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
        selected
          ? "bg-[var(--fintheon-accent)]/20 border-[var(--fintheon-accent)]/50 text-[var(--fintheon-accent)]"
          : "bg-white/5 border-white/10 text-gray-400 hover:border-white/20 hover:text-gray-300"
      }`}
    >
      {label}
    </button>
  );
}

export function BlindspotsInterview({
  visible,
  onComplete,
  onSkip,
  initialName = "",
}: BlindspotsInterviewProps) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<InterviewData>({
    name: initialName,
    discord: "",
    instruments: [],
    roadblocks: [],
    customRoadblock: "",
    dailyTarget: "",
    weeklyGoal: "",
    accountSize: "",
  });

  const totalSteps = 4;

  const toggleItem = useCallback(
    (field: "instruments" | "roadblocks", item: string) => {
      setData((prev) => {
        const arr = prev[field];
        return {
          ...prev,
          [field]: arr.includes(item)
            ? arr.filter((x) => x !== item)
            : [...arr, item],
        };
      });
    },
    [],
  );

  const handleComplete = useCallback(() => {
    onComplete(data);
  }, [data, onComplete]);

  const canProceed = () => {
    switch (step) {
      case 0:
        return data.name.trim().length > 0;
      case 1:
        return data.instruments.length > 0;
      case 2:
        return (
          data.roadblocks.length > 0 || data.customRoadblock.trim().length > 0
        );
      case 3:
        return true;
      default:
        return true;
    }
  };

  if (!visible) return null;

  const progress = ((step + 1) / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-[440px] bg-[var(--fintheon-surface)]/90 backdrop-blur-md border border-[var(--fintheon-accent)]/20 rounded-xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-white/5">
          <div
            className="h-full bg-[var(--fintheon-accent)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--fintheon-accent)]/10">
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[var(--fintheon-accent)]">
            Trader Profile ({step + 1}/{totalSteps})
          </span>
          <button
            onClick={onSkip}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Step content */}
        <div className="px-5 py-5 min-h-[220px]">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-white block mb-2">
                  What's your name?
                </label>
                <input
                  type="text"
                  value={data.name}
                  onChange={(e) =>
                    setData((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="Trader name"
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder-gray-500 focus:border-[var(--fintheon-accent)]/50 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-white block mb-2">
                  Discord username
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                    @
                  </span>
                  <input
                    type="text"
                    value={data.discord}
                    onChange={(e) =>
                      setData((d) => ({ ...d, discord: e.target.value }))
                    }
                    placeholder="username"
                    className="w-full pl-7 pr-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder-gray-500 focus:border-[var(--fintheon-accent)]/50 focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <label className="text-sm font-medium text-white block mb-3">
                What do you trade?
              </label>
              <div className="flex flex-wrap gap-2">
                {INSTRUMENTS.map((inst) => (
                  <Chip
                    key={inst}
                    label={inst}
                    selected={data.instruments.includes(inst)}
                    onClick={() => toggleItem("instruments", inst)}
                  />
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <label className="text-sm font-medium text-white block mb-3">
                What are your biggest trading roadblocks?
              </label>
              <div className="flex flex-wrap gap-2 mb-4">
                {ROADBLOCKS.map((rb) => (
                  <Chip
                    key={rb}
                    label={rb}
                    selected={data.roadblocks.includes(rb)}
                    onClick={() => toggleItem("roadblocks", rb)}
                  />
                ))}
              </div>
              <input
                type="text"
                value={data.customRoadblock}
                onChange={(e) =>
                  setData((d) => ({ ...d, customRoadblock: e.target.value }))
                }
                placeholder="Other (type your own)"
                className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder-gray-500 focus:border-[var(--fintheon-accent)]/50 focus:outline-none transition-colors"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <label className="text-sm font-medium text-white block">
                Trading goals
              </label>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Daily P&L target ($)
                </label>
                <input
                  type="text"
                  value={data.dailyTarget}
                  onChange={(e) =>
                    setData((d) => ({ ...d, dailyTarget: e.target.value }))
                  }
                  placeholder="e.g. 500"
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder-gray-500 focus:border-[var(--fintheon-accent)]/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Weekly goal ($)
                </label>
                <input
                  type="text"
                  value={data.weeklyGoal}
                  onChange={(e) =>
                    setData((d) => ({ ...d, weeklyGoal: e.target.value }))
                  }
                  placeholder="e.g. 2000"
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder-gray-500 focus:border-[var(--fintheon-accent)]/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">
                  Account size ($)
                </label>
                <input
                  type="text"
                  value={data.accountSize}
                  onChange={(e) =>
                    setData((d) => ({ ...d, accountSize: e.target.value }))
                  }
                  placeholder="e.g. 50000"
                  className="w-full px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-white text-sm placeholder-gray-500 focus:border-[var(--fintheon-accent)]/50 focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--fintheon-accent)]/10">
          <button
            onClick={onSkip}
            className="text-xs text-gray-500 hover:text-white transition-colors"
          >
            Skip for now
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep((s) => s - 1)}
                className="flex items-center gap-0.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-3 h-3" />
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (step < totalSteps - 1) {
                  setStep((s) => s + 1);
                } else {
                  handleComplete();
                }
              }}
              disabled={!canProceed()}
              className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium bg-[var(--fintheon-accent)] text-black rounded hover:brightness-110 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {step === totalSteps - 1 ? (
                <>
                  <Check className="w-3 h-3" />
                  Complete
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-3 h-3" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
