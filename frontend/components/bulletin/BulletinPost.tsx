// [claude-code 2026-04-03] Discord-style message row — avatar, grouping, hover action bar, image thumbnails
import { useState, useCallback } from "react";
import { MessageSquare, ArrowRight, Trash2, Copy, Check } from "lucide-react";
import { VotingControls, type VoteType } from "./VotingControls";

export interface BulletinPostData {
  id: string;
  authorId: string;
  authorAgent: string | null;
  deskId: string | null;
  content: string;
  contentParts?: { type: string; data: unknown }[] | null;
  parentId: string | null;
  voteUp: number;
  voteDown: number;
  voteCheck: number;
  voteX: number;
  promotedToProposal: boolean;
  createdAt: string;
}

interface BulletinPostProps {
  post: BulletinPostData;
  isGrouped: boolean;
  userVote: VoteType | null;
  onVote: (bulletinId: string, voteType: VoteType) => void;
  onReply: (bulletinId: string) => void;
  onDelete?: (bulletinId: string) => void;
  userId: string;
  replyCount?: number;
}

function formatRelativeTime(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "just now";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatFullDate(input: string): string {
  try {
    const d = new Date(input);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function getInitials(authorAgent: string | null, authorId: string): string {
  if (authorAgent) {
    if (authorAgent === "Harper") return "H";
    return authorAgent.charAt(0).toUpperCase();
  }
  return authorId.slice(0, 2).toUpperCase();
}

function getAvatarColor(authorId: string): string {
  // Deterministic color from author id
  let hash = 0;
  for (let i = 0; i < authorId.length; i++) {
    hash = authorId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hues = [35, 200, 280, 150, 20, 340, 60]; // gold-ish, blue, purple, green, orange, pink, yellow
  return `hsl(${hues[Math.abs(hash) % hues.length]}, 50%, 45%)`;
}

export function BulletinPost({
  post,
  isGrouped,
  userVote,
  onVote,
  onReply,
  onDelete,
  replyCount = 0,
}: BulletinPostProps) {
  const [copied, setCopied] = useState(false);
  const authorLabel = post.authorAgent ?? post.authorId.slice(0, 8);
  const initials = getInitials(post.authorAgent, post.authorId);
  const avatarColor = post.authorAgent
    ? "var(--fintheon-accent)"
    : getAvatarColor(post.authorId);

  const totalVotes = post.voteUp + post.voteDown + post.voteCheck + post.voteX;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(post.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [post.content]);

  // Extract images from contentParts
  const images = (post.contentParts ?? [])
    .filter((p) => p.type === "image" && typeof p.data === "string")
    .map((p) => p.data as string);

  return (
    <div
      className="group/msg relative flex gap-3 px-4 hover:bg-[var(--fintheon-accent)]/[0.03] transition-colors"
      style={{ paddingTop: isGrouped ? "2px" : "10px", paddingBottom: "2px" }}
    >
      {/* Avatar column — 32px wide */}
      <div className="w-8 flex-shrink-0">
        {!isGrouped && (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-semibold text-[var(--fintheon-bg)]"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </div>
        )}
      </div>

      {/* Content column */}
      <div className="min-w-0 flex-1">
        {/* Author line — only on first message of group */}
        {!isGrouped && (
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[13px] font-semibold text-[var(--fintheon-text)]">
              {authorLabel}
            </span>
            {post.authorAgent && (
              <span className="rounded px-1 py-0.5 text-[9px] uppercase tracking-wider text-[var(--fintheon-accent)]/60 bg-[var(--fintheon-accent)]/8">
                Agent
              </span>
            )}
            <span
              className="text-[11px] text-[var(--fintheon-text)]/25"
              title={formatFullDate(post.createdAt)}
            >
              {formatRelativeTime(post.createdAt)}
            </span>
            {post.promotedToProposal && (
              <span className="inline-flex items-center gap-1 rounded border border-[var(--fintheon-accent)]/35 bg-[var(--fintheon-accent)]/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--fintheon-accent)]">
                <ArrowRight className="h-2.5 w-2.5" />
                Proposal
              </span>
            )}
          </div>
        )}

        {/* Message text */}
        <p className="text-[13px] leading-relaxed text-[var(--fintheon-text)]/80 whitespace-pre-wrap break-words">
          {post.content}
        </p>

        {/* Image thumbnails */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1.5">
            {images.map((src, idx) => (
              <div
                key={idx}
                className="h-32 max-w-[240px] overflow-hidden rounded-lg border border-[var(--fintheon-accent)]/15 cursor-pointer"
                onClick={() => window.open(src, "_blank")}
              >
                <img src={src} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        )}

        {/* Reaction pills — only if there are votes */}
        {totalVotes > 0 && (
          <div className="mt-1">
            <VotingControls
              bulletinId={post.id}
              votes={{
                up: post.voteUp,
                down: post.voteDown,
                check: post.voteCheck,
                x: post.voteX,
              }}
              userVote={userVote}
              onVote={(type) => onVote(post.id, type)}
            />
          </div>
        )}
      </div>

      {/* Hover action bar — floating top-right */}
      <div className="absolute right-3 top-1 flex items-center gap-0.5 rounded-md border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] px-1 py-0.5 opacity-0 shadow-lg transition-opacity group-hover/msg:opacity-100">
        {/* Vote button (opens pills if no votes yet) */}
        {totalVotes === 0 && (
          <button
            onClick={() => onVote(post.id, "up")}
            title="Vote"
            className="rounded p-1 text-[var(--fintheon-text)]/30 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => onReply(post.id)}
          title="Reply"
          className="rounded p-1 text-[var(--fintheon-text)]/30 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {replyCount > 0 && (
            <span className="ml-0.5 text-[10px]">{replyCount}</span>
          )}
        </button>
        <button
          onClick={handleCopy}
          title={copied ? "Copied" : "Copy"}
          className="rounded p-1 text-[var(--fintheon-text)]/30 transition-colors hover:bg-[var(--fintheon-accent)]/10 hover:text-[var(--fintheon-accent)]"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
        {onDelete && (
          <button
            onClick={() => onDelete(post.id)}
            title="Delete"
            className="rounded p-1 text-[var(--fintheon-text)]/30 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
