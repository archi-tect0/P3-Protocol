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
  Video,
  Upload,
  Edit,
  Eye,
  EyeOff,
  DollarSign,
  Loader2,
  FileVideo,
  Image,
  CheckCircle,
  TrendingUp,
  Film,
  Clapperboard,
  Wallet,
  Play,
  BarChart3,
  Timer,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { P3Marketplace, type Asset, type CreateAssetRequest } from '@/lib/sdk/marketplace';
import { queryClient } from '@/lib/queryClient';

const sdk = new P3Marketplace();

const categories = [
  { value: 'action', label: 'Action' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'drama', label: 'Drama' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'horror', label: 'Horror' },
  { value: 'sci-fi', label: 'Sci-Fi' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'animation', label: 'Animation' },
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'music-video', label: 'Music Video' },
];

const createVideoSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  priceUsd: z.coerce.number().min(0, 'Price must be positive'),
  category: z.string().min(1, 'Category is required'),
  tags: z.string().optional(),
  policy: z.enum(['perpetual', 'rent_hours', 'stream_ppv']),
  editionTotal: z.coerce.number().int().min(0).optional(),
});

type CreateVideoForm = z.infer<typeof createVideoSchema>;

function VideoListItem({
  video,
  onEdit,
  onTogglePublish,
}: {
  video: Asset;
  onEdit: () => void;
  onTogglePublish: () => void;
}) {
  const isPublished = video.status === 'published';

  return (
    <Card
      data-testid={`card-my-video-${video.id}`}
      className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-32 aspect-video rounded-lg bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden relative group">
            {video.coverUrl ? (
              <img
                src={video.coverUrl}
                alt={video.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <Film className="w-8 h-8 text-rose-400" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play className="w-8 h-8 text-white fill-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-white truncate">
                  {video.title}
                </h3>
                <p className="text-sm text-slate-400">
                  {video.category || 'Uncategorized'}
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
                {video.priceUsd}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {video.totalStreams.toLocaleString()}
              </span>
              <span className="flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {video.totalDownloads} rentals
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid={`button-toggle-publish-${video.id}`}
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
              data-testid={`button-edit-${video.id}`}
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
  iconColor = 'text-rose-400',
}: {
  icon: typeof Video;
  label: string;
  value: string | number;
  trend?: string;
  iconColor?: string;
}) {
  return (
    <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center">
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

export default function CreatorStudio() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const walletAddress = localStorage.getItem('walletAddress');

  const form = useForm<CreateVideoForm>({
    resolver: zodResolver(createVideoSchema),
    defaultValues: {
      title: '',
      description: '',
      priceUsd: 9.99,
      category: '',
      tags: '',
      policy: 'rent_hours',
      editionTotal: 0,
    },
  });

  const { data: myVideos, isLoading: isLoadingVideos } = useQuery<{
    items: Asset[];
    total: number;
  }>({
    queryKey: ['/api/marketplace/assets/mine', { type: 'video' }],
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
    mutationFn: async (data: CreateVideoForm) => {
      const request: CreateAssetRequest = {
        type: 'video',
        title: data.title,
        description: data.description,
        priceUsd: data.priceUsd,
        category: data.category,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()) : [],
        policy: data.policy,
        editionTotal: data.editionTotal || undefined,
      };
      return sdk.video.createVideo(request);
    },
    onSuccess: async (result) => {
      if (selectedFile) {
        try {
          setUploadProgress(10);
          await sdk.video.uploadVideo(result.assetId, selectedFile);
          setUploadProgress(100);
          toast({
            title: 'Video Created',
            description: 'Your video has been created and uploaded successfully.',
          });
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'Video created but file upload failed.',
          });
        } finally {
          setUploadProgress(0);
        }
      } else {
        toast({
          title: 'Video Created',
          description: 'Your video draft has been created.',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/assets/mine'] });
      form.reset();
      setSelectedFile(null);
      setCoverFile(null);
      setActiveTab('my-videos');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Unable to create video.',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (assetId: string) => {
      return sdk.video.publishVideo(assetId);
    },
    onSuccess: () => {
      toast({
        title: 'Video Published',
        description: 'Your video is now live in the marketplace.',
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        'video/mp4',
        'video/webm',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-matroska',
      ];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload an MP4, WebM, MOV, AVI, or MKV file.',
        });
        return;
      }
      if (file.size > 5 * 1024 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: 'Maximum file size is 5GB.',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

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
      setCoverFile(file);
    }
  };

  const onSubmit = (data: CreateVideoForm) => {
    createMutation.mutate(data);
  };

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-rose-400" />
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">
            Connect Your Wallet
          </h2>
          <p className="text-slate-400 mb-6">
            You need to connect your wallet from the launcher to access the
            Creator Studio.
          </p>
          <Button
            data-testid="button-go-launcher"
            onClick={() => setLocation('/launcher')}
            className="bg-gradient-to-r from-rose-600 to-orange-600"
          >
            Go to Launcher
          </Button>
        </Card>
      </div>
    );
  }

  const totalViews =
    myVideos?.items.reduce((sum, v) => sum + v.totalStreams, 0) || 0;
  const totalRentals =
    myVideos?.items.reduce((sum, v) => sum + v.totalDownloads, 0) || 0;

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-600 flex items-center justify-center">
              <Clapperboard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Creator Studio</h1>
              <p className="text-xs text-slate-400">
                Upload and manage your videos
              </p>
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#1a1a1a]/80 border border-white/5 mb-6">
            <TabsTrigger
              data-testid="tab-overview"
              value="overview"
              className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-300"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              data-testid="tab-my-videos"
              value="my-videos"
              className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-300"
            >
              My Videos
            </TabsTrigger>
            <TabsTrigger
              data-testid="tab-upload"
              value="upload"
              className="data-[state=active]:bg-rose-500/20 data-[state=active]:text-rose-300"
            >
              Upload New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={Video}
                label="Total Videos"
                value={myVideos?.total || 0}
                iconColor="text-rose-400"
              />
              <StatCard
                icon={Eye}
                label="Total Views"
                value={totalViews.toLocaleString()}
                iconColor="text-orange-400"
              />
              <StatCard
                icon={Timer}
                label="Total Rentals"
                value={totalRentals.toLocaleString()}
                iconColor="text-amber-400"
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
                  <CardDescription>Get started with your videos</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <Button
                    data-testid="button-upload-video"
                    onClick={() => setActiveTab('upload')}
                    className="h-auto py-6 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8" />
                      <span>Upload New Video</span>
                    </div>
                  </Button>
                  <Button
                    data-testid="button-view-videos"
                    variant="outline"
                    onClick={() => setActiveTab('my-videos')}
                    className="h-auto py-6 border-white/10 text-white hover:bg-white/5"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <BarChart3 className="w-8 h-8" />
                      <span>View My Videos</span>
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
                  {myVideos?.items.length === 0 ? (
                    <div className="text-center py-8">
                      <Video className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No videos uploaded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myVideos?.items.slice(0, 3).map((video) => (
                        <div
                          key={video.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                        >
                          <div className="w-16 aspect-video rounded-lg bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center overflow-hidden">
                            {video.coverUrl ? (
                              <img src={video.coverUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Film className="w-4 h-4 text-rose-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{video.title}</p>
                            <p className="text-xs text-slate-400">{video.totalStreams} views</p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={video.status === 'published' ? 'bg-green-500/20 text-green-300 border-0' : 'bg-slate-500/20 text-slate-300 border-0'}
                          >
                            {video.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="my-videos">
            {isLoadingVideos ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-rose-400 animate-spin" />
              </div>
            ) : !myVideos?.items.length ? (
              <Card className="bg-[#1a1a1a]/60 border-white/5 p-12 text-center">
                <Video className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  No videos yet
                </h3>
                <p className="text-slate-400 mb-6">
                  Start your creator journey by uploading your first video.
                </p>
                <Button
                  data-testid="button-upload-first"
                  onClick={() => setActiveTab('upload')}
                  className="bg-gradient-to-r from-rose-600 to-orange-600"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Video
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {myVideos.items.map((video) => (
                  <VideoListItem
                    key={video.id}
                    video={video}
                    onEdit={() =>
                      toast({
                        title: 'Coming Soon',
                        description: 'Edit functionality will be available soon.',
                      })
                    }
                    onTogglePublish={() => {
                      if (video.status === 'published') {
                        toast({
                          title: 'Coming Soon',
                          description: 'Unpublish functionality will be available soon.',
                        });
                      } else {
                        publishMutation.mutate(video.id);
                      }
                    }}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="upload">
            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Upload className="w-5 h-5 text-rose-400" />
                  Upload New Video
                </CardTitle>
                <CardDescription>
                  Share your content with the world
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                      <div
                        data-testid="dropzone-video"
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                          selectedFile
                            ? 'border-rose-500/50 bg-rose-500/5'
                            : 'border-white/10 hover:border-rose-500/30'
                        }`}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="video/*"
                          onChange={handleFileSelect}
                          className="hidden"
                          data-testid="input-video-file"
                        />
                        {selectedFile ? (
                          <div className="space-y-2">
                            <CheckCircle className="w-12 h-12 text-rose-400 mx-auto" />
                            <p className="text-white font-medium">{selectedFile.name}</p>
                            <p className="text-sm text-slate-400">
                              {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <FileVideo className="w-12 h-12 text-slate-500 mx-auto" />
                            <p className="text-white font-medium">
                              Click to upload video
                            </p>
                            <p className="text-sm text-slate-400">
                              MP4, WebM, MOV, AVI, MKV up to 5GB
                            </p>
                          </div>
                        )}
                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <div className="mt-4">
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-rose-500 to-orange-500 transition-all duration-300"
                                style={{ width: `${uploadProgress}%` }}
                              />
                            </div>
                            <p className="text-sm text-slate-400 mt-2">
                              Uploading... {uploadProgress}%
                            </p>
                          </div>
                        )}
                      </div>

                      <div
                        data-testid="dropzone-cover"
                        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                          coverFile
                            ? 'border-orange-500/50 bg-orange-500/5'
                            : 'border-white/10 hover:border-orange-500/30'
                        }`}
                        onClick={() => coverInputRef.current?.click()}
                      >
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleCoverSelect}
                          className="hidden"
                          data-testid="input-cover-file"
                        />
                        {coverFile ? (
                          <div className="space-y-2">
                            <CheckCircle className="w-12 h-12 text-orange-400 mx-auto" />
                            <p className="text-white font-medium">{coverFile.name}</p>
                            <p className="text-sm text-slate-400">Cover image selected</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Image className="w-12 h-12 text-slate-500 mx-auto" />
                            <p className="text-white font-medium">
                              Click to upload cover
                            </p>
                            <p className="text-sm text-slate-400">
                              16:9 aspect ratio recommended
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Title</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-title"
                              placeholder="Enter video title"
                              className="bg-white/5 border-white/10 text-white"
                              {...field}
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
                              placeholder="Describe your video..."
                              className="bg-white/5 border-white/10 text-white min-h-[100px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="priceUsd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Purchase Price (USD)</FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-price"
                                type="number"
                                step="0.01"
                                min="0"
                                className="bg-white/5 border-white/10 text-white"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-slate-500">
                              Rental: 30% of purchase price
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Category</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger
                                  data-testid="select-category"
                                  className="bg-white/5 border-white/10 text-white"
                                >
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-[#1a1a1a] border-white/10">
                                {categories.map((cat) => (
                                  <SelectItem key={cat.value} value={cat.value}>
                                    {cat.label}
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
                        name="policy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">License Type</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger
                                  data-testid="select-policy"
                                  className="bg-white/5 border-white/10 text-white"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-[#1a1a1a] border-white/10">
                                <SelectItem value="rent_hours">Rent + Purchase</SelectItem>
                                <SelectItem value="perpetual">Purchase Only</SelectItem>
                                <SelectItem value="stream_ppv">Pay Per View</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="tags"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Tags</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-tags"
                              placeholder="action, thriller, indie (comma separated)"
                              className="bg-white/5 border-white/10 text-white"
                              {...field}
                            />
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
                          <FormLabel className="text-white">Limited Edition (Optional)</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-edition"
                              type="number"
                              min="0"
                              placeholder="Leave 0 for unlimited"
                              className="bg-white/5 border-white/10 text-white"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            Set a limit on total purchases (0 = unlimited)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-4">
                      <Button
                        data-testid="button-create-draft"
                        type="submit"
                        variant="outline"
                        disabled={createMutation.isPending}
                        className="flex-1 border-white/10 text-white hover:bg-white/5"
                      >
                        {createMutation.isPending && !selectedFile ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : null}
                        Save as Draft
                      </Button>
                      <Button
                        data-testid="button-create-publish"
                        type="submit"
                        disabled={createMutation.isPending || !selectedFile}
                        className="flex-1 bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500"
                      >
                        {createMutation.isPending && selectedFile ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        Upload & Publish
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
