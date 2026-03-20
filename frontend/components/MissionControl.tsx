import { X, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useBackend } from "../lib/backend";
import type { Account } from "../types/api";
import type { Position } from "../types/api";
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
  
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      const accountData = await backend.account.get();
      setAccount(accountData);
      
      const positionsData = await backend.trading.listPositions();
      setPositions(positionsData.positions);
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
  
  return (
    <div className="w-[280px] bg-[var(--fintheon-surface)] border-r border-zinc-900 flex flex-col">
      <div className="h-14 border-b border-zinc-900 flex items-center justify-between px-4">
        <h2 className="text-sm font-medium text-[var(--fintheon-accent)] tracking-wider uppercase">Mission Control</h2>
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
        
        <PositionsList />
      </div>
    </div>
  );
}
