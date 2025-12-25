import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useCallback } from "react";
import { Play, Heart, Bookmark, MessageCircle, Video, RefreshCw, Loader2 } from "lucide-react";
import type { StreamManifest, Profile, DID } from "@shared/nodestream-types";

interface FeedProps {
  onPlay: (streamId: string) => void;
  onRecord: () => void;
  onProfile: (did: DID) => void;
}

interface FeedResponse {
  streams: StreamManifest[];
  profiles: Record<DID, Profile>;
  favorites: string[];
  bookmarks: string[];
  commentCounts: Record<string, number>;
}

type FeedFilter = "following" | "trending" | "recent";

function formatDuration(chunks: StreamManifest["chunks"]): string {
  const totalMs = chunks.reduce((acc, chunk) => acc + chunk.durationMs, 0);
  const seconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function getThumbnail(stream: StreamManifest): string {
  if (stream.chunks.length > 0) {
    return `https://picsum.photos/seed/${stream.streamId}/400/225`;
  }
  return `https://picsum.photos/seed/${stream.streamId}/400/225`;
}

export default function Feed({ onPlay, onRecord, onProfile }: FeedProps) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FeedFilter>("trending");

  const { data, isLoading, isRefetching, refetch } = useQuery<FeedResponse>({
    queryKey: ["/api/atlas/streaming/v2/nodestream/feed", filter],
    refetchInterval: 30000,
  });

  const favoriteMutation = useMutation({
    mutationFn: async ({ streamId, action }: { streamId: string; action: "add" | "remove" }) => {
      const res = await fetch("/api/atlas/streaming/v2/nodestream/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, action }),
      });
      if (!res.ok) throw new Error("Failed to update favorite");
      return res.json();
    },
    onMutate: async ({ streamId, action }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/atlas/streaming/v2/nodestream/feed", filter] });
      const previous = queryClient.getQueryData<FeedResponse>(["/api/atlas/streaming/v2/nodestream/feed", filter]);
      if (previous) {
        queryClient.setQueryData<FeedResponse>(["/api/atlas/streaming/v2/nodestream/feed", filter], {
          ...previous,
          favorites: action === "add" 
            ? [...previous.favorites, streamId]
            : previous.favorites.filter(id => id !== streamId),
        });
      }
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/atlas/streaming/v2/nodestream/feed", filter], context.previous);
      }
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async ({ streamId, action }: { streamId: string; action: "add" | "remove" }) => {
      const res = await fetch("/api/atlas/streaming/v2/nodestream/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, action }),
      });
      if (!res.ok) throw new Error("Failed to update bookmark");
      return res.json();
    },
    onMutate: async ({ streamId, action }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/atlas/streaming/v2/nodestream/feed", filter] });
      const previous = queryClient.getQueryData<FeedResponse>(["/api/atlas/streaming/v2/nodestream/feed", filter]);
      if (previous) {
        queryClient.setQueryData<FeedResponse>(["/api/atlas/streaming/v2/nodestream/feed", filter], {
          ...previous,
          bookmarks: action === "add" 
            ? [...previous.bookmarks, streamId]
            : previous.bookmarks.filter(id => id !== streamId),
        });
      }
      return { previous };
    },
    onError: (_, __, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["/api/atlas/streaming/v2/nodestream/feed", filter], context.previous);
      }
    },
  });

  const handleRefresh = useCallback(() => {
    refetch();
  }, [refetch]);

  const handleFavorite = useCallback((streamId: string, isFavorited: boolean) => {
    favoriteMutation.mutate({ streamId, action: isFavorited ? "remove" : "add" });
  }, [favoriteMutation]);

  const handleBookmark = useCallback((streamId: string, isBookmarked: boolean) => {
    bookmarkMutation.mutate({ streamId, action: isBookmarked ? "remove" : "add" });
  }, [bookmarkMutation]);

  const streams = data?.streams ?? [];
  const profiles = data?.profiles ?? {};
  const favorites = data?.favorites ?? [];
  const bookmarks = data?.bookmarks ?? [];
  const commentCounts = data?.commentCounts ?? {};

  return (
    <div className="relative h-full flex flex-col" data-testid="nodestream-feed">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-400" />
          NodeStream
        </h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefetching}
          data-testid="button-refresh-feed"
        >
          {isRefetching ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as FeedFilter)} className="flex-1 flex flex-col">
        <TabsList className="w-full mb-4 bg-slate-800/50" data-testid="tabs-feed-filter">
          <TabsTrigger 
            value="following" 
            className="flex-1"
            data-testid="tab-following"
          >
            Following
          </TabsTrigger>
          <TabsTrigger 
            value="trending" 
            className="flex-1"
            data-testid="tab-trending"
          >
            Trending
          </TabsTrigger>
          <TabsTrigger 
            value="recent" 
            className="flex-1"
            data-testid="tab-recent"
          >
            Recent
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : streams.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Video className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No streams found</p>
              <p className="text-xs mt-1">Be the first to record!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {streams.map((stream) => {
                const profile = profiles[stream.owner];
                const isFavorited = favorites.includes(stream.streamId);
                const isBookmarked = bookmarks.includes(stream.streamId);
                const comments = commentCounts[stream.streamId] ?? 0;

                return (
                  <Card
                    key={stream.streamId}
                    className="bg-slate-900/60 border-slate-700 overflow-hidden hover:border-slate-600 transition-colors"
                    data-testid={`stream-card-${stream.streamId}`}
                  >
                    <div className="relative">
                      <img
                        src={getThumbnail(stream)}
                        alt={stream.title}
                        className="w-full h-40 object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                        <Button
                          size="lg"
                          className="rounded-full w-14 h-14 bg-purple-600 hover:bg-purple-700"
                          onClick={() => onPlay(stream.streamId)}
                          data-testid={`button-play-${stream.streamId}`}
                        >
                          <Play className="w-6 h-6 fill-current" />
                        </Button>
                      </div>
                      <div className="absolute bottom-2 right-2 bg-black/70 rounded px-2 py-0.5 text-xs text-white">
                        {formatDuration(stream.chunks)}
                      </div>
                      {stream.live && (
                        <div className="absolute top-2 left-2 bg-red-600 rounded px-2 py-0.5 text-xs text-white font-medium">
                          LIVE
                        </div>
                      )}
                    </div>

                    <CardContent className="p-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => onProfile(stream.owner)}
                          className="flex-shrink-0"
                          data-testid={`button-profile-${stream.owner}`}
                        >
                          <img
                            src={profile?.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${stream.owner}`}
                            alt={profile?.displayName || "Creator"}
                            className="w-10 h-10 rounded-full bg-slate-700"
                          />
                        </button>

                        <div className="flex-1 min-w-0">
                          <h3 
                            className="text-sm font-semibold text-white truncate"
                            data-testid={`text-title-${stream.streamId}`}
                          >
                            {stream.title}
                          </h3>
                          <button
                            onClick={() => onProfile(stream.owner)}
                            className="text-xs text-slate-400 hover:text-purple-400 transition-colors"
                            data-testid={`link-creator-${stream.owner}`}
                          >
                            {profile?.displayName || stream.owner.slice(0, 16) + "..."}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700/50">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleFavorite(stream.streamId, isFavorited)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                              isFavorited
                                ? "bg-red-500/20 text-red-400"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            }`}
                            data-testid={`button-favorite-${stream.streamId}`}
                          >
                            <Heart className={`w-3.5 h-3.5 ${isFavorited ? "fill-current" : ""}`} />
                          </button>

                          <button
                            onClick={() => handleBookmark(stream.streamId, isBookmarked)}
                            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                              isBookmarked
                                ? "bg-blue-500/20 text-blue-400"
                                : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                            }`}
                            data-testid={`button-bookmark-${stream.streamId}`}
                          >
                            <Bookmark className={`w-3.5 h-3.5 ${isBookmarked ? "fill-current" : ""}`} />
                          </button>
                        </div>

                        <div 
                          className="flex items-center gap-1 text-slate-400 text-xs"
                          data-testid={`text-comments-${stream.streamId}`}
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>{comments}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </Tabs>

      <Button
        className="fixed bottom-6 right-6 rounded-full w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg z-50"
        onClick={onRecord}
        data-testid="button-record"
      >
        <Video className="w-6 h-6" />
      </Button>
    </div>
  );
}
