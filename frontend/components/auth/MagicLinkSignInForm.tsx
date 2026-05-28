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
    <form onSubmit={handleSubmit} className="grid w-full gap-2">
      <div className="flex overflow-hidden rounded-lg border border-[#c79f4a]/15 bg-[#050402]/70 focus-within:border-[#c79f4a]/35">
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
          placeholder="email@domain.com"
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-[#f0ead6] outline-none placeholder:text-[#f0ead6]/35 disabled:cursor-not-allowed"
        />
        <button
          type="submit"
          disabled={isDisabled}
          className="flex min-w-[112px] items-center justify-center gap-2 border-l border-[#c79f4a]/15 px-3 text-xs font-semibold text-[#c79f4a] transition-colors hover:bg-[#c79f4a]/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? (
            <DotMatrixLoader variant="diagonal-scan" size={16} />
          ) : (
            <Mail size={15} />
          )}
          <span>Email link</span>
        </button>
      </div>
      {message && (
        <p
          className={`min-h-4 text-center text-[11px] ${
            status === "error" ? "text-red-300/80" : "text-[#c79f4a]/80"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
