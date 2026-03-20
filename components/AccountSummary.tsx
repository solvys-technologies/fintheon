import { useEffect, useState } from "react";
import { useBackend } from "../lib/backend";
import type { Account } from "~backend/account/get";

export default function AccountSummary() {
  const backend = useBackend();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    loadAccount();
    const interval = setInterval(loadAccount, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadAccount = async () => {
    try {
      const data = await backend.account.get();
      setAccount(data);
    } catch (error) {
      console.error('Failed to load account:', error);
    }
  };

  if (!account) {
    return (
      <div className="bg-[#140a00] rounded-lg p-4 animate-pulse">
        <div className="h-4 bg-zinc-900 rounded w-1/3 mb-3"></div>
        <div className="space-y-2">
          <div className="h-3 bg-zinc-900 rounded"></div>
          <div className="h-3 bg-zinc-900 rounded"></div>
          <div className="h-3 bg-zinc-900 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#140a00] rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Account Summary</h3>
      
      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-zinc-500">Balance</span>
          <span className="text-sm font-mono text-white">${account.balance.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-zinc-500">Equity</span>
          <span className="text-sm font-mono text-white">${account.equity.toLocaleString()}</span>
        </div>
        
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-zinc-500">Margin Used</span>
          <span className="text-sm font-mono text-zinc-400">${account.marginUsed.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
