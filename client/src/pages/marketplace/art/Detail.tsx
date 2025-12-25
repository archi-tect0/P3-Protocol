import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Palette,
  User,
  DollarSign,
  Shield,
  Loader2,
  Tag,
  Calendar,
  Eye,
  ShoppingCart,
  Share2,
  Check,
  Layers,
  History,
  Link as LinkIcon,
  Verified,
  ChevronRight,
  Anchor,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { P3Marketplace, type Asset, type CheckoutResult, type ExplorerFeed, type Receipt } from '@/lib/sdk/marketplace';
import { queryClient } from '@/lib/queryClient';

const sdk = new P3Marketplace();

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatNumber(num: number) {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function ProvenanceItem({ receipt, index }: { receipt: Receipt; index: number }) {
  return (
    <div
      data-testid={`provenance-item-${index}`}
      className="flex items-start gap-4 relative"
    >
      <div className="flex flex-col items-center">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0">
          <Anchor className="w-5 h-5 text-purple-400" />
        </div>
        {index !== 0 && (
          <div className="w-0.5 h-full bg-gradient-to-b from-purple-500/30 to-transparent absolute top-10 left-5 -z-10" />
        )}
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-center gap-2 mb-1">
          <Badge
            variant="secondary"
            className={`text-xs ${
              receipt.status === 'confirmed'
                ? 'bg-green-500/20 text-green-300'
                : receipt.status === 'submitted'
                ? 'bg-yellow-500/20 text-yellow-300'
                : 'bg-slate-500/20 text-slate-300'
            }`}
          >
            {receipt.status === 'confirmed' && <Verified className="w-3 h-3 mr-1" />}
            {receipt.status}
          </Badge>
          <span className="text-xs text-slate-500">
            {formatDate(receipt.createdAt)}
          </span>
        </div>
        <p className="text-white font-medium">{receipt.eventType}</p>
        {receipt.buyerWallet && (
          <p className="text-sm text-slate-400 flex items-center gap-1">
            <User className="w-3 h-3" />
            {receipt.buyerWallet.slice(0, 8)}...{receipt.buyerWallet.slice(-6)}
          </p>
        )}
        {receipt.txHash && (
          <a
            href={`https://basescan.org/tx/${receipt.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 mt-1"
          >
            <LinkIcon className="w-3 h-3" />
            View on Explorer
          </a>
        )}
        {receipt.digest && (
          <p className="text-xs text-slate-500 font-mono mt-1 truncate">
            Digest: {receipt.digest.slice(0, 16)}...
          </p>
        )}
      </div>
    </div>
  );
}

export default function ArtworkDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const walletAddress = localStorage.getItem('walletAddress');

  const { data: artwork, isLoading } = useQuery<Asset>({
    queryKey: ['/api/marketplace/catalog', params.id],
    enabled: !!params.id,
  });

  const { data: provenance } = useQuery<ExplorerFeed>({
    queryKey: ['/api/marketplace/explorer/asset', params.id],
    enabled: !!params.id,
  });

  const { data: artistWorks } = useQuery<{ items: Asset[] }>({
    queryKey: ['/api/marketplace/catalog', { authorWallet: artwork?.authorWallet, type: 'art' }],
    enabled: !!artwork?.authorWallet,
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      return sdk.art.purchase(params.id!);
    },
    onSuccess: (result: CheckoutResult & { editionNumber?: number }) => {
      toast({
        title: 'Purchase Successful!',
        description: result.existing
          ? 'You already own this artwork. View it in your collection!'
          : `You now own Edition #${result.editionNumber || '?'} of this artwork.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/catalog'] });
      setLocation(`/marketplace/art/view/${params.id}?license=${result.licenseId}`);
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
        description: 'Share this artwork with others.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Copy Failed',
        description: 'Unable to copy link.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  if (!artwork) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <Palette className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Artwork Not Found</h2>
          <p className="text-slate-400 mb-6">
            This artwork may have been removed or doesn't exist.
          </p>
          <Button
            data-testid="button-back-catalog"
            onClick={() => setLocation('/marketplace/art')}
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            Back to Gallery
          </Button>
        </Card>
      </div>
    );
  }

  const isPurchasing = purchaseMutation.isPending;
  const editionsRemaining = (artwork.editionTotal || 0) - (artwork.editionSold || 0);
  const isSoldOut = artwork.editionTotal && editionsRemaining <= 0;
  const otherWorks = artistWorks?.items.filter((w) => w.id !== artwork.id).slice(0, 4) || [];

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/15 via-transparent to-pink-900/15 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center gap-4 mb-8">
          <Button
            data-testid="button-back"
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/marketplace/art')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm text-slate-400">Artwork Details</p>
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
              <div className="aspect-square bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center relative group cursor-pointer"
                onClick={() => walletAddress && setLocation(`/marketplace/art/view/${params.id}`)}
              >
                {artwork.coverUrl ? (
                  <img
                    src={artwork.coverUrl}
                    alt={artwork.title}
                    className="w-full h-full object-contain"
                    data-testid="img-artwork"
                  />
                ) : (
                  <Palette className="w-32 h-32 text-purple-400" />
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="px-6 py-3 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white font-medium flex items-center gap-2">
                    <Eye className="w-5 h-5" />
                    View High-Res
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-6">
              <div>
                <Badge
                  variant="secondary"
                  className="bg-purple-500/20 text-purple-300 border-0 mb-3"
                >
                  <Palette className="w-3 h-3 mr-1" />
                  {artwork.category || 'Digital Art'}
                </Badge>
                <h1
                  data-testid="text-title"
                  className="text-3xl font-bold text-white mb-4"
                >
                  {artwork.title}
                </h1>

                <div className="flex items-center gap-4 flex-wrap mb-6">
                  <div className="flex items-center gap-2 text-slate-400">
                    <User className="w-4 h-4" />
                    <span
                      data-testid="text-artist"
                      className="text-purple-300 font-medium"
                    >
                      {artwork.authorWallet.slice(0, 8)}...{artwork.authorWallet.slice(-6)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Calendar className="w-4 h-4" />
                    <span>{formatDate(artwork.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-400">
                    <Eye className="w-4 h-4" />
                    <span data-testid="text-collected">{formatNumber(artwork.totalDownloads)} collected</span>
                  </div>
                </div>

                {artwork.tags && artwork.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-6">
                    {artwork.tags.map((tag) => (
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

                {artwork.description && (
                  <Card className="bg-[#1a1a1a]/60 border-white/5">
                    <CardContent className="p-4">
                      <p
                        data-testid="text-description"
                        className="text-slate-300 leading-relaxed whitespace-pre-wrap"
                      >
                        {artwork.description}
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {artwork.editionTotal && artwork.editionTotal > 0 && (
                <Card className="bg-[#1a1a1a]/60 border-white/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                        <Layers className="w-5 h-5 text-purple-400" />
                      </div>
                      <div>
                        <h4 className="font-medium text-white">
                          Limited Edition
                        </h4>
                        <p
                          data-testid="text-edition-info"
                          className="text-sm text-slate-400"
                        >
                          {isSoldOut ? (
                            <span className="text-red-400">Sold Out</span>
                          ) : (
                            <>
                              <span className="text-purple-300 font-semibold">{editionsRemaining}</span>{' '}
                              of {artwork.editionTotal} editions remaining
                            </>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                        style={{ width: `${((artwork.editionSold || 0) / artwork.editionTotal) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {artwork.editionSold || 0} editions sold
                    </p>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-[#1a1a1a]/60 border-white/5">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-purple-400" />
                    Provenance History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {provenance && provenance.items.length > 0 ? (
                    <div className="space-y-0">
                      {provenance.items.slice(0, 5).map((receipt, i) => (
                        <ProvenanceItem key={receipt.id} receipt={receipt} index={i} />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <Anchor className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No provenance records yet</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Records will appear after the first purchase
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-[#1a1a1a]/60 border-white/5">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
                      <Shield className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-white">
                        Protocol-Protected Content
                      </h4>
                      <p className="text-sm text-slate-400">
                        Secured with {artwork.encryptionAlg || 'AES-256-GCM'} encryption
                        • Anchored on-chain for provenance
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
                  <ShoppingCart className="w-5 h-5 text-purple-400" />
                  Collect This Artwork
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-xl bg-[#252525]/50 border border-purple-500/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white">Price</h3>
                      <p className="text-sm text-slate-400">
                        One-time purchase
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        data-testid="text-price"
                        className="text-2xl font-bold text-green-400"
                      >
                        ${artwork.priceUsd}
                      </p>
                    </div>
                  </div>
                  <Button
                    data-testid="button-purchase"
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                    disabled={isPurchasing || !walletAddress || !!isSoldOut}
                    onClick={() => purchaseMutation.mutate()}
                  >
                    {isPurchasing ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <DollarSign className="w-4 h-4 mr-2" />
                    )}
                    {isSoldOut
                      ? 'Sold Out'
                      : isPurchasing
                      ? 'Processing...'
                      : 'Purchase Now'}
                  </Button>
                </div>

                {!walletAddress && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-300 text-center">
                      Connect your wallet from the launcher to purchase.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a]/60 border-white/5">
              <CardHeader>
                <CardTitle className="text-white text-lg">Artist Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-xl">
                    {artwork.authorWallet.slice(2, 4).toUpperCase()}
                  </div>
                  <div>
                    <p
                      data-testid="text-artist-wallet"
                      className="font-medium text-white font-mono text-sm break-all"
                    >
                      {artwork.authorWallet}
                    </p>
                  </div>
                </div>
                {otherWorks.length > 0 && (
                  <div>
                    <p className="text-sm text-slate-400 mb-3">Other Works</p>
                    <div className="grid grid-cols-2 gap-2">
                      {otherWorks.map((work) => (
                        <button
                          key={work.id}
                          onClick={() => setLocation(`/marketplace/art/${work.id}`)}
                          className="aspect-square rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 overflow-hidden hover:ring-2 ring-purple-500/50 transition-all"
                        >
                          {work.coverUrl ? (
                            <img src={work.coverUrl} alt={work.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Palette className="w-6 h-6 text-purple-400" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    <Button
                      data-testid="button-view-all-works"
                      variant="ghost"
                      className="w-full mt-3 text-purple-300 hover:text-purple-200 hover:bg-purple-500/10"
                      onClick={() => setLocation(`/marketplace/art?artist=${artwork.authorWallet}`)}
                    >
                      View All Works
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
