import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useParams, useSearch } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Palette,
  Download,
  Loader2,
  Shield,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Info,
  X,
  User,
  Calendar,
  Layers,
  Hash,
  FileType,
  Lock,
  Move,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { P3Marketplace, type Asset, type License, type DownloadResult } from '@/lib/sdk/marketplace';

const sdk = new P3Marketplace();

type LicenseState = 'verifying' | 'valid' | 'invalid' | 'expired';

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatFileSize(bytes?: number) {
  if (!bytes) return 'Unknown';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ArtViewer() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const searchParams = new URLSearchParams(useSearch());
  const licenseId = searchParams.get('license');
  const { toast } = useToast();

  const [licenseState, setLicenseState] = useState<LicenseState>('verifying');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const { data: artwork, isLoading: isLoadingArtwork } = useQuery<Asset>({
    queryKey: ['/api/marketplace/catalog', params.id],
    enabled: !!params.id,
  });

  const { data: license, isLoading: isLoadingLicense } = useQuery<License & { editionNumber?: number }>({
    queryKey: ['/api/marketplace/gate/license', licenseId],
    enabled: !!licenseId,
  });

  const downloadMutation = useMutation({
    mutationFn: async () => {
      if (!licenseId || !license) throw new Error('No valid license');
      const result = await sdk.art.downloadHighRes(licenseId, 'token');
      return result;
    },
    onSuccess: (result: DownloadResult) => {
      setDownloadUrl(result.signedUrl);
      toast({
        title: 'Download Ready',
        description: 'Your high-resolution file is ready to download.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Download Failed',
        description: error.message || 'Unable to prepare download.',
      });
    },
  });

  useEffect(() => {
    if (!licenseId) {
      setLicenseState('invalid');
      return;
    }

    if (isLoadingLicense) {
      setLicenseState('verifying');
      return;
    }

    if (!license) {
      setLicenseState('invalid');
      return;
    }

    if (license.status === 'expired') {
      setLicenseState('expired');
      return;
    }

    if (license.status === 'revoked') {
      setLicenseState('invalid');
      return;
    }

    if (license.expiresAt && new Date(license.expiresAt) < new Date()) {
      setLicenseState('expired');
      return;
    }

    setLicenseState('valid');
  }, [license, licenseId, isLoadingLicense]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev * 1.5, 5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev / 1.5, 0.5));
  }, []);

  const handleFitToScreen = useCallback(() => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  }, [zoom, position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  }, [isDragging, dragStart, zoom]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      handleZoomIn();
    } else {
      handleZoomOut();
    }
  }, [handleZoomIn, handleZoomOut]);

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!document.fullscreenElement) {
        await container.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error('Fullscreen error:', err);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    } else {
      downloadMutation.mutate();
    }
  };

  if (licenseState === 'verifying' || isLoadingArtwork) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-purple-400 animate-pulse" />
          </div>
          <h2 data-testid="text-verifying" className="text-xl font-semibold text-white mb-2">
            Verifying License
          </h2>
          <p className="text-slate-400 mb-4">
            Checking your ownership rights on the protocol...
          </p>
          <Loader2 className="w-6 h-6 text-purple-400 animate-spin mx-auto" />
        </Card>
      </div>
    );
  }

  if (licenseState === 'invalid') {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8 text-red-400" />
          </div>
          <h2 data-testid="text-invalid" className="text-xl font-semibold text-white mb-2">
            Invalid License
          </h2>
          <p className="text-slate-400 mb-6">
            You don't have a valid license to view this artwork. Please purchase it first.
          </p>
          <Button
            data-testid="button-go-artwork"
            onClick={() => setLocation(`/marketplace/art/${params.id}`)}
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            Go to Artwork
          </Button>
        </Card>
      </div>
    );
  }

  if (licenseState === 'expired') {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-amber-400" />
          </div>
          <h2 data-testid="text-expired" className="text-xl font-semibold text-white mb-2">
            License Expired
          </h2>
          <p className="text-slate-400 mb-6">
            Your viewing license has expired. Please renew to continue viewing.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              data-testid="button-renew"
              onClick={() => setLocation(`/marketplace/art/${params.id}`)}
              className="bg-gradient-to-r from-purple-600 to-pink-600"
            >
              Renew License
            </Button>
            <Button
              data-testid="button-back-gallery"
              variant="outline"
              onClick={() => setLocation('/marketplace/art')}
              className="border-white/10 text-white hover:bg-white/5"
            >
              Back to Gallery
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`min-h-screen bg-black flex flex-col ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}
    >
      <header className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-4 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-4">
          <Button
            data-testid="button-back"
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/marketplace/art/${params.id}`)}
            className="text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 data-testid="text-title" className="text-lg font-semibold text-white">
              {artwork?.title || 'Loading...'}
            </h1>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-0 text-xs">
                <ShieldCheck className="w-3 h-3 mr-1" />
                Licensed View
              </Badge>
              {license?.editionNumber && (
                <Badge variant="secondary" className="bg-purple-500/20 text-purple-400 border-0 text-xs">
                  <Layers className="w-3 h-3 mr-1" />
                  Edition #{license.editionNumber}
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            data-testid="button-info"
            variant="ghost"
            size="icon"
            onClick={() => setShowInfo(!showInfo)}
            className={`${showInfo ? 'text-purple-400' : 'text-white'} hover:bg-white/10`}
          >
            <Info className="w-5 h-5" />
          </Button>
          <Button
            data-testid="button-download"
            variant="ghost"
            size="icon"
            onClick={handleDownload}
            disabled={downloadMutation.isPending}
            className="text-white hover:bg-white/10"
          >
            {downloadMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
          </Button>
        </div>
      </header>

      {showInfo && artwork && (
        <div className="absolute top-20 right-6 z-30 w-80">
          <Card className="bg-[#1a1a1a]/95 backdrop-blur-xl border-white/10">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Artwork Info</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowInfo(false)}
                  className="text-slate-400 hover:text-white hover:bg-white/10 h-8 w-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="text-slate-400">Artist</p>
                    <p className="text-white font-mono text-xs">
                      {artwork.authorWallet.slice(0, 10)}...{artwork.authorWallet.slice(-8)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="text-slate-400">Created</p>
                    <p className="text-white">{formatDate(artwork.createdAt)}</p>
                  </div>
                </div>
                {artwork.editionTotal && (
                  <div className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <div>
                      <p className="text-slate-400">Edition</p>
                      <p className="text-white">
                        #{license?.editionNumber || '?'} of {artwork.editionTotal}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <Hash className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="text-slate-400">Asset ID</p>
                    <p className="text-white font-mono text-xs">{artwork.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <FileType className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="text-slate-400">File Size</p>
                    <p className="text-white">{formatFileSize(artwork.filesize)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Lock className="w-4 h-4 text-purple-400" />
                  <div>
                    <p className="text-slate-400">Encryption</p>
                    <p className="text-white">{artwork.encryptionAlg || 'AES-256-GCM'}</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <main
        className="flex-1 flex items-center justify-center relative overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
      >
        {artwork?.coverUrl ? (
          <img
            ref={imageRef}
            src={artwork.previewUrl || artwork.coverUrl}
            alt={artwork.title}
            data-testid="img-viewer"
            className="max-w-full max-h-full object-contain transition-transform duration-200"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transformOrigin: 'center',
            }}
            draggable={false}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Palette className="w-32 h-32 text-purple-400" />
          </div>
        )}

        {zoom > 1 && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 rounded-full bg-black/60 backdrop-blur-sm border border-white/10">
            <Move className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-300">Drag to pan</span>
          </div>
        )}
      </main>

      <footer className="absolute bottom-0 left-0 right-0 z-20 px-6 pb-6 pt-16 bg-gradient-to-t from-black/80 to-transparent">
        <div className="flex items-center justify-center gap-4">
          <Button
            data-testid="button-zoom-out"
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="text-white hover:bg-white/10 disabled:opacity-50"
          >
            <ZoomOut className="w-5 h-5" />
          </Button>

          <div className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-medium min-w-[80px] text-center">
            {Math.round(zoom * 100)}%
          </div>

          <Button
            data-testid="button-zoom-in"
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= 5}
            className="text-white hover:bg-white/10 disabled:opacity-50"
          >
            <ZoomIn className="w-5 h-5" />
          </Button>

          <div className="w-px h-6 bg-white/20 mx-2" />

          <Button
            data-testid="button-fit"
            variant="ghost"
            size="icon"
            onClick={handleFitToScreen}
            className="text-white hover:bg-white/10"
          >
            <RotateCcw className="w-5 h-5" />
          </Button>

          <Button
            data-testid="button-fullscreen"
            variant="ghost"
            size="icon"
            onClick={toggleFullscreen}
            className="text-white hover:bg-white/10"
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </Button>
        </div>
      </footer>
    </div>
  );
}
