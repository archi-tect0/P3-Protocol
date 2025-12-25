import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageCircle, Heart, Flame, Sparkles, Send, Loader2 } from "lucide-react";
import type { CommentEvent, ReactionEvent, Session, Profile, DID } from "@shared/nodestream-types";

interface CommentBarProps {
  streamId: string;
  session: Session;
}

interface CommentsResponse {
  comments: CommentEvent[];
  reactions: Record<string, number>;
  userReactions: string[];
  profiles: Record<DID, Profile>;
}

type ReactionKind = "like" | "love" | "fire" | "wow";

const REACTION_ICONS: Record<ReactionKind, typeof Heart> = {
  like: Heart,
  love: Heart,
  fire: Flame,
  wow: Sparkles,
};

const REACTION_COLORS: Record<ReactionKind, { active: string; inactive: string }> = {
  like: { active: "bg-red-500/20 text-red-400", inactive: "bg-slate-800 text-slate-400 hover:bg-slate-700" },
  love: { active: "bg-pink-500/20 text-pink-400", inactive: "bg-slate-800 text-slate-400 hover:bg-slate-700" },
  fire: { active: "bg-orange-500/20 text-orange-400", inactive: "bg-slate-800 text-slate-400 hover:bg-slate-700" },
  wow: { active: "bg-yellow-500/20 text-yellow-400", inactive: "bg-slate-800 text-slate-400 hover:bg-slate-700" },
};

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

