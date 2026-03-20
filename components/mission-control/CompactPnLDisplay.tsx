import { useState, useEffect } from 'react';
import { useBackend } from '../../lib/backend';
import type { BrokerAccount } from '~backend/projectx/list_accounts';

interface CompactPnLDisplayProps {
  showAccount?: boolean;
}

/**
 * Compact P&L display for floating widget
 * Shows current day P&L and optionally the active account
 */
export function CompactPnLDisplay({ showAccount = true }: CompactPnLDisplayProps) {
  const backend = useBackend();
  const [currentPnL, setCurrentPnL] = useState<number>(0);
  const [selectedAccount, setSelectedAccount] = useState<BrokerAccount | null>(null);

  useEffect(() => {
    const fetchData = async () => {
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
      } catch (err) {
        console.error('Failed to fetch account data:', err);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [backend, showAccount]);

  const pnlColor = currentPnL >= 0 ? 'text-emerald-400' : 'text-red-500';
  const pnlSign = currentPnL >= 0 ? '+' : '';

  return (
    <div className="flex items-center gap-3">
      {/* P&L Display */}
      <div className="flex flex-col items-end">
        <span className="text-[9px] text-gray-500">Day P&L</span>
        <span className={`text-sm font-bold ${pnlColor}`}>
          {pnlSign}${currentPnL.toFixed(2)}
        </span>
      </div>

      {/* Account Info */}
      {showAccount && selectedAccount && (
        <div className="flex flex-col items-start border-l border-zinc-700 pl-3">
          <span className="text-[9px] text-gray-500">Account</span>
          <span className="text-[10px] text-[#D4AF37] font-medium truncate max-w-[80px]">
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
