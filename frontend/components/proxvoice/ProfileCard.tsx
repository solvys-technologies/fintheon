import { MessageCircle, Rss, Send } from "lucide-react";
import type { ComponentType } from "react";
import { XLogo } from "../../lib/shared-icons";
import type { ProxVoiceProfile, ProxVoiceSocialLinks } from "../../lib/services";

interface ProfileCardProps {
  profile: ProxVoiceProfile;
  mobile?: boolean;
  onClose?: () => void;
  compact?: boolean;
}

const SOCIALS: Array<{
  key: keyof ProxVoiceSocialLinks;
  label: string;
  icon: ComponentType<{ className?: string }>;
}> = [
  { key: "x", label: "X", icon: XLogo },
  { key: "substack", label: "Substack", icon: Rss },
  { key: "telegram", label: "Telegram", icon: Send },
  { key: "discord", label: "Discord", icon: MessageCircle },
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function socialHref(key: keyof ProxVoiceSocialLinks, handle: string) {
  const safe = handle.replace(/^@+/, "");
  if (key === "x") return `https://x.com/${safe}`;
  if (key === "substack") {
    return safe.includes(".") ? `https://${safe}` : `https://${safe}.substack.com`;
  }
  if (key === "telegram") return `https://t.me/${safe}`;
  return undefined;
}

export function ProfileCard({ profile, mobile = false, onClose, compact = false }: ProfileCardProps) {
  const socials = SOCIALS.filter(({ key }) => profile.socialLinks[key]);
  return (
    <section
      className={`fintheon-fade-in bg-[var(--fintheon-surface)] p-4 text-[var(--fintheon-text)] ${
        mobile ? "min-h-screen w-full" : "w-[300px] rounded-md"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--fintheon-bg)] text-sm text-[var(--fintheon-accent)]">
              {initials(profile.displayName) || "FT"}
            </div>
          )}
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">
              {profile.displayName}
            </h3>
            <p className="truncate text-[10px] text-[var(--fintheon-text)]/45">
              {profile.position || "Desk Team"}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="fintheon-action-link px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-text)]/55"
          >
            Close
          </button>
        )}
      </div>
      {profile.bio && !compact && (
        <p className="fintheon-fade-divider mt-4 pb-1 text-xs leading-relaxed text-[var(--fintheon-text)]/62">
          {profile.bio}
        </p>
      )}
      {profile.broker && (
        <div className="mt-3 inline-flex rounded-md bg-[var(--fintheon-bg)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-accent)]/78">
          {profile.broker}
        </div>
      )}
      <div className="mt-4 space-y-2">
        {socials.length === 0 && (
          <p className="text-xs text-[var(--fintheon-text)]/45">
            No social handles listed.
          </p>
        )}
        {socials.map(({ key, label, icon: Icon }) => {
          const handle = profile.socialLinks[key]!;
          const href = socialHref(key, handle);
          const content = (
            <span className="proxvoice-pill-shimmer flex w-full items-center justify-between rounded-md bg-[var(--fintheon-bg)] px-3 py-2 text-xs text-[var(--fintheon-text)]/75 transition-opacity duration-200 hover:opacity-80">
              <span className="flex items-center gap-2">
                <Icon className="h-3.5 w-3.5 text-[var(--fintheon-accent)]/75" />
                {label}
              </span>
              <span className="font-mono text-[11px]">@{handle}</span>
            </span>
          );
          return href ? (
            <a key={key} href={href} target="_blank" rel="noreferrer">
              {content}
            </a>
          ) : (
            <div key={key}>{content}</div>
          );
        })}
      </div>
    </section>
  );
}
