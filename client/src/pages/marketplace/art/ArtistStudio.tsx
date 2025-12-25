import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Palette,
  Upload,
  Edit,
  Eye,
  EyeOff,
  DollarSign,
  Loader2,
  Image as ImageIcon,
  CheckCircle,
  TrendingUp,
  Wallet,
  BarChart3,
  Layers,
  FileImage,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { P3Marketplace, type Asset, type CreateAssetRequest } from '@/lib/sdk/marketplace';
import { queryClient } from '@/lib/queryClient';

const sdk = new P3Marketplace();

const mediums = [
  { value: 'digital', label: 'Digital' },
  { value: 'photography', label: 'Photography' },
  { value: '3d', label: '3D' },
  { value: 'illustration', label: 'Illustration' },
  { value: 'generative', label: 'Generative' },
];

const createArtworkSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  priceUsd: z.coerce.number().min(0.01, 'Price must be at least $0.01'),
  medium: z.string().min(1, 'Medium is required'),
  tags: z.string().optional(),
  editionTotal: z.coerce.number().int().min(1, 'At least 1 edition required').max(10000),
});

type CreateArtworkForm = z.infer<typeof createArtworkSchema>;

function ArtworkListItem({
  artwork,
  onEdit,
  onTogglePublish,
}: {
  artwork: Asset;
  onEdit: () => void;
  onTogglePublish: () => void;
}) {
  const isPublished = artwork.status === 'published';
  const editionsRemaining = (artwork.editionTotal || 0) - (artwork.editionSold || 0);

  return (
    <Card
      data-testid={`card-my-artwork-${artwork.id}`}
      className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {artwork.coverUrl ? (
              <img
                src={artwork.coverUrl}
                alt={artwork.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Palette className="w-10 h-10 text-purple-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-white truncate">
                  {artwork.title}
                </h3>
                <p className="text-sm text-slate-400">
                  {artwork.category || 'Digital'}
                </p>
              </div>
              <Badge
                variant={isPublished ? 'default' : 'secondary'}
                className={
                  isPublished
                    ? 'bg-green-500/20 text-green-300 border-0'
                    : 'bg-slate-500/20 text-slate-300 border-0'
                }
              >
                {isPublished ? 'Published' : 'Draft'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm text-slate-400">
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {artwork.priceUsd}
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {artwork.editionSold || 0}/{artwork.editionTotal || '∞'} sold
              </span>
              {artwork.editionTotal && (
                <span className="flex items-center gap-1 text-purple-300">
                  {editionsRemaining} remaining
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid={`button-toggle-publish-${artwork.id}`}
              variant="ghost"
              size="icon"
              onClick={onTogglePublish}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              {isPublished ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
            <Button
              data-testid={`button-edit-${artwork.id}`}
              variant="ghost"
              size="icon"
              onClick={onEdit}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <Edit className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  iconColor = 'text-purple-400',
}: {
  icon: typeof Palette;
  label: string;
  value: string | number;
  trend?: string;
  iconColor?: string;
}) {
  return (
    <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <Icon className={`w-5 h-5 ${iconColor}`} />
          </div>
          <div>
            <p className="text-sm text-slate-400">{label}</p>
            <p className="text-xl font-bold text-white">{value}</p>
            {trend && (
              <p className="text-xs text-green-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                {trend}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ArtistStudio() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [highResFile, setHighResFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const highResInputRef = useRef<HTMLInputElement>(null);

  const walletAddress = localStorage.getItem('walletAddress');

  const form = useForm<CreateArtworkForm>({
    resolver: zodResolver(createArtworkSchema),
    defaultValues: {
      title: '',
      description: '',
      priceUsd: 99.99,
      medium: '',
      tags: '',
      editionTotal: 100,
    },
  });

  const { data: myArtworks, isLoading: isLoadingArtworks } = useQuery<{
    items: Asset[];
    total: number;
  }>({
    queryKey: ['/api/marketplace/assets/mine', { type: 'art' }],
    enabled: !!walletAddress,
  });

  const { data: treasuryData } = useQuery<{
    totalEarned: string;
    pending: string;
  }>({
    queryKey: ['/api/marketplace/treasury/statement'],
    enabled: !!walletAddress,
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateArtworkForm) => {
      const request: CreateAssetRequest = {
        type: 'art',
        title: data.title,
        description: data.description,
        priceUsd: data.priceUsd,
        category: data.medium,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()) : [],
        editionTotal: data.editionTotal,
      };
      return sdk.art.createArtwork(request);
    },
    onSuccess: async (result) => {
      if (highResFile) {
        try {
          setUploadProgress(10);
          await sdk.art.uploadArtwork(result.assetId, highResFile);
          setUploadProgress(100);
          toast({
            title: 'Artwork Created',
            description: 'Your artwork has been created and uploaded successfully.',
          });
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'Artwork created but file upload failed.',
          });
        } finally {
          setUploadProgress(0);
        }
      } else {
        toast({
          title: 'Artwork Created',
          description: 'Your artwork draft has been created.',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/assets/mine'] });
      form.reset();
      setCoverFile(null);
      setHighResFile(null);
      setActiveTab('my-artworks');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Unable to create artwork.',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (assetId: string) => {
      return sdk.art.publishArtwork(assetId);
    },
    onSuccess: () => {
      toast({
        title: 'Artwork Published',
        description: 'Your artwork is now live in the gallery.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/assets/mine'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Publish Failed',
        description: error.message,
      });
    },
  });

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload an image file for the cover.',
        });
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: 'Cover image must be under 10MB.',
        });
        return;
      }
      setCoverFile(file);
    }
  };

  const handleHighResSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/tiff'];
      if (!validTypes.includes(file.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload a PNG, JPEG, WebP, or TIFF file.',
        });
        return;
      }
      if (file.size > 100 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: 'High-res file must be under 100MB.',
        });
        return;
      }
      setHighResFile(file);
    }
  };

  const onSubmit = (data: CreateArtworkForm) => {
    createMutation.mutate(data);
  };

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-purple-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-slate-400 mb-6">
            You need to connect your wallet from the launcher to access the
            Artist Studio.
          </p>
          <Button
            data-testid="button-go-launcher"
            onClick={() => setLocation('/launcher')}
            className="bg-gradient-to-r from-purple-600 to-pink-600"
          >
            Go to Launcher
          </Button>
        </Card>
      </div>
    );
  }

  const totalCollected =
    myArtworks?.items.reduce((sum, a) => sum + a.totalDownloads, 0) || 0;
  const totalEditionsSold =
    myArtworks?.items.reduce((sum, a) => sum + (a.editionSold || 0), 0) || 0;

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Artist Studio</h1>
              <p className="text-xs text-slate-400">
                Create and manage your artworks
              </p>
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <TabsList className="bg-[#1a1a1a]/80 border border-white/5 mb-6">
            <TabsTrigger
              data-testid="tab-overview"
              value="overview"
              data-state={activeTab === 'overview' ? 'active' : 'inactive'}
              onClick={() => setActiveTab('overview')}
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              data-testid="tab-my-artworks"
              value="my-artworks"
              data-state={activeTab === 'my-artworks' ? 'active' : 'inactive'}
              onClick={() => setActiveTab('my-artworks')}
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              My Artworks
            </TabsTrigger>
            <TabsTrigger
              data-testid="tab-create"
              value="create"
              data-state={activeTab === 'create' ? 'active' : 'inactive'}
              onClick={() => setActiveTab('create')}
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              Create New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={Palette}
                label="Total Artworks"
                value={myArtworks?.total || 0}
                iconColor="text-purple-400"
              />
              <StatCard
                icon={Layers}
                label="Editions Sold"
                value={totalEditionsSold.toLocaleString()}
                iconColor="text-pink-400"
              />
              <StatCard
                icon={Eye}
                label="Times Collected"
                value={totalCollected.toLocaleString()}
                iconColor="text-cyan-400"
              />
              <StatCard
                icon={DollarSign}
                label="Total Earnings"
                value={`$${treasuryData?.totalEarned || '0.00'}`}
                trend={treasuryData?.pending ? `$${treasuryData.pending} pending` : undefined}
                iconColor="text-green-400"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Quick Actions</CardTitle>
                  <CardDescription>Get started with your artworks</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <Button
                    data-testid="button-create-artwork"
                    onClick={() => setActiveTab('create')}
                    className="h-auto py-6 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8" />
                      <span>Create New Artwork</span>
                    </div>
                  </Button>
                  <Button
                    data-testid="button-view-artworks"
                    variant="outline"
                    onClick={() => setActiveTab('my-artworks')}
                    className="h-auto py-6 border-white/10 text-white hover:bg-white/5"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <BarChart3 className="w-8 h-8" />
                      <span>View My Artworks</span>
                    </div>
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Recent Activity</CardTitle>
                  <CardDescription>Your latest performance</CardDescription>
                </CardHeader>
                <CardContent>
                  {myArtworks?.items.length === 0 ? (
                    <div className="text-center py-8">
                      <Palette className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No artworks created yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myArtworks?.items.slice(0, 3).map((artwork) => (
                        <div
                          key={artwork.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                        >
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center overflow-hidden">
                            {artwork.coverUrl ? (
                              <img src={artwork.coverUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Palette className="w-5 h-5 text-purple-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{artwork.title}</p>
                            <p className="text-xs text-slate-400">
                              {artwork.editionSold || 0}/{artwork.editionTotal || '∞'} sold
                            </p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={artwork.status === 'published' ? 'bg-green-500/20 text-green-300 border-0' : 'bg-slate-500/20 text-slate-300 border-0'}
                          >
                            {artwork.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="my-artworks" style={{ display: activeTab === 'my-artworks' ? 'block' : 'none' }}>
            {isLoadingArtworks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
            ) : !myArtworks?.items.length ? (
              <Card className="bg-[#1a1a1a]/60 border-white/5 p-12 text-center">
                <Palette className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  No artworks yet
                </h3>
                <p className="text-slate-400 mb-6">
                  Start your artistic journey by creating your first artwork.
                </p>
                <Button
                  data-testid="button-create-first"
                  onClick={() => setActiveTab('create')}
                  className="bg-gradient-to-r from-purple-600 to-pink-600"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Create Your First Artwork
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {myArtworks.items.map((artwork) => (
                  <ArtworkListItem
                    key={artwork.id}
                    artwork={artwork}
                    onEdit={() =>
                      toast({
                        title: 'Coming Soon',
                        description: 'Edit functionality will be available soon.',
                      })
                    }
                    onTogglePublish={() => {
                      if (artwork.status === 'published') {
                        toast({
                          title: 'Coming Soon',
                          description: 'Unpublish functionality will be available soon.',
                        });
                      } else {
                        publishMutation.mutate(artwork.id);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="create" style={{ display: activeTab === 'create' ? 'block' : 'none' }}>
            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-purple-400" />
                  Create New Artwork
                </CardTitle>
                <CardDescription>
                  Upload your artwork and set up editions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="space-y-6">
                        <FormField
                          control={form.control}
                          name="title"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">Title</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-title"
                                  placeholder="Enter artwork title"
                                  {...field}
                                  className="bg-[#252525] border-white/10 text-white"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">Description</FormLabel>
                              <FormControl>
                                <Textarea
                                  data-testid="input-description"
                                  placeholder="Describe your artwork..."
                                  {...field}
                                  rows={4}
                                  className="bg-[#252525] border-white/10 text-white resize-none"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={form.control}
                            name="priceUsd"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white">Price (USD)</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                      data-testid="input-price"
                                      type="number"
                                      step="0.01"
                                      min="0.01"
                                      {...field}
                                      className="bg-[#252525] border-white/10 text-white pl-9"
                                    />
                                  </div>
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="editionTotal"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel className="text-white">Edition Size</FormLabel>
                                <FormControl>
                                  <div className="relative">
                                    <Layers className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <Input
                                      data-testid="input-editions"
                                      type="number"
                                      min="1"
                                      max="10000"
                                      {...field}
                                      className="bg-[#252525] border-white/10 text-white pl-9"
                                    />
                                  </div>
                                </FormControl>
                                <FormDescription className="text-slate-500">
                                  Total editions available
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={form.control}
                          name="medium"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">Medium</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger
                                    data-testid="select-medium"
                                    className="bg-[#252525] border-white/10 text-white"
                                  >
                                    <SelectValue placeholder="Select medium" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-[#1a1a1a] border-white/10">
                                  {mediums.map((m) => (
                                    <SelectItem key={m.value} value={m.value}>
                                      {m.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="tags"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-white">Tags</FormLabel>
                              <FormControl>
                                <Input
                                  data-testid="input-tags"
                                  placeholder="abstract, colorful, nature (comma-separated)"
                                  {...field}
                                  className="bg-[#252525] border-white/10 text-white"
                                />
                              </FormControl>
                              <FormDescription className="text-slate-500">
                                Separate tags with commas
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="space-y-6">
                        <div>
                          <label className="block text-sm font-medium text-white mb-2">
                            Cover Image
                          </label>
                          <input
                            ref={coverInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleCoverSelect}
                            className="hidden"
                          />
                          <button
                            type="button"
                            data-testid="button-upload-cover"
                            onClick={() => coverInputRef.current?.click()}
                            className="w-full aspect-square rounded-xl border-2 border-dashed border-white/20 hover:border-purple-500/50 transition-colors flex flex-col items-center justify-center bg-[#252525]/50 group overflow-hidden"
                          >
                            {coverFile ? (
                              <div className="relative w-full h-full">
                                <img
                                  src={URL.createObjectURL(coverFile)}
                                  alt="Cover preview"
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="text-white font-medium">Change Cover</span>
                                </div>
                              </div>
                            ) : (
                              <>
                                <ImageIcon className="w-12 h-12 text-slate-500 group-hover:text-purple-400 transition-colors mb-3" />
                                <span className="text-slate-400 group-hover:text-purple-300 transition-colors">
                                  Upload Cover Image
                                </span>
                                <span className="text-xs text-slate-500 mt-1">
                                  PNG, JPG, WebP (max 10MB)
                                </span>
                              </>
                            )}
                          </button>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-white mb-2">
                            High-Resolution File
                          </label>
                          <input
                            ref={highResInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/tiff"
                            onChange={handleHighResSelect}
                            className="hidden"
                          />
                          <button
                            type="button"
                            data-testid="button-upload-highres"
                            onClick={() => highResInputRef.current?.click()}
                            className="w-full p-6 rounded-xl border-2 border-dashed border-white/20 hover:border-purple-500/50 transition-colors flex flex-col items-center justify-center bg-[#252525]/50 group"
                          >
                            {highResFile ? (
                              <div className="flex items-center gap-3">
                                <CheckCircle className="w-6 h-6 text-green-400" />
                                <div className="text-left">
                                  <p className="text-white font-medium">{highResFile.name}</p>
                                  <p className="text-sm text-slate-400">
                                    {(highResFile.size / (1024 * 1024)).toFixed(2)} MB
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <>
                                <FileImage className="w-10 h-10 text-slate-500 group-hover:text-purple-400 transition-colors mb-2" />
                                <span className="text-slate-400 group-hover:text-purple-300 transition-colors">
                                  Upload High-Res File
                                </span>
                                <span className="text-xs text-slate-500 mt-1">
                                  PNG, JPG, WebP, TIFF (max 100MB)
                                </span>
                              </>
                            )}
                          </button>
                        </div>

                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-slate-400">Uploading...</span>
                              <span className="text-purple-400">{uploadProgress}%</span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-white/10">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          form.reset();
                          setCoverFile(null);
                          setHighResFile(null);
                        }}
                        className="border-white/10 text-white hover:bg-white/5"
                      >
                        Reset
                      </Button>
                      <Button
                        data-testid="button-submit"
                        type="submit"
                        disabled={createMutation.isPending}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500"
                      >
                        {createMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Upload className="w-4 h-4 mr-2" />
                            Create Artwork
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
