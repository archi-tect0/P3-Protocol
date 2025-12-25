import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  X,
  Star,
  Share2,
  ExternalLink,
  ShoppingCart,
  Heart,
  Bookmark,
  User,
  DollarSign,
  Play,
  Download,
  Eye,
  Music,
  Video,
  Palette,
  BookOpen,
  Flag,
  Copy,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { type Asset } from '@/lib/sdk/marketplace';

export type AssetType = 'track' | 'album' | 'video' | 'art' | 'ebook';

interface MarketplaceContextSheetProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  assetType: AssetType;
  onNavigate: (assetId: string) => void;
  onBuy?: (asset: Asset) => void;
}

function getAssetIcon(type: AssetType) {
  switch (type) {
    case 'track':
    case 'album':
      return <Music className="w-5 h-5" />;
    case 'video':
      return <Video className="w-5 h-5" />;
    case 'art':
      return <Palette className="w-5 h-5" />;
    case 'ebook':
      return <BookOpen className="w-5 h-5" />;
    default:
      return <Star className="w-5 h-5" />;
  }
}

function getGradientForType(type: AssetType): string {
  switch (type) {
    case 'track':
    case 'album':
      return 'from-cyan-500 to-purple-600';
    case 'video':
      return 'from-rose-500 to-orange-600';
    case 'art':
      return 'from-purple-500 to-pink-600';
    case 'ebook':
      return 'from-purple-500 to-indigo-600';
    default:
      return 'from-purple-500 to-indigo-600';
  }
}

function getStatLabel(type: AssetType): string {
  switch (type) {
    case 'track':
    case 'album':
      return 'streams';
    case 'video':
      return 'views';
    case 'art':
    case 'ebook':
      return 'downloads';
    default:
      return 'downloads';
  }
}

function getStatIcon(type: AssetType) {
  switch (type) {
    case 'track':
    case 'album':
      return <Play className="w-3 h-3" />;
    case 'video':
      return <Eye className="w-3 h-3" />;
    case 'art':
    case 'ebook':
      return <Download className="w-3 h-3" />;
    default:
      return <Download className="w-3 h-3" />;
  }
}

