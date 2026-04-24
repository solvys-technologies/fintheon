// [claude-code 2026-03-27] S2-T6: Password gate UI — blocks Developer tab until correct password entered
import { useState } from "react";
import { Lock } from "lucide-react";
import { authenticateDev } from "../../lib/dev-settings-auth";

interface DevPasswordGateProps {
  onAuthenticated: () => void;
}

export function DevPasswordGate({ onAuthenticated }: DevPasswordGateProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || checking) return;

    setChecking(true);
    setError(false);

    const ok = await authenticateDev(password);
    if (ok) {
      onAuthenticated();
    } else {
      setError(true);
      setChecking(false);
    }
  };

  return (
    <div className="flex items-center justify-center py-20">
      <div
        className="w-full max-w-sm rounded-lg border p-8 text-center"
        style={{
          borderColor:
            "color-mix(in srgb, var(--fintheon-accent) 25%, transparent)",
          backgroundColor: "rgba(10,10,0,0.4)",
        }}
      >
        <div
          className="mx-auto mb-4 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--fintheon-accent) 12%, transparent)",
          }}
        >
          <Lock size={18} style={{ color: "var(--fintheon-accent)" }} />
        </div>

        <h3 className="text-[15px] font-semibold text-white mb-1">
          Developer Settings
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          Enter password to access developer tools.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(false);
            }}
            placeholder="Password"
            autoFocus
            className="w-full px-3 py-2 rounded-md text-sm font-mono text-white placeholder-gray-600 outline-none transition-colors"
            style={{
              backgroundColor: "rgba(0,0,0,0.3)",
              border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "color-mix(in srgb, var(--fintheon-accent) 20%, transparent)"}`,
            }}
          />

          {error && <p className="text-xs text-red-400">Incorrect password.</p>}

          <button
            type="submit"
            disabled={checking || !password.trim()}
            className="w-full py-2 rounded-md text-sm font-medium transition-all disabled:opacity-40"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--fintheon-accent) 15%, transparent)",
              color: "var(--fintheon-accent)",
              border:
                "1px solid color-mix(in srgb, var(--fintheon-accent) 30%, transparent)",
            }}
          >
            {checking ? "Checking..." : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
