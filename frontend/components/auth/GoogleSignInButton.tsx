// [claude-code 2026-03-31] Heat Regime shimmer — sweeps across button surface, no outer glow
import React from "react";
import { DotMatrixLoader } from "../icon-bank/DotMatrixLoader";

type GoogleSignInButtonProps = {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
  label?: string;
};

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  onClick,
  isLoading,
  disabled,
  label = "Continue with Google",
}) => (
  <>
    <style>{`
      @keyframes liquid-glass-sheen {
        0% {
          background-position: -200% center;
        }
        100% {
          background-position: 200% center;
        }
      }
      .auth-primary-button {
        position: relative;
        display: flex;
        min-height: 56px;
        width: 100%;
        align-items: center;
        justify-content: center;
        gap: 0.72rem;
        overflow: hidden;
        border-radius: 999px;
        border: 1px solid color-mix(in srgb, #f0ead6 62%, transparent);
        background:
          linear-gradient(
            115deg,
            color-mix(in srgb, #f0ead6 88%, transparent) 0%,
            color-mix(in srgb, #f0ead6 74%, transparent) 48%,
            color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 14%, #f0ead6) 100%
          );
        background-size: 220% 100%;
        color: #080705;
        font-size: 0.88rem;
        font-weight: 750;
        letter-spacing: 0;
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.78),
          inset 0 -18px 30px rgba(255, 255, 255, 0.11),
          0 14px 42px rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(24px) saturate(1.42);
        -webkit-backdrop-filter: blur(24px) saturate(1.42);
        transition:
          border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
          box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1),
          transform 180ms cubic-bezier(0.22, 1, 0.36, 1);
        animation: liquid-glass-sheen 5.8s ease-in-out infinite;
      }

      .auth-primary-button::before {
        content: "";
        position: absolute;
        inset: 1px 8px auto;
        height: 44%;
        border-radius: 999px;
        background: color-mix(in srgb, white 38%, transparent);
        opacity: 0.62;
        pointer-events: none;
      }

      .auth-primary-button::after {
        content: "";
        position: absolute;
        inset: 0;
        background-image: linear-gradient(
          90deg,
          transparent 0%,
          transparent 35%,
          rgba(255, 255, 255, 0.2) 47%,
          rgba(255, 255, 255, 0.42) 50%,
          rgba(255, 255, 255, 0.2) 53%,
          transparent 65%,
          transparent 100%
        );
        background-size: 200% 100%;
        animation: liquid-glass-sheen 4.8s ease-in-out infinite;
        opacity: 0.72;
        pointer-events: none;
      }

      .auth-primary-button > * {
        position: relative;
        z-index: 1;
      }

      .auth-primary-button:hover:not(:disabled) {
        border-color: color-mix(in srgb, #f0ead6 82%, transparent);
        box-shadow:
          inset 0 1px 0 rgba(255, 255, 255, 0.86),
          inset 0 -18px 30px rgba(255, 255, 255, 0.14),
          0 18px 48px rgba(0, 0, 0, 0.34);
        transform: translateY(-1px);
      }

      .auth-primary-button:focus-visible {
        outline: 2px solid color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 72%, transparent);
        outline-offset: 3px;
      }

      .auth-primary-button:disabled {
        cursor: not-allowed;
        opacity: 0.58;
      }
    `}</style>
    <button
      onClick={onClick}
      disabled={disabled ?? isLoading}
      className="auth-primary-button"
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
          <span>{label}</span>
        </>
      )}
    </button>
  </>
);
