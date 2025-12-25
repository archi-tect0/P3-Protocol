import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Video, Upload, Heart, Eye, Loader2, Play } from "lucide-react";
import { P3 } from "@/lib/sdk";

interface VideoItem {
  id: string;
  title: string;
  url: string;
  likes: number;
  views: number;
  liked: boolean;
}

export default function VideoFeedTile() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [videos, setVideos] = useState<VideoItem[]>([
    { id: '1', title: 'Ocean Waves', url: 'https://www.w3schools.com/html/mov_bbb.mp4', likes: 42, views: 156, liked: false },
    { id: '2', title: 'City Lights', url: 'https://www.w3schools.com/html/movie.mp4', likes: 28, views: 89, liked: false },
    { id: '3', title: 'Nature Walk', url: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4', likes: 67, views: 234, liked: false },
  ]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a video file",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload a video smaller than 100MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const url = URL.createObjectURL(file);
      const newVideo: VideoItem = {
        id: `user-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        url,
        likes: 0,
        views: 0,
        liked: false,
      };

      try {
        await P3.proofs.publish("video_post", { 
          videoId: newVideo.id, 
          ts: Date.now() 
        });
      } catch (e) {
        console.warn("Anchor failed:", e);
      }

      setVideos((prev) => [newVideo, ...prev]);
      toast({
        title: "Video Uploaded",
        description: "Your video has been added to the feed",
      });
    } catch (error) {
      console.error("Upload error:", error);
      const url = URL.createObjectURL(file);
      const newVideo: VideoItem = {
        id: `user-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, ""),
        url,
        likes: 0,
        views: 0,
        liked: false,
      };
      setVideos((prev) => [newVideo, ...prev]);
      toast({
        title: "Video Uploaded (Demo)",
        description: "Video added locally",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleLike = async (videoId: string) => {
    setVideos((prev) =>
      prev.map((video) =>
        video.id === videoId
          ? {
              ...video,
              likes: video.liked ? video.likes - 1 : video.likes + 1,
              liked: !video.liked,
            }
          : video
      )
    );

    try {
      await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "video_like",
          payload: {
            videoId,
            action: videos.find((v) => v.id === videoId)?.liked ? "unlike" : "like",
          },
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error("Like anchor error:", error);
    }
  };

  const handleVideoPlay = async (videoId: string) => {
    setVideos((prev) =>
      prev.map((video) =>
        video.id === videoId
          ? { ...video, views: video.views + 1 }
          : video
      )
    );

    try {
      await P3.proofs.publish("video_post", { 
        videoId, 
        ts: Date.now() 
      });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
  };

  return (
    <Card className="glass-card" data-testid="tile-video-feed">
      <CardContent className="p-6">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
            <Video className="w-6 h-6 text-white" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-3">Video Feed</h3>

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
            className="hidden"
            data-testid="input-video-file"
          />

          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full mb-4 bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white"
            data-testid="button-upload-video"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Video
              </>
            )}
          </Button>

          <div className="space-y-4 max-h-80 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {videos.map((video) => (
              <div
                key={video.id}
                className="rounded-lg bg-slate-900/50 border border-slate-700 overflow-hidden"
              >
                <div className="relative">
                  <video
                    src={video.url}
                    controls
                    className="w-full h-32 object-cover"
                    onPlay={() => handleVideoPlay(video.id)}
                    data-testid={`video-player-${video.id}`}
                  />
                  <div className="absolute top-2 left-2 bg-black/60 rounded px-2 py-0.5">
                    <Play className="w-3 h-3 text-white inline mr-1" />
                  </div>
                </div>
                
                <div className="p-3">
                  <p className="text-sm font-medium text-white text-left truncate mb-2" data-testid={`text-title-${video.id}`}>
                    {video.title}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <button
                      onClick={() => handleLike(video.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors ${
                        video.liked
                          ? "bg-red-500/20 text-red-400"
                          : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      }`}
                      data-testid={`button-like-${video.id}`}
                    >
                      <Heart
                        className={`w-4 h-4 ${video.liked ? "fill-current" : ""}`}
                      />
                      <span className="text-sm">{video.likes}</span>
                    </button>
                    
                    <div className="flex items-center gap-1.5 text-slate-400" data-testid={`text-views-${video.id}`}>
                      <Eye className="w-4 h-4" />
                      <span className="text-sm">{video.views}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {videos.length === 0 && (
            <div className="py-8 text-center text-slate-400">
              <Video className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No videos yet. Upload one to get started!</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
