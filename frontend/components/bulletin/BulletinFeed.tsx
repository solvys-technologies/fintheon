// [claude-code 2026-03-31] S12-T1: Bulletin feed — list posts, new post form, realtime, voting
import { useCallback, useEffect, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useBackend } from '../../lib/backend';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { BulletinPost, type BulletinPostData } from './BulletinPost';
import type { VoteType } from './VotingControls';

interface DeskOption {
  id: string;
  name: string;
}

export function BulletinFeed() {
  const backend = useBackend();
  const { userId } = useAuth();
  const { addToast } = useToast();
  const [posts, setPosts] = useState<BulletinPostData[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, VoteType>>({});
  const [loading, setLoading] = useState(true);
  const [desks, setDesks] = useState<DeskOption[]>([]);
  const [selectedDesk, setSelectedDesk] = useState<string>('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [threadReplies, setThreadReplies] = useState<Record<string, BulletinPostData[]>>({});
  const [replyContent, setReplyContent] = useState('');

  const fetchPosts = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedDesk) params.deskId = selectedDesk;
      const result = await backend.bulletin.listPosts(params);
      setPosts(result.posts);

      // Fetch user votes for all posts
      const votes: Record<string, VoteType> = {};
      for (const post of result.posts) {
        const voteResult = await backend.bulletin.getVotes(post.id);
        const myVote = voteResult.votes.find((v: any) => v.userId === userId);
        if (myVote) votes[post.id] = myVote.voteType;
      }
      setUserVotes(votes);
    } catch (err) {
      console.error('[BulletinFeed] Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  }, [backend, selectedDesk, userId]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  // Load desks
  useEffect(() => {
    backend.peers.listDesks().then((res) => {
      setDesks(res.desks.map((d: any) => ({ id: d.id, name: d.name })));
    }).catch(() => {});
  }, [backend]);

  // Supabase Realtime subscription
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    const channel = sb
      .channel('bulletin-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'peer_bulletin' },
        (payload) => {
          // Detect promotion
          if (
            payload.eventType === 'UPDATE' &&
            payload.new &&
            (payload.new as any).promoted_to_proposal === true &&
            payload.old &&
            (payload.old as any).promoted_to_proposal === false
          ) {
            const content = (payload.new as any).content ?? '';
            const stockMatch = content.match(/\$([A-Z]{1,5})/);
            const instrument = stockMatch?.[1] ?? 'Trade';
            addToast(`New Proposal Available — ${instrument}`, 'success', 'View in Strategium', 'trade-alert', 'top-right');
          }
          void fetchPosts();
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [fetchPosts, addToast]);

  const handleSubmit = async () => {
    if (!newContent.trim() || submitting) return;
    setSubmitting(true);
    try {
      await backend.bulletin.createPost({
        content: newContent.trim(),
        deskId: selectedDesk || undefined,
      });
      setNewContent('');
      await fetchPosts();
    } catch (err) {
      console.error('[BulletinFeed] Failed to create post:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (bulletinId: string, voteType: VoteType) => {
    try {
      await backend.bulletin.castVote(bulletinId, voteType);
      setUserVotes((prev) => ({ ...prev, [bulletinId]: voteType }));
      await fetchPosts();
    } catch (err) {
      console.error('[BulletinFeed] Vote failed:', err);
    }
  };

  const handleReply = async (parentId: string) => {
    if (expandedThread === parentId) {
      setExpandedThread(null);
      return;
    }
    setExpandedThread(parentId);
    try {
      const result = await backend.bulletin.getPostReplies(parentId);
      setThreadReplies((prev) => ({ ...prev, [parentId]: result.replies }));
    } catch (err) {
      console.error('[BulletinFeed] Failed to load replies:', err);
    }
  };

  const submitReply = async (parentId: string) => {
    if (!replyContent.trim()) return;
    try {
      await backend.bulletin.createPost({
        content: replyContent.trim(),
        parentId,
      });
      setReplyContent('');
      const result = await backend.bulletin.getPostReplies(parentId);
      setThreadReplies((prev) => ({ ...prev, [parentId]: result.replies }));
      await fetchPosts();
    } catch (err) {
      console.error('[BulletinFeed] Reply failed:', err);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--fintheon-text)]">Bulletin Board</h3>
        {desks.length > 0 && (
          <select
            value={selectedDesk}
            onChange={(e) => setSelectedDesk(e.target.value)}
            className="rounded border border-zinc-700 bg-[var(--fintheon-bg)] px-2 py-1 text-xs text-zinc-300"
          >
            <option value="">All Desks</option>
            {desks.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* New post form */}
      <div className="rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)] p-3">
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder="Post a trade idea... (use $AAPL or /ES for instruments)"
          rows={2}
          className="w-full resize-none rounded border border-zinc-700/50 bg-[var(--fintheon-bg)] px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 focus:border-[var(--fintheon-accent)]/40 focus:outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSubmit();
          }}
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={() => void handleSubmit()}
            disabled={!newContent.trim() || submitting}
            className="inline-flex items-center gap-1.5 rounded border border-[var(--fintheon-accent)]/40 bg-[var(--fintheon-accent)]/10 px-3 py-1.5 text-xs font-medium text-[var(--fintheon-accent)] transition-colors hover:bg-[var(--fintheon-accent)]/20 disabled:opacity-40"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            Post
          </button>
        </div>
      </div>

      {/* Posts list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-lg border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-surface)] px-4 py-6 text-center text-sm text-zinc-400">
          No posts yet. Be the first to share a trade idea.
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id}>
              <BulletinPost
                post={post}
                userVote={userVotes[post.id] ?? null}
                onVote={handleVote}
                onReply={handleReply}
              />

              {/* Expanded thread */}
              {expandedThread === post.id && (
                <div className="ml-6 mt-2 space-y-2 border-l border-zinc-700/40 pl-4">
                  {(threadReplies[post.id] ?? []).map((reply) => (
                    <BulletinPost
                      key={reply.id}
                      post={reply}
                      userVote={userVotes[reply.id] ?? null}
                      onVote={handleVote}
                      onReply={() => {}}
                    />
                  ))}
                  <div className="flex gap-2">
                    <input
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="Reply..."
                      className="flex-1 rounded border border-zinc-700/50 bg-[var(--fintheon-bg)] px-3 py-1.5 text-xs text-zinc-300 placeholder-zinc-600 focus:border-[var(--fintheon-accent)]/40 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void submitReply(post.id);
                      }}
                    />
                    <button
                      onClick={() => void submitReply(post.id)}
                      className="rounded border border-[var(--fintheon-accent)]/30 px-2 py-1 text-xs text-[var(--fintheon-accent)]"
                    >
                      <Send className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
