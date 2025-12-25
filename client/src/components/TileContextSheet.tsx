import { useState, useEffect, useRef, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  X, Star, Folder, FolderPlus, Check, ChevronRight, ChevronDown,
  Download, Trash2, Share2, Pin, History, Shield, Flag, Settings,
  LayoutGrid, ExternalLink, Info, User, Globe, Mail
} from 'lucide-react';
import { TileRef, Folder as FolderType } from '@/lib/hubLayout';
import { P3, type AppManifest, type MenuAction } from '@/lib/sdk';

interface TileContextSheetProps {
  isOpen: boolean;
  onClose: () => void;
  tile: TileRef | null;
  tileIcon?: ReactNode;
  gradient?: string;
  isFavorite: boolean;
  isInstalled?: boolean;
  folders: FolderType[];
  currentFolderId?: string | null;
  onToggleFavorite: () => void;
  onAddToFolder: (folderId: string) => void;
  onRemoveFromFolder: (folderId: string) => void;
  onCreateFolder: (name: string) => void;
  onInstallChange?: () => void;
  onPinToHome?: () => void;
  onOpenAnchorLog?: () => void;
}

type ExpandedSection = 'folders' | 'widgets' | 'info' | 'reviews' | 'devActions' | null;

export function TileContextSheet({
  isOpen,
  onClose,
  tile,
  tileIcon,
  gradient = 'from-purple-500 to-indigo-600',
  isFavorite,
  isInstalled: propIsInstalled,
  folders,
  currentFolderId,
  onToggleFavorite,
  onAddToFolder,
  onRemoveFromFolder,
  onCreateFolder,
  onInstallChange,
  onPinToHome,
  onOpenAnchorLog,
}: TileContextSheetProps) {
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [expandedSection, setExpandedSection] = useState<ExpandedSection>(null);
  const [manifest, setManifest] = useState<AppManifest | null>(null);
  const [isInstalled, setIsInstalled] = useState(propIsInstalled ?? false);
  const [widgets, setWidgets] = useState<AppManifest['widgets']>([]);
  const [devActions, setDevActions] = useState<MenuAction[]>([]);
  const [reviewStats, setReviewStats] = useState({ avg: 0, count: 0 });
  const [reviews, setReviews] = useState<any[]>([]);
  const [reportReason, setReportReason] = useState('');
  const [showReportInput, setShowReportInput] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && tile) {
      (async () => {
        const m = await P3.Apps.getManifest(tile.appId);
        setManifest(m);
        
        const installed = await P3.Apps.isInstalled(tile.appId);
        setIsInstalled(installed);
        
        const w = await P3.Apps.widgets(tile.appId);
        setWidgets(w);
        
        const actions = P3.Menu.list(tile.appId);
        setDevActions(actions);
        
        const stats = await P3.Reviews.stats(tile.appId);
        setReviewStats(stats);
        
        const revList = await P3.Reviews.list(tile.appId);
        setReviews(revList.slice(0, 5));
      })();
    }
  }, [isOpen, tile]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setShowNewFolder(false);
      setNewFolderName('');
      setExpandedSection(null);
      setShowReportInput(false);
      setReportReason('');
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (showNewFolder && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showNewFolder]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const handleCreateFolder = () => {
    if (newFolderName.trim()) {
      onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowNewFolder(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateFolder();
    }
  };

  const toggleSection = (section: ExpandedSection) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const handleInstall = async () => {
    if (!tile) return;
    if (isInstalled) {
      await P3.Apps.uninstall(tile.appId);
      setIsInstalled(false);
    } else {
      await P3.Apps.install(tile.appId);
      setIsInstalled(true);
    }
    onInstallChange?.();
  };

  const handleShare = async () => {
    if (!tile) return;
    const url = manifest?.links?.pwa || `${location.origin}/standalone/${tile.appId}/`;
    const title = manifest?.title || tile.title;
    
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
      }
    } else {
      await navigator.clipboard.writeText(url);
    }
    onClose();
  };

  const handlePinToHome = () => {
    if (onPinToHome) {
      onPinToHome();
    } else if (tile) {
      P3.Apps.addPin(tile.appId);
    }
    onClose();
  };

  const handleAnchorLog = () => {
    if (onOpenAnchorLog) {
      onOpenAnchorLog();
    } else if (tile) {
      window.open(`/explorer/app/${tile.appId}`, '_blank', 'noopener');
    }
    onClose();
  };

  const handleReport = async () => {
    if (!tile || !reportReason.trim()) return;
    
    const report = { appId: tile.appId, reason: reportReason.trim(), ts: Date.now() };
    const existing = JSON.parse(localStorage.getItem('p3:reports') || '[]');
    localStorage.setItem('p3:reports', JSON.stringify([report, ...existing]));
    
    try {
      await P3.proofs.publish('app_report', { 
        appId: tile.appId, 
        reason: reportReason.trim(),
        privacy: 'hash-only'
      });
    } catch {
    }
    
    setShowReportInput(false);
    setReportReason('');
    onClose();
  };

  const handleDevAction = async (action: MenuAction) => {
    if (!tile) return;
    try {
      await action.run({ appId: tile.appId, manifest });
    } catch (e) {
      console.error('Dev action failed:', e);
    }
  };

  const handleAddWidget = (widget: NonNullable<AppManifest['widgets']>[0]) => {
    if ((window as any).P3Widgets?.add) {
      (window as any).P3Widgets.add(widget);
    }
    onClose();
  };

  if (!isOpen || !tile) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        data-testid="context-sheet-backdrop"
      />
      
      <div 
        ref={sheetRef}
        className="relative w-full max-w-md mx-4 mb-4 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 max-h-[80vh] overflow-y-auto"
        style={{
          background: 'rgba(20, 20, 20, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        data-testid="tile-context-sheet"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-inherit">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
              <div className="w-5 h-5 text-white">
                {tileIcon}
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{tile.title}</h3>
              <p className="text-[11px] text-slate-400 capitalize">{tile.category}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
            data-testid="button-close-context-sheet"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-2 space-y-1">
          <button
            onClick={handleInstall}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
            data-testid="button-toggle-install"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isInstalled ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
              {isInstalled ? <Trash2 className="w-4 h-4 text-red-400" /> : <Download className="w-4 h-4 text-emerald-400" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                {isInstalled ? 'Uninstall' : 'Install'}
              </p>
              <p className="text-[11px] text-slate-500">
                {isInstalled ? 'Remove from installed apps' : 'Add to your installed apps'}
              </p>
            </div>
          </button>

          <button
            onClick={() => {
              onToggleFavorite();
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
            data-testid="button-toggle-favorite"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isFavorite ? 'bg-amber-500/20' : 'bg-white/10'}`}>
              <Star className={`w-4 h-4 ${isFavorite ? 'text-amber-400 fill-amber-400' : 'text-slate-400'}`} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">
                {isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              </p>
              <p className="text-[11px] text-slate-500">
                {isFavorite ? 'Remove from your favorites list' : 'Quick access from home screen'}
              </p>
            </div>
            {isFavorite && <Check className="w-4 h-4 text-amber-400" />}
          </button>

          <div className="my-1 h-px bg-white/5" />

          <button
            onClick={() => toggleSection('folders')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
            data-testid="button-show-folders"
          >
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Folder className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Add to Folder</p>
              <p className="text-[11px] text-slate-500">
                {folders.length > 0 
                  ? `${folders.length} folder${folders.length !== 1 ? 's' : ''} available`
                  : 'Organize apps into folders'}
              </p>
            </div>
            {expandedSection === 'folders' ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {expandedSection === 'folders' && (
            <div className="ml-4 pl-4 border-l border-white/10 space-y-1">
              {folders.map(folder => {
                const isInFolder = folder.id === currentFolderId;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      if (isInFolder) {
                        onRemoveFromFolder(folder.id);
                      } else {
                        onAddToFolder(folder.id);
                      }
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                    data-testid={`button-folder-${folder.id}`}
                  >
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center ${isInFolder ? 'bg-purple-500/20' : 'bg-white/10'}`}>
                      <Folder className={`w-3 h-3 ${isInFolder ? 'text-purple-400' : 'text-slate-400'}`} />
                    </div>
                    <span className="flex-1 text-sm text-white">{folder.name}</span>
                    {isInFolder && <Check className="w-3.5 h-3.5 text-purple-400" />}
                  </button>
                );
              })}

              {!showNewFolder ? (
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                  data-testid="button-new-folder"
                >
                  <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                    <FolderPlus className="w-3 h-3 text-emerald-400" />
                  </div>
                  <span className="text-sm text-emerald-400">Create New Folder</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 px-1 py-1">
                  <Input
                    ref={inputRef}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Folder name..."
                    className="flex-1 h-8 bg-white/5 border-white/10 text-white text-sm placeholder:text-slate-500 focus:border-purple-500/50"
                    data-testid="input-new-folder-name"
                  />
                  <Button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    size="sm"
                    className="h-8 bg-emerald-600 hover:bg-emerald-500 text-white px-2"
                    data-testid="button-create-folder"
                  >
                    <FolderPlus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {widgets && widgets.length > 0 && (
            <>
              <button
                onClick={() => toggleSection('widgets')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                data-testid="button-show-widgets"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <LayoutGrid className="w-4 h-4 text-cyan-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">View Widgets</p>
                  <p className="text-[11px] text-slate-500">{widgets.length} widget{widgets.length !== 1 ? 's' : ''} available</p>
                </div>
                {expandedSection === 'widgets' ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
              </button>

              {expandedSection === 'widgets' && (
                <div className="ml-4 pl-4 border-l border-white/10 space-y-1">
                  {widgets.map(w => (
                    <div key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
                      <div className="flex-1">
                        <p className="text-sm text-white">{w.title}</p>
                        <p className="text-[10px] text-slate-500">{w.size}</p>
                      </div>
                      <Button
                        onClick={() => handleAddWidget(w)}
                        size="sm"
                        className="h-7 bg-cyan-600 hover:bg-cyan-500 text-white text-xs px-2"
                      >
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <div className="my-1 h-px bg-white/5" />

          <button
            onClick={() => toggleSection('info')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
            data-testid="button-show-info"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <Info className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Info & Manifest</p>
              <p className="text-[11px] text-slate-500">View app details and permissions</p>
            </div>
            {expandedSection === 'info' ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {expandedSection === 'info' && manifest && (
            <div className="ml-4 pl-4 border-l border-white/10 space-y-2 py-2">
              {manifest.description && (
                <p className="text-xs text-slate-400">{manifest.description}</p>
              )}
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                {manifest.version && (
                  <div>
                    <span className="text-slate-500">Version:</span>
                    <span className="text-white ml-1">{manifest.version}</span>
                  </div>
                )}
                {manifest.developer?.name && (
                  <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-500" />
                    <span className="text-white">{manifest.developer.name}</span>
                  </div>
                )}
              </div>

              {manifest.developer?.website && (
                <a 
                  href={manifest.developer.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  <Globe className="w-3 h-3" />
                  <span>Website</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}

              {manifest.developer?.contact && (
                <a 
                  href={manifest.developer.contact}
                  className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
                >
                  <Mail className="w-3 h-3" />
                  <span>Contact</span>
                </a>
              )}

              {manifest.permissions && manifest.permissions.length > 0 && (
                <div className="mt-2">
                  <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                    <Shield className="w-3 h-3" />
                    <span>Permissions:</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {manifest.permissions.map(p => (
                      <span key={p} className="px-2 py-0.5 rounded-full bg-white/10 text-[10px] text-slate-300">
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => toggleSection('reviews')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
            data-testid="button-show-reviews"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
              <Star className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Reviews</p>
              <p className="text-[11px] text-slate-500">
                {reviewStats.count > 0 
                  ? `${reviewStats.count} reviews • ${reviewStats.avg} avg`
                  : 'No reviews yet'}
              </p>
            </div>
            {expandedSection === 'reviews' ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {expandedSection === 'reviews' && (
            <div className="ml-4 pl-4 border-l border-white/10 space-y-2 py-2">
              <Button
                onClick={async () => {
                  const rating = prompt('Rating (1-5):');
                  if (!rating) return;
                  const num = parseInt(rating);
                  if (isNaN(num) || num < 1 || num > 5) return;
                  const text = prompt('Optional review text:') || undefined;
                  await P3.Reviews.add(tile.appId, num, text);
                  const stats = await P3.Reviews.stats(tile.appId);
                  setReviewStats(stats);
                  const list = await P3.Reviews.list(tile.appId);
                  setReviews(list.slice(0, 5));
                }}
                size="sm"
                className="h-7 bg-amber-600 hover:bg-amber-500 text-white text-xs"
              >
                Leave a Review
              </Button>

              {reviews.length > 0 ? (
                <div className="space-y-2">
                  {reviews.map(r => (
                    <div key={r.id} className="p-2 rounded-lg bg-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-amber-400 text-xs">{'★'.repeat(r.rating)}</span>
                        <span className="text-[10px] text-slate-500">
                          {r.address.slice(0, 6)}…{r.address.slice(-4)}
                        </span>
                      </div>
                      {r.text && <p className="text-xs text-slate-300 mt-1">{r.text}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No reviews yet. Be the first!</p>
              )}
            </div>
          )}

          <div className="my-1 h-px bg-white/5" />

          <button
            onClick={handleShare}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
            data-testid="button-share"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Share</p>
              <p className="text-[11px] text-slate-500">Share this app with others</p>
            </div>
          </button>

          <button
            onClick={handlePinToHome}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
            data-testid="button-pin"
          >
            <div className="w-8 h-8 rounded-lg bg-pink-500/20 flex items-center justify-center">
              <Pin className="w-4 h-4 text-pink-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Pin to Home</p>
              <p className="text-[11px] text-slate-500">Quick access from home screen</p>
            </div>
          </button>

          <button
            onClick={handleAnchorLog}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
            data-testid="button-anchor-log"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <History className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-white">Anchor Log</p>
              <p className="text-[11px] text-slate-500">View blockchain activity</p>
            </div>
          </button>

          <div className="my-1 h-px bg-white/5" />

          {!showReportInput ? (
            <button
              onClick={() => setShowReportInput(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
              data-testid="button-report"
            >
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Flag className="w-4 h-4 text-red-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Report App</p>
                <p className="text-[11px] text-slate-500">Flag for review</p>
              </div>
            </button>
          ) : (
            <div className="px-4 py-2 space-y-2">
              <Input
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Reason for reporting..."
                className="h-9 bg-white/5 border-white/10 text-white text-sm placeholder:text-slate-500 focus:border-red-500/50"
                data-testid="input-report-reason"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleReport}
                  disabled={!reportReason.trim()}
                  size="sm"
                  className="h-8 bg-red-600 hover:bg-red-500 text-white"
                >
                  Submit Report
                </Button>
                <Button
                  onClick={() => {
                    setShowReportInput(false);
                    setReportReason('');
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-8 text-slate-400 hover:text-white"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {devActions.length > 0 && (
            <>
              <div className="my-1 h-px bg-white/5" />
              
              <button
                onClick={() => toggleSection('devActions')}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                data-testid="button-show-dev-actions"
              >
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-violet-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Developer Actions</p>
                  <p className="text-[11px] text-slate-500">{devActions.length} custom action{devActions.length !== 1 ? 's' : ''}</p>
                </div>
                {expandedSection === 'devActions' ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronRight className="w-4 h-4 text-slate-500" />}
              </button>

              {expandedSection === 'devActions' && (
                <div className="ml-4 pl-4 border-l border-white/10 space-y-1">
                  {devActions.map(action => (
                    <button
                      key={action.id}
                      onClick={() => handleDevAction(action)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                    >
                      <span className="text-sm text-white">{action.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-3 pt-1 border-t border-white/5">
          <p className="text-[10px] text-center text-slate-600">
            Long-press any app to access these options
          </p>
        </div>
      </div>
    </div>
  );
}
