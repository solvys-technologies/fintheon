import { X, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useBackend } from "../lib/backend";
import type { Account } from "~backend/account/get";
import type { Position } from "~backend/trading/list_positions";
import type { AnalystReport } from "../lib/services";
import Toggle from "./Toggle";
import AccountSummary from "./AccountSummary";
import PositionsList from "./PositionsList";

interface MissionControlProps {
  onClose: () => void;
}

export default function MissionControl({ onClose }: MissionControlProps) {
  const backend = useBackend();
  const [account, setAccount] = useState<Account | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [analystReports, setAnalystReports] = useState<AnalystReport[]>([]);
  const [analystRefreshing, setAnalystRefreshing] = useState(false);
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const accountData = await backend.account.get();
      setAccount(accountData);
      
      const positionsData = await backend.trading.listPositions();
      setPositions(positionsData.positions);

      const reports = await backend.analysts.getReports();
      setAnalystReports(reports);
    } catch (error: any) {
      if (error.code === "not_found") {
        const newAccount = await backend.account.create({ initialBalance: 10000 });
        setAccount(newAccount);
        await backend.trading.seedPositions();
        const positionsData = await backend.trading.listPositions();
        setPositions(positionsData.positions);
      }
    }
  };
  
  const handleToggle = async (key: "tradingEnabled" | "autoTrade" | "riskManagement", value: boolean) => {
    if (!account) return;
    
    await backend.account.updateSettings({
      [key]: value,
    });
    
    setAccount({ ...account, [key]: value });
  };

  const refreshAnalystReports = async () => {
    setAnalystRefreshing(true);
    try {
      const reports = await backend.analysts.getReports({ refresh: true });
      setAnalystReports(reports);
    } catch (error) {
      console.error('Failed to refresh analyst reports', error);
    } finally {
      setAnalystRefreshing(false);
    }
  };
  
  return (
    <div className="w-[280px] bg-[#0a0a00] border-r border-zinc-900 flex flex-col">
      <div className="h-14 border-b border-zinc-900 flex items-center justify-between px-4">
        <h2 className="text-sm font-medium text-[#D4AF37] tracking-wider uppercase">Mission Control</h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-zinc-900/50 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-500" />
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AccountSummary />
        
        <div className="bg-[#140a00] rounded-lg p-4 space-y-3">
          <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Trading Status</h3>
          
          <Toggle
            label="Trading Enabled"
            checked={account?.tradingEnabled ?? false}
            onChange={(checked) => handleToggle("tradingEnabled", checked)}
          />
          
          <Toggle
            label="Auto Trade"
            checked={account?.autoTrade ?? false}
            onChange={(checked) => handleToggle("autoTrade", checked)}
          />
          
          <Toggle
            label="Risk Management"
            checked={account?.riskManagement ?? false}
            onChange={(checked) => handleToggle("riskManagement", checked)}
          />
        </div>

        <div className="bg-[#140a00] rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Analyst Pulse</h3>
            <button
              onClick={refreshAnalystReports}
              className="text-[10px] text-[#D4AF37] uppercase tracking-widest disabled:opacity-50"
              disabled={analystRefreshing}
            >
              {analystRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {analystReports.length === 0 ? (
            <p className="text-xs text-zinc-500">No analyst summaries yet.</p>
          ) : (
            analystReports.map((report) => {
              const data = report.reportData || {};
              const metrics = Array.isArray(data.metrics) ? data.metrics : [];
              return (
                <div key={report.id} className="bg-black/30 border border-[#D4AF37]/10 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-white uppercase">
                      {data.title || report.agentType.replace('_', ' ')}
                    </p>
                    {report.confidenceScore !== null && report.confidenceScore !== undefined && (
                      <span className="text-[10px] text-zinc-400">
                        {(report.confidenceScore * 100).toFixed(0)}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">{data.summary}</p>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-zinc-300">
                    {metrics.map((metric: any, idx: number) => (
                      <div key={`${report.id}-metric-${idx}`} className="bg-black/20 rounded px-2 py-1">
                        <p className="text-[10px] text-zinc-500 uppercase">{metric.label}</p>
                        <p>{metric.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        <PositionsList />
      </div>
    </div>
  );
}
