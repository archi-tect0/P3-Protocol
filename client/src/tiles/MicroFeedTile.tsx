import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Heart, Trash2, Send } from "lucide-react";
import P3 from "@/lib/sdk";

type Post = { 
  id: string; 
  author: string; 
  text: string; 
  imageCid?: string; 
  ts: number; 
  likes: number;
  liked: boolean;
};

function generateId() {
  return `post-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function MicroFeedTile() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  async function createPost() {
    if (!text.trim()) return;
    setLoading(true);
    const id = generateId();
    const newPost: Post = {
      id,
      author: "0x" + Math.random().toString(16).slice(2, 10),
      text: text.trim(),
      ts: Date.now(),
      likes: 0,
      liked: false
    };
    
    try {
      await P3.proofs.publish("post_create", { postId: id, text: text.slice(0, 50), ts: Date.now() });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
    
    setPosts(prev => [newPost, ...prev]);
    setText("");
    setLoading(false);
  }

  async function likePost(id: string) {
    setPosts(prev => prev.map(p => {
      if (p.id === id) {
        const newLikes = p.liked ? p.likes - 1 : p.likes + 1;
        return { ...p, likes: newLikes, liked: !p.liked };
      }
      return p;
    }));
    
    try {
      await P3.proofs.publish("post_like", { postId: id, ts: Date.now() });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
  }

  async function deletePost(id: string) {
    setPosts(prev => prev.filter(p => p.id !== id));
    try {
      await P3.proofs.publish("post_delete", { postId: id, ts: Date.now() });
    } catch (e) {
      console.warn("Anchor failed:", e);
    }
  }

  return (
    <Card className="glass-card border-slate-700/50 overflow-hidden" data-testid="tile-microfeed">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-pink-400" />
            MicroFeed
          </CardTitle>
          <Badge variant="secondary" className="bg-pink-500/20 text-pink-400">
            {posts.length} posts
          </Badge>
        </div>
        <CardDescription className="text-slate-400">
          Anchored social posts with proof receipts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening?"
            className="bg-slate-800 border-slate-700 resize-none"
            rows={2}
            data-testid="input-post-text"
          />
          <Button 
            onClick={createPost} 
            disabled={loading || !text.trim()}
            className="w-full bg-pink-500 hover:bg-pink-600"
            data-testid="button-create-post"
          >
            <Send className="h-4 w-4 mr-2" />
            {loading ? "Posting..." : "Post & Anchor"}
          </Button>
        </div>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {posts.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-4">No posts yet. Be the first!</p>
          )}
          {posts.map((p) => (
            <div key={p.id} className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-500">{p.author.slice(0, 10)}...</span>
                <span className="text-xs text-slate-500">{new Date(p.ts).toLocaleTimeString()}</span>
              </div>
              <p className="text-sm text-slate-200 mb-2">{p.text}</p>
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => likePost(p.id)}
                  className={p.liked ? "text-pink-400" : "text-slate-400"}
                  data-testid={`button-like-${p.id}`}
                >
                  <Heart className={`h-4 w-4 mr-1 ${p.liked ? "fill-pink-400" : ""}`} />
                  {p.likes}
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => deletePost(p.id)}
                  className="text-slate-400 hover:text-red-400"
                  data-testid={`button-delete-${p.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
