// [claude-code 2026-02-26] Replace balance KPI with status + platform tracker; remove P&L pill graphic.
import { useSettings } from '../../contexts/SettingsContext';
import { useState, useEffect } from 'react';
import { useBackend } from '../../lib/backend';
import { useAuth } from '../../contexts/AuthContext';
import { TestTradeButton } from './TestTradeButton';
import type { ProjectXAccount } from '../../../types/api';
type BrokerAccount = ProjectXAccount & { provider?: string; isPaper?: boolean };
import { Radio } from 'lucide-react';

interface AccountTrackerWidgetProps {
  currentPnL?: number;
}

export function AccountTrackerWidget({ currentPnL: propPnL }: AccountTrackerWidgetProps) {
  const backend = useBackend();
  const { isAuthenticated } = useAuth();
  const { developerSettings } = useSettings();
  const [currentPnL, setCurrentPnL] = useState<number>(propPnL ?? 0);
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [showAccountDropdown, setShowAccountDropdown] = useState<boolean>(false);
  const [projectxAccounts, setProjectxAccounts] = useState<BrokerAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uplinked, setUplinked] = useState<boolean>(false);
  const [uplinking, setUplinking] = useState<boolean>(false);
  const [uplinkMessage, setUplinkMessage] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchProjectXAccounts = async () => {
      try {
        const result = await backend.projectx.listAccounts();
        setProjectxAccounts(result.accounts as BrokerAccount[]);
        if (result.accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(result.accounts[0].accountId);
        }
      } catch (err) {
        console.warn('Failed to fetch ProjectX accounts:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjectXAccounts();
  }, [backend, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;

    let interval: NodeJS.Timeout;

    const fetchAccount = async (): Promise<boolean> => {
      try {
        const account = await backend.account.get();
        // Always use dailyPnl from backend, not prop (prop is for backward compatibility)
        setCurrentPnL(account.dailyPnl);
        return true;
      } catch (err: any) {
        console.warn('Failed to fetch account:', err);
        if (err?.status === 401 || err?.code === 'auth_skipped') {
          return false;
        }
        return true;
      }
    };

    const runPolling = async () => {
      const shouldContinue = await fetchAccount();
      if (shouldContinue) {
        interval = setInterval(async () => {
          const ok = await fetchAccount();
          if (!ok && interval) clearInterval(interval);
        }, 5000);
      }
    };

    runPolling();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [backend, isAuthenticated]);

  const handleUplink = async () => {
    setUplinking(true);
    setUplinkMessage('');
    try {
      const result = await backend.projectx.uplinkProjectX();
      if (result.success) {
        setUplinked(true);
        setUplinkMessage(result.message);

        const accountsResult = await backend.projectx.listAccounts();
        setProjectxAccounts(accountsResult.accounts as BrokerAccount[]);
        if (accountsResult.accounts.length > 0 && !selectedAccount) {
          setSelectedAccount(accountsResult.accounts[0].accountId);
        }

        const account = await backend.account.get();
        setCurrentPnL(account.dailyPnl);
      } else {
        setUplinkMessage(result.message);
      }
    } catch (err: any) {
      console.warn('Failed to uplink:', err);
      if (err?.message?.includes('credentials') || err?.message?.includes('ProjectX')) {
        setUplinkMessage(err.message);
      } else if (err?.code === 'unauthenticated') {
        setUplinkMessage('Authentication error - please refresh the page');
      } else {
        setUplinkMessage('Failed to establish uplink - check console for details');
      }
    } finally {
      setUplinking(false);
      setTimeout(() => setUplinkMessage(''), 5000);
    }
  };

  const activeAccount = projectxAccounts.find(a => a.accountId === selectedAccount);
  const statusWord = uplinked ? 'Active' : 'Dormant';
  const statusColor = uplinked ? 'text-emerald-400' : 'text-zinc-500';
  const platformLabel = activeAccount
    ? `${activeAccount.provider ?? 'ProjectX'} • ${activeAccount.isPaper ? 'Paper' : 'Live'}`
    : (projectxAccounts.length > 0 ? 'Select an account' : 'No uplink');

  return (
    <div className="bg-[var(--fintheon-bg)] p-2.5">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <h3 className="text-xs font-semibold text-[var(--fintheon-accent)]">Account Tracker</h3>
          {uplinked && (
            <div className="relative">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              <div className="absolute inset-0 w-1.5 h-1.5 bg-emerald-400 rounded-full animate-ping opacity-75" />
            </div>
          )}
        </div>
        <p className="text-[10px] text-gray-500">{loading ? 'Loading…' : ''}</p>
      </div>

      {/* Account chooser dropdown in its own row */}
      <div className="mb-1.5">
        <div className="relative">
          {projectxAccounts.length > 0 ? (
            <>
              <button
                onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                className="w-full px-2 py-1 rounded bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 text-[10px] text-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/10 transition-colors text-left"
              >
                {projectxAccounts.find(a => a.accountId === selectedAccount)?.accountName || 'Select Account'}
              </button>
              {showAccountDropdown && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded shadow-lg z-10 min-w-[180px]">
                  {projectxAccounts.map(account => (
                    <button
                      key={account.accountId}
                      onClick={() => {
                        setSelectedAccount(account.accountId);
                        setShowAccountDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--fintheon-accent)]/10 transition-colors ${selectedAccount === account.accountId ? 'text-[var(--fintheon-accent)]' : 'text-gray-400'
                        }`}
                    >
                      <div className="font-medium">{account.accountName}</div>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        {account.provider} • {account.isPaper ? 'Paper' : 'Live'}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="w-full px-2 py-1 text-[10px] text-gray-500 text-center">
No accounts
            </div>
          )}
        </div>
      </div>

      <div className="mb-2">
        <button
          onClick={handleUplink}
          disabled={uplinking || uplinked}
          className={`w-full px-2 py-1.5 rounded font-medium text-[11px] transition-all flex items-center justify-center gap-1.5 ${uplinked
            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
            : 'bg-[var(--fintheon-accent)] hover:bg-[var(--fintheon-accent)]/90 text-black border border-[var(--fintheon-accent)]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          <Radio className={`w-3 h-3 ${uplinked ? 'animate-pulse' : ''}`} />
          {uplinking ? 'Establishing Uplink...' : uplinked ? 'Uplink Active' : 'Uplink'}
        </button>
        {uplinkMessage && (
          <p className={`text-[10px] mt-1 text-center ${uplinked ? 'text-emerald-400' : 'text-red-400'
            }`}>
            {uplinkMessage}
          </p>
        )}
      </div>

      <div className="mb-2 flex justify-between items-baseline">
        <div>
          <p className="text-[10px] text-gray-500">Status</p>
          <p className={`text-sm font-bold ${statusColor}`}>{statusWord}</p>
          <p className="text-[10px] text-zinc-600 mt-0.5">Trading: {platformLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-500">Day P&L</p>
          <span className="text-sm font-bold" style={{ color: currentPnL >= 0 ? 'var(--fintheon-bullish)' : 'var(--fintheon-bearish)' }}>
            {currentPnL >= 0 ? '+' : ''}${currentPnL.toFixed(2)}
          </span>
        </div>
      </div>

      {developerSettings.showTestTradeButton && (
        <div className="mt-4 pt-4 border-t border-zinc-800">
          <TestTradeButton selectedAccount={selectedAccount} />
        </div>
      )}
    </div>
  );
}
