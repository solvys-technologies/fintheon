import { X, Check, Cpu } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/Button';
import { useAuth } from '../contexts/AuthContext';

interface UpgradeModalProps {
  onClose: () => void;
}

type Tier = 'free' | 'pulse' | 'pulse_plus' | 'pulse_pro';

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
    name: 'Free',
    price: '$0',
    priceSubtext: 'forever',
    features: [
      'Basic RiskFlow',
      'IV Score + Implied Vol Tickers',
      'Community support',
    ],
    color: 'text-gray-400',
    borderColor: 'border-gray-600',
    buttonText: 'Current Plan',
  },
  pulse: {
    name: 'Pulse',
    price: '$49',
    priceSubtext: 'per month',
    features: [
      'Everything in Free',
      'PsychAssist',
      'Basic RiskFlow with implied volatility scoring',
      'Trading Psych Agent for ER Analysis',
    ],
    color: 'text-[#D4AF37]',
    borderColor: 'border-[#D4AF37]',
    buttonText: 'Upgrade to Pulse',
  },
  pulse_plus: {
    name: 'Pulse+',
    price: '$149',
    priceSubtext: 'per month',
    features: [
      'Everything in Pulse',
      'Risk management tools',
      'Autonomous Trading Algo',
      'Full RiskFlow for commentary and macroeconomic data releases with implied volatility scoring',
    ],
    color: 'text-[#FBC717]',
    borderColor: 'border-[#FBC717]',
    buttonText: 'Upgrade to Pulse+',
  },
  pulse_pro: {
    name: 'Pulse Pro',
    price: '$299',
    priceSubtext: 'per month',
    features: [
      'Everything in Pulse+',
      'Priority support',
      'Custom AI Agent & Trading model training',
      'Multi-account management',
      'Access to Risk Event Trading Playbook from Priced In Research',
    ],
    color: 'text-emerald-400',
    borderColor: 'border-emerald-400',
    buttonText: 'Upgrade to Pro',
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
    <div className={`fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 ${isClosing ? 'animate-fade-out-backdrop' : 'animate-fade-in-backdrop'}`}>
      <div className={`bg-[#0a0a00] border border-[#D4AF37]/30 rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}>
        <div className="sticky top-0 bg-[#0a0a00] border-b border-[#D4AF37]/20 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-[#D4AF37] flex items-center gap-2">
              <Cpu className="w-6 h-6" />
              Upgrade Your Plan
            </h2>
            <p className="text-sm text-gray-400 mt-1">Choose the plan that fits your trading needs</p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[#D4AF37]/10 rounded transition-lush"
          >
            <X className="w-5 h-5 text-[#D4AF37]" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {(['free', 'pulse', 'pulse_plus', 'pulse_pro'] as const).map((t) => {
              const info = tierData[t];
              const isCurrent = tier === t;
              
              return (
                <div
                  key={t}
                  className={`bg-[#050500] border-2 rounded-lg p-6 transition-all ${
                    isCurrent
                      ? `${info.borderColor} shadow-lg`
                      : 'border-[#D4AF37]/20 hover:border-[#D4AF37]/40'
                  }`}
                >
                  <div className="text-center mb-6">
                    <h3 className={`text-xl font-bold ${info.color} mb-2`}>{info.name}</h3>
                    <div className="mb-1">
                      <span className="text-3xl font-bold text-white">{info.price}</span>
                    </div>
                    <p className="text-xs text-gray-500">{info.priceSubtext}</p>
                  </div>

                  <div className="space-y-3 mb-6">
                    {info.features.map((feature, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${info.color}`} />
                        <span className="text-sm text-gray-300">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant={isCurrent ? 'secondary' : 'primary'}
                    onClick={() => !isCurrent && handleUpgrade(t)}
                    disabled={isCurrent}
                    className="w-full"
                  >
                    {isCurrent ? 'Current Plan' : info.buttonText}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="mt-8 p-6 bg-[#050500] border border-[#D4AF37]/20 rounded-lg">
            <h3 className="text-lg font-semibold text-[#D4AF37] mb-3">Need Help Choosing?</h3>
            <p className="text-sm text-gray-400 mb-4">
              Not sure which plan is right for you? Our team can help you find the perfect fit for your trading strategy.
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
