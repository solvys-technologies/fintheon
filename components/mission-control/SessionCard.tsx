import { TrendingUp, TrendingDown } from 'lucide-react';

interface SessionCardProps {
  date: string;
  pnl: number;
  resonanceState: 'Stable' | 'Tilt' | 'Neutral';
  onClick: () => void;
  isActive: boolean;
}

export function SessionCard({ date, pnl, resonanceState, onClick, isActive }: SessionCardProps) {
  const getResonanceColor = (state: string) => {
    switch (state) {
      case 'Stable':
        return 'text-emerald-400';
      case 'Tilt':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <button
      onClick={onClick}
      className={`w-full p-3 rounded-lg border transition-all ${
        isActive
          ? 'bg-[#D4AF37]/10 border-[#D4AF37]/30'
          : 'bg-[#0a0a00] border-zinc-900 hover:border-zinc-800'
      }`}
    >
      <div className="text-sm font-medium text-white mb-2">{date}</div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {pnl >= 0 ? (
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          ) : (
            <TrendingDown className="w-4 h-4 text-red-500" />
          )}
          <span className={`text-sm font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-500'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
          </span>
        </div>
        <div className={`text-xs ${getResonanceColor(resonanceState)}`}>
          ER: {resonanceState}
        </div>
      </div>
    </button>
  );
}
