// TODO: remove — replaced by Fluxer embed (2026-04-12). Kept until Fluxer is confirmed stable.
// [claude-code 2026-04-03] Discord-style forum redesign — PromptBox, message grouping, scroll container, hover actions
import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ChevronDown, Send } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { useBackend } from "../../lib/backend";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { BulletinPost, type BulletinPostData } from "./BulletinPost";
import type { VoteType } from "./VotingControls";
import { PromptBox } from "../ui/chatgpt-prompt-input";

interface DeskOption {
  id: string;
  name: string;
}

/** Check if two posts should be grouped (same author, within 5 minutes) */
function shouldGroup(prev: BulletinPostData, curr: BulletinPostData): boolean {
  if (prev.authorId !== curr.authorId) return false;
  const pTime = new Date(prev.createdAt).getTime();
  const cTime = new Date(curr.createdAt).getTime();
  return Math.abs(cTime - pTime) < 5 * 60 * 1000;
}

export function BulletinFeed() {
  const backend = useBackend();
  const { userId } = useAuth();
  const { addToast } = useToast();
  const [posts, setPosts] = useState<BulletinPostData[]>([]);
  const [userVotes, setUserVotes] = useState<Record<string, VoteType>>({});
  const [loading, setLoading] = useState(true);
  const [desks, setDesks] = useState<DeskOption[]>([]);
  const [selectedDesk, setSelectedDesk] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedThread, setExpandedThread] = useState<string | null>(null);
  const [threadReplies, setThreadReplies] = useState<
    Record<string, BulletinPostData[]>
  >({});
  const [replyContent, setReplyContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const fetchPosts = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (selectedDesk) params.deskId = selectedDesk;
      const result = await backend.bulletin.listPosts(params);
      setPosts(result.posts);

      const votes: Record<string, VoteType> = {};
      for (const post of result.posts) {
        const voteResult = await backend.bulletin.getVotes(post.id);
        const myVote = voteResult.votes.find((v: any) => v.userId === userId);
        if (myVote) votes[post.id] = myVote.voteType;
      }
      setUserVotes(votes);
    } catch (err) {
      console.error("[BulletinFeed] Failed to load posts:", err);
    } finally {
      setLoading(false);
    }
  }, [backend, selectedDesk, userId]);

  useEffect(() => {
    void fetchPosts();
  }, [fetchPosts]);

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [posts.length, scrollToBottom]);

  // Load desks
  useEffect(() => {
    backend.peers
      .listDesks()
      .then((res) => {
        setDesks(res.desks.map((d: any) => ({ id: d.id, name: d.name })));
      })
      .catch(() => {});
  }, [backend]);

  // Supabase Realtime subscription
  useEffect(() => {
    const sb = supabase;
    if (!sb) return;

    const channel = sb
      .channel("bulletin-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "peer_bulletin" },
        (payload) => {
          if (
            payload.eventType === "UPDATE" &&
            payload.new &&
            (payload.new as any).promoted_to_proposal === true &&
            payload.old &&
            (payload.old as any).promoted_to_proposal === false
          ) {
            const content = (payload.new as any).content ?? "";
            const stockMatch = content.match(/\$([A-Z]{1,5})/);
            const instrument = stockMatch?.[1] ?? "Trade";
            addToast(
              `New Proposal Available — ${instrument}`,
              "success",
              "View in Strategium",
              "trade-alert",
              "top-right",
            );
          }
          void fetchPosts();
        },
      )
      .subscribe();

    return () => {
      void sb.removeChannel(channel);
    };
  }, [fetchPosts, addToast]);

  const handleSubmit = async (msg: string, images?: string[]) => {
    if (!msg.trim() || submitting) return;
    setSubmitting(true);
    try {
      const contentParts = images?.length
        ? images.map((img) => ({ type: "image" as const, data: img }))
        : undefined;
      await backend.bulletin.createPost({
        content: msg.trim(),
        contentParts,
        deskId: selectedDesk || undefined,
      });
      await fetchPosts();
    } catch (err) {
      console.error("[BulletinFeed] Failed to create post:", err);
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
      console.error("[BulletinFeed] Vote failed:", err);
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
      console.error("[BulletinFeed] Failed to load replies:", err);
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      await backend.bulletin.deletePost(postId);
      await fetchPosts();
    } catch (err) {
      console.error("[BulletinFeed] Delete failed:", err);
    }
  };

  const submitReply = async (parentId: string) => {
    if (!replyContent.trim()) return;
    try {
      await backend.bulletin.createPost({
        content: replyContent.trim(),
        parentId,
      });
      setReplyContent("");
      const result = await backend.bulletin.getPostReplies(parentId);
      setThreadReplies((prev) => ({ ...prev, [parentId]: result.replies }));
      await fetchPosts();
    } catch (err) {
      console.error("[BulletinFeed] Reply failed:", err);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center gap-3 px-4 py-2">
        <span className="text-xs font-semibold text-[var(--fintheon-text)]">
          Forum
        </span>
        {desks.length > 0 && (
          <div className="relative">
            <select
              value={selectedDesk}
              onChange={(e) => setSelectedDesk(e.target.value)}
              className="appearance-none rounded-lg border border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-bg)] px-2.5 py-1.5 pr-7 text-[11px] text-[var(--fintheon-text)]/60 outline-none transition-colors hover:border-[var(--fintheon-accent)]/40 focus:border-[var(--fintheon-accent)]/40"
            >
              <option value="">All Desks</option>
              {desks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <ChevronDown
              size={10}
              className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[var(--fintheon-text)]/30"
            />
          </div>
        )}
        <div className="flex-1" />
        <span className="text-[10px] font-mono text-[var(--fintheon-muted)]/40">
          {posts.length} messages
        </span>
      </div>

      {/* Scrollable message area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-2">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
          </div>
        ) : posts.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6">
            <span className="text-sm text-[var(--fintheon-accent)]/40">
              No messages yet
            </span>
            <span className="text-center text-xs text-[var(--fintheon-text)]/20">
              Be the first to share a trade idea.
            </span>
          </div>
        ) : (
          posts.map((post, idx) => {
            const prev = idx > 0 ? posts[idx - 1] : null;
            const isGrouped = prev ? shouldGroup(prev, post) : false;

            return (
              <div key={post.id}>
                <BulletinPost
                  post={post}
                  isGrouped={isGrouped}
                  userVote={userVotes[post.id] ?? null}
                  onVote={handleVote}
                  onReply={handleReply}
                  onDelete={post.authorId === userId ? handleDelete : undefined}
                  userId={userId}
                />

                {/* Thread expansion */}
                {expandedThread === post.id && (
                  <div className="ml-12 mr-4 mt-1 mb-2 rounded-lg border-l-2 border-[var(--fintheon-accent)]/20 bg-[var(--fintheon-surface)]/30 pl-4 py-2">
                    {(threadReplies[post.id] ?? []).map((reply, rIdx) => {
                      const prevReply =
                        rIdx > 0 ? threadReplies[post.id][rIdx - 1] : null;
                      const isReplyGrouped = prevReply
                        ? shouldGroup(prevReply, reply)
                        : false;
                      return (
                        <BulletinPost
                          key={reply.id}
                          post={reply}
                          isGrouped={isReplyGrouped}
                          userVote={userVotes[reply.id] ?? null}
                          onVote={handleVote}
                          onReply={() => {}}
                          userId={userId}
                        />
                      );
                    })}
                    <div className="flex gap-2 mt-1 pr-4">
                      <input
                        value={replyContent}
                        onChange={(e) => setReplyContent(e.target.value)}
                        placeholder="Reply to thread..."
                        className="flex-1 rounded-lg border border-[var(--fintheon-accent)]/15 bg-[var(--fintheon-bg)] px-3 py-1.5 text-xs text-[var(--fintheon-text)] placeholder-[var(--fintheon-text)]/20 outline-none transition-colors focus:border-[var(--fintheon-accent)]/40"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void submitReply(post.id);
                        }}
                      />
                      <button
                        onClick={() => void submitReply(post.id)}
                        className="rounded-lg border border-[var(--fintheon-accent)]/30 px-2.5 py-1.5 text-[var(--fintheon-accent)] transition-colors hover:bg-[var(--fintheon-accent)]/10"
                      >
                        <Send className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* PromptBox input */}
      <div className="px-2">
        <PromptBox
          compact
          onSend={(msg, images) => handleSubmit(msg, images)}
          isProcessing={submitting}
          placeholder="Message the forum..."
          thinkHarder={false}
          setThinkHarder={() => {}}
          activeSkill={null}
          onSelectSkill={() => {}}
          showSkills={false}
          onToggleSkills={() => {}}
        />
      </div>
    </div>
  );
}
