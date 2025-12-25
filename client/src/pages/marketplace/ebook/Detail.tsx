import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrowLeft,
  BookOpen,
  Download,
  User,
  DollarSign,
  Shield,
  Loader2,
  ExternalLink,
  Tag,
  Calendar,
  FileText,
  ShoppingCart,
  BookmarkPlus,
  Share2,
  Check,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { P3Marketplace, type Asset, type CheckoutResult, type BorrowResult } from '@/lib/sdk/marketplace';
import { queryClient } from '@/lib/queryClient';

const sdk = new P3Marketplace();

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatFileSize(bytes?: number) {
  if (!bytes) return 'Unknown';
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
}

export default function EbookDetail() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [borrowDays, setBorrowDays] = useState(7);
  const [copied, setCopied] = useState(false);

  const walletAddress = localStorage.getItem('walletAddress');

  const { data: ebook, isLoading } = useQuery<Asset>({
    queryKey: ['/api/marketplace/catalog', params.id],
    enabled: !!params.id,
  });

  const purchaseMutation = useMutation({
    mutationFn: async () => {
      return sdk.ebook.checkout(params.id!);
    },
    onSuccess: (result: CheckoutResult) => {
      toast({
        title: 'Purchase Successful!',
        description: result.existing
          ? 'You already own this ebook. Redirecting to reader...'
          : 'Your ebook is ready to read.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/catalog'] });
      setTimeout(() => {
        setLocation(`/marketplace/ebook/read/${params.id}?license=${result.licenseId}`);
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Purchase Failed',
        description: error.message || 'Unable to complete purchase. Please try again.',
      });
    },
  });

  const borrowMutation = useMutation({
    mutationFn: async () => {
      return sdk.ebook.borrow(params.id!, borrowDays);
    },
    onSuccess: (result: BorrowResult) => {
      toast({
        title: 'Borrow Successful!',
        description: `Your license expires on ${formatDate(result.expiresAt)}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/catalog'] });
      setTimeout(() => {
        setLocation(`/marketplace/ebook/read/${params.id}?license=${result.licenseId}`);
      }, 1500);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Borrow Failed',
        description: error.message || 'Unable to borrow. Please try again.',
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
        description: 'Share this ebook with others.',
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

  if (!ebook) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <BookOpen className="w-12 h-12 text-slate-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Ebook Not Found</h2>
          <p className="text-slate-400 mb-6">
            This ebook may have been removed or doesn't exist.
          </p>
          <Button
            data-testid="button-back-catalog"
            onClick={() => setLocation('/marketplace/ebook')}
            className="bg-gradient-to-r from-purple-600 to-indigo-600"
          >
            Back to Catalog
          </Button>
        </Card>
      </div>
    );
  }

  const isPurchasing = purchaseMutation.isPending;
  const isBorrowing = borrowMutation.isPending;

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/15 via-transparent to-indigo-900/15 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        <header className="flex items-center gap-4 mb-8">
          <Button
            data-testid="button-back"
            variant="ghost"
            size="icon"
            onClick={() => setLocation('/marketplace/ebook')}
            className="text-slate-400 hover:text-white hover:bg-white/10"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <p className="text-sm text-slate-400">Ebook Details</p>
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
              <div className="aspect-[3/4] bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                {ebook.coverUrl ? (
                  <img
                    src={ebook.coverUrl}
                    alt={ebook.title}
                    className="w-full h-full object-cover"
                    data-testid="img-cover"
                  />
                ) : (
                  <BookOpen className="w-24 h-24 text-purple-400" />
                )}
              </div>
              <CardContent className="p-4">
                {ebook.previewUrl && (
                  <Button
                    data-testid="button-preview"
                    variant="outline"
                    className="w-full border-white/10 text-white hover:bg-white/5 mb-3"
                    onClick={() => window.open(ebook.previewUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Preview Sample
                  </Button>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <FileText className="w-4 h-4" />
                  <span>{formatFileSize(ebook.filesize)}</span>
                  {ebook.mime && (
                    <>
                      <span>•</span>
                      <span>{ebook.mime.split('/')[1]?.toUpperCase()}</span>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div>
              <Badge
                variant="secondary"
                className="bg-purple-500/20 text-purple-300 border-0 mb-3"
              >
                {ebook.category || 'Ebook'}
              </Badge>
              <h1
                data-testid="text-title"
                className="text-3xl font-bold text-white mb-4"
              >
                {ebook.title}
              </h1>
              
              <div className="flex items-center gap-4 flex-wrap mb-6">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-4 h-4" />
                  <span
                    data-testid="text-author"
                    className="text-purple-300 font-medium"
                  >
                    {ebook.authorWallet.slice(0, 8)}...{ebook.authorWallet.slice(-6)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(ebook.createdAt)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <Download className="w-4 h-4" />
                  <span>{ebook.totalDownloads} downloads</span>
                </div>
              </div>

              {ebook.tags && ebook.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {ebook.tags.map((tag) => (
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

              {ebook.description && (
                <Card className="bg-[#1a1a1a]/60 border-white/5">
                  <CardContent className="p-4">
                    <p
                      data-testid="text-description"
                      className="text-slate-300 leading-relaxed whitespace-pre-wrap"
                    >
                      {ebook.description}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>

            <Card className="bg-gradient-to-br from-[#1a1a1a]/80 to-[#1a1a1a]/60 backdrop-blur-xl border-white/5">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-green-400" />
                  Purchase Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 rounded-xl bg-[#252525]/50 border border-white/5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-white">Buy Forever</h3>
                      <p className="text-sm text-slate-400">
                        Own this ebook permanently
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        data-testid="text-price"
                        className="text-2xl font-bold text-green-400"
                      >
                        ${ebook.priceUsd}
                      </p>
                      <p className="text-xs text-slate-500">One-time payment</p>
                    </div>
                  </div>
                  <Button
                    data-testid="button-purchase"
                    className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500"
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

                {ebook.policy === 'lend_days' && (
                  <div className="p-4 rounded-xl bg-[#252525]/50 border border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-white">Borrow</h3>
                        <p className="text-sm text-slate-400">
                          Temporary access at a lower cost
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Label htmlFor="borrow-days" className="text-slate-400">
                          Days:
                        </Label>
                        <Input
                          id="borrow-days"
                          data-testid="input-borrow-days"
                          type="number"
                          min={1}
                          max={30}
                          value={borrowDays}
                          onChange={(e) =>
                            setBorrowDays(parseInt(e.target.value) || 7)
                          }
                          className="w-16 bg-[#1a1a1a] border-white/10 text-white text-center"
                        />
                      </div>
                    </div>
                    <Button
                      data-testid="button-borrow"
                      variant="outline"
                      className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10"
                      disabled={isBorrowing || !walletAddress}
                      onClick={() => borrowMutation.mutate()}
                    >
                      {isBorrowing ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <BookmarkPlus className="w-4 h-4 mr-2" />
                      )}
                      {isBorrowing
                        ? 'Processing...'
                        : `Borrow for ${borrowDays} days`}
                    </Button>
                  </div>
                )}

                {!walletAddress && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <p className="text-sm text-amber-300 text-center">
                      Connect your wallet from the launcher to purchase or borrow.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a]/60 border-white/5">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-white">
                      Protocol-Protected Content
                    </h4>
                    <p className="text-sm text-slate-400">
                      Secured with {ebook.encryptionAlg || 'AES-256-GCM'} encryption
                      • Receipts anchored on-chain
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#1a1a1a]/60 border-white/5">
              <CardHeader>
                <CardTitle className="text-white text-lg">Author Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <User className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <p
                      data-testid="text-author-wallet"
                      className="font-medium text-white font-mono"
                    >
                      {ebook.authorWallet}
                    </p>
                    <p className="text-sm text-slate-400">
                      {ebook.editionTotal
                        ? `Limited Edition: ${ebook.editionSold || 0} / ${ebook.editionTotal} sold`
                        : 'Unlimited Edition'}
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
