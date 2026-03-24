import { useState, useEffect } from 'react';
import { useBackend } from '../../lib/backend';
import { useAuth } from '../../contexts/AuthContext';
import type { ProjectXAccount } from '../../../types/api';
type BrokerAccount = ProjectXAccount & { provider?: string; isPaper?: boolean };

interface CompactPnLDisplayProps {
  showAccount?: boolean;
}

/**
 * Compact P&L display for floating widget
 * Shows current day P&L and optionally the active account
 */
export function CompactPnLDisplay({ showAccount = true }: CompactPnLDisplayProps) {
  const backend = useBackend();
  const { isAuthenticated } = useAuth();
  const [currentPnL, setCurrentPnL] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<BrokerAccount | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setCurrentPnL(0);
      setSelectedAccount(null);
      return;
    }

    let interval: NodeJS.Timeout;

    const fetchData = async (): Promise<boolean> => {
      try {
        // Fetch account P&L
        const account = await backend.account.get();
        setCurrentPnL(account.dailyPnl);

        // Fetch ProjectX accounts to get active account info
        if (showAccount) {
          const result = await backend.projectx.listAccounts();
          if (result.accounts.length > 0) {
            // Use the first account or the one marked as active
            setSelectedAccount(result.accounts[0]);
          }
        }
        return true;
      } catch (err: any) {
        console.warn('Failed to fetch account data:', err);
        if (err?.status === 401 || err?.code === 'auth_skipped') {
          return false;
        }
        return true;
      }
    };

    const runPolling = async () => {
      const ok = await fetchData();
      if (ok) {
        interval = setInterval(async () => {
          const ok = await fetchData();
          if (!ok && interval) clearInterval(interval);
        }, 5000);
      }
    };

    runPolling();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [backend, isAuthenticated, showAccount]);

  const pnlCssColor = currentPnL >= 0 ? 'var(--fintheon-bullish)' : 'var(--fintheon-bearish)';
  const pnlSign = currentPnL >= 0 ? '+' : '';

  return (
    <div className="flex items-center gap-3">
      {/* P&L Display */}
      <div className="flex flex-col items-end">
        <span className="text-[9px] text-gray-500">Day P&L</span>
        <span className="text-sm font-bold" style={{ color: pnlCssColor }}>
          {pnlSign}${currentPnL.toFixed(2)}
        </span>
      </div>

      {/* Account Info */}
      {showAccount && selectedAccount && (
        <div className="flex flex-col items-start border-l border-zinc-700 pl-3">
          <span className="text-[9px] text-gray-500">Account</span>
          <span className="text-[10px] text-[var(--fintheon-accent)] font-medium truncate max-w-[80px]">
            {selectedAccount.accountName}
          </span>
          <span className="text-[8px] text-gray-500">
            {selectedAccount.provider} • {selectedAccount.isPaper ? 'Paper' : 'Live'}
          </span>
        </div>
      )}
    </div>
  );
}
