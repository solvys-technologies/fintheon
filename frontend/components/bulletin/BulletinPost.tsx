// [claude-code 2026-03-31] S12-T1: Bulletin post card — author, content, votes, reply
import { MessageSquare, ArrowRight } from 'lucide-react';
import { VotingControls, type VoteType } from './VotingControls';

export interface BulletinPostData {
  id: string;
  authorId: string;
  authorAgent: string | null;
  deskId: string | null;
  content: string;
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
  userVote: VoteType | null;
  onVote: (bulletinId: string, voteType: VoteType) => void;
  onReply: (bulletinId: string) => void;
  replyCount?: number;
}

function formatRelativeTime(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return 'just now';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function BulletinPost({ post, userVote, onVote, onReply, replyCount = 0 }: BulletinPostProps) {
  const authorLabel = post.authorAgent ?? post.authorId.slice(0, 8);

  return (
    <article className="rounded-lg border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)] px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {post.authorAgent && (
            <span className="text-sm">
              {post.authorAgent === 'Harper-Opus' ? 'H' : 'A'}
            </span>
          )}
          <span className="text-xs font-medium text-[var(--fintheon-text)]">{authorLabel}</span>
          <span className="text-[10px] text-zinc-500">{formatRelativeTime(post.createdAt)}</span>
        </div>
        {post.promotedToProposal && (
          <span className="inline-flex items-center gap-1 rounded border border-[var(--fintheon-accent)]/35 bg-[var(--fintheon-accent)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--fintheon-accent)]">
            <ArrowRight className="h-3 w-3" />
            Proposal
          </span>
        )}
      </div>

      <p className="mb-3 text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">{post.content}</p>

      <div className="flex items-center justify-between">
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

        <button
          onClick={() => onReply(post.id)}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] text-zinc-400 transition-colors hover:text-zinc-300"
        >
          <MessageSquare className="h-3 w-3" />
          {replyCount > 0 && <span>{replyCount}</span>}
        </button>
      </div>
    </article>
  );
}
