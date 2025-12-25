import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import {
  Book, Bookmark, Highlighter, StickyNote, ChevronLeft,
  Search, Loader2, AlertCircle, BookOpen, List, Plus,
  PanelRightOpen, PanelRightClose, ShoppingCart, Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import EpubViewer from '@/components/atlas/EpubViewer';

function ScrollArea({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`overflow-auto ${className || ''}`}>{children}</div>;
}

interface MarketplaceItem {
  id: string;
  title: string;
  author: string | null;
  coverImage: string | null;
  thumbnail?: string | null;
  category: string | null;
  subcategory?: string | null;
  description: string | null;
  price: string | null;
  metadata: Record<string, any> | null;
  externalId?: string | null;
  manifest?: {
    externalIds?: {
      gutenbergId?: string;
    };
    assets?: Array<{
      type?: string;
      format?: string;
      url?: string;
    }>;
  } | null;
}

const getGutenbergCover = (item: MarketplaceItem): string => {
  const gutenbergId = item.manifest?.externalIds?.gutenbergId || item.externalId;
  if (gutenbergId) {
    return `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}.cover.medium.jpg`;
  }
  return '';
};

const getBookThumbnail = (item: MarketplaceItem): string | null => {
  return item.coverImage || item.thumbnail || getGutenbergCover(item) || null;
};

const getGutenbergReaderUrl = (item: MarketplaceItem): string | null => {
  const gutenbergId = item.manifest?.externalIds?.gutenbergId || item.externalId;
  if (gutenbergId) {
    return `https://www.gutenberg.org/cache/epub/${gutenbergId}/pg${gutenbergId}-images.html`;
  }
  const htmlAsset = item.manifest?.assets?.find(
    (a: any) => a.type === 'html' || a.format?.includes('html')
  );
  return htmlAsset?.url || null;
};

const getLocalEpubUrl = (item: MarketplaceItem, _wallet: string): string => {
  // Use local server endpoint to serve downloaded EPUB
  return `/api/gamedeck/ebooks/file/${item.id}`;
};

const hasEpubAvailable = (item: MarketplaceItem): boolean => {
  // Check if book has EPUB format available
  if (item.metadata?.formats?.epub) return true;
  const epubAsset = item.manifest?.assets?.find(
    (a: any) => a.type === 'epub' || a.format === 'epub'
  );
  if (epubAsset?.url) return true;
  const gutenbergId = item.manifest?.externalIds?.gutenbergId || item.externalId || item.metadata?.gutenberg_id;
  if (gutenbergId) return true;
  return false;
};

interface BookProgress {
  id: string;
  bookId: string;
  wallet: string;
  currentPage: number;
  totalPages: number;
  lastReadAt: string;
  book?: MarketplaceItem;
}

interface Highlight {
  id: string;
  bookId: string;
  wallet: string;
  page: number;
  text: string;
  color: string;
  createdAt: string;
}

interface Note {
  id: string;
  bookId: string;
  wallet: string;
  page: number;
  content: string;
  createdAt: string;
}

interface BookmarkItem {
  id: string;
  bookId: string;
  wallet: string;
  page: number;
  label: string | null;
  createdAt: string;
}

interface LibraryEntry {
  item: MarketplaceItem;
  accessType: string;
  purchasedAt?: string;
  progress?: BookProgress;
}

interface LibraryResponse {
  items: LibraryEntry[];
  count: number;
}

interface ContinueReadingResponse {
  items: LibraryEntry[];
  count: number;
}

interface CatalogResponse {
  items: MarketplaceItem[];
  count: number;
}

interface ProgressResponse {
  progress: BookProgress;
  highlights: Highlight[];
  notes: Note[];
  bookmarks: BookmarkItem[];
  content?: {
    pages: string[];
    toc?: { title: string; page: number }[];
  };
}

const CATEGORIES = ['Fiction', 'Non-Fiction', 'Sci-Fi', 'Fantasy', 'Mystery', 'Romance', 'Biography', 'History', 'Self-Help', 'Technology'];

export default function ReaderMode() {
  const { wallet, pushReceipt, addRunningApp, removeRunningApp } = useAtlasStore();
  const { toast } = useToast();

  const [isReading, setIsReading] = useState(false);
  const [selectedBook, setSelectedBook] = useState<MarketplaceItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState<'toc' | 'bookmarks' | 'highlights' | 'notes'>('toc');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [showNoteForm, setShowNoteForm] = useState(false);
  const runningAppIdRef = useRef<string | null>(null);

  const libraryQuery = useQuery<LibraryResponse>({
    queryKey: ['/api/gamedeck/ebooks/library', wallet],
    queryFn: async () => {
      if (!wallet) return { items: [], count: 0 };
      const res = await fetch('/api/gamedeck/ebooks/library', {
        headers: { 'x-wallet-address': wallet },
      });
      if (!res.ok) throw new Error('Failed to fetch library');
      return res.json();
    },
    enabled: !!wallet && !isReading,
  });

  const continueQuery = useQuery<ContinueReadingResponse>({
    queryKey: ['/api/gamedeck/ebooks/continue', wallet],
    queryFn: async () => {
      if (!wallet) return { items: [], count: 0 };
      const res = await fetch('/api/gamedeck/ebooks/continue', {
        headers: { 'x-wallet-address': wallet },
      });
      if (!res.ok) throw new Error('Failed to fetch continue reading');
      return res.json();
    },
    enabled: !!wallet && !isReading,
  });

  const catalogQuery = useQuery<CatalogResponse>({
    queryKey: ['/api/gamedeck/ebooks/catalog', searchQuery, categoryFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ free: 'true', limit: '50' });
      if (searchQuery) params.append('q', searchQuery);
      if (categoryFilter && categoryFilter !== 'all') params.append('category', categoryFilter);
      const res = await fetch(`/api/gamedeck/ebooks/catalog?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch catalog');
      return res.json();
    },
    enabled: !isReading,
  });

  const progressQuery = useQuery<ProgressResponse>({
    queryKey: ['/api/gamedeck/ebooks/progress', selectedBook?.id, wallet],
    queryFn: async () => {
      if (!selectedBook || !wallet) throw new Error('No book selected');
      const res = await fetch(`/api/gamedeck/ebooks/progress/${selectedBook.id}`, {
        headers: { 'x-wallet-address': wallet },
      });
      if (!res.ok) throw new Error('Failed to fetch progress');
      return res.json();
    },
    enabled: isReading && !!selectedBook && !!wallet,
  });

  const saveProgressMutation = useMutation({
    mutationFn: async ({ bookId, page, totalPages }: { bookId: string; page: number; totalPages: number }) => {
      return apiRequest(`/api/gamedeck/ebooks/progress/${bookId}`, {
        method: 'POST',
        body: JSON.stringify({ page, totalPages }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/ebooks/progress', variables.bookId] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/ebooks/continue'] });
    },
  });

  const addNoteMutation = useMutation({
    mutationFn: async ({ bookId, page, content }: { bookId: string; page: number; content: string }) => {
      return apiRequest(`/api/gamedeck/ebooks/note/${bookId}`, {
        method: 'POST',
        body: JSON.stringify({ page, content }),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/ebooks/progress', variables.bookId] });
      pushReceipt({
        id: `ebook-note-${Date.now()}`,
        hash: `0x${Date.now().toString(16)}`,
        scope: 'ebooks',
        endpoint: 'note.add',
        timestamp: Date.now(),
        data: { bookId: variables.bookId, page: variables.page },
      });
      toast({ title: 'Note Added' });
      setNewNoteContent('');
      setShowNoteForm(false);
    },
    onError: (err: any) => {
      toast({ title: 'Failed to add note', description: err.message, variant: 'destructive' });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async ({ bookId }: { bookId: string }) => {
      return apiRequest(`/api/gamedeck/ebooks/purchase/${bookId}`, {
        method: 'POST',
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/ebooks/library'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/ebooks/catalog'] });
      pushReceipt({
        id: `ebook-purchase-${Date.now()}`,
        hash: data.txHash || `0x${Date.now().toString(16)}`,
        scope: 'ebooks',
        endpoint: 'book.purchase',
        timestamp: Date.now(),
        data: { bookId: variables.bookId },
      });
      toast({ title: 'Book Added to Library' });
    },
    onError: (err: any) => {
      toast({ title: 'Purchase Failed', description: err.message, variant: 'destructive' });
    },
  });

  const removeFromLibraryMutation = useMutation({
    mutationFn: async ({ bookId }: { bookId: string }) => {
      return apiRequest(`/api/gamedeck/ebooks/library/${bookId}`, {
        method: 'DELETE',
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/ebooks/library'] });
      queryClient.invalidateQueries({ queryKey: ['/api/gamedeck/ebooks/continue'] });
      pushReceipt({
        id: `ebook-remove-${Date.now()}`,
        hash: `0x${Date.now().toString(16)}`,
        scope: 'ebooks',
        endpoint: 'book.remove',
        timestamp: Date.now(),
        data: { bookId: variables.bookId },
      });
      toast({ title: 'Book Removed from Library' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to remove book', description: err.message, variant: 'destructive' });
    },
  });

  const library = libraryQuery.data?.items || [];
  const continueReading = continueQuery.data?.items || [];
  const catalog = catalogQuery.data?.items || [];
  const progress = progressQuery.data?.progress;
  const highlights = progressQuery.data?.highlights || [];
  const notes = progressQuery.data?.notes || [];
  const bookmarks = progressQuery.data?.bookmarks || [];
  const bookContent = progressQuery.data?.content;
  const totalPages = progress?.totalPages || bookContent?.pages?.length || 100;
  const toc = bookContent?.toc || [];

  const ownedBookIds = useMemo(() => new Set(library.map(b => b.item.id)), [library]);

  const filteredCatalog = useMemo(() => {
    return catalog.filter(book => !ownedBookIds.has(book.id));
  }, [catalog, ownedBookIds]);

  const handleOpenBook = (book: MarketplaceItem) => {
    setSelectedBook(book);
    setCurrentPage(1);
    setIsReading(true);
    
    addRunningApp({
      mode: 'reader',
      name: book.title,
      icon: 'BookOpen',
      state: 'active',
      metadata: {
        title: book.title,
        subtitle: book.author || 'Unknown Author',
        progress: 0,
      },
      supportsPip: false,
    });
    
    const apps = useAtlasStore.getState().runningApps;
    const myApp = apps.find(a => a.mode === 'reader');
    if (myApp) runningAppIdRef.current = myApp.id;
  };

  const handleCloseBook = () => {
    if (selectedBook) {
      saveProgressMutation.mutate({ bookId: selectedBook.id, page: currentPage, totalPages });
    }
    if (runningAppIdRef.current) {
      removeRunningApp(runningAppIdRef.current);
      runningAppIdRef.current = null;
    }
    setIsReading(false);
    setSelectedBook(null);
    setShowSidePanel(false);
  };

  const handlePageChange = (page: number) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
    if (selectedBook) {
      saveProgressMutation.mutate({ bookId: selectedBook.id, page: newPage, totalPages });
    }
  };

  const handleAddNote = () => {
    if (selectedBook && newNoteContent.trim()) {
      addNoteMutation.mutate({
        bookId: selectedBook.id,
        page: currentPage,
        content: newNoteContent.trim(),
      });
    }
  };

  const handleGoToPage = (page: number) => {
    handlePageChange(page);
    setShowSidePanel(false);
  };

  if (!wallet) {
    return (
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full text-white/60"
        data-testid="reader-mode-no-wallet"
      >
        <Book className="w-16 h-16 mb-4 opacity-40" />
        <p className="text-lg">Connect your wallet to access your eBook library</p>
      </MotionDiv>
    );
  }

  if (isReading && selectedBook) {
    const localEpubUrl = getLocalEpubUrl(selectedBook, wallet);
    const epubAvailable = hasEpubAvailable(selectedBook);
    const gutenbergUrl = getGutenbergReaderUrl(selectedBook);
    
    return (
      <MotionDiv
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="h-full flex flex-col bg-slate-900"
        data-testid="reader-mode-reading"
      >
        <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/40">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCloseBook}
              className="text-white/70 hover:text-white"
              data-testid="button-back-to-library"
            >
              <ChevronLeft className="w-5 h-5 mr-1" />
              Library
            </Button>
          </div>
          <div className="flex-1 text-center">
            <h2 className="text-white font-medium truncate max-w-md mx-auto" data-testid="text-book-title">
              {selectedBook.title}
            </h2>
            {selectedBook.author && (
              <p className="text-white/50 text-sm">{selectedBook.author}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSidePanel(!showSidePanel)}
              className="text-white/70 hover:text-white"
              data-testid="button-toggle-sidepanel"
            >
              {showSidePanel ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            {epubAvailable ? (
              <EpubViewer
                epubUrl={localEpubUrl}
                theme="dark"
                fontSize={100}
                onTocLoaded={(_tocItems) => {
                  // TOC is loaded from the EPUB
                }}
                onLocationChange={(location) => {
                  setCurrentPage(location.page);
                  if (selectedBook) {
                    saveProgressMutation.mutate({
                      bookId: selectedBook.id,
                      page: location.page,
                      totalPages: 100,
                    });
                  }
                }}
                onError={(error) => {
                  console.error('EPUB load error:', error);
                  toast({ title: 'Failed to load book', description: error, variant: 'destructive' });
                }}
              />
            ) : gutenbergUrl ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-br from-slate-800 to-slate-900">
                <BookOpen className="w-16 h-16 text-purple-400 mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">{selectedBook.title}</h3>
                <p className="text-white/60 mb-6 text-center max-w-md">
                  This book will open in a new browser tab for the best reading experience.
                </p>
                <Button
                  onClick={() => window.open(gutenbergUrl, '_blank', 'noopener,noreferrer')}
                  className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3"
                  data-testid="button-open-book"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Open Book
                </Button>
                <p className="text-white/40 text-xs mt-4">
                  Opens Project Gutenberg reader
                </p>
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-6" data-testid="reader-content-error">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 text-white/40 mx-auto mb-4" />
                  <p className="text-white/70">Unable to load book content.</p>
                  <p className="text-white/50 text-sm mt-2">Please try again or select a different book.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCloseBook}
                    className="mt-4"
                    data-testid="button-error-back"
                  >
                    Back to Library
                  </Button>
                </div>
              </div>
            )}
          </div>

          <AnimatePresence>
            {showSidePanel && (
              <MotionDiv
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 300, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="flex-none border-l border-white/10 bg-black/40 overflow-hidden"
                data-testid="reader-sidepanel"
              >
                <div className="w-[300px] h-full flex flex-col">
                  <div className="flex-none flex border-b border-white/10">
                    {(['toc', 'bookmarks', 'highlights', 'notes'] as const).map(tab => (
                      <button
                        key={tab}
                        className={`flex-1 px-2 py-3 text-xs font-medium transition-colors ${
                          sidePanelTab === tab
                            ? 'text-white bg-white/10'
                            : 'text-white/50 hover:text-white/70'
                        }`}
                        onClick={() => setSidePanelTab(tab)}
                        data-testid={`button-tab-${tab}`}
                      >
                        {tab === 'toc' && <List className="w-4 h-4 mx-auto mb-1" />}
                        {tab === 'bookmarks' && <Bookmark className="w-4 h-4 mx-auto mb-1" />}
                        {tab === 'highlights' && <Highlighter className="w-4 h-4 mx-auto mb-1" />}
                        {tab === 'notes' && <StickyNote className="w-4 h-4 mx-auto mb-1" />}
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>

                  <ScrollArea className="flex-1 p-3">
                    {sidePanelTab === 'toc' && (
                      <div className="space-y-1">
                        {toc.length > 0 ? (
                          toc.map((item, i) => (
                            <button
                              key={i}
                              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                                currentPage >= item.page ? 'text-white' : 'text-white/50'
                              } hover:bg-white/10`}
                              onClick={() => handleGoToPage(item.page)}
                              data-testid={`button-toc-item-${i}`}
                            >
                              {item.title}
                              <span className="text-white/30 ml-2">p.{item.page}</span>
                            </button>
                          ))
                        ) : (
                          <p className="text-white/40 text-sm text-center py-4">No table of contents</p>
                        )}
                      </div>
                    )}

                    {sidePanelTab === 'bookmarks' && (
                      <div className="space-y-2">
                        {bookmarks.length > 0 ? (
                          bookmarks.map(bm => (
                            <button
                              key={bm.id}
                              className="w-full text-left px-3 py-2 rounded bg-white/5 hover:bg-white/10 transition-colors"
                              onClick={() => handleGoToPage(bm.page)}
                              data-testid={`button-bookmark-${bm.id}`}
                            >
                              <div className="flex items-center gap-2">
                                <Bookmark className="w-4 h-4 text-amber-400" />
                                <span className="text-white text-sm">Page {bm.page}</span>
                              </div>
                              {bm.label && <p className="text-white/50 text-xs mt-1">{bm.label}</p>}
                            </button>
                          ))
                        ) : (
                          <p className="text-white/40 text-sm text-center py-4">No bookmarks yet</p>
                        )}
                      </div>
                    )}

                    {sidePanelTab === 'highlights' && (
                      <div className="space-y-2">
                        {highlights.length > 0 ? (
                          highlights.map(h => (
                            <button
                              key={h.id}
                              className="w-full text-left px-3 py-2 rounded hover:bg-white/10 transition-colors"
                              onClick={() => handleGoToPage(h.page)}
                              data-testid={`button-highlight-${h.id}`}
                            >
                              <span
                                className="inline-block px-2 py-1 rounded text-sm"
                                style={{ backgroundColor: h.color, color: '#000' }}
                              >
                                {h.text.slice(0, 50)}{h.text.length > 50 ? '...' : ''}
                              </span>
                              <p className="text-white/40 text-xs mt-1">Page {h.page}</p>
                            </button>
                          ))
                        ) : (
                          <p className="text-white/40 text-sm text-center py-4">No highlights yet</p>
                        )}
                      </div>
                    )}

                    {sidePanelTab === 'notes' && (
                      <div className="space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-dashed border-white/20 text-white/70"
                          onClick={() => setShowNoteForm(!showNoteForm)}
                          data-testid="button-add-note"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Note to Page {currentPage}
                        </Button>

                        {showNoteForm && (
                          <div className="p-2 bg-white/5 rounded-lg space-y-2">
                            <textarea
                              value={newNoteContent}
                              onChange={(e) => setNewNoteContent(e.target.value)}
                              placeholder="Write your note..."
                              className="w-full bg-white/10 border border-white/20 rounded px-3 py-2 text-white text-sm resize-none"
                              rows={3}
                              data-testid="textarea-new-note"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={handleAddNote}
                                disabled={!newNoteContent.trim() || addNoteMutation.isPending}
                                data-testid="button-save-note"
                              >
                                Save
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setShowNoteForm(false);
                                  setNewNoteContent('');
                                }}
                                data-testid="button-cancel-note"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )}

                        {notes.length > 0 ? (
                          notes.map(n => (
                            <button
                              key={n.id}
                              className="w-full text-left px-3 py-2 rounded bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                              onClick={() => handleGoToPage(n.page)}
                              data-testid={`button-note-${n.id}`}
                            >
                              <p className="text-white text-sm">{n.content}</p>
                              <p className="text-white/40 text-xs mt-1">Page {n.page}</p>
                            </button>
                          ))
                        ) : (
                          !showNoteForm && (
                            <p className="text-white/40 text-sm text-center py-4">No notes yet</p>
                          )
                        )}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </MotionDiv>
            )}
          </AnimatePresence>
        </div>
      </MotionDiv>
    );
  }

  return (
    <MotionDiv
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-full flex flex-col overflow-hidden"
      data-testid="reader-mode"
    >
      <div className="flex-none px-4 py-3 border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Book className="w-7 h-7 text-emerald-400" />
            <h2 className="text-xl font-bold text-white">eBook Library</h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search books..."
              className="pl-10 bg-white/10 border-white/20 text-white placeholder:text-white/40"
              data-testid="input-search-books"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 bg-white/10 border-white/20 text-white" data-testid="select-category">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        {continueReading.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Continue Reading
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {continueReading.map(entry => (
                <Card
                  key={entry.item.id}
                  className="group bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer transition-all overflow-hidden"
                  onClick={() => handleOpenBook(entry.item)}
                  data-testid={`card-continue-book-${entry.item.id}`}
                >
                  <div className="aspect-[2/3] relative overflow-hidden">
                    {getBookThumbnail(entry.item) ? (
                      <img
                        src={getBookThumbnail(entry.item)!}
                        alt={entry.item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center">
                        <Book className="w-12 h-12 text-white/40" />
                      </div>
                    )}
                    <button
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white/70 hover:text-red-400 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromLibraryMutation.mutate({ bookId: entry.item.id });
                      }}
                      disabled={removeFromLibraryMutation.isPending}
                      data-testid={`button-remove-continue-${entry.item.id}`}
                    >
                      {removeFromLibraryMutation.isPending && removeFromLibraryMutation.variables?.bookId === entry.item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                      <div
                        className="h-full bg-emerald-500"
                        style={{
                          width: `${entry.progress ? (entry.progress.currentPage / entry.progress.totalPages) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-medium text-white text-sm truncate">{entry.item.title}</h4>
                    {entry.item.author && (
                      <p className="text-white/50 text-xs truncate mt-1">{entry.item.author}</p>
                    )}
                    {entry.progress && (
                      <p className="text-emerald-400 text-xs mt-1">
                        {Math.round((entry.progress.currentPage / entry.progress.totalPages) * 100)}% complete
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Book className="w-5 h-5 text-emerald-400" />
            Your Library
          </h3>
          {libraryQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-white/50" />
            </div>
          ) : library.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {library.map(entry => (
                <Card
                  key={entry.item.id}
                  className="group bg-white/5 border-white/10 hover:bg-white/10 cursor-pointer transition-all overflow-hidden"
                  onClick={() => handleOpenBook(entry.item)}
                  data-testid={`card-library-book-${entry.item.id}`}
                >
                  <div className="aspect-[2/3] relative overflow-hidden">
                    {getBookThumbnail(entry.item) ? (
                      <img
                        src={getBookThumbnail(entry.item)!}
                        alt={entry.item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-600 to-indigo-700 flex items-center justify-center">
                        <Book className="w-12 h-12 text-white/40" />
                      </div>
                    )}
                    <button
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white/70 hover:text-red-400 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromLibraryMutation.mutate({ bookId: entry.item.id });
                      }}
                      disabled={removeFromLibraryMutation.isPending}
                      data-testid={`button-remove-book-${entry.item.id}`}
                    >
                      {removeFromLibraryMutation.isPending && removeFromLibraryMutation.variables?.bookId === entry.item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                    {entry.progress && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                        <div
                          className="h-full bg-emerald-500"
                          style={{
                            width: `${(entry.progress.currentPage / entry.progress.totalPages) * 100}%`
                          }}
                        />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-medium text-white text-sm truncate">{entry.item.title}</h4>
                    {entry.item.author && (
                      <p className="text-white/50 text-xs truncate mt-1">{entry.item.author}</p>
                    )}
                    {entry.item.subcategory && (
                      <span className="inline-block mt-1 px-2 py-0.5 bg-white/10 rounded text-xs text-white/60">
                        {entry.item.subcategory}
                      </span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-white/40">
              <Book className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Your library is empty</p>
              <p className="text-sm mt-1">Browse the catalog below to add books</p>
            </div>
          )}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-purple-400" />
            Free eBooks Catalog
          </h3>
          {catalogQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-white/50" />
            </div>
          ) : filteredCatalog.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {filteredCatalog.map(book => (
                <Card
                  key={book.id}
                  className="group bg-white/5 border-white/10 hover:bg-white/10 transition-all overflow-hidden"
                  data-testid={`card-catalog-book-${book.id}`}
                >
                  <div className="aspect-[2/3] relative overflow-hidden">
                    {getBookThumbnail(book) ? (
                      <img
                        src={getBookThumbnail(book)!}
                        alt={book.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                        <Book className="w-12 h-12 text-white/40" />
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <h4 className="font-medium text-white text-sm truncate">{book.title}</h4>
                    {book.author && (
                      <p className="text-white/50 text-xs truncate mt-1">{book.author}</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full mt-2 border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        purchaseMutation.mutate({ bookId: book.id });
                      }}
                      disabled={purchaseMutation.isPending}
                      data-testid={`button-add-book-${book.id}`}
                    >
                      {purchaseMutation.isPending && purchaseMutation.variables?.bookId === book.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-1" />
                          Add to Library
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : catalogQuery.isError ? (
            <div className="text-center py-12 text-white/40">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>Failed to load catalog</p>
            </div>
          ) : (
            <div className="text-center py-12 text-white/40">
              <Book className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p>No books found matching your search</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </MotionDiv>
  );
}
