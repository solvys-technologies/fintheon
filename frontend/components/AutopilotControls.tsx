// [claude-code 2026-03-11] Track 3: Autopilot control panel — toggle, thresholds, strategy list
import { Power, Target, BarChart3, Shield, Crosshair } from 'lucide-react'
import type { AutopilotStatus } from './AutopilotDashboard'

interface AutopilotControlsProps {
  status: AutopilotStatus | null
  onToggle?: (enabled: boolean) => void
}

const STRATEGY_LIST = [
  'Morning Flush',
  'Lunch Flush',
  'Power Hour Flush',
  'VIX Fix 22',
  '40/40 Club',
  'Playbook Sweep',
]

export function AutopilotControls({ status, onToggle }: AutopilotControlsProps) {
  const isEnabled = status?.enabled ?? false
  const confidenceThreshold = status?.confidenceThreshold ?? 0
  const maxTrades = status?.maxTradesPerDay ?? 0
  const drawdownLimit = status?.dailyDrawdownLimit ?? 0

  return (
    <div className="space-y-3">
      {/* Enable/Disable Toggle */}
      <div className="bg-[#0a0906] border border-[#c79f4a20] rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Power className="w-4 h-4 text-[#c79f4a]" />
            <span className="text-sm font-medium text-[#f0ead6]">Autopilot</span>
          </div>
          <button
            onClick={() => onToggle?.(!isEnabled)}
            className={`
              relative w-11 h-6 rounded-full transition-colors duration-200
              ${isEnabled ? 'bg-[#c79f4a]' : 'bg-[#f0ead620]'}
            `}
          >
            <span
              className={`
                absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200
                ${isEnabled ? 'translate-x-5 bg-[#050402]' : 'translate-x-0 bg-[#f0ead680]'}
              `}
            />
          </button>
        </div>
        <div className="mt-2 text-xs text-[#f0ead680]">
          {isEnabled ? 'System active — processing signals' : 'System paused — signals ignored'}
        </div>
      </div>

      {/* Dry Run Indicator */}
      <div className="bg-[#0a0906] border border-[#c79f4a20] rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-[#c79f4a]" />
          <span className="text-sm font-medium text-[#f0ead6]">Mode</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-0.5 rounded bg-[#c79f4a20] text-[#c79f4a] border border-[#c79f4a30]">
            DRY RUN
          </span>
          <span className="text-xs text-[#f0ead680]">No live orders</span>
        </div>
      </div>

      {/* Thresholds */}
      <div className="bg-[#0a0906] border border-[#c79f4a20] rounded-lg p-4 space-y-3">
        <div className="text-xs text-[#f0ead680] uppercase tracking-wider mb-1">Thresholds</div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-[#f0ead680]" />
            <span className="text-xs text-[#f0ead6]">Confidence</span>
          </div>
          <span className="text-sm font-bold text-[#c79f4a] font-mono">
            {confidenceThreshold}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-[#f0ead680]" />
            <span className="text-xs text-[#f0ead6]">Max Trades</span>
          </div>
          <span className="text-sm font-bold text-[#c79f4a] font-mono">
            {maxTrades}/day
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="w-3.5 h-3.5 text-[#f0ead680]" />
            <span className="text-xs text-[#f0ead6]">Drawdown Limit</span>
          </div>
          <span className="text-sm font-bold text-red-400 font-mono">
            ${drawdownLimit.toLocaleString()}
          </span>
        </div>
      </div>

      {/* Strategy List */}
      <div className="bg-[#0a0906] border border-[#c79f4a20] rounded-lg p-4">
        <div className="text-xs text-[#f0ead680] uppercase tracking-wider mb-2">Strategies</div>
        <div className="flex flex-wrap gap-1.5">
          {STRATEGY_LIST.map((strategy) => (
            <span
              key={strategy}
              className="text-[10px] px-2 py-0.5 rounded-full bg-[#c79f4a15] text-[#c79f4a] border border-[#c79f4a20]"
            >
              {strategy}
            </span>
          ))}
        </div>
      </div>

      {/* Status Summary */}
      {!status && (
        <div className="text-center py-6">
          <div className="text-xs text-[#f0ead640] animate-pulse">
            Connecting to autopilot...
          </div>
        </div>
      )}
    </div>
  )
}
