// [claude-code 2026-03-31] Heat Regime shimmer on Google sign-in button
import React from 'react';

type GoogleSignInButtonProps = {
  onClick: () => void;
  isLoading: boolean;
};

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({ onClick, isLoading }) => (
  <>
    <style>{`
      @keyframes heat-regime-shimmer {
        0%, 100% {
          box-shadow:
            0 0 6px rgba(199, 159, 74, 0.15),
            inset 0 0 8px rgba(199, 159, 74, 0.05);
          border-color: rgba(199, 159, 74, 0.2);
        }
        50% {
          box-shadow:
            0 0 18px rgba(199, 159, 74, 0.35),
            0 0 40px rgba(199, 159, 74, 0.1),
            inset 0 0 12px rgba(199, 159, 74, 0.08);
          border-color: rgba(199, 159, 74, 0.5);
        }
      }
    `}</style>
    <button
      onClick={onClick}
      disabled={isLoading}
      className="group flex w-full items-center justify-center gap-3 rounded-lg border border-[#c79f4a]/20 bg-[#0a0906] px-6 py-3.5 text-sm font-medium tracking-wide text-[#f0ead6] transition-all duration-300 hover:border-[#c79f4a]/50 hover:bg-[#0a0906]/80 focus:outline-none focus:ring-2 focus:ring-[#c79f4a]/40 focus:ring-offset-2 focus:ring-offset-[#050402] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ animation: isLoading ? 'none' : 'heat-regime-shimmer 2.5s ease-in-out infinite' }}
    >
    {isLoading ? (
      <svg className="h-5 w-5 animate-spin text-[#c79f4a]" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    ) : (
      <>
        {/* Google "G" logo */}
        <svg className="h-5 w-5" viewBox="0 0 24 24">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 001 12c0 1.94.46 3.77 1.18 5.42l3.66-2.84z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        <span>Sign in with Google</span>
      </>
    )}
    </button>
  </>
);
