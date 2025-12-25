import { useEffect, useState } from 'react';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { Image, Lock, Download, Share2, RefreshCw, AlertCircle, Folder } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface GalleryItem {
  id: string;
  name: string;
  encrypted: boolean;
  size: string;
  uploadedAt: string;
  type: 'image' | 'document' | 'video' | 'other';
  cid?: string;
  thumbnail?: string;
}

export default function GalleryMode() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { pushReceipt, wallet } = useAtlasStore();

  async function fetchGallery() {
    setLoading(true);
    setError(null);
    
    try {
      if (!wallet) {
        setError('Connect wallet to view your gallery');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/atlas/storage/list?wallet=${wallet}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        pushReceipt({
          id: `receipt-gallery-error-${Date.now()}`,
          hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
          scope: 'atlas.render.gallery.error',
          endpoint: '/api/atlas/storage/list',
          timestamp: Date.now(),
          error: `HTTP ${response.status}: ${errorText.slice(0, 100)}`
        });
        throw new Error(`Storage API returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.ok && Array.isArray(data.files)) {
        const galleryItems: GalleryItem[] = data.files.map((file: any) => ({
          id: file.id || file.cid || `file-${Date.now()}-${Math.random()}`,
          name: file.name || 'Unnamed file',
          encrypted: file.encrypted ?? false,
          size: formatFileSize(file.size || 0),
          uploadedAt: formatTimeAgo(file.uploadedAt || file.createdAt),
          type: getFileType(file.name || file.mimeType),
          cid: file.cid,
          thumbnail: file.thumbnail
        }));
        setItems(galleryItems);
        
        pushReceipt({
          id: `receipt-gallery-${Date.now()}`,
          hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
          scope: 'atlas.render.gallery',
          endpoint: '/api/atlas/storage/list',
          timestamp: Date.now()
        });
      } else {
        setItems([]);
        pushReceipt({
          id: `receipt-gallery-empty-${Date.now()}`,
          hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
          scope: 'atlas.render.gallery.empty',
          endpoint: '/api/atlas/storage/list',
          timestamp: Date.now()
        });
      }
    } catch (err) {
      console.error('Gallery fetch failed:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      pushReceipt({
        id: `receipt-gallery-fail-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.gallery.fail',
        endpoint: '/api/atlas/storage/list',
        timestamp: Date.now(),
        error: errorMsg
      });
      setError(`Failed to load gallery: ${errorMsg}`);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchGallery();
  }, [wallet]);

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatTimeAgo(dateStr: string | number): string {
    if (!dateStr) return 'Unknown';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }

  function getFileType(name: string): GalleryItem['type'] {
    const ext = name.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) return 'image';
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) return 'video';
    if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(ext || '')) return 'document';
    return 'other';
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">{error}</p>
        <Button 
          variant="outline" 
          onClick={fetchGallery}
          className="border-white/20 text-white/80 hover:bg-white/10"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="gallery-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-light text-white/80">Gallery</h2>
        <Button 
          variant="ghost" 
          size="sm"
          onClick={fetchGallery}
          className="text-white/60 hover:text-white"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>
      
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Folder className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">Your gallery is empty</p>
          <p className="text-white/40 text-sm">Upload files via the storage API or dCiphrs to see them here</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item, index) => (
            <MotionDiv
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.08 }}
              className="group relative aspect-square rounded-xl bg-gradient-to-br from-white/10 to-white/5 
                         border border-white/10 overflow-hidden cursor-pointer
                         hover:border-cyan-400/30 transition-all duration-300"
              data-testid={`gallery-item-${item.id}`}
            >
              {item.thumbnail ? (
                <img 
                  src={item.thumbnail} 
                  alt={item.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Image className="w-10 h-10 text-white/20 group-hover:text-white/30 transition-all" />
                </div>
              )}
              
              {item.encrypted && (
                <div className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/40 backdrop-blur-sm">
                  <Lock className="w-3 h-3 text-cyan-400" />
                </div>
              )}
              
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent
                              translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                <p className="text-sm text-white/90 truncate">{item.name}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-xs text-white/50">{item.size}</span>
                  <span className="text-xs text-white/40">{item.uploadedAt}</span>
                </div>
              </div>
              
              <div className="absolute top-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors">
                  <Download className="w-3.5 h-3.5 text-white/70" />
                </button>
                <button className="p-1.5 rounded-lg bg-black/40 backdrop-blur-sm hover:bg-black/60 transition-colors">
                  <Share2 className="w-3.5 h-3.5 text-white/70" />
                </button>
              </div>
            </MotionDiv>
          ))}
        </div>
      )}
    </MotionDiv>
  );
}
