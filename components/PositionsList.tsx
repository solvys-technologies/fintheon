import { useEffect, useState } from "react";
import { useBackend } from "../lib/backend";
import type { Position } from "~backend/trading/list_positions";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function PositionsList() {
  const backend = useBackend();
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    loadPositions();
    const interval = setInterval(loadPositions, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadPositions = async () => {
    try {
      const data = await backend.trading.listPositions();
      setPositions(data.positions);
    } catch (error) {
      console.error('Failed to load positions:', error);
    }
  };

  if (positions.length === 0) {
    return (
      <div className="bg-[#140a00] rounded-lg p-4">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Active Positions</h3>
        <p className="text-xs text-zinc-600 text-center py-4">No active positions</p>
      </div>
    );
  }
  
  return (
    <div className="bg-[#140a00] rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Active Positions</h3>
      
      <div className="space-y-2">
        {positions.map((position) => {
          const isProfit = position.pnl >= 0;
          
          return (
            <div
              key={position.id}
              className="bg-[#1a1500] rounded p-2.5 space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {position.side === "long" ? (
                    <TrendingUp className="w-3 h-3 text-[#00FF85]" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-[#FF4040]" />
                  )}
                  <span className="text-xs font-medium text-white">{position.symbol}</span>
                </div>
                <span className="text-[9px] text-zinc-500 uppercase">{position.side}</span>
              </div>
              
              <div className="flex justify-between text-[9px]">
                <span className="text-zinc-500">Size: {position.size}</span>
                <span className="text-zinc-500">Entry: ${position.entryPrice.toLocaleString()}</span>
              </div>
              
              <div className="flex justify-between items-center pt-1 border-t border-zinc-900/50">
                <span className="text-[9px] text-zinc-600">P&L</span>
                <div className="text-right">
                  <div className={`text-xs font-mono font-bold ${isProfit ? "text-[#00FF85]" : "text-[#FF4040]"}`}>
                    {isProfit ? "+" : ""}{position.pnl.toFixed(2)}
                  </div>
                  <div className={`text-[8px] ${isProfit ? "text-[#00FF85]/70" : "text-[#FF4040]/70"}`}>
                    {isProfit ? "+" : ""}{position.pnlPercentage.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
