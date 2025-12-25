import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Video,
  Play,
  Pause,
  User,
  DollarSign,
  Shield,
  Loader2,
  ExternalLink,
  Tag,
  Calendar,
  Eye,
  ShoppingCart,
  Share2,
  Check,
  Clock,
  Film,
  Tv,
  Timer,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { P3Marketplace, type Asset, type CheckoutResult, type BorrowResult, type StreamResult } from '@/lib/sdk/marketplace';
import { queryClient } from '@/lib/queryClient';

const sdk = new P3Marketplace();

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDuration(filesize?: number) {
  if (!filesize) return '--:--';
  const totalSeconds = Math.floor(filesize / 16000);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export default function VideoDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);

  const walletAddress = localStorage.getItem('walletAddress');

  const { data: video, isLoading } = useQuery<Asset>({
    queryKey: ['/api/marketplace/catalog', params.id],
    enabled: !!params.id,
  });

  const { data: viewStats } = useQuery<{ totalViews: number; rentals: number; purchases: number }>({
    queryKey: ['/api/marketplace/explorer/stats', params.id, 'video'],
    enabled: !!params.id,
  });

  const streamMutation = useMutation({
    mutationFn: async () => {
      return sdk.video.stream(params.id!);
    },
    onSuccess: (result: StreamResult) => {
      setLocation(`/marketplace/video/player/${params.id}?play=${result.playId}`);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Stream Failed',
        description: error.message || 'Unable to start streaming. Please try again.',
      });
    },
  });

  const rentMutation = useMutation({
    mutationFn: async (hours: number) => {
      return sdk.video.rent(params.id!, hours);
    },
    onSuccess: (result: BorrowResult) => {
      toast({
        title: 'Rental Successful!',
        description: `You can watch until ${new Date(result.expiresAt).toLocaleString()}`,
      });
      setLocation(`/marketplace/video/player/${params.id}?license=${result.licenseId}`);
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/catalog'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Rental Failed',
        description: error.message || 'Unable to complete rental. Please try again.',
      });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      return sdk.video.purchase(params.id!);
    },
    onSuccess: (result: CheckoutResult) => {
      toast({
        title: 'Purchase Successful!',
        description: result.existing
          ? 'You already own this video. Ready to watch!'
          : 'Your video is ready to stream.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/catalog'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Purchase Failed',
        description: error.message || 'Unable to complete purchase. Please try again.',
      });
    },
  });

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: 'Link Copied!',
        description: 'Share this video with others.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Unable to copy link.',
      });
    }
  };

  const handleWatch = () => {
    streamMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <Video className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Video Not Found</h2>
          <p className="text-slate-400 mb-6">
            This video may have been removed or doesn't exist.
          </p>
          <Button
            data-testid="button-back-catalog"
            onClick={() => setLocation('/marketplace/video')}
            className="bg-gradient-to-r from-rose-600 to-orange-600"
          >
            Back to Catalog
          </Button>
        </Card>
      </div>
    );
  }

  const isStreaming = streamMutation.isPending;
  const isRenting = rentMutation.isPending;
  const isPurchasing = purchaseMutation.isPending;
  const rentPrice = (parseFloat(video.priceUsd) * 0.3).toFixed(2);

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-rose-900/15 via-transparent to-orange-900/15 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center gap-4 mb-8">
          <Button
            data-testid="button-back"
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/marketplace/video')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm text-slate-400">Video Details</p>
          </div>
          <Button
            data-testid="button-share"
            variant="ghost"
            size="icon"
            onClick={handleShare}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            {copied ? (
              <Check className="w-5 h-5 text-green-400" />
            ) : (
              <Share2 className="w-5 h-5" />
            )}
          </Button>
        </header>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 overflow-hidden mb-6">
              <div className="aspect-video bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center relative group">
                {video.coverUrl ? (
                  <img
                    src={video.coverUrl}
                    alt={video.title}
                    className="w-full h-full object-cover"
                    data-testid="img-cover"
                  />
                ) : (
                  <Film className="w-24 h-24 text-rose-400" />
                )}
                {video.previewUrl ? (
                  <button
                    data-testid="button-play-trailer"
                    onClick={() => setIsPlayingPreview(!isPlayingPreview)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-20 h-20 rounded-full bg-rose-500 flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform shadow-lg shadow-rose-500/30">
                        {isPlayingPreview ? (
                          <Pause className="w-10 h-10 text-white" />
                        ) : (
                          <Play className="w-10 h-10 text-white fill-white ml-1" />
                        )}
                      </div>
                      <span className="text-white font-medium">Watch Trailer</span>
                    </div>
                  </button>
                ) : (
                  <button
                    data-testid="button-play-cover"
                    onClick={handleWatch}
                    disabled={isStreaming}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-wait"
                  >
                    <div className="w-20 h-20 rounded-full bg-rose-500 flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform shadow-lg shadow-rose-500/30">
                      {isStreaming ? (
                        <Loader2 className="w-10 h-10 text-white animate-spin" />
                      ) : (
                        <Play className="w-10 h-10 text-white fill-white ml-1" />
                      )}
                    </div>
                  </button>
                )}
                <div className="absolute bottom-4 left-4 flex gap-2">
                  <Badge variant="secondary" className="bg-black/70 text-white border-0">
                    <Clock className="w-3 h-3 mr-1" />
                    {formatDuration(video.filesize)}
                  </Badge>
                  {video.category && (
                    <Badge variant="secondary" className="bg-rose-500/70 text-white border-0">
                      {video.category}
                    </Badge>
                  )}
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <div>
                <Badge
                  variant="secondary"
                  className="bg-rose-500/20 text-rose-300 border-0 mb-3"
                >
                  <Film className="w-3 h-3 mr-1" />
                  Video
                </Badge>
                <h1
                  data-testid="text-title"
                  className="text-3xl font-bold text-white mb-4"
                >
                  {video.title}
                </h1>
                
                <div className="flex items-center gap-4 flex-wrap mb-6">
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="w-4 h-4" />
                    <span
                      data-testid="text-creator"
                      className="text-rose-300 font-medium"
                    >
                      {video.authorWallet.slice(0, 8)}...{video.authorWallet.slice(-6)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(video.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Eye className="w-4 h-4" />
                    <span data-testid="text-views">{formatNumber(video.totalStreams)} views</span>
                  </div>
                </div>

                {video.tags && video.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {video.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="border-white/10 text-slate-400"
                      >
                        <Tag className="w-3 h-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}

                {video.description && (
                  <Card className="bg-[#1a1a1a]/60 border-white/5">
                    <CardContent className="p-4">
                      <p
                        data-testid="text-description"
                        className="text-slate-300 leading-relaxed whitespace-pre-wrap"
                      >
                        {video.description}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <Card className="bg-[#1a1a1a]/60 border-white/5">
                  <CardContent className="p-4 text-center">
                    <Eye className="w-6 h-6 text-rose-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{formatNumber(viewStats?.totalViews || video.totalStreams)}</p>
                    <p className="text-sm text-slate-400">Total Views</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#1a1a1a]/60 border-white/5">
                  <CardContent className="p-4 text-center">
                    <Timer className="w-6 h-6 text-orange-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{formatNumber(viewStats?.rentals || 0)}</p>
                    <p className="text-sm text-slate-400">Rentals</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#1a1a1a]/60 border-white/5">
                  <CardContent className="p-4 text-center">
                    <ShoppingCart className="w-6 h-6 text-green-400 mx-auto mb-2" />
                    <p className="text-2xl font-bold text-white">{formatNumber(viewStats?.purchases || video.totalDownloads)}</p>
                    <p className="text-sm text-slate-400">Purchases</p>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-[#1a1a1a]/60 border-white/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-rose-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">
                        Protocol-Protected Content
                      </h4>
                      <p className="text-sm text-slate-400">
                        Secured with {video.encryptionAlg || 'AES-256-GCM'} encryption
                        • Streams anchored on-chain
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5 sticky top-6">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Tv className="w-5 h-5 text-rose-400" />
                  Watch Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-[#252525]/50 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Timer className="w-4 h-4 text-orange-400" />
                        Rent 48 Hours
                      </h3>
                      <p className="text-sm text-slate-400">
                        Watch anytime within 48 hours
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        data-testid="text-rent-price"
                        className="text-xl font-bold text-orange-400"
                      >
                        ${rentPrice}
                      </p>
                    </div>
                  </div>
                  <Button
                    data-testid="button-rent"
                    className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500"
                    disabled={isRenting || !walletAddress}
                    onClick={() => rentMutation.mutate(48)}
                  >
                    {isRenting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Timer className="w-4 h-4 mr-2" />
                    )}
                    {isRenting ? 'Processing...' : 'Rent Now'}
                  </Button>
                </div>

                <div className="p-4 rounded-xl bg-[#252525]/50 border border-rose-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white">Buy Forever</h3>
                      <p className="text-sm text-slate-400">
                        Own this video permanently
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        data-testid="text-purchase-price"
                        className="text-2xl font-bold text-green-400"
                      >
                        ${video.priceUsd}
                      </p>
                      <p className="text-xs text-slate-500">One-time payment</p>
                    </div>
                  </div>
                  <Button
                    data-testid="button-purchase"
                    variant="outline"
                    className="w-full border-green-500/30 text-green-300 hover:bg-green-500/10"
                    disabled={isPurchasing || !walletAddress}
                    onClick={() => purchaseMutation.mutate()}
                  >
                    {isPurchasing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <DollarSign className="w-4 h-4 mr-2" />
                    )}
                    {isPurchasing ? 'Processing...' : 'Purchase Now'}
                  </Button>
                </div>

                {video.previewUrl && (
                  <Button
                    data-testid="button-preview"
                    variant="outline"
                    className="w-full border-white/10 text-white hover:bg-white/5"
                    onClick={() => window.open(video.previewUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Watch Trailer
                  </Button>
                )}

                {!walletAddress && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-300 text-center">
                      Connect your wallet from the launcher to rent or purchase.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a]/60 border-white/5">
              <CardHeader>
                <CardTitle className="text-white text-lg">Creator Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p
                      data-testid="text-creator-wallet"
                      className="font-medium text-white font-mono text-sm"
                    >
                      {video.authorWallet}
                    </p>
                    <p className="text-sm text-slate-400">
                      {video.editionTotal
                        ? `Limited Edition: ${video.editionSold || 0} / ${video.editionTotal} sold`
                        : 'Unlimited Streams'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
