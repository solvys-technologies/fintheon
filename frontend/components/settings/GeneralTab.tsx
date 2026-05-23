// [claude-code 2026-04-16] Added linked Google account display + switch account
// [claude-code 2026-04-03] Extracted from SettingsPanel.tsx — general/profile tab
import React, { useState } from "react";
import { CreditCard } from "lucide-react";
import { ProfileSettingsSection } from "./ProfileSettingsSection";

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

  return (
    <>
      <ProfileSettingsSection
        traderName={traderName}
        setTraderName={setTraderName}
      />

      <section className="fintheon-fade-divider mt-6 pb-1">
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
                  className="w-full rounded-md bg-[var(--fintheon-surface)] px-4 py-3 text-left transition-opacity duration-200 hover:opacity-85 focus:outline-none"
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
                    <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-md bg-[var(--fintheon-surface)] fintheon-fade-in">
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
                            className={`fintheon-fade-divider w-full text-left px-4 py-3 transition-colors hover:bg-[var(--fintheon-accent)]/8 ${
                              isSelected ? "bg-[var(--fintheon-accent)]/10" : ""
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

      <section className="fintheon-fade-divider mt-6 pt-2">
        <h3 className="text-sm font-semibold text-[var(--fintheon-accent)] mb-3">
          Billing
        </h3>
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Current Plan
            </h4>
            <div className="rounded-md bg-[var(--fintheon-surface)] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-lg font-bold text-[var(--fintheon-accent)]">
                    {tier.replace("_", " ").toUpperCase()}
                  </p>
                  <p className="text-xs text-gray-500">Active subscription</p>
                </div>
                <button
                  type="button"
                  className="fintheon-action-link text-right text-[11px] font-semibold uppercase tracking-[0.12em]"
                  onClick={onShowUpgradeModal}
                >
                  Change Plan
                </button>
              </div>
              <div className="text-sm text-gray-400">
                <p>
                  Next billing date:{" "}
                  <span className="text-[var(--fintheon-text)]">Jan 4, 2026</span>
                </p>
                <p className="mt-1">
                  Amount: <span className="text-[var(--fintheon-text)]">$149.00</span>
                </p>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Payment Method
            </h4>
            <div className="rounded-md bg-[var(--fintheon-surface)] p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-12 items-center justify-center rounded bg-[var(--fintheon-bg)]">
                    <CreditCard className="h-5 w-5 text-[var(--fintheon-accent)]/70" />
                  </div>
                  <div>
                    <p className="text-sm text-[var(--fintheon-text)]">.... .... .... 4242</p>
                    <p className="text-xs text-gray-500">Expires 12/2027</p>
                  </div>
                </div>
                <button type="button" className="fintheon-action-link text-right text-[11px] font-semibold uppercase tracking-[0.12em]">
                  Update
                </button>
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">
              Billing History
            </h4>
            <div className="rounded-md bg-[var(--fintheon-surface)]">
              {[
                { date: "Dec 4, 2025", amount: "$149.00", status: "Paid" },
                { date: "Nov 4, 2025", amount: "$149.00", status: "Paid" },
                { date: "Oct 4, 2025", amount: "$149.00", status: "Paid" },
              ].map((invoice, idx) => (
                <div
                  key={idx}
                  className="fintheon-fade-divider flex items-center justify-between px-4 py-3 transition-opacity duration-200 hover:opacity-80"
                >
                  <div>
                    <p className="text-sm text-[var(--fintheon-text)]">{invoice.date}</p>
                    <p className="text-xs text-gray-500">{invoice.status}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-[var(--fintheon-text)]">
                      {invoice.amount}
                    </p>
                    <button className="fintheon-action-link text-right text-[11px] font-semibold uppercase tracking-[0.12em]">
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
            <div className="rounded-md bg-[var(--fintheon-surface)] p-4">
              <p className="text-sm text-gray-400 mb-3">
                Cancel your subscription. You will retain access until the end
                of your billing period.
              </p>
              <div className="flex justify-end">
                <button className="fintheon-action-link text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-red-400">
                  Cancel Subscription
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
