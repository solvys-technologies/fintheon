// [claude-code 2026-03-31] Heat Regime shimmer — sweeps across button surface, no outer glow
import React from "react";
import { DotMatrixLoader } from "../icon-bank/DotMatrixLoader";

type GoogleSignInButtonProps = {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
};

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onClick,
  isLoading,
  disabled,
}) => (
  <>
    <style>{`
      @keyframes heat-shimmer-sweep {
        0% {
          background-position: -200% center;
        }
        100% {
          background-position: 200% center;
        }
      }
      .heat-shimmer-btn {
        background-image: linear-gradient(
          90deg,
          transparent 0%,
          transparent 35%,
          rgba(199, 159, 74, 0.08) 45%,
          rgba(199, 159, 74, 0.15) 50%,
          rgba(199, 159, 74, 0.08) 55%,
          transparent 65%,
          transparent 100%
        );
        background-size: 200% 100%;
        animation: heat-shimmer-sweep 4.8s ease-in-out infinite;
      }
    `}</style>
    <button
      onClick={onClick}
      disabled={disabled ?? isLoading}
      className="heat-shimmer-btn group relative flex w-full items-center justify-center gap-3 overflow-hidden rounded-lg border border-[#c79f4a]/15 bg-[#0a0906] px-6 py-3.5 text-sm font-medium tracking-wide text-[#f0ead6] transition-all duration-300 hover:border-[#c79f4a]/35 hover:bg-[#0a0906]/80 focus:outline-none focus:ring-1 focus:ring-[#c79f4a]/30 focus:ring-offset-1 focus:ring-offset-[#050402] disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ animation: isLoading ? "none" : undefined }}
    >
      {isLoading ? (
        <DotMatrixLoader variant="diagonal-scan" size={20} />
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
