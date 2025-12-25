import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  ShoppingBag, ExternalLink, Wallet, Loader2,
  Globe, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface PriceFiat {
  amount: number;
  currency: string;
}

interface ProductManifest {
  id: string;
  externalId?: string;
  source: string;
  title: string;
  description?: string;
  thumbnail?: string;
  images?: string[];
  priceWei?: string;
  priceFiat?: PriceFiat;
  merchantUrl: string;
  merchantName?: string;
  category?: string;
  tags?: string[];
  inStock?: boolean;
  metadata?: Record<string, unknown>;
}

interface ProductCardProps {
  product: ProductManifest;
  onOpenBrowser?: (url: string) => void;
}

export function ProductCard({ product, onOpenBrowser }: ProductCardProps) {
  const { wallet } = useAtlasStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'anchored' | 'browser' | null>(null);

  const anchoredPurchaseMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/atlas-one/products/purchase/anchored', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': wallet || '',
        },
        body: JSON.stringify({
          productId: product.id,
          priceWei: product.priceWei || '0',
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Purchase Complete',
        description: 'Your purchase has been recorded with a wallet receipt.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/atlas-one/library'] });
      setShowPurchaseDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Purchase Failed',
        description: error.message || 'Failed to complete purchase',
        variant: 'destructive',
      });
    },
  });

  const browserPurchaseMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/atlas-one/products/purchase/browser', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-wallet-address': wallet || '',
        },
        body: JSON.stringify({
          productId: product.id,
          merchantUrl: product.merchantUrl,
          priceFiat: product.priceFiat,
        }),
      });
    },
    onSuccess: () => {
      toast({
        title: 'Browser Purchase Logged',
        description: 'Opening merchant checkout. Your receipt will be anchored.',
      });
      if (onOpenBrowser) {
        onOpenBrowser(product.merchantUrl);
      } else {
        window.open(product.merchantUrl, '_blank');
      }
      setShowPurchaseDialog(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Log Purchase',
        description: error.message || 'Opening merchant site anyway...',
        variant: 'destructive',
      });
      window.open(product.merchantUrl, '_blank');
    },
  });

  const handlePurchaseClick = () => {
    if (!wallet) {
      toast({
        title: 'Wallet Required',
        description: 'Connect your wallet to make purchases.',
        variant: 'destructive',
      });
      return;
    }
    setShowPurchaseDialog(true);
  };

  const handleModeSelect = (mode: 'anchored' | 'browser') => {
    setSelectedMode(mode);
    if (mode === 'anchored') {
      anchoredPurchaseMutation.mutate();
    } else {
      browserPurchaseMutation.mutate();
    }
  };

  const formatPrice = () => {
    if (product.priceFiat) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: product.priceFiat.currency,
      }).format(product.priceFiat.amount);
    }
    if (product.priceWei && product.priceWei !== '0') {
      const ethValue = parseFloat(product.priceWei) / 1e18;
      return `${ethValue.toFixed(4)} ETH`;
    }
    return 'Price on site';
  };

  const isPending = anchoredPurchaseMutation.isPending || browserPurchaseMutation.isPending;

  return (
    <>
      <Card
        className="bg-slate-800/50 border-slate-700 hover:border-violet-500/50 transition-all cursor-pointer group overflow-hidden"
        data-testid={`product-card-${product.id}`}
      >
        <CardContent className="p-0">
          <div className="aspect-square bg-slate-700 relative overflow-hidden">
            {product.thumbnail ? (
              <img
                src={product.thumbnail}
                alt={product.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingBag className="w-12 h-12 text-slate-500" />
              </div>
            )}
            
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="text-xs bg-black/60 backdrop-blur-sm">
                {product.source}
              </Badge>
            </div>
            
            {product.inStock === false && (
              <div className="absolute top-2 right-2">
                <Badge variant="destructive" className="text-xs">
                  Out of Stock
                </Badge>
              </div>
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-3">
              <Button 
                size="sm" 
                className="w-full bg-violet-600 hover:bg-violet-700"
                onClick={handlePurchaseClick}
                data-testid={`button-buy-${product.id}`}
              >
                <ShoppingBag className="w-4 h-4 mr-1" />
                Buy Now
              </Button>
            </div>
          </div>
          
          <div className="p-3">
            <h3 className="font-medium text-white truncate" data-testid={`text-title-${product.id}`}>
              {product.title}
            </h3>
            
            {product.merchantName && (
              <p className="text-xs text-slate-400 truncate mt-0.5">
                {product.merchantName}
              </p>
            )}
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-sm font-semibold text-emerald-400" data-testid={`text-price-${product.id}`}>
                {formatPrice()}
              </span>
              
              {product.category && (
                <Badge variant="outline" className="text-xs text-slate-500 border-slate-600">
                  {product.category}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Choose Purchase Method</DialogTitle>
            <DialogDescription className="text-slate-400">
              How would you like to complete this purchase?
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-4 py-4">
            {product.thumbnail && (
              <img
                src={product.thumbnail}
                alt={product.title}
                className="w-20 h-20 rounded-lg object-cover"
              />
            )}
            <div className="flex-1">
              <h4 className="font-medium text-white">{product.title}</h4>
              <p className="text-sm text-slate-400">{product.merchantName}</p>
              <p className="text-lg font-bold text-emerald-400 mt-1">{formatPrice()}</p>
            </div>
          </div>

          <div className="space-y-3">
            <MotionDiv
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="outline"
                className="w-full h-auto py-4 px-4 border-violet-500/50 hover:border-violet-500 hover:bg-violet-500/10 justify-start"
                onClick={() => handleModeSelect('anchored')}
                disabled={isPending}
                data-testid="button-purchase-anchored"
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-violet-400" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">Buy with Atlas</span>
                      {selectedMode === 'anchored' && anchoredPurchaseMutation.isPending && (
                        <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Wallet receipt + ownership tracking + blockchain anchoring
                    </p>
                  </div>
                  <Wallet className="w-5 h-5 text-violet-400 flex-shrink-0" />
                </div>
              </Button>
            </MotionDiv>

            <MotionDiv
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                variant="outline"
                className="w-full h-auto py-4 px-4 border-slate-600 hover:border-slate-500 hover:bg-slate-800 justify-start"
                onClick={() => handleModeSelect('browser')}
                disabled={isPending}
                data-testid="button-purchase-browser"
              >
                <div className="flex items-start gap-3 w-full">
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-slate-400" />
                  </div>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">Merchant Checkout</span>
                      {selectedMode === 'browser' && browserPurchaseMutation.isPending && (
                        <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Open {product.merchantName || 'store'} in browser (optional receipt)
                    </p>
                  </div>
                  <ExternalLink className="w-5 h-5 text-slate-400 flex-shrink-0" />
                </div>
              </Button>
            </MotionDiv>
          </div>

          <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <p className="text-xs text-slate-500">
              <strong className="text-slate-400">Atlas Mode:</strong> Purchase tracked in your wallet library with immutable receipt.
              <br />
              <strong className="text-slate-400">Browser Mode:</strong> Complete checkout on merchant site, optionally log receipt.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default ProductCard;
