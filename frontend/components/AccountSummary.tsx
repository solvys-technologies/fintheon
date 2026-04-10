import { useEffect, useState } from "react";
import { useBackend } from "../lib/backend";
import { useAuth } from "../contexts/AuthContext";
import type { Account } from "../types/api";

export default function AccountSummary() {
  const backend = useBackend();
  const { isAuthenticated } = useAuth();
  const [account, setAccount] = useState<Account | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setAccount(null);
      return;
    }

    let interval: NodeJS.Timeout;

    const runLoadAccount = async () => {
      const shouldContinue = await loadAccount();
      if (shouldContinue) {
        interval = setInterval(loadAccount, 5000);
      }
    };

    runLoadAccount();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [backend, isAuthenticated]);

  const loadAccount = async (): Promise<boolean> => {
    if (!isAuthenticated) return false;
    try {
      const data = await backend.account.get();
      setAccount(data);
      return true;
    } catch (error: any) {
      console.warn("Failed to load account:", error);
      // If unauthorized, stop polling
      if (error?.status === 401 || error?.code === "auth_skipped") {
        console.warn("Account polling stopped due to auth failure");
        return false;
      }
      return true; // Continue polling for other errors
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

  const pnlPercentage = ((account.dailyPnl ?? 0) / account.balance) * 100;
  const isPositive = (account.dailyPnl ?? 0) >= 0;

  const barWidth = Math.min(Math.abs(pnlPercentage) * 2, 100);

  return (
    <div className="bg-[#140a00] rounded-lg p-4 space-y-3">
      <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
        Account Summary
      </h3>

      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-zinc-500">Balance</span>
          <span className="text-sm font-mono text-white">
            ${account.balance.toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-zinc-500">Equity</span>
          <span className="text-sm font-mono text-white">
            ${(account.equity ?? account.balance).toLocaleString()}
          </span>
        </div>

        <div className="flex justify-between items-baseline">
          <span className="text-[10px] text-zinc-500">Margin Used</span>
          <span className="text-sm font-mono text-zinc-400">
            ${(account.marginUsed ?? 0).toLocaleString()}
          </span>
        </div>
      </div>

      <div className="pt-3 border-t border-zinc-900">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[10px] text-zinc-500">Daily P&L</span>
          <div className="text-right">
            <div
              className="text-sm font-mono font-bold"
              style={{
                color: isPositive
                  ? "var(--fintheon-bullish)"
                  : "var(--fintheon-bearish)",
              }}
            >
              {isPositive ? "+" : ""}
              {(account.dailyPnl ?? 0).toFixed(2)}
            </div>
            <div
              className="text-[9px]"
              style={{
                color: isPositive
                  ? "color-mix(in srgb, var(--fintheon-bullish) 70%, transparent)"
                  : "color-mix(in srgb, var(--fintheon-bearish) 70%, transparent)",
              }}
            >
              {isPositive ? "+" : ""}
              {pnlPercentage.toFixed(2)}%
            </div>
          </div>
        </div>

        <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              backgroundColor: isPositive
                ? "var(--fintheon-bullish)"
                : "var(--fintheon-bearish)",
              width: `${barWidth}%`,
              marginLeft: isPositive ? "50%" : `${50 - barWidth}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
