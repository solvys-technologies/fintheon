import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useBackend } from "../../lib/backend";
import { useAuth } from "../../contexts/AuthContext";

interface TeamOnboardingProps {
  open: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

const CAPABILITY_OPTIONS = [
  { id: "twitter-cli", label: "Twitter CLI" },
  { id: "computer-use", label: "Computer Use" },
  { id: "hermes", label: "Hermes" },
] as const;

export function TeamOnboarding({
  open,
  onClose,
  onComplete,
}: TeamOnboardingProps) {
  const backend = useBackend();
  const { isAuthenticated, user } = useAuth();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [deviceName, setDeviceName] = useState(() => {
    const fallback =
      typeof navigator !== "undefined" ? navigator.platform : "Fintheon Device";
    return `Fintheon ${fallback}`;
  });
  const [capabilities, setCapabilities] = useState<string[]>(["twitter-cli"]);
  const [assignedDesk, setAssignedDesk] =
    useState<string>("Pending assignment");

  const effectiveAuth =
    isAuthenticated || import.meta.env.VITE_BYPASS_AUTH === "true";
  const canAdvanceFromLogin =
    effectiveAuth || (email.trim().length > 0 && password.trim().length > 0);
  const roleLabel = useMemo(
    () => (user?.role ?? "peer").toLowerCase(),
    [user?.role],
  );

  if (!open) return null;

  function toggleCapability(capability: string) {
    setCapabilities((prev) =>
      prev.includes(capability)
        ? prev.filter((item) => item !== capability)
        : [...prev, capability],
    );
  }

  async function handleSupabaseLogin() {
    if (effectiveAuth) {
      setStep(2);
      return;
    }

    if (!supabase) {
      setError("Supabase is not configured in this frontend build.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (loginError) {
        setError(loginError.message);
        return;
      }
      setStep(2);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    setBusy(true);
    setError(null);
    try {
      const result = await backend.peers.register({
        deviceName: deviceName.trim() || "Fintheon Device",
        platform:
          typeof navigator !== "undefined" ? navigator.platform : "unknown",
        capabilities,
        hermesAvailable: capabilities.includes("hermes"),
      });
      setAssignedDesk(result.peer.deskName || "Awaiting admin assignment");
      setStep(4);
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-[var(--fintheon-accent)]/25 bg-[var(--fintheon-surface)] p-4">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--fintheon-text)]">
              Team Onboarding
            </h2>
            <p className="text-xs text-zinc-400">Step {step} of 4</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-zinc-500 hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
            title="Close onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <p className="mb-3 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300">
            {error}
          </p>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">
              Login with your Supabase account.
            </p>
            {!effectiveAuth && (
              <>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] px-3 py-2 text-sm text-[var(--fintheon-text)]"
                />
                <input
                  value={password}
                  type="password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] px-3 py-2 text-sm text-[var(--fintheon-text)]"
                />
              </>
            )}
            <button
              onClick={() => void handleSupabaseLogin()}
              disabled={!canAdvanceFromLogin || busy}
              className="rounded border border-[var(--fintheon-accent)]/35 px-3 py-1.5 text-sm font-medium text-[var(--fintheon-accent)] disabled:opacity-50"
            >
              {busy ? "Authenticating…" : effectiveAuth ? "Continue" : "Login"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">Name this device.</p>
            <input
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Device name"
              className="w-full rounded border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] px-3 py-2 text-sm text-[var(--fintheon-text)]"
            />
            <button
              onClick={() => setStep(3)}
              disabled={!deviceName.trim()}
              className="rounded border border-[var(--fintheon-accent)]/35 px-3 py-1.5 text-sm font-medium text-[var(--fintheon-accent)] disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">
              Select this device capabilities.
            </p>
            <div className="grid gap-2">
              {CAPABILITY_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center justify-between rounded border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] px-3 py-2 text-sm text-zinc-300"
                >
                  <span>{option.label}</span>
                  <input
                    type="checkbox"
                    checked={capabilities.includes(option.id)}
                    onChange={() => toggleCapability(option.id)}
                  />
                </label>
              ))}
            </div>
            <button
              onClick={() => void handleRegister()}
              disabled={busy}
              className="rounded border border-[var(--fintheon-accent)]/35 px-3 py-1.5 text-sm font-medium text-[var(--fintheon-accent)] disabled:opacity-50"
            >
              {busy ? "Registering…" : "Register Device"}
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-300">Registration complete.</p>
            <p className="rounded border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] px-3 py-2 text-sm text-[var(--fintheon-text)]">
              Assigned desk: {assignedDesk}
            </p>
            <button
              onClick={onClose}
              className="rounded border border-[var(--fintheon-accent)]/35 px-3 py-1.5 text-sm font-medium text-[var(--fintheon-accent)]"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
