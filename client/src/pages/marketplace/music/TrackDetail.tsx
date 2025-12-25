import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Music,
  Play,
  Pause,
  User,
  DollarSign,
  Shield,
  Loader2,
  ExternalLink,
  Tag,
  Calendar,
  Headphones,
  ShoppingCart,
  Share2,
  Check,
  Clock,
  BarChart3,
  Users,
  Radio,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { P3Marketplace, type Asset, type CheckoutResult, type StreamResult } from '@/lib/sdk/marketplace';
import { queryClient } from '@/lib/queryClient';

const sdk = new P3Marketplace();

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatDuration(seconds?: number) {
  if (!seconds) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export default function TrackDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [, setCurrentPlayId] = useState<string | null>(null);

  const walletAddress = localStorage.getItem('walletAddress');

  const { data: track, isLoading } = useQuery<Asset>({
    queryKey: ['/api/marketplace/catalog', params.id],
    enabled: !!params.id,
  });

  const { data: streamStats } = useQuery<{ totalStreams: number; uniqueListeners: number }>({
    queryKey: ['/api/marketplace/explorer/stats', params.id],
    enabled: !!params.id,
  });

  const streamMutation = useMutation({
    mutationFn: async () => {
      return sdk.music.stream(params.id!);
    },
    onSuccess: (result: StreamResult) => {
      setCurrentPlayId(result.playId);
      setIsPlaying(true);
      setLocation(`/marketplace/music/player/${params.id}?play=${result.playId}`);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Stream Failed',
        description: error.message || 'Unable to start streaming. Please try again.',
      });
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      return sdk.music.purchase(params.id!);
    },
    onSuccess: (result: CheckoutResult) => {
      toast({
        title: 'Purchase Successful!',
        description: result.existing
          ? 'You already own this track. Ready to play!'
          : 'Your track is ready to stream.',
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
        description: 'Share this track with others.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Unable to copy link.',
      });
    }
  };

  const handlePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      streamMutation.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  if (!track) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <Music className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Track Not Found</h2>
          <p className="text-slate-400 mb-6">
            This track may have been removed or doesn't exist.
          </p>
          <Button
            data-testid="button-back-catalog"
            onClick={() => setLocation('/marketplace/music')}
            className="bg-gradient-to-r from-cyan-600 to-purple-600"
          >
            Back to Catalog
          </Button>
        </Card>
      </div>
    );
  }

  const isStreaming = streamMutation.isPending;
  const isPurchasing = purchaseMutation.isPending;

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/15 via-transparent to-purple-900/15 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center gap-4 mb-8">
          <Button
            data-testid="button-back"
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/marketplace/music')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm text-slate-400">Track Details</p>
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
          <div className="lg:col-span-1">
            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 overflow-hidden sticky top-6">
              <div className="aspect-square bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center relative group">
                {track.coverUrl ? (
                  <img
                    src={track.coverUrl}
                    alt={track.title}
                    className="w-full h-full object-cover"
                    data-testid="img-cover"
                  />
                ) : (
                  <Music className="w-24 h-24 text-cyan-400" />
                )}
                <button
                  data-testid="button-play-cover"
                  onClick={handlePlay}
                  disabled={isStreaming}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer disabled:cursor-wait"
                >
                  <div className="w-20 h-20 rounded-full bg-cyan-500 flex items-center justify-center transform scale-90 group-hover:scale-100 transition-transform shadow-lg shadow-cyan-500/30">
                    {isStreaming ? (
                      <Loader2 className="w-10 h-10 text-white animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-10 h-10 text-white" />
                    ) : (
                      <Play className="w-10 h-10 text-white fill-white ml-1" />
                    )}
                  </div>
                </button>
              </div>
              <CardContent className="p-4">
                {track.previewUrl && (
                  <Button
                    data-testid="button-preview"
                    variant="outline"
                    className="w-full border-white/10 text-white hover:bg-white/5 mb-3"
                    onClick={() => window.open(track.previewUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Preview Sample
                  </Button>
                )}
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {formatDuration(track.filesize ? Math.floor(track.filesize / 16000) : undefined)}
                  </span>
                  {track.mime && (
                    <span>{track.mime.split('/')[1]?.toUpperCase()}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div>
              <Badge
                variant="secondary"
                className="bg-cyan-500/20 text-cyan-300 border-0 mb-3"
              >
                {track.category || track.type === 'album' ? 'Album' : 'Single'}
              </Badge>
              <h1
                data-testid="text-title"
                className="text-3xl font-bold text-white mb-4"
              >
                {track.title}
              </h1>
              
              <div className="flex items-center gap-4 flex-wrap mb-6">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-4 h-4" />
                  <span
                    data-testid="text-artist"
                    className="text-cyan-300 font-medium"
                  >
                    {track.authorWallet.slice(0, 8)}...{track.authorWallet.slice(-6)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(track.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Headphones className="w-4 h-4" />
                  <span data-testid="text-streams">{formatNumber(track.totalStreams)} streams</span>
                </div>
              </div>

              {track.tags && track.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {track.tags.map((tag) => (
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

              {track.description && (
                <Card className="bg-[#1a1a1a]/60 border-white/5">
                  <CardContent className="p-4">
                    <p
                      data-testid="text-description"
                      className="text-slate-300 leading-relaxed whitespace-pre-wrap"
                    >
                      {track.description}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="bg-[#1a1a1a]/60 border-white/5">
                <CardContent className="p-4 text-center">
                  <Headphones className="w-6 h-6 text-cyan-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{formatNumber(streamStats?.totalStreams || track.totalStreams)}</p>
                  <p className="text-sm text-slate-400">Total Streams</p>
                </CardContent>
              </Card>
              <Card className="bg-[#1a1a1a]/60 border-white/5">
                <CardContent className="p-4 text-center">
                  <Users className="w-6 h-6 text-purple-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{formatNumber(streamStats?.uniqueListeners || 0)}</p>
                  <p className="text-sm text-slate-400">Unique Listeners</p>
                </CardContent>
              </Card>
              <Card className="bg-[#1a1a1a]/60 border-white/5">
                <CardContent className="p-4 text-center">
                  <BarChart3 className="w-6 h-6 text-green-400 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-white">{track.totalDownloads}</p>
                  <p className="text-sm text-slate-400">Downloads</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-green-400" />
                  Listen Now
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-xl bg-[#252525]/50 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white flex items-center gap-2">
                        <Radio className="w-4 h-4 text-cyan-400" />
                        Stream Now
                      </h3>
                      <p className="text-sm text-slate-400">
                        Start listening instantly
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-slate-400">Per stream</p>
                    </div>
                  </div>
                  <Button
                    data-testid="button-stream"
                    className="w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500"
                    disabled={isStreaming || !walletAddress}
                    onClick={handlePlay}
                  >
                    {isStreaming ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2 fill-current" />
                    )}
                    {isStreaming ? 'Loading...' : 'Play Now'}
                  </Button>
                </div>

                <div className="p-4 rounded-xl bg-[#252525]/50 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white">Buy Forever</h3>
                      <p className="text-sm text-slate-400">
                        Own this track permanently
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        data-testid="text-price"
                        className="text-2xl font-bold text-green-400"
                      >
                        ${track.priceUsd}
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

                {!walletAddress && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-300 text-center">
                      Connect your wallet from the launcher to stream or purchase.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a]/60 border-white/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">
                      Protocol-Protected Content
                    </h4>
                    <p className="text-sm text-slate-400">
                      Secured with {track.encryptionAlg || 'AES-256-GCM'} encryption
                      • Streams anchored on-chain
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a]/60 border-white/5">
              <CardHeader>
                <CardTitle className="text-white text-lg">Artist Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p
                      data-testid="text-artist-wallet"
                      className="font-medium text-white font-mono"
                    >
                      {track.authorWallet}
                    </p>
                    <p className="text-sm text-slate-400">
                      {track.editionTotal
                        ? `Limited Edition: ${track.editionSold || 0} / ${track.editionTotal} sold`
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
