import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { ShoppingCart, BookOpen, Music, Video, Image, ArrowRight } from "lucide-react";

const marketplaceVerticals = [
  { 
    id: 'ebook', 
    name: 'Ebook Store', 
    description: 'Digital books',
    path: '/marketplace/ebook',
    icon: BookOpen, 
    gradient: 'from-amber-500 to-orange-600' 
  },
  { 
    id: 'music', 
    name: 'Music Hub', 
    description: 'Stream & own',
    path: '/marketplace/music',
    icon: Music, 
    gradient: 'from-pink-500 to-rose-600' 
  },
  { 
    id: 'video', 
    name: 'Video Vault', 
    description: 'Premium content',
    path: '/marketplace/video',
    icon: Video, 
    gradient: 'from-red-500 to-rose-600' 
  },
  { 
    id: 'art', 
    name: 'Art Gallery', 
    description: 'Digital art & NFTs',
    path: '/marketplace/art',
    icon: Image, 
    gradient: 'from-violet-500 to-purple-600' 
  },
];

export default function MarketplaceTile() {
  return (
    <Card className="glass-card" data-testid="tile-marketplace">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-red-500/20">
            <ShoppingCart className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Marketplace</h3>
            <p className="text-xs text-slate-400">4 verticals with cross-chain settlement</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {marketplaceVerticals.map((vertical) => {
            const Icon = vertical.icon;
            return (
              <Link key={vertical.id} href={vertical.path}>
                <div 
                  className={`p-3 rounded-lg bg-gradient-to-br ${vertical.gradient} hover:scale-[1.02] transition-all cursor-pointer group`}
                  data-testid={`link-marketplace-${vertical.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-5 h-5 text-white" />
                    <ArrowRight className="w-4 h-4 text-white/60 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <p className="text-sm font-medium text-white">{vertical.name}</p>
                  <p className="text-xs text-white/70">{vertical.description}</p>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-4 p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Cross-chain settlement active • 2.5% fee</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
