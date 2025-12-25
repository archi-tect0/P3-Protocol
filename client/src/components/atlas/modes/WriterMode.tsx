import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAtlasStore } from '@/state/useAtlasStore';
import { MotionDiv } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, FileText } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { WriterDocCard } from '../cards/WriterDocCard';

function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-auto ${className || ''}`}>{children}</div>;
}

export default function WriterMode() {
  const { wallet } = useAtlasStore();
  const { toast } = useToast();
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const sessionId = typeof window !== 'undefined' 
    ? sessionStorage.getItem('atlas_session_id') || `session-${Date.now()}`
    : `session-${Date.now()}`;

  const { data: docsData, isLoading } = useQuery({
    queryKey: ['/api/writer/docs/list', wallet],
    queryFn: async () => {
      if (!wallet) return { docs: [] };
      const res = await fetch('/api/writer/docs/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: { walletAddress: wallet, sessionId }
        })
      });
      return res.json();
    },
    enabled: !!wallet
  });

  const createDocMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest('/api/writer/docs', {
        method: 'POST',
        body: JSON.stringify({
          scope: { walletAddress: wallet, sessionId },
          init: { title: title || 'Untitled Document' }
        })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/writer/docs/list'] });
      setSelectedDocId(data.doc?.id);
      setNewDocTitle('');
      setShowCreateForm(false);
      toast({ title: 'Document created', description: 'Your new document is ready.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create document', variant: 'destructive' });
    }
  });

  if (!wallet) {
    return (
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full text-white/60"
        data-testid="writer-mode-no-wallet"
      >
        <FileText className="w-16 h-16 mb-4 opacity-40" />
        <p className="text-lg">Connect your wallet to use Writer</p>
      </MotionDiv>
    );
  }

  if (selectedDocId) {
    return (
      <div className="h-full flex flex-col" data-testid="writer-mode-editor">
        <div className="flex items-center gap-2 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSelectedDocId(null)}
            data-testid="writer-back-button"
          >
            Back to Documents
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <WriterDocCard 
            docId={selectedDocId} 
            walletAddress={wallet} 
            sessionId={sessionId} 
          />
        </div>
      </div>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col"
      data-testid="writer-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-6 h-6" />
          Writer
        </h2>
        <Button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          data-testid="writer-new-doc-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Document
        </Button>
      </div>

      {showCreateForm && (
        <div className="flex gap-2 mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
          <Input
            value={newDocTitle}
            onChange={(e) => setNewDocTitle(e.target.value)}
            placeholder="Document title..."
            className="flex-1 bg-white/10 border-white/20"
            data-testid="writer-new-doc-input"
          />
          <Button 
            onClick={() => createDocMutation.mutate(newDocTitle)}
            disabled={createDocMutation.isPending}
            data-testid="writer-create-doc-button"
          >
            Create
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-white/5 animate-pulse rounded-lg" />
            ))}
          </div>
        ) : docsData?.docs?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {docsData.docs.map((doc: any) => (
              <div
                key={doc.id}
                className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                onClick={() => setSelectedDocId(doc.id)}
                data-testid={`writer-doc-item-${doc.id}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-white">{doc.artifact?.title || 'Untitled'}</h3>
                    <p className="text-sm text-white/50 mt-1">
                      v{doc.version} · {new Date(doc.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <FileText className="w-5 h-5 text-white/40" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-white/40">
            <FileText className="w-12 h-12 mb-3 opacity-40" />
            <p>No documents yet</p>
            <p className="text-sm mt-1">Create your first document to get started</p>
          </div>
        )}
      </ScrollArea>
    </MotionDiv>
  );
}
