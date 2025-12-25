import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  FolderOpen, File, Plus, Trash2, Edit2, Search, ChevronRight,
  Home, Folder, FileText, Image, Video, Music, Archive, Database,
  Loader2, AlertCircle, RefreshCw, ArrowUp
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type FileType = 'document' | 'image' | 'video' | 'audio' | 'archive' | 'data' | 'other';

interface FileEntry {
  id: string;
  name: string;
  type: FileType;
  mime: string;
  sizeBytes: number;
  storageRef: string | null;
  storageProvider: string;
  parentId: string | null;
  isFolder: boolean;
  tags: string[] | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

interface EntriesResponse {
  entries: FileEntry[];
  pagination: { offset: number; limit: number; total: number };
  stats: { totalFiles: number; totalFolders: number; totalSize: number };
}

interface Breadcrumb {
  id: string;
  name: string;
}

const TYPE_ICONS: Record<FileType, any> = {
  document: FileText,
  image: Image,
  video: Video,
  audio: Music,
  archive: Archive,
  data: Database,
  other: File,
};

const TYPE_COLORS: Record<FileType, string> = {
  document: 'text-blue-400',
  image: 'text-green-400',
  video: 'text-purple-400',
  audio: 'text-pink-400',
  archive: 'text-amber-400',
  data: 'text-cyan-400',
  other: 'text-gray-400',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default function FileHubMode() {
  const wallet = useAtlasStore(s => s.wallet);
  const pushReceipt = useAtlasStore(s => s.pushReceipt);
  const { toast } = useToast();
  
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingEntry, setEditingEntry] = useState<FileEntry | null>(null);
  const [editName, setEditName] = useState('');

  const entriesQueryKey = currentFolderId 
    ? `/api/file-hub?parentId=${currentFolderId}` 
    : '/api/file-hub';
  
  const entriesQuery = useQuery<EntriesResponse>({
    queryKey: [entriesQueryKey],
    enabled: !!wallet,
  });

  const breadcrumbsQuery = useQuery<{ breadcrumbs: Breadcrumb[] }>({
    queryKey: [`/api/file-hub/${currentFolderId}/breadcrumbs`],
    enabled: !!wallet && !!currentFolderId,
  });

  const searchMutation = useMutation({
    mutationFn: async (query: string) => {
      return apiRequest(`/api/file-hub/search/query?q=${encodeURIComponent(query)}`);
    },
  });

  const createFolderMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest('/api/file-hub/folder', {
        method: 'POST',
        body: JSON.stringify({ name, parentId: currentFolderId }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [entriesQueryKey] });
      if (data.receipt) pushReceipt(data.receipt);
      setShowNewFolder(false);
      setNewFolderName('');
      toast({ title: 'Folder created', description: `Created folder "${data.folder.name}"` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest(`/api/file-hub/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [entriesQueryKey] });
      if (data.receipt) pushReceipt(data.receipt);
      setEditingEntry(null);
      setEditName('');
      toast({ title: 'Renamed', description: `Renamed to "${data.entry.name}"` });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/file-hub/${id}`, { method: 'DELETE' });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [entriesQueryKey] });
      if (data.receipt) pushReceipt(data.receipt);
      toast({ title: 'Deleted', description: 'Entry deleted successfully' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) {
      searchMutation.mutate(searchQuery.trim());
    }
  };

  const handleNavigate = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearchQuery('');
    searchMutation.reset();
  };

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.isFolder) {
      handleNavigate(entry.id);
    }
  };

  if (!wallet) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center" data-testid="filehub-no-wallet">
        <FolderOpen className="w-16 h-16 text-gray-500 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Connect Wallet</h2>
        <p className="text-gray-400">Connect your wallet to access File Hub</p>
      </div>
    );
  }

  const entries = searchMutation.data?.entries || entriesQuery.data?.entries || [];
  const stats = entriesQuery.data?.stats;
  const breadcrumbs = breadcrumbsQuery.data?.breadcrumbs || [];
  const isSearching = searchMutation.isPending || !!searchMutation.data;

  return (
    <div className="space-y-4" data-testid="filehub-mode">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="w-6 h-6 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">File Hub</h1>
        </div>
        <div className="flex items-center gap-2">
          {stats && (
            <div className="text-sm text-gray-400 mr-4">
              {stats.totalFiles} files, {stats.totalFolders} folders ({formatBytes(stats.totalSize)})
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewFolder(true)}
            data-testid="button-new-folder"
          >
            <Plus className="w-4 h-4 mr-1" />
            New Folder
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => entriesQuery.refetch()}
            data-testid="button-refresh-files"
          >
            <RefreshCw className={`w-4 h-4 ${entriesQuery.isRefetching ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search files and folders..."
            className="pl-10 bg-gray-800/50 border-gray-700"
            data-testid="input-search-files"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSearch} data-testid="button-search">
          Search
        </Button>
        {isSearching && (
          <Button variant="ghost" size="sm" onClick={() => { searchMutation.reset(); setSearchQuery(''); }}>
            Clear
          </Button>
        )}
      </div>

      <div className="flex items-center gap-1 text-sm bg-gray-800/30 rounded-lg p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleNavigate(null)}
          className="h-6 px-2"
          data-testid="button-nav-home"
        >
          <Home className="w-4 h-4" />
        </Button>
        {breadcrumbs.map((crumb) => (
          <div key={crumb.id} className="flex items-center">
            <ChevronRight className="w-4 h-4 text-gray-500" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigate(crumb.id)}
              className="h-6 px-2 text-gray-300"
            >
              {crumb.name}
            </Button>
          </div>
        ))}
        {currentFolderId && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleNavigate(breadcrumbs.length > 1 ? breadcrumbs[breadcrumbs.length - 2].id : null)}
            className="ml-auto h-6 px-2"
            data-testid="button-nav-up"
          >
            <ArrowUp className="w-4 h-4 mr-1" />
            Up
          </Button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {showNewFolder && (
          <MotionDiv
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700"
          >
            <Folder className="w-5 h-5 text-amber-400" />
            <Input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="flex-1 bg-gray-700/50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && newFolderName.trim() && createFolderMutation.mutate(newFolderName.trim())}
              data-testid="input-new-folder-name"
            />
            <Button
              size="sm"
              onClick={() => newFolderName.trim() && createFolderMutation.mutate(newFolderName.trim())}
              disabled={!newFolderName.trim() || createFolderMutation.isPending}
              data-testid="button-create-folder"
            >
              {createFolderMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowNewFolder(false); setNewFolderName(''); }}>
              Cancel
            </Button>
          </MotionDiv>
        )}
      </AnimatePresence>

      {entriesQuery.isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : entriesQuery.isError ? (
        <div className="flex items-center justify-center py-12 text-red-400">
          <AlertCircle className="w-6 h-6 mr-2" />
          Failed to load files
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-400" data-testid="filehub-empty">
          <FolderOpen className="w-16 h-16 mb-4 opacity-50" />
          <p>{isSearching ? 'No files match your search' : 'This folder is empty'}</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {entries.map((entry: FileEntry) => {
            const Icon = entry.isFolder ? Folder : TYPE_ICONS[entry.type as FileType] || File;
            const colorClass = entry.isFolder ? 'text-amber-400' : TYPE_COLORS[entry.type as FileType] || 'text-gray-400';
            
            return (
              <MotionDiv
                key={entry.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="group flex items-center gap-3 p-3 bg-gray-800/30 hover:bg-gray-800/50 rounded-lg border border-gray-700/50 cursor-pointer transition-colors"
                onClick={() => handleEntryClick(entry)}
                data-testid={`entry-${entry.id}`}
              >
                <Icon className={`w-5 h-5 ${colorClass}`} />
                
                {editingEntry?.id === entry.id ? (
                  <div className="flex-1 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 h-8 bg-gray-700/50"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editName.trim()) {
                          updateEntryMutation.mutate({ id: entry.id, name: editName.trim() });
                        } else if (e.key === 'Escape') {
                          setEditingEntry(null);
                          setEditName('');
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => editName.trim() && updateEntryMutation.mutate({ id: entry.id, name: editName.trim() })}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white truncate">{entry.name}</div>
                      <div className="text-xs text-gray-500">
                        {entry.isFolder ? 'Folder' : formatBytes(entry.sizeBytes)} · {formatTimeAgo(entry.updatedAt)}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditingEntry(entry);
                          setEditName(entry.name);
                        }}
                        data-testid={`button-edit-${entry.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-300"
                        onClick={() => {
                          if (confirm(`Delete "${entry.name}"?`)) {
                            deleteEntryMutation.mutate(entry.id);
                          }
                        }}
                        data-testid={`button-delete-${entry.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </>
                )}
              </MotionDiv>
            );
          })}
        </div>
      )}
    </div>
  );
}
