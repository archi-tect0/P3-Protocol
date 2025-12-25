import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Heart, Bookmark, Radio, Wifi, Loader2, AlertCircle, MessageCircle, Send } from "lucide-react";
import type { StreamManifest, Profile, DID, CommentEvent, VideoChunk } from "@shared/nodestream-types";

interface PlayerProps {
  streamId: string;
  onBack: () => void;
  onProfile: (did: DID) => void;
}

interface ManifestResponse {
  manifest: StreamManifest;
  profile: Profile | null;
  isFavorited: boolean;
  isBookmarked: boolean;
  comments: CommentEvent[];
  source: "origin" | "mesh";
}

type LoadingState = "fetching_manifest" | "loading_chunks" | "ready" | "error";

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-slate-700/50 rounded ${className || ""}`} />
  );
}

function CommentBar({ 
  streamId, 
  comments, 
  onProfile 
}: { 
  streamId: string; 
  comments: CommentEvent[]; 
  onProfile: (did: DID) => void;
}) {
  const [newComment, setNewComment] = useState("");
  const queryClient = useQueryClient();

  const postCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await fetch(`/api/atlas/streaming/v2/nodestream/streams/${streamId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to post comment");
      return res.json();
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["/api/atlas/streaming/v2/nodestream/streams", streamId] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim()) {
      postCommentMutation.mutate(newComment.trim());
    }
  };

  return (
    <div className="space-y-4" data-testid="comment-section">
      <div className="flex items-center gap-2 text-sm text-slate-300">
        <MessageCircle className="w-4 h-4" />
        <span>{comments.length} Comments</span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2" data-testid="comment-form">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          data-testid="input-comment"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!newComment.trim() || postCommentMutation.isPending}
          className="bg-purple-600 hover:bg-purple-700"
          data-testid="button-submit-comment"
        >
          {postCommentMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </form>

      <div className="space-y-3 max-h-64 overflow-y-auto">
        {comments.map((comment) => (
          <div
            key={comment.eventId}
            className="flex gap-3 p-3 bg-slate-800/50 rounded-lg"
            data-testid={`comment-${comment.eventId}`}
          >
            <button
              onClick={() => onProfile(comment.author)}
              className="flex-shrink-0"
              data-testid={`button-comment-author-${comment.eventId}`}
            >
              <img
                src={`https://api.dicebear.com/7.x/identicon/svg?seed=${comment.author}`}
                alt="Avatar"
                className="w-8 h-8 rounded-full bg-slate-700"
              />
            </button>
            <div className="flex-1 min-w-0">
              <button
                onClick={() => onProfile(comment.author)}
                className="text-xs text-purple-400 hover:underline"
              >
                {comment.author.slice(0, 16)}...
              </button>
              <p className="text-sm text-slate-300 mt-1" data-testid={`text-comment-content-${comment.eventId}`}>
                {comment.content}
              </p>
              <span className="text-xs text-slate-500">
                {new Date(comment.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-slate-500 text-center py-4" data-testid="text-no-comments">
            No comments yet. Be the first to comment!
          </p>
        )}
      </div>
    </div>
  );
}

export default function Player({ streamId, onBack, onProfile }: PlayerProps) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("fetching_manifest");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<ManifestResponse>({
    queryKey: ["/api/atlas/streaming/v2/nodestream/streams", streamId],
  });

  const favoriteMutation = useMutation({
    mutationFn: async (action: "add" | "remove") => {
      const res = await fetch("/api/atlas/streaming/v2/nodestream/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, action }),
      });
      if (!res.ok) throw new Error("Failed to update favorite");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/atlas/streaming/v2/nodestream/streams", streamId] });
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async (action: "add" | "remove") => {
      const res = await fetch("/api/atlas/streaming/v2/nodestream/bookmarks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, action }),
      });
      if (!res.ok) throw new Error("Failed to update bookmark");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/atlas/streaming/v2/nodestream/streams", streamId] });
    },
  });

  const fetchChunksAndBuildVideo = useCallback(async (chunks: VideoChunk[]) => {
    try {
      setLoadingState("loading_chunks");
      const chunkBlobs: Blob[] = [];
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const response = await fetch(`/api/atlas/streaming/v2/nodestream/chunks/${chunk.cid}`);
        if (!response.ok) {
          throw new Error(`Failed to fetch chunk ${chunk.cid}`);
        }
        const blob = await response.blob();
        chunkBlobs.push(blob);
        setLoadingProgress(Math.round(((i + 1) / chunks.length) * 100));
      }

      const combinedBlob = new Blob(chunkBlobs, { type: "video/webm" });
      const url = URL.createObjectURL(combinedBlob);
      setVideoUrl(url);
      setLoadingState("ready");
    } catch (err) {
      console.error("Error loading chunks:", err);
      setErrorMessage(err instanceof Error ? err.message : "Failed to load video chunks");
      setLoadingState("error");
    }
  }, []);

  useEffect(() => {
    if (data?.manifest) {
      if (data.manifest.chunks.length > 0) {
        fetchChunksAndBuildVideo(data.manifest.chunks);
      } else {
        setLoadingState("ready");
      }
    }
  }, [data?.manifest, fetchChunksAndBuildVideo]);

  useEffect(() => {
    if (isError) {
      setLoadingState("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to load stream");
    }
  }, [isError, error]);

  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);
  void handlePlayPause; // Reserved for video controls

  const handleFavorite = useCallback(() => {
    if (data) {
      favoriteMutation.mutate(data.isFavorited ? "remove" : "add");
    }
  }, [data, favoriteMutation]);

  const handleBookmark = useCallback(() => {
    if (data) {
      bookmarkMutation.mutate(data.isBookmarked ? "remove" : "add");
    }
  }, [data, bookmarkMutation]);

  const manifest = data?.manifest;
  const profile = data?.profile;
  const isFavorited = data?.isFavorited ?? false;
  const isBookmarked = data?.isBookmarked ?? false;
  const comments = data?.comments ?? [];
  const source = data?.source ?? "origin";

  return (
    <div className="flex flex-col h-full" data-testid="nodestream-player">
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          data-testid="button-back"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-lg font-bold text-white">Now Playing</h2>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4">
        <Card className="bg-slate-900/60 border-slate-700 overflow-hidden">
          <div className="relative aspect-video bg-black">
            {loadingState === "fetching_manifest" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" data-testid="loading-manifest">
                <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                <span className="text-sm text-slate-400">Fetching manifest...</span>
              </div>
            )}

            {loadingState === "loading_chunks" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" data-testid="loading-chunks">
                <Loader2 className="w-10 h-10 animate-spin text-purple-400" />
                <span className="text-sm text-slate-400">Loading chunks... {loadingProgress}%</span>
                <div className="w-48 h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
              </div>
            )}

            {loadingState === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" data-testid="loading-error">
                <AlertCircle className="w-10 h-10 text-red-400" />
                <span className="text-sm text-red-400">{errorMessage || "Failed to load video"}</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onBack}
                  data-testid="button-error-back"
                >
                  Go Back
                </Button>
              </div>
            )}

            {loadingState === "ready" && (
              <>
                {videoUrl ? (
                  <video
                    ref={videoRef}
                    src={videoUrl}
                    controls
                    className="w-full h-full"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    data-testid="video-player"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center" data-testid="no-video">
                    <img
                      src={`https://picsum.photos/seed/${streamId}/800/450`}
                      alt="Stream thumbnail"
                      className="w-full h-full object-cover opacity-50"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-slate-400">No video content available</span>
                    </div>
                  </div>
                )}
              </>
            )}

            {manifest?.live && loadingState === "ready" && (
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-red-600 text-white text-xs font-medium px-2 py-1 rounded" data-testid="badge-live">
                <Radio className="w-3 h-3 animate-pulse" />
                LIVE
              </div>
            )}

            <div className="absolute top-3 right-3" data-testid="badge-source">
              <Badge variant={source === "origin" ? "default" : "secondary"} className="flex items-center gap-1">
                <Wifi className="w-3 h-3" />
                Source: {source === "origin" ? "Origin" : "Mesh"}
              </Badge>
            </div>
          </div>

          <CardContent className="p-4 space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : manifest ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white" data-testid="text-stream-title">
                      {manifest.title}
                    </h3>
                    <button
                      onClick={() => onProfile(manifest.owner)}
                      className="flex items-center gap-2 mt-2 group"
                      data-testid="button-creator-profile"
                    >
                      <img
                        src={profile?.avatarUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${manifest.owner}`}
                        alt={profile?.displayName || "Creator"}
                        className="w-8 h-8 rounded-full bg-slate-700"
                      />
                      <span className="text-sm text-slate-400 group-hover:text-purple-400 transition-colors" data-testid="text-creator-name">
                        {profile?.displayName || manifest.owner.slice(0, 16) + "..."}
                      </span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleFavorite}
                      disabled={favoriteMutation.isPending}
                      className={isFavorited ? "text-red-400 hover:text-red-300" : "text-slate-400 hover:text-red-400"}
                      data-testid="button-favorite"
                    >
                      <Heart className={`w-5 h-5 ${isFavorited ? "fill-current" : ""}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleBookmark}
                      disabled={bookmarkMutation.isPending}
                      className={isBookmarked ? "text-blue-400 hover:text-blue-300" : "text-slate-400 hover:text-blue-400"}
                      data-testid="button-bookmark"
                    >
                      <Bookmark className={`w-5 h-5 ${isBookmarked ? "fill-current" : ""}`} />
                    </Button>
                  </div>
                </div>

                {manifest.description && (
                  <p className="text-sm text-slate-400" data-testid="text-stream-description">
                    {manifest.description}
                  </p>
                )}

                {manifest.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2" data-testid="stream-tags">
                    {manifest.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs" data-testid={`tag-${tag}`}>
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="text-xs text-slate-500" data-testid="text-stream-date">
                  Published {new Date(manifest.createdAt).toLocaleDateString()}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        {manifest && (
          <Card className="bg-slate-900/60 border-slate-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentBar
                streamId={streamId}
                comments={comments}
                onProfile={onProfile}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
