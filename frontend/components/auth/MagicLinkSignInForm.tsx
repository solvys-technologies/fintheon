import React, { useState } from "react";
import { Mail } from "lucide-react";
import { DotMatrixLoader } from "../icon-bank/DotMatrixLoader";

interface MagicLinkSignInFormProps {
  onSend: (email: string) => Promise<void>;
  disabled?: boolean;
}

export function MagicLinkSignInForm({
  onSend,
  disabled = false,
}: MagicLinkSignInFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      setStatus("error");
      setMessage("Enter an email.");
      return;
    }

    setStatus("sending");
    setMessage("");

    try {
      await onSend(trimmedEmail);
      setStatus("sent");
      setMessage("Check inbox.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Send failed.";
      setStatus("error");
      setMessage(detail);
    }
  }

  const isSending = status === "sending";
  const isDisabled = disabled || isSending;

  return (
    <form onSubmit={handleSubmit} className="auth-magic-form">
      <style>{magicLinkCss}</style>
      <div
        className={`auth-magic-field ${
          status === "error" ? "auth-magic-field--error" : ""
        }`}
      >
        <input
          aria-label="Email"
          type="email"
          value={email}
          disabled={isDisabled}
          onChange={(event) => {
            setEmail(event.target.value);
            if (status !== "sending") {
              setStatus("idle");
              setMessage("");
            }
          }}
          placeholder="Email for login"
        />
        <button type="submit" disabled={isDisabled}>
          {isSending ? (
            <DotMatrixLoader variant="diagonal-scan" size={16} />
          ) : (
            <Mail size={15} />
          )}
          <span>Log in</span>
        </button>
      </div>
      {message && (
        <p
          className={`auth-magic-message ${
            status === "error"
              ? "auth-magic-message--error"
              : "auth-magic-message--sent"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}

const magicLinkCss = `
  .auth-magic-form {
    display: grid;
    width: 100%;
    gap: 0.42rem;
  }

  .auth-magic-field {
    display: flex;
    min-height: 54px;
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--fintheon-text, #f0ead6) 7%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--fintheon-surface, #0a0905) 32%, transparent);
    box-shadow:
      inset 0 1px 0 color-mix(in srgb, var(--fintheon-text, #f0ead6) 5%, transparent),
      0 12px 34px rgba(0, 0, 0, 0.24);
    backdrop-filter: blur(18px) saturate(1.22);
    -webkit-backdrop-filter: blur(18px) saturate(1.22);
    transition:
      border-color 180ms cubic-bezier(0.22, 1, 0.36, 1),
      background 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .auth-magic-field:focus-within {
    border-color: color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 42%, transparent);
    background: color-mix(in srgb, var(--fintheon-surface, #0a0905) 42%, transparent);
  }

  .auth-magic-field--error {
    border-color: color-mix(in srgb, #fca5a5 52%, transparent);
  }

  .auth-magic-field input {
    min-width: 0;
    flex: 1;
    border: 0;
    background: transparent;
    padding: 0 1.05rem;
    color: color-mix(in srgb, var(--fintheon-text, #f0ead6) 88%, transparent);
    font-size: 0.88rem;
    outline: none;
  }

  .auth-magic-field input::placeholder {
    color: color-mix(in srgb, var(--fintheon-text, #f0ead6) 36%, transparent);
  }

  .auth-magic-field input:disabled,
  .auth-magic-field button:disabled {
    cursor: not-allowed;
  }

  .auth-magic-field button {
    display: inline-flex;
    min-width: 7.2rem;
    align-items: center;
    justify-content: center;
    gap: 0.42rem;
    border: 0;
    border-left: 1px solid color-mix(in srgb, var(--fintheon-text, #f0ead6) 7%, transparent);
    background: color-mix(in srgb, var(--fintheon-text, #f0ead6) 3%, transparent);
    color: color-mix(in srgb, var(--fintheon-text, #f0ead6) 86%, var(--fintheon-primary, var(--fintheon-accent)));
    font-size: 0.78rem;
    font-weight: 720;
    letter-spacing: 0;
    transition: background 180ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .auth-magic-field button:hover:not(:disabled) {
    background: color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 12%, transparent);
  }

  .auth-magic-field button:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 62%, transparent);
    outline-offset: -4px;
  }

  .auth-magic-field button:disabled {
    opacity: 0.56;
  }

  .auth-magic-message {
    min-height: 1rem;
    margin: 0;
    text-align: center;
    font-size: 0.7rem;
    line-height: 1.2;
  }

  .auth-magic-message--sent {
    color: color-mix(in srgb, var(--fintheon-primary, var(--fintheon-accent)) 78%, transparent);
  }

  .auth-magic-message--error {
    color: color-mix(in srgb, #fca5a5 82%, transparent);
  }

  @media (max-width: 420px) {
    .auth-magic-field button {
      min-width: 6.2rem;
    }
  }
`;
