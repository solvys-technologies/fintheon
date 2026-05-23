import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Bell, Eye, EyeOff, Loader2, RefreshCcw, ShieldOff } from "lucide-react";
import { useBackend } from "../../lib/backend";
import { FadingRuler } from "../shared/FadingRuler";
import {
  DESK_NARRATIVES,
  enrichPost,
  formatBulletinTime,
  isVisibleForZen,
  readEnabledNarratives,
  readZenMode,
  toPost,
  writeEnabledNarratives,
  type BulletinPost,
  type EnrichedPost,
} from "./bulletin-watchlist-utils";

export function BulletinWatchlistTab() {
  const backend = useBackend();
  const [posts, setPosts] = useState<BulletinPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isZenMode, setIsZenMode] = useState(readZenMode);
  const [enabledNarratives, setEnabledNarratives] = useState<Set<string>>(
    () => readEnabledNarratives(),
  );

  const refresh = useCallback(async () => {
    setHasError(false);
    setIsLoading(true);
    try {
      const result = await backend.bulletin.listPosts({ limit: 40 });
      setPosts(result.posts.map(toPost));
    } catch {
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  }, [backend.bulletin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ active?: boolean }>).detail;
      setIsZenMode(Boolean(detail?.active));
    };
    window.addEventListener("fintheon:zen-mode-change", handler);
    setIsZenMode(readZenMode());
    return () => window.removeEventListener("fintheon:zen-mode-change", handler);
  }, []);

  const enriched = useMemo(() => posts.map(enrichPost), [posts]);
  const visible = useMemo(
    () =>
      isZenMode
        ? enriched.filter((post) => isVisibleForZen(post, enabledNarratives))
        : enriched,
    [enabledNarratives, enriched, isZenMode],
  );
  const blocked = isZenMode ? enriched.length - visible.length : 0;

  const toggleNarrative = (slug: string) => {
    setEnabledNarratives((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      writeEnabledNarratives(next);
      return next;
    });
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] leading-relaxed text-[var(--fintheon-muted)]">
            Desk bulletin watchlist. Narrative filters apply in Zen only.
          </p>
          <p className="mt-1 text-[9px] uppercase tracking-[0.16em] text-[var(--fintheon-muted)]/60">
            {isZenMode ? `${blocked} blocked` : "Zen filter idle"}
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="rounded-md p-1.5 text-[var(--fintheon-muted)] transition hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
          title="Refresh watchlist"
        >
          <RefreshCcw size={13} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Desk narratives">
        {DESK_NARRATIVES.map((narrative) => {
          const isEnabled = enabledNarratives.has(narrative.slug);
          return (
            <button
              key={narrative.slug}
              type="button"
              onClick={() => toggleNarrative(narrative.slug)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] uppercase tracking-[0.1em] transition ${
                isEnabled ? "opacity-100" : "opacity-40"
              }`}
              style={{
                borderColor: `${narrative.color}44`,
                color: narrative.color,
                backgroundColor: isEnabled ? `${narrative.color}12` : "transparent",
              }}
            >
              {isEnabled ? <Eye size={10} /> : <EyeOff size={10} />}
              {narrative.title}
            </button>
          );
        })}
      </div>

      {isZenMode && blocked > 0 ? (
        <div
          data-bulletin-watchlist-blocked-count={blocked}
          className="flex items-center gap-2 rounded-md border px-2.5 py-2 text-[10px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]"
          style={{ borderColor: "color-mix(in srgb, var(--fintheon-accent) 14%, transparent)" }}
        >
          <ShieldOff size={12} className="text-[var(--fintheon-accent)]/70" />
          {blocked} note{blocked === 1 ? "" : "s"} blocked by Zen narrative filter
        </div>
      ) : null}

      <WatchlistBody
        posts={visible}
        isLoading={isLoading}
        hasError={hasError}
        isZenMode={isZenMode}
      />
    </div>
  );
}

function WatchlistBody({
  posts,
  isLoading,
  hasError,
  isZenMode,
}: {
  posts: EnrichedPost[];
  isLoading: boolean;
  hasError: boolean;
  isZenMode: boolean;
}) {
  if (isLoading) return <StateRow icon={<Loader2 size={13} className="animate-spin" />} text="Loading bulletins" />;
  if (hasError) return <StateRow icon={<ShieldOff size={13} />} text="Bulletins unavailable" />;
  if (posts.length === 0) return <StateRow icon={<Bell size={13} />} text={isZenMode ? "No visible narratives" : "No bulletin notes"} />;

  return (
    <div className="space-y-1" data-bulletin-watchlist-visible-count={posts.length}>
      {posts.slice(0, 12).map((post, index) => (
        <div key={post.id}>
          {index > 0 ? <FadingRuler /> : null}
          <article className="group rounded-md px-1.5 py-2 transition hover:bg-white/[0.025]">
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                {post.narratives.slice(0, 3).map((slug) => (
                  <NarrativeChip key={slug} slug={slug} />
                ))}
                {post.narratives.length === 0 ? <NarrativeChip slug="unthreaded" /> : null}
              </div>
              <span className="shrink-0 font-mono text-[9px] text-[var(--fintheon-muted)]/60">
                {formatBulletinTime(post.createdAt)}
              </span>
            </div>
            <p className="line-clamp-3 text-[12px] leading-5 text-[var(--fintheon-text)]">
              {post.content}
            </p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.12em] text-[var(--fintheon-muted)]/50">
              {post.authorAgent || "Desk Bulletin"}
            </p>
          </article>
        </div>
      ))}
    </div>
  );
}

function NarrativeChip({ slug }: { slug: string }) {
  const narrative = DESK_NARRATIVES.find((item) => item.slug === slug);
  const color = narrative?.color ?? "var(--fintheon-muted)";
  return (
    <span
      className="rounded border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.1em]"
      style={{ borderColor: `${color}33`, color, backgroundColor: `${color}10` }}
    >
      {narrative?.title ?? "Unthreaded"}
    </span>
  );
}

function StateRow({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-md border border-dashed border-[var(--fintheon-accent)]/15 px-3 py-5 text-[10px] uppercase tracking-[0.14em] text-[var(--fintheon-muted)]">
      {icon}
      {text}
    </div>
  );
}
