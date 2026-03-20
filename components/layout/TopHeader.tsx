// [claude-code 2026-03-20] Shell rebuild: stripped TopStepX, IV fetching, layout options — clean title bar only
import { useAuth } from '../../contexts/AuthContext';

function FintheonLogo() {
  return (
    <div className="relative w-10 h-10 flex items-center justify-center">
      <img
        src="/fintheon-logo.png"
        alt="Fintheon Logo"
        className="w-10 h-10 object-contain"
      />
    </div>
  );
}

export function TopHeader() {
  const { tier } = useAuth();

  const getTierDisplayName = () => {
    switch (tier) {
      case 'free': return 'Free';
      case 'fintheon': return 'Fintheon';
      case 'fintheon_plus': return 'Fintheon+';
      case 'fintheon_pro': return 'Fintheon Pro';
      default: return 'Free';
    }
  };

  return (
    <div className="bg-[#0a0a00] border-b border-[#D4AF37]/20 h-[70px] flex items-center justify-between pr-6">
      <div className="flex items-center gap-3">
        <div className="w-16 flex items-center justify-center">
          <FintheonLogo />
        </div>
        <span className="text-sm font-semibold text-[#c79f4a] tracking-wide">Fintheon</span>
        <span className="text-[13px] text-gray-500 border border-[#D4AF37]/20 rounded-lg px-3 py-1 bg-[#050500]">
          {getTierDisplayName()}
        </span>
      </div>
    </div>
  );
}
