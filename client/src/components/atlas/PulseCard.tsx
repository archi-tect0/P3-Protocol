import { useQuery } from '@tanstack/react-query';
import { MotionDiv } from '@/lib/motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Gamepad2, BookOpen, Video, Package, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';

interface GrowthDeltas {
  today: number;
  thisWeek: number;
  thisMonth: number;
}

interface ContentTypeMetrics {
  total: number;
  deltas: GrowthDeltas;
}

interface GrowthTotals {
  games: number;
  ebooks: number;
  videos: number;
  products: number;
  total: number;
}

interface SurfaceGrowthResponse {
  success: boolean;
  timestamp: string;
  totals: GrowthTotals;
  byType: {
    games: ContentTypeMetrics;
    ebooks: ContentTypeMetrics;
    videos: ContentTypeMetrics;
    products: ContentTypeMetrics;
  };
  aggregateDeltas: GrowthDeltas;
  narrative: string;
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div 
      className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className || ''}`}
      data-testid="skeleton-loader"
    />
  );
}

function MetricItem({ 
  icon: Icon, 
  label, 
  count, 
  delta,
  testId 
}: { 
  icon: typeof Gamepad2; 
  label: string; 
  count: number; 
  delta: number;
  testId: string;
}) {
  const isPositive = delta > 0;
  const isNegative = delta < 0;
  const isNeutral = delta === 0;
  
  return (
    <div 
      className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50"
      data-testid={testId}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
          <Icon className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
        </div>
        <div>
          <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
          <p className="text-xl font-semibold text-slate-900 dark:text-white" data-testid={`${testId}-count`}>
            {count.toLocaleString()}
          </p>
        </div>
      </div>
      
      <div 
        className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium ${
          isPositive 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
            : isNegative 
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
        }`}
        data-testid={`${testId}-delta`}
      >
        {isPositive && <TrendingUp className="w-3.5 h-3.5" data-testid={`${testId}-delta-up`} />}
        {isNegative && <TrendingDown className="w-3.5 h-3.5" data-testid={`${testId}-delta-down`} />}
        {isNeutral && <Minus className="w-3.5 h-3.5" data-testid={`${testId}-delta-neutral`} />}
        <span>{isPositive ? '+' : ''}{delta}</span>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <Card className="w-full" data-testid="pulse-card-loading">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Skeleton className="w-5 h-5" />
          <Skeleton className="w-32 h-6" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
              <div className="flex items-center gap-3">
                <Skeleton className="w-9 h-9" />
                <div className="space-y-2">
                  <Skeleton className="w-16 h-3" />
                  <Skeleton className="w-12 h-6" />
                </div>
              </div>
              <Skeleton className="w-14 h-6 rounded-full" />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
          <Skeleton className="w-full h-4" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PulseCard() {
  const { data, isLoading, isError, error } = useQuery<SurfaceGrowthResponse>({
    queryKey: ['/api/atlas/pulse/growth'],
    refetchInterval: 60000,
  });

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError || !data?.success) {
    return (
      <Card className="w-full" data-testid="pulse-card-error">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-red-600 dark:text-red-400">
            <Activity className="w-5 h-5" />
            Surface Growth Pulse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-500 dark:text-slate-400" data-testid="pulse-error-message">
            {error instanceof Error ? error.message : 'Failed to load growth metrics'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const { byType, narrative } = data;

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="w-full" data-testid="pulse-card">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg text-slate-900 dark:text-white">
            <Activity className="w-5 h-5 text-cyan-500" />
            Surface Growth Pulse
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="pulse-metrics-grid">
            <MetricItem
              icon={Gamepad2}
              label="Games"
              count={byType.games.total}
              delta={byType.games.deltas.today}
              testId="pulse-metric-games"
            />
            <MetricItem
              icon={BookOpen}
              label="Ebooks"
              count={byType.ebooks.total}
              delta={byType.ebooks.deltas.today}
              testId="pulse-metric-ebooks"
            />
            <MetricItem
              icon={Video}
              label="Videos"
              count={byType.videos.total}
              delta={byType.videos.deltas.today}
              testId="pulse-metric-videos"
            />
            <MetricItem
              icon={Package}
              label="Products"
              count={byType.products.total}
              delta={byType.products.deltas.today}
              testId="pulse-metric-products"
            />
          </div>
          
          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700">
            <p 
              className="text-sm text-slate-500 dark:text-slate-400 italic"
              data-testid="pulse-narrative"
            >
              {narrative}
            </p>
          </div>
        </CardContent>
      </Card>
    </MotionDiv>
  );
}

export { PulseCard };