export function MarketplaceContextSheet({
  isOpen,
  onClose,
  asset,
  assetType,
  onNavigate,
  onBuy,
}: MarketplaceContextSheetProps) {
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (isOpen && asset) {
      const wishlisted = JSON.parse(localStorage.getItem('p3:wishlist') || '[]');
      const bookmarked = JSON.parse(localStorage.getItem('p3:bookmarks') || '[]');
      setIsWishlisted(wishlisted.includes(asset.id));
      setIsBookmarked(bookmarked.includes(asset.id));
    }
  }, [isOpen, asset]);

  const handleShare = async () => {
    if (!asset) return;
    const url = `${location.origin}/marketplace/${assetType}/${asset.id}`;
    const title = asset.title;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
    }
    onClose();
  };

  const handleCopyLink = async () => {
    if (!asset) return;
    const url = `${location.origin}/marketplace/${assetType}/${asset.id}`;
    await navigator.clipboard.writeText(url);
    onClose();
  };

  const handleToggleWishlist = () => {
    if (!asset) return;
    const wishlisted = JSON.parse(localStorage.getItem('p3:wishlist') || '[]');
    let updated;
    if (isWishlisted) {
      updated = wishlisted.filter((id: string) => id !== asset.id);
    } else {
      updated = [asset.id, ...wishlisted];
    }
    localStorage.setItem('p3:wishlist', JSON.stringify(updated));
    setIsWishlisted(!isWishlisted);
  };

  const handleToggleBookmark = () => {
    if (!asset) return;
    const bookmarked = JSON.parse(localStorage.getItem('p3:bookmarks') || '[]');
    let updated;
    if (isBookmarked) {
      updated = bookmarked.filter((id: string) => id !== asset.id);
    } else {
      updated = [asset.id, ...bookmarked];
    }
    localStorage.setItem('p3:bookmarks', JSON.stringify(updated));
    setIsBookmarked(!isBookmarked);
  };

  const handleViewDetails = () => {
    if (!asset) return;
    onNavigate(asset.id);
    onClose();
  };

  const handleBuy = () => {
    if (!asset) return;
    if (onBuy) {
      onBuy(asset);
    } else {
      onNavigate(asset.id);
    }
    onClose();
  };

  const handleReport = () => {
    if (!asset) return;
    const reason = prompt('Report reason:');
    if (!reason?.trim()) return;

    const reports = JSON.parse(localStorage.getItem('p3:asset_reports') || '[]');
    reports.push({
      assetId: asset.id,
      assetType,
      reason: reason.trim(),
      ts: Date.now(),
    });
    localStorage.setItem('p3:asset_reports', JSON.stringify(reports));
    onClose();
  };

  if (!isOpen || !asset) return null;

  const gradient = getGradientForType(assetType);
  const statCount = asset.totalStreams || asset.totalDownloads || 0;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        data-testid="marketplace-context-backdrop"
      />

      <div
        ref={sheetRef}
        className="relative w-full max-w-md mx-4 mb-4 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300 max-h-[80vh] overflow-y-auto"
        style={{
          background: 'rgba(20, 20, 20, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        data-testid="marketplace-context-sheet"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-white/10 bg-inherit">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg flex-shrink-0 overflow-hidden`}
            >
              {asset.coverUrl ? (
                <img
                  src={asset.coverUrl}
                  alt={asset.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-white">{getAssetIcon(assetType)}</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-white truncate">
                {asset.title}
              </h3>
              <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                <User className="w-3 h-3 flex-shrink-0" />
                {asset.authorWallet.slice(0, 6)}...{asset.authorWallet.slice(-4)}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10 flex-shrink-0"
            data-testid="button-close-marketplace-context"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 mb-3">
            <Badge
              variant="secondary"
              className="bg-green-500/20 text-green-300 border-0"
            >
              <DollarSign className="w-3 h-3 mr-0.5" />
              {asset.priceUsd}
            </Badge>
            {statCount > 0 && (
              <Badge
                variant="secondary"
                className="bg-white/10 text-slate-300 border-0"
              >
                {getStatIcon(assetType)}
                <span className="ml-1">
                  {statCount.toLocaleString()} {getStatLabel(assetType)}
                </span>
              </Badge>
            )}
            {asset.tags && asset.tags.length > 0 && (
              <Badge
                variant="outline"
                className="text-xs border-white/10 text-slate-400"
              >
                {asset.tags[0]}
              </Badge>
            )}
          </div>
        </div>

        <div className="p-2 space-y-1">
          <button
            onClick={handleViewDetails}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left min-h-[52px]"
            data-testid="button-view-details"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br ${gradient}/20`}
            >
              <ExternalLink className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">View Details</p>
              <p className="text-[11px] text-slate-500">
                See full information and preview
              </p>
            </div>
          </button>

          <button
            onClick={handleBuy}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left min-h-[52px]"
            data-testid="button-buy"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                Buy for ${asset.priceUsd}
              </p>
              <p className="text-[11px] text-slate-500">
                Purchase and add to your collection
              </p>
            </div>
          </button>

          <div className="my-1 h-px bg-white/5" />

          <button
            onClick={handleToggleWishlist}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left min-h-[52px]"
            data-testid="button-toggle-wishlist"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isWishlisted ? 'bg-pink-500/20' : 'bg-white/10'
              }`}
            >
              <Heart
                className={`w-4 h-4 ${
                  isWishlisted ? 'text-pink-400 fill-pink-400' : 'text-slate-400'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                {isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
              </p>
              <p className="text-[11px] text-slate-500">
                {isWishlisted ? 'Remove from your wishlist' : 'Save for later purchase'}
              </p>
            </div>
          </button>

          <button
            onClick={handleToggleBookmark}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left min-h-[52px]"
            data-testid="button-toggle-bookmark"
          >
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isBookmarked ? 'bg-amber-500/20' : 'bg-white/10'
              }`}
            >
              <Bookmark
                className={`w-4 h-4 ${
                  isBookmarked ? 'text-amber-400 fill-amber-400' : 'text-slate-400'
                }`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">
                {isBookmarked ? 'Remove Bookmark' : 'Bookmark'}
              </p>
              <p className="text-[11px] text-slate-500">
                {isBookmarked ? 'Remove from bookmarks' : 'Quick access to this item'}
              </p>
            </div>
          </button>

          <div className="my-1 h-px bg-white/5" />

          <button
            onClick={handleShare}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left min-h-[52px]"
            data-testid="button-share"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
              <Share2 className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Share</p>
              <p className="text-[11px] text-slate-500">Share this with others</p>
            </div>
          </button>

          <button
            onClick={handleCopyLink}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left min-h-[52px]"
            data-testid="button-copy-link"
          >
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <Copy className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Copy Link</p>
              <p className="text-[11px] text-slate-500">Copy link to clipboard</p>
            </div>
          </button>

          <div className="my-1 h-px bg-white/5" />

          <button
            onClick={handleReport}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-left min-h-[52px]"
            data-testid="button-report"
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
              <Flag className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-red-400">Report</p>
              <p className="text-[11px] text-slate-500">Report inappropriate content</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MarketplaceContextSheet;