function formatTimestamp(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

export default function CommentBar({ streamId, session }: CommentBarProps) {
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  const { data, isLoading } = useQuery<CommentsResponse>({
    queryKey: ["nodestream-comments", streamId],
    refetchInterval: 10000,
  });

  const sortedComments = useMemo(() => {
    const comments = data?.comments ?? [];
    return [...comments].sort((a, b) => a.createdAt - b.createdAt);
  }, [data?.comments]);

  const postCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const newComment: CommentEvent = {
        eventId: generateEventId(),
        parentStreamId: streamId,
        author: session.did,
        content,
        createdAt: Date.now(),
        vectorClock: { [session.did]: 1 },
        signature: "",
      };

      const res = await fetch("/api/atlas/streaming/v2/nodestream/comments", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`,
        },
        body: JSON.stringify({ streamId, comment: newComment }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey: ["nodestream-comments", streamId] });
      const previous = queryClient.getQueryData<CommentsResponse>(["nodestream-comments", streamId]);

      const optimisticComment: CommentEvent = {
        eventId: generateEventId(),
        parentStreamId: streamId,
        author: session.did,
        content,
        createdAt: Date.now(),
        vectorClock: { [session.did]: 1 },
        signature: "",
      };

      if (previous) {
        queryClient.setQueryData<CommentsResponse>(["nodestream-comments", streamId], {
          ...previous,
          comments: [...previous.comments, optimisticComment],
        });
      } else {
        queryClient.setQueryData<CommentsResponse>(["nodestream-comments", streamId], {
          comments: [optimisticComment],
          reactions: {},
          userReactions: [],
          profiles: {},
        });
      }

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["nodestream-comments", streamId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["nodestream-comments", streamId] });
    },
  });

  const toggleReactionMutation = useMutation({
    mutationFn: async (kind: ReactionKind) => {
      const newReaction: ReactionEvent = {
        eventId: generateEventId(),
        targetStreamId: streamId,
        author: session.did,
        kind,
        createdAt: Date.now(),
        signature: "",
      };

      const res = await fetch("/api/atlas/streaming/v2/nodestream/reactions", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.token}`,
        },
        body: JSON.stringify({ streamId, reaction: newReaction }),
      });
      if (!res.ok) throw new Error("Failed to toggle reaction");
      return res.json();
    },
    onMutate: async (kind: ReactionKind) => {
      await queryClient.cancelQueries({ queryKey: ["nodestream-comments", streamId] });
      const previous = queryClient.getQueryData<CommentsResponse>(["nodestream-comments", streamId]);

      if (previous) {
        const hasReaction = previous.userReactions.includes(kind);
        const currentCount = previous.reactions[kind] ?? 0;

        queryClient.setQueryData<CommentsResponse>(["nodestream-comments", streamId], {
          ...previous,
          reactions: {
            ...previous.reactions,
            [kind]: hasReaction ? Math.max(0, currentCount - 1) : currentCount + 1,
          },
          userReactions: hasReaction
            ? previous.userReactions.filter((r) => r !== kind)
            : [...previous.userReactions, kind],
        });
      }

      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["nodestream-comments", streamId], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["nodestream-comments", streamId] });
    },
  });

  const handleSubmitComment = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = commentText.trim();
      if (!trimmed) return;

      postCommentMutation.mutate(trimmed);
      setCommentText("");
    },
    [commentText, postCommentMutation]
  );

  const handleToggleReaction = useCallback(
    (kind: ReactionKind) => {
      toggleReactionMutation.mutate(kind);
    },
    [toggleReactionMutation]
  );

  const profiles = data?.profiles ?? {};
  const reactions = data?.reactions ?? {};
  const userReactions = data?.userReactions ?? [];

  return (
    <Card 
      className="bg-slate-900/80 border-slate-700 flex flex-col h-full"
      data-testid="comment-bar"
    >
      <CardContent className="p-3 flex flex-col h-full">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">Comments</h3>
          <span 
            className="text-xs text-slate-400"
            data-testid="text-comment-count"
          >
            ({sortedComments.length})
          </span>
        </div>

        <div className="flex gap-2 mb-3" data-testid="reaction-buttons">
          {(["like", "love", "fire", "wow"] as ReactionKind[]).map((kind) => {
            const Icon = REACTION_ICONS[kind];
            const isActive = userReactions.includes(kind);
            const count = reactions[kind] ?? 0;
            const colors = REACTION_COLORS[kind];

            return (
              <button
                key={kind}
                onClick={() => handleToggleReaction(kind)}
                disabled={toggleReactionMutation.isPending}
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                  isActive ? colors.active : colors.inactive
                }`}
                data-testid={`button-reaction-${kind}`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "fill-current" : ""}`} />
                {count > 0 && <span>{count}</span>}
              </button>
            );
          })}
        </div>

        <ScrollArea className="flex-1 mb-3" data-testid="comment-list">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : sortedComments.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-xs">No comments yet</p>
              <p className="text-xs mt-1">Be the first to comment!</p>
            </div>
          ) : (
            <div className="space-y-3 pr-2">
              {sortedComments.map((comment) => {
                const profile = profiles[comment.author];
                const avatarUrl =
                  profile?.avatarUrl ||
                  `https://api.dicebear.com/7.x/identicon/svg?seed=${comment.author}`;
                const displayName =
                  profile?.displayName || comment.author.slice(0, 12) + "...";

                return (
                  <div
                    key={comment.eventId}
                    className="flex gap-2"
                    data-testid={`comment-item-${comment.eventId}`}
                  >
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="w-8 h-8 rounded-full bg-slate-700 flex-shrink-0"
                      data-testid={`img-avatar-${comment.eventId}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs font-medium text-white truncate"
                          data-testid={`text-author-${comment.eventId}`}
                        >
                          {displayName}
                        </span>
                        <span
                          className="text-xs text-slate-500"
                          data-testid={`text-timestamp-${comment.eventId}`}
                        >
                          {formatTimestamp(comment.createdAt)}
                        </span>
                      </div>
                      <p
                        className="text-xs text-slate-300 mt-0.5 break-words"
                        data-testid={`text-content-${comment.eventId}`}
                      >
                        {comment.content}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <form 
          onSubmit={handleSubmitComment} 
          className="flex gap-2"
          data-testid="form-comment"
        >
          <Input
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 h-9 bg-slate-800 border-slate-600 text-sm text-white placeholder:text-slate-500"
            disabled={postCommentMutation.isPending}
            data-testid="input-comment"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!commentText.trim() || postCommentMutation.isPending}
            className="h-9 px-3 bg-purple-600 hover:bg-purple-700"
            data-testid="button-submit-comment"
          >
            {postCommentMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
