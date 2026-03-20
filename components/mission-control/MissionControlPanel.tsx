import { ChevronLeft, ChevronRight, MoveLeft, MoveRight, GripVertical, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { EmotionalResonanceMonitor } from './EmotionalResonanceMonitor';
import { ThreadHistory } from './ThreadHistory';
import { BlindspotsWidget } from './BlindspotsWidget';
import { AlgoStatusWidget } from './AlgoStatusWidget';
import { AccountTrackerWidget } from './AccountTrackerWidget';
import { MinimalERMeter } from '../MinimalERMeter';
import { useBackend } from '../../lib/backend';
import { PanelPosition } from '../layout/DraggablePanel';

interface MissionControlPanelProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  topStepXEnabled?: boolean;
  position?: PanelPosition;
  onPositionChange?: (position: PanelPosition) => void;
  onHide?: () => void;
}

export function MissionControlPanel({ 
  collapsed, 
  onToggleCollapse, 
  topStepXEnabled = false,
  position = 'right',
  onPositionChange,
  onHide
}: MissionControlPanelProps) {
  const backend = useBackend();
  const [dailyPnl, setDailyPnl] = useState<number>(0);
  const [algoEnabled, setAlgoEnabled] = useState<boolean>(false);
  const [erScore, setErScore] = useState<number>(0);

  // Fetch account data for PNL and algo status
  useEffect(() => {
    const fetchAccount = async () => {
      try {
        const account = await backend.account.get();
        setDailyPnl(account.dailyPnl);
        setAlgoEnabled(account.algoEnabled);
      } catch (err) {
        console.error('Failed to fetch account:', err);
      }
    };
    fetchAccount();
    const interval = setInterval(fetchAccount, 5000);
    return () => clearInterval(interval);
  }, [backend]);

  // Listen for ER score updates from EmotionalResonanceMonitor
  // We'll use a custom event or context to share ER score
  useEffect(() => {
    const handleERUpdate = (event: CustomEvent<number>) => {
      setErScore(event.detail);
    };
    window.addEventListener('erScoreUpdate', handleERUpdate as EventListener);
    return () => {
      window.removeEventListener('erScoreUpdate', handleERUpdate as EventListener);
    };
  }, []);

  // Normalize ER score from -10 to 10 range to 0-1 range for display
  const normalizedResonance = Math.max(0, Math.min(1, (erScore + 10) / 20));

  // When TopStepX is enabled, Mission Control takes full sidebar width
  const width = topStepXEnabled ? (collapsed ? 'w-16' : 'w-80') : (collapsed ? 'w-16' : 'w-80');

  return (
    <div
      className={`bg-[#0a0a00] border-r border-[#D4AF37]/20 transition-lush ${width}`}
    >
      <div className="h-full flex flex-col">
        <div className="h-12 flex items-center justify-between px-3">
          {!collapsed && (
            <h2 className="text-sm font-semibold text-[#D4AF37]">Mission Control</h2>
          )}
          <div className="flex items-center gap-1">
            {topStepXEnabled && !collapsed && onPositionChange && (
              <>
                {position === 'right' && (
                  <button
                    onClick={() => onPositionChange('left')}
                    className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
                    title="Move Left"
                  >
                    <MoveLeft className="w-3.5 h-3.5" />
                  </button>
                )}
                {position === 'left' && (
                  <button
                    onClick={() => onPositionChange('right')}
                    className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
                    title="Move Right"
                  >
                    <MoveRight className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => onPositionChange('floating')}
                  className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
                  title="Float"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {topStepXEnabled && onHide && (
              <button
                onClick={onHide}
                className="p-1 hover:bg-[#D4AF37]/10 rounded text-[#D4AF37]/60 hover:text-[#D4AF37]"
                title="Hide"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            {topStepXEnabled && (
              <button
                onClick={onToggleCollapse}
                className="p-1.5 hover:bg-[#D4AF37]/10 rounded transition-colors"
              >
                {collapsed ? (
                  <ChevronRight className="w-4 h-4 text-[#D4AF37]" />
                ) : (
                  <ChevronLeft className="w-4 h-4 text-[#D4AF37]" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Always render all components to keep them functional, hide visually when collapsed */}
        <div className={`flex-1 px-1 py-4 flex items-start justify-center ${collapsed ? '' : 'hidden'}`}>
          <MinimalERMeter 
            resonance={normalizedResonance} 
            pnl={dailyPnl} 
            algoEnabled={algoEnabled} 
          />
        </div>
        
        <div className={`flex-1 overflow-y-auto p-2 space-y-2 ${collapsed ? 'hidden' : ''}`}>
          <EmotionalResonanceMonitor onERScoreChange={setErScore} />
          <BlindspotsWidget />
          <AccountTrackerWidget />
          <AlgoStatusWidget />
          <ThreadHistory />
        </div>
      </div>
    </div>
  );
}
