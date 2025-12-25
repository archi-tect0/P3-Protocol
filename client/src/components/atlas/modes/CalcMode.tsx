import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAtlasStore } from '@/state/useAtlasStore';
import { MotionDiv } from '@/lib/motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Table, Grid } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { CalcSheetCard } from '../cards/CalcSheetCard';

function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-auto ${className || ''}`}>{children}</div>;
}

export default function CalcMode() {
  const { wallet } = useAtlasStore();
  const { toast } = useToast();
  const [selectedSheetId, setSelectedSheetId] = useState<string | null>(null);
  const [newSheetTitle, setNewSheetTitle] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const sessionId = typeof window !== 'undefined' 
    ? sessionStorage.getItem('atlas_session_id') || `session-${Date.now()}`
    : `session-${Date.now()}`;

  const { data: sheetsData, isLoading } = useQuery({
    queryKey: ['/api/calc/sheets', wallet],
    queryFn: async () => {
      if (!wallet) return { sheets: [] };
      const res = await fetch('/api/calc/sheets/list', {
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

  const createSheetMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest('/api/calc/sheets', {
        method: 'POST',
        body: JSON.stringify({
          scope: { walletAddress: wallet, sessionId },
          title: title || 'Untitled Spreadsheet'
        })
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/calc/sheets'] });
      setSelectedSheetId(data.sheet?.id);
      setNewSheetTitle('');
      setShowCreateForm(false);
      toast({ title: 'Spreadsheet created', description: 'Your new spreadsheet is ready.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create spreadsheet', variant: 'destructive' });
    }
  });

  if (!wallet) {
    return (
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full text-white/60"
        data-testid="calc-mode-no-wallet"
      >
        <Table className="w-16 h-16 mb-4 opacity-40" />
        <p className="text-lg">Connect your wallet to use Calc</p>
      </MotionDiv>
    );
  }

  if (selectedSheetId) {
    return (
      <div className="h-full flex flex-col" data-testid="calc-mode-editor">
        <div className="flex items-center gap-2 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setSelectedSheetId(null)}
            data-testid="calc-back-button"
          >
            Back to Spreadsheets
          </Button>
        </div>
        <div className="flex-1 min-h-0">
          <CalcSheetCard 
            sheetId={selectedSheetId} 
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
      data-testid="calc-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Table className="w-6 h-6" />
          Calc
        </h2>
        <Button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          data-testid="calc-new-sheet-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Spreadsheet
        </Button>
      </div>

      {showCreateForm && (
        <div className="flex gap-2 mb-4 p-4 bg-white/5 rounded-lg border border-white/10">
          <Input
            value={newSheetTitle}
            onChange={(e) => setNewSheetTitle(e.target.value)}
            placeholder="Spreadsheet title..."
            className="flex-1 bg-white/10 border-white/20"
            data-testid="calc-new-sheet-input"
          />
          <Button 
            onClick={() => createSheetMutation.mutate(newSheetTitle)}
            disabled={createSheetMutation.isPending}
            data-testid="calc-create-sheet-button"
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
        ) : sheetsData?.sheets?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sheetsData.sheets.map((sheet: any) => (
              <div
                key={sheet.id}
                className="p-4 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 cursor-pointer transition-colors"
                onClick={() => setSelectedSheetId(sheet.id)}
                data-testid={`calc-sheet-item-${sheet.id}`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-white">{sheet.artifact?.title || 'Untitled'}</h3>
                    <p className="text-sm text-white/50 mt-1">
                      v{sheet.version} · {new Date(sheet.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Grid className="w-5 h-5 text-white/40" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-white/40">
            <Table className="w-12 h-12 mb-3 opacity-40" />
            <p>No spreadsheets yet</p>
            <p className="text-sm mt-1">Create your first spreadsheet to get started</p>
          </div>
        )}
      </ScrollArea>
    </MotionDiv>
  );
}
