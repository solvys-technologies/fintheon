// [claude-code 2026-05-21] SOL-60: Add Account modal — Prop Firm/Broker, Account Size, baseline screenshot slot.
import { useState } from "react";
import { X, Building2, DollarSign, ImagePlus } from "lucide-react";

interface AddAccountModalProps {
  onClose: () => void;
  onSave: (
    accountSize: number,
    broker?: string,
    projectx?: { username: string; apiKey: string },
  ) => Promise<void> | void;
  initialSize?: number;
}

export function AddAccountModal({
  onClose,
  onSave,
  initialSize = 0,
}: AddAccountModalProps) {
  const [broker, setBroker] = useState(() => {
    try {
      return localStorage.getItem("fintheon:account-broker") ?? "";
    } catch {
      return "";
    }
  });
  const [size, setSize] = useState(initialSize > 0 ? String(initialSize) : "");
  const [projectxUsername, setProjectxUsername] = useState("");
  const [projectxApiKey, setProjectxApiKey] = useState("");
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsedSize = parseFloat(size.replace(/[^0-9.]/g, "")) || 0;
  const canSave = parsedSize > 0;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    if (
      (projectxUsername.trim() && !projectxApiKey.trim()) ||
      (!projectxUsername.trim() && projectxApiKey.trim())
    ) {
      setError("ProjectX username and API key are both required.");
      setSaving(false);
      return;
    }
    try {
      localStorage.setItem("fintheon:account-broker", broker);
    } catch {}
    try {
      await onSave(
        parsedSize,
        broker || undefined,
        projectxUsername.trim() && projectxApiKey.trim()
          ? {
              username: projectxUsername.trim(),
              apiKey: projectxApiKey.trim(),
            }
          : undefined,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save account");
    } finally {
      setSaving(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setScreenshotName(file.name);
  };

  return (
    <div
      className="fintheon-modal-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="fintheon-modal-surface w-full max-w-sm p-5 flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-(--fintheon-text)">
            Add Account
          </span>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-(--fintheon-accent)/10 transition-colors"
          >
            <X className="w-4 h-4 text-(--fintheon-muted)" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2">
          <input
            type="text"
            value={projectxUsername}
            onChange={(e) => setProjectxUsername(e.target.value)}
            placeholder="ProjectX username"
            autoComplete="username"
            className="w-full bg-black/40 border border-(--fintheon-accent)/20 rounded-lg px-3 py-2 text-sm text-(--fintheon-text) placeholder:text-zinc-600 focus:outline-none focus:border-(--fintheon-accent)/50 transition-colors"
          />
          <input
            type="password"
            value={projectxApiKey}
            onChange={(e) => setProjectxApiKey(e.target.value)}
            placeholder="ProjectX API key"
            autoComplete="off"
            className="w-full bg-black/40 border border-(--fintheon-accent)/20 rounded-lg px-3 py-2 text-sm text-(--fintheon-text) placeholder:text-zinc-600 focus:outline-none focus:border-(--fintheon-accent)/50 transition-colors"
          />
        </div>

        {/* Broker field */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[11px] text-(--fintheon-muted) uppercase tracking-wider font-medium">
            <Building2 className="w-3 h-3" />
            Prop Firm / Broker
          </label>
          <input
            type="text"
            value={broker}
            onChange={(e) => setBroker(e.target.value)}
            placeholder="e.g. Apex, Topstep, IBKR"
            className="w-full bg-black/40 border border-(--fintheon-accent)/20 rounded-lg px-3 py-2 text-sm text-(--fintheon-text) placeholder:text-zinc-600 focus:outline-none focus:border-(--fintheon-accent)/50 transition-colors"
          />
        </div>

        {/* Account Size field */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[11px] text-(--fintheon-muted) uppercase tracking-wider font-medium">
            <DollarSign className="w-3 h-3" />
            Account Size
          </label>
          <input
            type="text"
            inputMode="numeric"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="e.g. 50000"
            className="w-full bg-black/40 border border-(--fintheon-accent)/20 rounded-lg px-3 py-2 text-sm font-mono text-(--fintheon-text) placeholder:text-zinc-600 focus:outline-none focus:border-(--fintheon-accent)/50 transition-colors"
          />
          {parsedSize > 0 && (
            <span className="text-[10px] text-(--fintheon-muted) font-mono">
              ${parsedSize.toLocaleString("en-US")}
            </span>
          )}
        </div>

        {error && (
          <div className="text-[10px] text-[var(--fintheon-bearish)]">
            {error}
          </div>
        )}

        {/* Screenshot slot */}
        <div className="flex flex-col gap-1.5">
          <label className="flex items-center gap-1.5 text-[11px] text-(--fintheon-muted) uppercase tracking-wider font-medium">
            <ImagePlus className="w-3 h-3" />
            Baseline Screenshot
          </label>
          <label className="flex items-center justify-center gap-2 w-full border border-dashed border-(--fintheon-accent)/20 rounded-lg px-3 py-3 cursor-pointer hover:border-(--fintheon-accent)/40 transition-colors">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <span className="text-[11px] text-(--fintheon-muted)">
              {screenshotName ?? "Click to attach (optional)"}
            </span>
          </label>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg text-[12px] font-medium text-(--fintheon-muted) border border-(--fintheon-accent)/15 hover:text-(--fintheon-text) transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="flex-1 py-2 rounded-lg text-[12px] font-medium bg-(--fintheon-accent) text-black hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Account"}
          </button>
        </div>
      </div>
    </div>
  );
}
