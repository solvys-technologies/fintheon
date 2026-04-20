// [claude-code 2026-04-16] Added linked Google account display + switch account
// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — general/profile tab
import React, { useState } from "react";
import { CreditCard, Mail, RefreshCw } from "@/components/shared/iso-icons";
import { Button } from "../ui/Button";
import { useAuth } from "../../contexts/AuthContext";

interface AvailableSymbol {
  symbol: string;
  contractName: string;
  description: string;
}

interface GeneralTabProps {
  traderName: string;
  setTraderName: (name: string) => void;
  selectedSymbol: { symbol: string; contractName: string };
  setSelectedSymbol: (sym: { symbol: string; contractName: string }) => void;
  availableSymbols: AvailableSymbol[];
  tier: string;
  onShowUpgradeModal: () => void;
}

export function GeneralTab({
  traderName,
  setTraderName,
  selectedSymbol,
  setSelectedSymbol,
  availableSymbols,
  tier,
  onShowUpgradeModal,
}: GeneralTabProps) {
  const [showSymbolDropdown, setShowSymbolDropdown] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const { user, signOut, signIn } = useAuth();

  const linkedEmail = user?.email || user?.user_metadata?.email || null;
  const avatarUrl = user?.user_metadata?.avatar_url || null;

  const handleSwitchAccount = async () => {
    setIsSwitching(true);
    try {
      await signOut();
      await signIn();
    } catch {
      setIsSwitching(false);
    }
  };

  return (
    <>
      <section className="mb-6">
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Trader Identity
        </h3>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            Trader Name
          </label>
          <input
            type="text"
            value={traderName}
            onChange={(e) => setTraderName(e.target.value.slice(0, 24))}
            maxLength={24}
            placeholder="Enter your name"
            className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded-lg px-4 py-3 text-white text-sm focus:outline-none focus:border-[var(--fintheon-accent)]/30 transition-colors"
          />
          <p className="text-[10px] text-gray-500 mt-1.5">
            Displayed in the toolbar next to your tier badge
          </p>
        </div>
      </section>

      <section className="mb-6">
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Linked Google Account
        </h3>
        <div className="bg-[var(--fintheon-bg)] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt=""
                  className="w-9 h-9 rounded-full border border-zinc-700"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-gray-400" />
                </div>
              )}
              <div>
                <p className="text-sm text-white">
                  {linkedEmail || "No account linked"}
                </p>
                <p className="text-[10px] text-gray-500">
                  Google OAuth via Supabase
                </p>
              </div>
            </div>
            <Button
              variant="secondary"
              className="text-xs flex items-center gap-1.5"
              onClick={handleSwitchAccount}
              disabled={isSwitching}
            >
              <RefreshCw
                className={`w-3 h-3 ${isSwitching ? "animate-spin" : ""}`}
              />
              Switch Account
            </Button>
          </div>
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Trading Symbol
        </h3>
        <div className="relative">
          {(() => {
            const symbolKey = selectedSymbol.symbol.replace("/", "");
            const selected =
              availableSymbols.find((s) => s.symbol === symbolKey) ||
              availableSymbols[0];
            return (
              <>
                <button
                  onClick={() => setShowSymbolDropdown(!showSymbolDropdown)}
                  className="w-full bg-[var(--fintheon-surface)] border border-zinc-800 rounded-lg px-4 py-3 text-left hover:border-[var(--fintheon-accent)]/30 focus:outline-none focus:border-[var(--fintheon-accent)]/30 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-bold text-white">
                        {selected.symbol}
                      </div>
                      <div className="text-xs text-gray-400">
                        {selected.contractName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {selected.description}
                      </div>
                    </div>
                    <svg
                      className="w-5 h-5 text-gray-400 ml-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>
                {showSymbolDropdown && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowSymbolDropdown(false)}
                    />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-lg shadow-xl z-20 max-h-64 overflow-y-auto">
                      {availableSymbols.map((sym) => {
                        const isSelected = sym.symbol === symbolKey;
                        return (
                          <button
                            key={sym.symbol}
                            onClick={() => {
                              setSelectedSymbol({
                                symbol: `/${sym.symbol}`,
                                contractName: `/${sym.contractName.replace(" ", "")}`,
                              });
                              setShowSymbolDropdown(false);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-[var(--fintheon-accent)]/10 transition-colors border-b border-zinc-800 last:border-b-0 ${
                              isSelected ? "bg-[var(--fintheon-accent)]/20" : ""
                            }`}
                          >
                            <div className="text-sm font-bold text-white">
                              {sym.symbol}
                            </div>
                            <div className="text-xs text-gray-400">
                              {sym.contractName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {sym.description}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            );
          })()}
        </div>
      </section>

      <section className="pt-6 border-t border-zinc-800">
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Billing
        </h3>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Current Plan
            </h4>
            <div className="bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-lg font-bold text-[var(--fintheon-accent)]">
                    {tier.replace("_", " ").toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-500">Active subscription</p>
                </div>
                <Button
                  variant="secondary"
                  className="text-xs"
                  onClick={onShowUpgradeModal}
                >
                  Change Plan
                </Button>
              </div>
              <div className="text-sm text-gray-400">
                <p>
                  Next billing date:{" "}
                  <span className="text-white">Jan 4, 2026</span>
                </p>
                <p className="mt-1">
                  Amount: <span className="text-white">$149.00</span>
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Payment Method
            </h4>
            <div className="bg-[var(--fintheon-bg)] border border-zinc-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-white">.... .... .... 4242</p>
                    <p className="text-xs text-gray-500">Expires 12/2027</p>
                  </div>
                </div>
                <Button variant="secondary" className="text-xs">
                  Update
                </Button>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Billing History
            </h4>
            <div className="bg-[var(--fintheon-bg)] border border-zinc-800 rounded-lg overflow-hidden">
              {[
                { date: "Dec 4, 2025", amount: "$149.00", status: "Paid" },
                { date: "Nov 4, 2025", amount: "$149.00", status: "Paid" },
                { date: "Oct 4, 2025", amount: "$149.00", status: "Paid" },
              ].map((invoice, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 last:border-b-0 hover:bg-[var(--fintheon-accent)]/5 transition-colors"
                >
                  <div>
                    <p className="text-sm text-white">{invoice.date}</p>
                    <p className="text-xs text-gray-500">{invoice.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-white">
                      {invoice.amount}
                    </p>
                    <button className="text-xs text-[var(--fintheon-accent)] hover:underline">
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-red-500 mb-3">
              Danger Zone
            </h4>
            <div className="bg-[var(--fintheon-bg)] border border-red-500/30 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-3">
                Cancel your subscription. You will retain access until the end
                of your billing period.
              </p>
              <Button
                variant="secondary"
                className="text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
              >
                Cancel Subscription
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
