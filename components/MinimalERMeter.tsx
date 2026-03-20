interface MinimalERMeterProps {
  resonance: number;
  pnl?: number;
  algoEnabled: boolean;
}

export function MinimalERMeter({ resonance, algoEnabled }: MinimalERMeterProps) {
  const getResonanceColor = () => {
    // Resonance is normalized 0-1, where 0.5 is the median/neutral level
    // Above median (0.5) = green, below median = red
    if (resonance > 0.5) return 'bg-emerald-400';
    if (resonance < 0.5) return 'bg-red-500';
    return 'bg-gray-400'; // Exactly at median
  };

  // Ensure resonance is between 0 and 1, then convert to percentage height
  const clampedResonance = Math.max(0, Math.min(1, resonance));
  const resonanceHeight = Math.max(10, Math.min(90, clampedResonance * 100));

  return (
    <div className="flex flex-col gap-2 p-2 bg-[#0a0a00] border border-[#D4AF37]/20 rounded w-full">
      <div className="text-center">
        <span className="text-[10px] font-semibold text-[#D4AF37]">ER</span>
      </div>
      
      <div className="flex justify-center">
        <div className="relative h-24 w-4 bg-zinc-900 rounded-full overflow-hidden">
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-500 z-10" style={{ bottom: '50%' }} />
          <div
            className={`absolute bottom-0 left-0 right-0 transition-all duration-500 ${getResonanceColor()}`}
            style={{ height: `${resonanceHeight}%` }}
          />
        </div>
      </div>
      
      <div className="flex justify-center pt-1">
        <div className={`w-2 h-2 rounded-full ${algoEnabled ? 'bg-emerald-400' : 'bg-gray-600'}`} />
      </div>
    </div>
  );
}
