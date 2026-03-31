// [claude-code 2026-03-31] S13-T2: TradePlanStatus — small badge shown on proposal cards
import { Loader2, CheckCircle2, CircleOff } from 'lucide-react';

type TradePlanState = 'generating' | 'ready' | 'unavailable';

interface TradePlanStatusProps {
  state: TradePlanState;
}

export function TradePlanStatus({ state }: TradePlanStatusProps) {
  if (state === 'generating') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#c79f4a]/70">
        <Loader2 size={12} className="animate-spin" />
        Trade Plan: Generating...
      </span>
    );
  }

  if (state === 'ready') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#c79f4a]">
        <CheckCircle2 size={12} />
        Trade Plan: Ready
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-[#f0ead6]/30">
      <CircleOff size={12} />
      Trade Plan: Unavailable
    </span>
  );
}
