import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { publishReceipt } from '@/lib/canvasBus';
import { useReceipts } from '@/hooks/useReceipts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Link,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Image,
  FileCode,
  Type,
  FileText,
  Download,
  History,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  RefreshCw,
  Receipt as ReceiptIcon,
  AlignLeft,
} from 'lucide-react';

function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-y-auto ${className || ''}`}>
      {children}
    </div>
  );
}

interface WriterDoc {
  id: string;
  artifactId: string;
  version: number;
  trackChangesEnabled: boolean;
  outline: any;
  createdAt: string;
  updatedAt: string;
}

interface WriterBlock {
  id: string;
  docId: string;
  position: number;
  blockType: 'paragraph' | 'heading1' | 'heading2' | 'heading3' | 'listOrdered' | 'listUnordered' | 'table' | 'image' | 'quote' | 'codeBlock' | 'embed';
  text: string;
  marks: string[];
  attrs: Record<string, unknown> | null;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

interface DocData {
  ok: boolean;
  doc: WriterDoc;
  blocks: WriterBlock[];
}

interface Revision {
  id: string;
  op: string;
  rangeFrom: string;
  rangeTo: string;
  createdAt: string;
}

interface WriterDocCardProps {
  docId: string;
  walletAddress: string;
  sessionId: string;
}

const BLOCK_TYPE_ICONS: Record<string, React.ReactNode> = {
  paragraph: <Type className="w-4 h-4" />,
  heading1: <Heading1 className="w-4 h-4" />,
  heading2: <Heading2 className="w-4 h-4" />,
  heading3: <Heading3 className="w-4 h-4" />,
  listOrdered: <ListOrdered className="w-4 h-4" />,
  listUnordered: <List className="w-4 h-4" />,
  quote: <Quote className="w-4 h-4" />,
  codeBlock: <FileCode className="w-4 h-4" />,
  image: <Image className="w-4 h-4" />,
  embed: <Code className="w-4 h-4" />,
};

export function WriterDocCard({ docId, walletAddress, sessionId }: WriterDocCardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('editor');
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showOutline, setShowOutline] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');

  const { data, isLoading, refetch } = useQuery<DocData>({
    queryKey: ['/api/writer/docs', docId],
  });

  const { data: revisionsData } = useQuery<{ ok: boolean; revisions: Revision[] }>({
    queryKey: ['/api/writer/docs', docId, 'revisions'],
    enabled: activeTab === 'history',
  });

  const { receipts } = useReceipts({ artifactId: data?.doc?.artifactId, limit: 20 });

  const scope = useMemo(() => ({ walletAddress, sessionId }), [walletAddress, sessionId]);

  const insertTextMutation = useMutation({
    mutationFn: async ({ blockId, offset, text }: { blockId: string; offset: number; text: string }) => {
      return apiRequest(`/api/writer/docs/${docId}/insert-text`, {
        method: 'POST',
        body: JSON.stringify({ scope, blockId, offset, text }),
      });
    },
    onSuccess: (result: any) => {
      if (result.receipt && data?.doc?.artifactId) {
        publishReceipt({
          ...result.receipt,
          actor: { walletAddress, sessionId },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/writer/docs', docId] });
      toast({ title: 'Text inserted', description: 'Block updated successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Insert failed', description: err.message, variant: 'destructive' });
    },
  });

  const applyStyleMutation = useMutation({
    mutationFn: async ({ blockId, marks }: { blockId: string; marks: string[] }) => {
      return apiRequest(`/api/writer/docs/${docId}/apply-style`, {
        method: 'POST',
        body: JSON.stringify({ scope, blockId, marks }),
      });
    },
    onSuccess: (result: any) => {
      if (result.receipt && data?.doc?.artifactId) {
        publishReceipt({
          ...result.receipt,
          actor: { walletAddress, sessionId },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/writer/docs', docId] });
      toast({ title: 'Style applied', description: 'Block styled successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Style failed', description: err.message, variant: 'destructive' });
    },
  });

  const insertBlockMutation = useMutation({
    mutationFn: async ({ blockType, text, afterId }: { blockType: string; text?: string; afterId?: string }) => {
      return apiRequest(`/api/writer/docs/${docId}/insert-block`, {
        method: 'POST',
        body: JSON.stringify({
          scope,
          block: { blockType, text: text || '' },
          position: afterId ? { afterId } : undefined,
        }),
      });
    },
    onSuccess: (result: any) => {
      if (result.receipt && data?.doc?.artifactId) {
        publishReceipt({
          ...result.receipt,
          actor: { walletAddress, sessionId },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/writer/docs', docId] });
      toast({ title: 'Block added', description: 'New block inserted' });
    },
    onError: (err: any) => {
      toast({ title: 'Insert block failed', description: err.message, variant: 'destructive' });
    },
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (blockId: string) => {
      return apiRequest(`/api/writer/docs/${docId}/delete-block`, {
        method: 'POST',
        body: JSON.stringify({ scope, blockId }),
      });
    },
    onSuccess: (result: any) => {
      if (result.receipt && data?.doc?.artifactId) {
        publishReceipt({
          ...result.receipt,
          actor: { walletAddress, sessionId },
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/writer/docs', docId] });
      setSelectedBlockId(null);
      toast({ title: 'Block deleted', description: 'Block removed from document' });
    },
    onError: (err: any) => {
      toast({ title: 'Delete failed', description: err.message, variant: 'destructive' });
    },
  });

  const trackChangesMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      return apiRequest(`/api/writer/docs/${docId}/track-changes`, {
        method: 'POST',
        body: JSON.stringify({ scope, enabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/writer/docs', docId] });
      toast({ title: 'Track changes updated' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to toggle track changes', description: err.message, variant: 'destructive' });
    },
  });

  const exportMutation = useMutation({
    mutationFn: async (format: 'md' | 'pdf' | 'docx') => {
      return apiRequest(`/api/writer/docs/${docId}/export`, {
        method: 'POST',
        body: JSON.stringify({ scope, format }),
      });
    },
    onSuccess: (result: any) => {
      if (result.content) {
        const blob = new Blob([result.content], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
      toast({ title: 'Export complete', description: `Downloaded ${result.filename}` });
    },
    onError: (err: any) => {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    },
  });

  const handleToggleMark = useCallback((mark: string) => {
    if (!selectedBlockId || !data?.blocks) return;
    const block = data.blocks.find(b => b.id === selectedBlockId);
    if (!block) return;

    const currentMarks = block.marks || [];
    const hasmark = currentMarks.includes(mark);
    const newMarks = hasmark
      ? currentMarks.filter(m => m !== mark)
      : [...currentMarks, mark];
    
    applyStyleMutation.mutate({ blockId: selectedBlockId, marks: newMarks });
  }, [selectedBlockId, data?.blocks, applyStyleMutation]);

  const handleSaveBlockEdit = useCallback(() => {
    if (!editingBlockId) return;
    const block = data?.blocks?.find(b => b.id === editingBlockId);
    if (!block) return;

    insertTextMutation.mutate({
      blockId: editingBlockId,
      offset: 0,
      text: editingText,
    });
    setEditingBlockId(null);
    setEditingText('');
  }, [editingBlockId, editingText, data?.blocks, insertTextMutation]);

  const outlineBlocks = useMemo(() => {
    if (!data?.blocks) return [];
    return data.blocks.filter(b => 
      b.blockType === 'heading1' || b.blockType === 'heading2' || b.blockType === 'heading3'
    );
  }, [data?.blocks]);

  const selectedBlock = useMemo(() => {
    if (!selectedBlockId || !data?.blocks) return null;
    return data.blocks.find(b => b.id === selectedBlockId);
  }, [selectedBlockId, data?.blocks]);

  if (isLoading) {
    return (
      <Card className="w-full bg-black/40 backdrop-blur-sm border-white/10" data-testid="writer-doc-card-loading">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-white/10 rounded w-48" />
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-white/5 rounded w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data?.ok || !data.doc) {
    return (
      <Card className="w-full bg-black/40 backdrop-blur-sm border-white/10" data-testid="writer-doc-card-error">
        <CardContent className="p-6 text-center">
          <p className="text-white/60">Document not found</p>
          <Button 
            variant="ghost" 
            onClick={() => refetch()} 
            className="mt-2"
            data-testid="writer-retry-btn"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { doc, blocks } = data;

  return (
    <Card className="w-full bg-black/40 backdrop-blur-sm border-white/10" data-testid="writer-doc-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <CardTitle className="text-lg font-semibold text-white">Writer Document</CardTitle>
            <Badge variant="outline" className="text-xs">v{doc.version}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowOutline(!showOutline)}
              className="text-white/60 hover:text-white"
              data-testid="writer-toggle-outline-btn"
            >
              <AlignLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-white/60 hover:text-white"
              data-testid="writer-refresh-btn"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-1 p-2 bg-white/5 rounded-lg" data-testid="writer-toolbar">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleMark('bold')}
            disabled={!selectedBlockId}
            className={`h-8 w-8 p-0 ${selectedBlock?.marks?.includes('bold') ? 'bg-white/20' : ''}`}
            data-testid="writer-bold-btn"
          >
            <Bold className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleMark('italic')}
            disabled={!selectedBlockId}
            className={`h-8 w-8 p-0 ${selectedBlock?.marks?.includes('italic') ? 'bg-white/20' : ''}`}
            data-testid="writer-italic-btn"
          >
            <Italic className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleMark('underline')}
            disabled={!selectedBlockId}
            className={`h-8 w-8 p-0 ${selectedBlock?.marks?.includes('underline') ? 'bg-white/20' : ''}`}
            data-testid="writer-underline-btn"
          >
            <Underline className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleMark('strikethrough')}
            disabled={!selectedBlockId}
            className={`h-8 w-8 p-0 ${selectedBlock?.marks?.includes('strikethrough') ? 'bg-white/20' : ''}`}
            data-testid="writer-strikethrough-btn"
          >
            <Strikethrough className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleMark('code')}
            disabled={!selectedBlockId}
            className={`h-8 w-8 p-0 ${selectedBlock?.marks?.includes('code') ? 'bg-white/20' : ''}`}
            data-testid="writer-code-btn"
          >
            <Code className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleToggleMark('link')}
            disabled={!selectedBlockId}
            className={`h-8 w-8 p-0 ${selectedBlock?.marks?.includes('link') ? 'bg-white/20' : ''}`}
            data-testid="writer-link-btn"
          >
            <Link className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertBlockMutation.mutate({ blockType: 'heading1', afterId: selectedBlockId || undefined })}
            className="h-8 w-8 p-0"
            data-testid="writer-h1-btn"
          >
            <Heading1 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertBlockMutation.mutate({ blockType: 'heading2', afterId: selectedBlockId || undefined })}
            className="h-8 w-8 p-0"
            data-testid="writer-h2-btn"
          >
            <Heading2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertBlockMutation.mutate({ blockType: 'heading3', afterId: selectedBlockId || undefined })}
            className="h-8 w-8 p-0"
            data-testid="writer-h3-btn"
          >
            <Heading3 className="w-4 h-4" />
          </Button>

          <div className="w-px h-6 bg-white/20 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertBlockMutation.mutate({ blockType: 'listUnordered', afterId: selectedBlockId || undefined })}
            className="h-8 w-8 p-0"
            data-testid="writer-list-btn"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertBlockMutation.mutate({ blockType: 'listOrdered', afterId: selectedBlockId || undefined })}
            className="h-8 w-8 p-0"
            data-testid="writer-ordered-list-btn"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => insertBlockMutation.mutate({ blockType: 'quote', afterId: selectedBlockId || undefined })}
            className="h-8 w-8 p-0"
            data-testid="writer-quote-btn"
          >
            <Quote className="w-4 h-4" />
          </Button>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => trackChangesMutation.mutate(!doc.trackChangesEnabled)}
            className={`h-8 px-2 text-xs ${doc.trackChangesEnabled ? 'text-green-400' : 'text-white/60'}`}
            data-testid="writer-track-changes-btn"
          >
            {doc.trackChangesEnabled ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
            Track
          </Button>
        </div>

        <div className="flex gap-4">
          {showOutline && outlineBlocks.length > 0 && (
            <div className="w-48 shrink-0 bg-white/5 rounded-lg p-2" data-testid="writer-outline-panel">
              <h4 className="text-xs font-medium text-white/60 mb-2 px-2">Outline</h4>
              <div className="space-y-1">
                {outlineBlocks.map((block) => (
                  <button
                    key={block.id}
                    onClick={() => setSelectedBlockId(block.id)}
                    className={`w-full text-left px-2 py-1 rounded text-xs hover:bg-white/10 transition ${
                      block.blockType === 'heading1' ? 'pl-2' : 
                      block.blockType === 'heading2' ? 'pl-4' : 'pl-6'
                    } ${selectedBlockId === block.id ? 'bg-white/20' : ''}`}
                    data-testid={`writer-outline-item-${block.id}`}
                  >
                    <span className="text-white/80 truncate block">{block.text || 'Untitled'}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full bg-white/5 border border-white/10">
                <TabsTrigger value="editor" className="flex-1 data-[state=active]:bg-white/10" data-testid="writer-tab-editor">
                  <FileText className="w-3 h-3 mr-1" />
                  Editor
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 data-[state=active]:bg-white/10" data-testid="writer-tab-history">
                  <History className="w-3 h-3 mr-1" />
                  History
                </TabsTrigger>
                <TabsTrigger value="receipts" className="flex-1 data-[state=active]:bg-white/10" data-testid="writer-tab-receipts">
                  <ReceiptIcon className="w-3 h-3 mr-1" />
                  Receipts
                </TabsTrigger>
              </TabsList>

              <TabsContent value="editor" className="mt-4">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2 pr-2" data-testid="writer-blocks-container">
                    {blocks.map((block) => (
                      <div
                        key={block.id}
                        className={`group relative rounded-lg p-3 transition-all cursor-pointer ${
                          selectedBlockId === block.id 
                            ? 'bg-blue-500/20 ring-1 ring-blue-500/50' 
                            : 'bg-white/5 hover:bg-white/10'
                        }`}
                        onClick={() => setSelectedBlockId(block.id)}
                        data-testid={`writer-block-${block.id}`}
                      >
                        <div className="flex items-start gap-2">
                          <div className="text-white/40 mt-1">
                            {BLOCK_TYPE_ICONS[block.blockType] || <Type className="w-4 h-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            {editingBlockId === block.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editingText}
                                  onChange={(e) => setEditingText(e.target.value)}
                                  className="flex-1 bg-black/30 border border-white/20 rounded px-2 py-1 text-sm text-white"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveBlockEdit();
                                    if (e.key === 'Escape') {
                                      setEditingBlockId(null);
                                      setEditingText('');
                                    }
                                  }}
                                  data-testid={`writer-block-edit-input-${block.id}`}
                                />
                                <Button
                                  size="sm"
                                  onClick={handleSaveBlockEdit}
                                  className="h-7"
                                  data-testid={`writer-block-save-btn-${block.id}`}
                                >
                                  Save
                                </Button>
                              </div>
                            ) : (
                              <p
                                className={`text-white/90 ${
                                  block.blockType === 'heading1' ? 'text-xl font-bold' :
                                  block.blockType === 'heading2' ? 'text-lg font-semibold' :
                                  block.blockType === 'heading3' ? 'text-base font-medium' :
                                  block.blockType === 'quote' ? 'italic border-l-2 border-white/40 pl-2' :
                                  block.blockType === 'codeBlock' ? 'font-mono text-sm bg-black/30 p-2 rounded' :
                                  'text-sm'
                                } ${block.marks?.includes('bold') ? 'font-bold' : ''} 
                                  ${block.marks?.includes('italic') ? 'italic' : ''} 
                                  ${block.marks?.includes('underline') ? 'underline' : ''} 
                                  ${block.marks?.includes('strikethrough') ? 'line-through' : ''} 
                                  ${block.marks?.includes('code') ? 'font-mono bg-white/10 px-1 rounded' : ''}`}
                                onDoubleClick={() => {
                                  setEditingBlockId(block.id);
                                  setEditingText(block.text || '');
                                }}
                              >
                                {block.text || <span className="text-white/30">Empty block</span>}
                              </p>
                            )}
                            <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                              <Badge variant="outline" className="text-[10px] px-1 py-0">{block.blockType}</Badge>
                              {block.marks && block.marks.length > 0 && (
                                <span>{block.marks.join(', ')}</span>
                              )}
                            </div>
                          </div>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                insertBlockMutation.mutate({ blockType: 'paragraph', afterId: block.id });
                              }}
                              className="h-6 w-6 p-0"
                              data-testid={`writer-add-block-btn-${block.id}`}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteBlockMutation.mutate(block.id);
                              }}
                              className="h-6 w-6 p-0 text-red-400 hover:text-red-300"
                              data-testid={`writer-delete-block-btn-${block.id}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <Button
                      variant="ghost"
                      onClick={() => insertBlockMutation.mutate({ blockType: 'paragraph' })}
                      className="w-full border border-dashed border-white/20 text-white/40 hover:text-white hover:border-white/40"
                      data-testid="writer-add-block-btn"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Block
                    </Button>
                  </div>
                </ScrollArea>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                  <div className="text-xs text-white/40">
                    {blocks.length} blocks • v{doc.version}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportMutation.mutate('md')}
                      disabled={exportMutation.isPending}
                      className="h-7 text-xs"
                      data-testid="writer-export-md-btn"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      MD
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportMutation.mutate('docx')}
                      disabled={exportMutation.isPending}
                      className="h-7 text-xs"
                      data-testid="writer-export-docx-btn"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      DOCX
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => exportMutation.mutate('pdf')}
                      disabled={exportMutation.isPending}
                      className="h-7 text-xs"
                      data-testid="writer-export-pdf-btn"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      PDF
                    </Button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="history" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {!revisionsData?.revisions || revisionsData.revisions.length === 0 ? (
                    <div className="text-center text-white/40 py-8" data-testid="writer-no-revisions">
                      {doc.trackChangesEnabled 
                        ? 'No revisions recorded yet'
                        : 'Enable track changes to record revisions'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {revisionsData.revisions.map((revision) => (
                        <div
                          key={revision.id}
                          className="bg-white/5 rounded-lg p-3"
                          data-testid={`writer-revision-${revision.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">{revision.op}</Badge>
                            <span className="text-xs text-white/40">
                              {new Date(revision.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="text-xs text-white/60 mt-1">
                            Range: {revision.rangeFrom} → {revision.rangeTo}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="receipts" className="mt-4">
                <ScrollArea className="h-[400px]">
                  {receipts.length === 0 ? (
                    <div className="text-center text-white/40 py-8" data-testid="writer-no-receipts">
                      No receipts recorded yet
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {receipts.map((receipt) => (
                        <div
                          key={receipt.id}
                          className="bg-white/5 rounded-lg p-3"
                          data-testid={`writer-receipt-${receipt.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400">{receipt.op}</Badge>
                            <span className="text-xs text-white/40">
                              {new Date(receipt.timestamp).toLocaleString()}
                            </span>
                          </div>
                          {receipt.meta && Object.keys(receipt.meta).length > 0 && (
                            <div className="mt-2 text-xs text-white/40 font-mono bg-black/20 rounded p-2 overflow-x-auto">
                              {JSON.stringify(receipt.meta, null, 2).slice(0, 150)}
                            </div>
                          )}
                          <div className="text-[10px] text-white/30 mt-1 truncate">
                            Hash: {receipt.nextHash}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default WriterDocCard;
