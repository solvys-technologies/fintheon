// [claude-code 2026-03-22] T5: Updated pricing — Pleb $0, Analyst $149, Desk $699, Boardroom $1,999
import { X, Check, Cpu } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/Button";
import { useAuth } from "../contexts/AuthContext";

interface UpgradeModalProps {
  onClose: () => void;
}

type Tier = "free" | "fintheon" | "fintheon_plus" | "fintheon_pro";

interface TierInfo {
  name: string;
  price: string;
  priceSubtext: string;
  features: string[];
  color: string;
  borderColor: string;
  buttonText: string;
}

const tierData: Record<Tier, TierInfo> = {
  free: {
    name: "Pleb",
    price: "$0",
    priceSubtext: "forever",
    features: [
      "Basic RiskFlow access",
      "Limited daily brief",
      "Community support",
    ],
    color: "text-gray-400",
    borderColor: "border-gray-600",
    buttonText: "Current Plan",
  },
  fintheon: {
    name: "Analyst",
    price: "$149",
    priceSubtext: "per month",
    features: [
      "Full RiskFlow feed",
      "Read-only Consilium",
      "Executive dashboard",
      "P&L tracking",
      "All daily briefs (MDB/ADB/PMDB/WT)",
    ],
    color: "text-[var(--fintheon-accent)]",
    borderColor: "border-[var(--fintheon-accent)]",
    buttonText: "Upgrade to Analyst",
  },
  fintheon_plus: {
    name: "Desk",
    price: "$699",
    priceSubtext: "per month",
    features: [
      "Everything in Analyst",
      "Full Consilium with @mention",
      "Voice assistant",
      "Chat agents",
      "MiroShark predictions",
      "Automated proposals",
    ],
    color: "text-[color-mix(in_srgb,var(--fintheon-accent)_80%,white)]",
    borderColor: "border-[color-mix(in_srgb,var(--fintheon-accent)_80%,white)]",
    buttonText: "Upgrade to Desk",
  },
  fintheon_pro: {
    name: "Boardroom",
    price: "$1,999",
    priceSubtext: "per month",
    features: [
      "Everything in Desk",
      "Custom agent instructions",
      "Autopilot + Rithmic",
      "API access",
      "Priority Opus routing",
      "White-glove onboarding",
    ],
    color: "text-emerald-400",
    borderColor: "border-emerald-400",
    buttonText: "Upgrade to Boardroom",
  },
};

export function UpgradeModal({ onClose }: UpgradeModalProps) {
  const { tier, setTier } = useAuth();
  const [isClosing, setIsClosing] = useState(false);

  const handleUpgrade = (selectedTier: Tier) => {
    setTier(selectedTier);
    setIsClosing(true);
    setTimeout(() => onClose(), 1300);
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => onClose(), 1300);
  };

  return (
    <div
      className={`fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 ${isClosing ? "animate-fade-out-backdrop" : "animate-fade-in-backdrop"}`}
    >
      <div
        className={`bg-[var(--fintheon-surface)] border border-[var(--fintheon-accent)]/30 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto ${isClosing ? "animate-fade-out" : "animate-fade-in"}`}
      >
        <div className="sticky top-0 bg-[var(--fintheon-surface)] border-b border-[var(--fintheon-accent)]/20 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[var(--fintheon-accent)] flex items-center gap-2">
              <Cpu className="w-6 h-6" />
              Upgrade Your Plan
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Choose the plan that fits your trading needs
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[var(--fintheon-accent)]/10 rounded transition-lush"
          >
            <X className="w-5 h-5 text-[var(--fintheon-accent)]" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(
              ["free", "fintheon", "fintheon_plus", "fintheon_pro"] as const
            ).map((t) => {
              const info = tierData[t];
              const isCurrent = tier === t;

              return (
                <div
                  key={t}
                  className={`bg-[var(--fintheon-bg)] border-2 rounded-lg p-6 transition-all ${
                    isCurrent
                      ? `${info.borderColor} shadow-lg`
                      : "border-[var(--fintheon-accent)]/20 hover:border-[var(--fintheon-accent)]/40"
                  }`}
                >
                  <div className="text-center mb-6">
                    <h3 className={`text-xl font-bold ${info.color} mb-2`}>
                      {info.name}
                    </h3>
                    <div className="mb-1">
                      <span className="text-3xl font-bold text-white">
                        {info.price}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500">{info.priceSubtext}</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {info.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check
                          className={`w-4 h-4 mt-0.5 flex-shrink-0 ${info.color}`}
                        />
                        <span className="text-sm text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant={isCurrent ? "secondary" : "primary"}
                    onClick={() => !isCurrent && handleUpgrade(t)}
                    disabled={isCurrent}
                    className="w-full"
                  >
                    {isCurrent ? "Current Plan" : info.buttonText}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-6 bg-[var(--fintheon-bg)] border border-[var(--fintheon-accent)]/20 rounded-lg">
            <h3 className="text-lg font-semibold text-[var(--fintheon-accent)] mb-3">
              Need Help Choosing?
            </h3>
            <p className="text-sm text-gray-400 mb-4">
              Not sure which plan is right for you? Our team can help you find
              the perfect fit for your trading strategy.
            </p>
            <Button variant="secondary" className="text-sm">
              Contact Sales
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
