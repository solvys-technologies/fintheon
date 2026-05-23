import { useEffect, useRef, useState } from "react";
import { Mail, Upload } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useBackend } from "../../lib/backend";
import type { ProxVoiceSocialLinks } from "../../lib/services";

interface ProfileSettingsSectionProps {
  traderName: string;
  setTraderName: (name: string) => void;
}

const socialKeys = ["x", "substack", "telegram", "discord"] as const;

export function ProfileSettingsSection({
  traderName,
  setTraderName,
}: ProfileSettingsSectionProps) {
  const backend = useBackend();
  const { user, signOut, signIn } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [bio, setBio] = useState("");
  const [position, setPosition] = useState("");
  const [broker, setBroker] = useState("");
  const [socialLinks, setSocialLinks] = useState<ProxVoiceSocialLinks>({});
  const [status, setStatus] = useState<string | null>(null);
  const linkedEmail = user?.email || user?.user_metadata?.email || null;

  useEffect(() => {
    let cancelled = false;
    backend.proxVoice.getProfile().then((res) => {
      if (cancelled) return;
      setTraderName(res.profile.displayName);
      setAvatarUrl(res.profile.avatarUrl);
      setBio(res.profile.bio ?? "");
      setPosition(res.profile.position ?? "");
      setBroker(res.profile.broker ?? "");
      setSocialLinks(res.profile.socialLinks);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [backend.proxVoice, setTraderName]);

  const chooseAvatar = async (file: File | null) => {
    if (!file) return;
    if (file.size > 500_000) {
      setStatus("[IMAGE TOO LARGE]");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.readAsDataURL(file);
  };

  const save = async () => {
    setStatus("[SAVING]");
    const res = await backend.proxVoice.updateProfile({
      displayName: traderName,
      avatarUrl,
      bio,
      position,
      broker,
      socialLinks,
    });
    setAvatarUrl(res.profile.avatarUrl);
    setBio(res.profile.bio ?? "");
    setPosition(res.profile.position ?? "");
    setBroker(res.profile.broker ?? "");
    setSocialLinks(res.profile.socialLinks);
    setStatus("[SAVED]");
    window.setTimeout(() => setStatus(null), 1400);
  };

  return (
    <section className="fintheon-fade-in space-y-5">
      <div className="fintheon-fade-divider flex items-start justify-between gap-4 pb-1">
        <div className="flex min-w-0 items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover transition-opacity duration-200 hover:opacity-80"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--fintheon-surface)] text-[var(--fintheon-text)]/45">
              <Mail className="h-4 w-4" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[var(--fintheon-text)]">
              Public Profile
            </h3>
            <p className="truncate text-[11px] text-[var(--fintheon-text)]/40">
              {linkedEmail || "No account linked"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 text-right">
          {status && (
            <span className="font-mono text-[10px] text-[var(--fintheon-text)]/40">
              {status}
            </span>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void chooseAvatar(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="fintheon-action-link inline-flex items-center justify-end gap-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
          >
            <Upload className="h-3.5 w-3.5" />
            Upload
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_1.4fr]">
        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-text)]/38">
            Display Name
          </span>
          <input
            value={traderName}
            onChange={(event) => setTraderName(event.target.value.slice(0, 32))}
            className="w-full rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-sm text-[var(--fintheon-text)] outline-none transition-colors duration-200 focus:bg-[#110f0a]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-text)]/38">
            Short Bio
          </span>
          <input
            value={bio}
            onChange={(event) => setBio(event.target.value.slice(0, 180))}
            placeholder="One line for the floor"
            className="w-full rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-sm text-[var(--fintheon-text)] outline-none transition-colors duration-200 placeholder:text-[var(--fintheon-text)]/22 focus:bg-[#110f0a]"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-text)]/38">
            Position on Desk Team
          </span>
          <input
            value={position}
            onChange={(event) => setPosition(event.target.value.slice(0, 48))}
            placeholder="Lead trader, risk, analyst"
            className="w-full rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-sm text-[var(--fintheon-text)] outline-none transition-colors duration-200 placeholder:text-[var(--fintheon-text)]/22 focus:bg-[#110f0a]"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-text)]/38">
            Broker / Prop Firm
          </span>
          <input
            value={broker}
            onChange={(event) => setBroker(event.target.value.slice(0, 48))}
            placeholder="Topstep, Tradovate, IBKR"
            className="w-full rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-sm text-[var(--fintheon-text)] outline-none transition-colors duration-200 placeholder:text-[var(--fintheon-text)]/22 focus:bg-[#110f0a]"
          />
        </label>
      </div>

      <div className="fintheon-fade-divider grid gap-3 pb-1 sm:grid-cols-2">
        {socialKeys.map((key) => (
          <label key={key} className="block">
            <span className="mb-1.5 block text-[10px] uppercase tracking-[0.16em] text-[var(--fintheon-text)]/38">
              {key}
            </span>
            <input
              value={socialLinks[key] ?? ""}
              onChange={(event) =>
                setSocialLinks((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
              placeholder={`@${key}`}
              className="w-full rounded-md bg-[var(--fintheon-surface)] px-3 py-2 text-sm text-[var(--fintheon-text)] outline-none transition-colors duration-200 placeholder:text-[var(--fintheon-text)]/22 focus:bg-[#110f0a]"
            />
          </label>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          className="fintheon-action-link text-[11px] font-semibold uppercase tracking-[0.14em]"
        >
          Save Profile
        </button>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => signOut().then(signIn).catch(() => {})}
          className="fintheon-action-link text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-text)]/45"
        >
          Switch Account
        </button>
      </div>
    </section>
  );
}
