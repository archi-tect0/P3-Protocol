import { useQuery } from '@tanstack/react-query';
import { MotionDiv, MotionButton } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { StickyNote, Star, Lock, Plus, RefreshCw, AlertCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

interface NoteRecord {
  id: string;
  title: string;
  encryptedBody?: string;
  searchableContent?: string;
  isPinned: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  starred: boolean;
  encrypted: boolean;
  updatedAt: string;
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

export default function NotesMode() {
  const { pushReceipt, wallet } = useAtlasStore();

  const { data, isLoading, error, refetch } = useQuery<{ ok: boolean; notes: NoteRecord[] }>({
    queryKey: ['/api/nexus/notes', wallet],
    enabled: !!wallet,
  });

  useEffect(() => {
    if (data?.ok && data.notes?.length > 0) {
      pushReceipt({
        id: `receipt-notes-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.notes',
        endpoint: '/api/nexus/notes',
        timestamp: Date.now()
      });
    } else if (data?.ok && (!data.notes || data.notes.length === 0)) {
      pushReceipt({
        id: `receipt-notes-empty-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.notes.empty',
        endpoint: '/api/nexus/notes',
        timestamp: Date.now()
      });
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      pushReceipt({
        id: `receipt-notes-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.notes.error',
        endpoint: '/api/nexus/notes',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [error]);

  const notes: Note[] = (data?.notes || []).map(n => ({
    id: n.id,
    title: n.title || 'Untitled',
    content: n.searchableContent || (n.encryptedBody ? '[Encrypted content]' : 'No content'),
    starred: n.isPinned === 1,
    encrypted: !!n.encryptedBody,
    updatedAt: formatTimeAgo(n.updatedAt || n.createdAt)
  }));

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="notes-no-wallet">
        <FileText className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to view notes</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="notes-loading">
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
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="notes-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load notes</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-notes-retry"
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
      data-testid="notes-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-light text-white/80" data-testid="text-notes-title">Notes</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            className="text-white/60 hover:text-white p-2"
            data-testid="button-notes-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <MotionButton
            className="flex items-center gap-2 px-3 py-2 rounded-lg
                       bg-cyan-400/10 border border-cyan-400/30 text-cyan-400
                       hover:bg-cyan-400/20 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-testid="button-new-note"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm">New Note</span>
          </MotionButton>
        </div>
      </div>
      
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="notes-empty">
          <FileText className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">No notes yet</p>
          <p className="text-white/40 text-sm">Create notes to see them here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="notes-list">
          {notes.map((note, index) => (
            <MotionDiv
              key={note.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 
                         hover:border-white/20 cursor-pointer transition-all group"
              data-testid={`note-item-${note.id}`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-amber-400/60" />
                  <h3 className="text-base font-medium text-white/90 group-hover:text-white" data-testid={`text-note-title-${note.id}`}>
                    {note.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {note.encrypted && (
                    <Lock className="w-3 h-3 text-cyan-400/60" />
                  )}
                  {note.starred && (
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  )}
                </div>
              </div>
              
              <p className="text-sm text-white/50 line-clamp-2 mb-3" data-testid={`text-note-content-${note.id}`}>
                {note.content}
              </p>
              
              <div className="text-xs text-white/30" data-testid={`text-note-time-${note.id}`}>
                {note.updatedAt}
              </div>
            </MotionDiv>
          ))}
        </div>
      )}
    </MotionDiv>
  );
}
