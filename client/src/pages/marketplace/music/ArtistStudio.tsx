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
  Music,
  Upload,
  Plus,
  Edit,
  Eye,
  EyeOff,
  DollarSign,
  Loader2,
  FileAudio,
  Image,
  CheckCircle,
  TrendingUp,
  Headphones,
  Mic2,
  Wallet,
  Album,
  Play,
  BarChart3,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { P3Marketplace, type Asset, type CreateAssetRequest } from '@/lib/sdk/marketplace';
import { queryClient } from '@/lib/queryClient';

const sdk = new P3Marketplace();

const genres = [
  { value: 'pop', label: 'Pop' },
  { value: 'rock', label: 'Rock' },
  { value: 'hip-hop', label: 'Hip-Hop' },
  { value: 'electronic', label: 'Electronic' },
  { value: 'jazz', label: 'Jazz' },
  { value: 'classical', label: 'Classical' },
  { value: 'r&b', label: 'R&B' },
  { value: 'indie', label: 'Indie' },
  { value: 'country', label: 'Country' },
  { value: 'metal', label: 'Metal' },
];

const createTrackSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  priceUsd: z.coerce.number().min(0, 'Price must be positive'),
  genre: z.string().min(1, 'Genre is required'),
  tags: z.string().optional(),
  policy: z.enum(['perpetual', 'stream_ppv']),
  editionTotal: z.coerce.number().int().min(0).optional(),
  isAlbum: z.boolean(),
});

type CreateTrackForm = z.infer<typeof createTrackSchema>;

function TrackListItem({
  track,
  onEdit,
  onTogglePublish,
}: {
  track: Asset;
  onEdit: () => void;
  onTogglePublish: () => void;
}) {
  const isPublished = track.status === 'published';
  const isAlbum = track.type === 'album';

  return (
    <Card
      data-testid={`card-my-track-${track.id}`}
      className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden relative group">
            {track.coverUrl ? (
              <img
                src={track.coverUrl}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            ) : isAlbum ? (
              <Album className="w-6 h-6 text-purple-400" />
            ) : (
              <Music className="w-6 h-6 text-cyan-400" />
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Play className="w-6 h-6 text-white fill-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white truncate">
                    {track.title}
                  </h3>
                  {isAlbum && (
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-0 text-xs">
                      Album
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-slate-400">
                  {track.category || 'Uncategorized'}
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
                {track.priceUsd}
              </span>
              <span className="flex items-center gap-1">
                <Headphones className="w-3 h-3" />
                {track.totalStreams.toLocaleString()}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid={`button-toggle-publish-${track.id}`}
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
              data-testid={`button-edit-${track.id}`}
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
  iconColor = 'text-cyan-400',
}: {
  icon: typeof Music;
  label: string;
  value: string | number;
  trend?: string;
  iconColor?: string;
}) {
  return (
    <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center">
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const walletAddress = localStorage.getItem('walletAddress');

  const form = useForm<CreateTrackForm>({
    resolver: zodResolver(createTrackSchema),
    defaultValues: {
      title: '',
      description: '',
      priceUsd: 2.99,
      genre: '',
      tags: '',
      policy: 'stream_ppv',
      editionTotal: 0,
      isAlbum: false,
    },
  });

  const { data: myTracks, isLoading: isLoadingTracks } = useQuery<{
    items: Asset[];
    total: number;
  }>({
    queryKey: ['/api/marketplace/assets/mine', { type: 'track' }],
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
    mutationFn: async (data: CreateTrackForm) => {
      const request: CreateAssetRequest = {
        type: data.isAlbum ? 'album' : 'track',
        title: data.title,
        description: data.description,
        priceUsd: data.priceUsd,
        category: data.genre,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()) : [],
        policy: data.policy,
        editionTotal: data.editionTotal || undefined,
      };
      
      if (data.isAlbum) {
        return sdk.music.createAlbum(request);
      }
      return sdk.music.createTrack(request);
    },
    onSuccess: async (result) => {
      if (selectedFile) {
        try {
          setUploadProgress(10);
          await sdk.music.uploadAudio(result.assetId, selectedFile);
          setUploadProgress(100);
          toast({
            title: 'Track Created',
            description: 'Your track has been created and audio uploaded.',
          });
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'Track created but audio upload failed.',
          });
        } finally {
          setUploadProgress(0);
        }
      } else {
        toast({
          title: 'Track Created',
          description: 'Your track draft has been created.',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/assets/mine'] });
      form.reset();
      setSelectedFile(null);
      setCoverFile(null);
      setActiveTab('my-tracks');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Unable to create track.',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (assetId: string) => {
      return sdk.music.publishTrack(assetId);
    },
    onSuccess: () => {
      toast({
        title: 'Track Published',
        description: 'Your track is now live in the marketplace.',
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
        'audio/mpeg',
        'audio/mp3',
        'audio/wav',
        'audio/flac',
        'audio/aac',
        'audio/ogg',
        'audio/x-m4a',
      ];
      if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|flac|aac|ogg|m4a)$/i)) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload an MP3, WAV, FLAC, AAC, OGG, or M4A file.',
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
          description: 'Please upload an image file for the cover art.',
        });
        return;
      }
      setCoverFile(file);
    }
  };

  const onSubmit = (data: CreateTrackForm) => {
    createMutation.mutate(data);
  };

  if (!walletAddress) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mx-auto mb-4">
            <Wallet className="w-8 h-8 text-cyan-400" />
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
            className="bg-gradient-to-r from-cyan-600 to-purple-600"
          >
            Go to Launcher
          </Button>
        </Card>
      </div>
    );
  }

  const totalStreams =
    myTracks?.items.reduce((sum, t) => sum + t.totalStreams, 0) || 0;
  const albumCount =
    myTracks?.items.filter((t) => t.type === 'album').length || 0;

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
              <Mic2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Artist Studio</h1>
              <p className="text-xs text-slate-400">
                Upload and manage your music
              </p>
            </div>
          </div>
        </header>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#1a1a1a]/80 border border-white/5 mb-6">
            <TabsTrigger
              data-testid="tab-overview"
              value="overview"
              className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
            >
              Overview
            </TabsTrigger>
            <TabsTrigger
              data-testid="tab-my-tracks"
              value="my-tracks"
              className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
            >
              My Tracks
            </TabsTrigger>
            <TabsTrigger
              data-testid="tab-upload"
              value="upload"
              className="data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300"
            >
              Upload New
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <StatCard
                icon={Music}
                label="Total Tracks"
                value={myTracks?.total || 0}
                iconColor="text-cyan-400"
              />
              <StatCard
                icon={Album}
                label="Albums"
                value={albumCount}
                iconColor="text-purple-400"
              />
              <StatCard
                icon={Headphones}
                label="Total Streams"
                value={totalStreams.toLocaleString()}
                iconColor="text-green-400"
              />
              <StatCard
                icon={DollarSign}
                label="Total Earnings"
                value={`$${treasuryData?.totalEarned || '0.00'}`}
                trend={treasuryData?.pending ? `$${treasuryData.pending} pending` : undefined}
                iconColor="text-amber-400"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
                <CardHeader>
                  <CardTitle className="text-white">Quick Actions</CardTitle>
                  <CardDescription>Get started with your music</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4">
                  <Button
                    data-testid="button-upload-track"
                    onClick={() => setActiveTab('upload')}
                    className="h-auto py-6 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="w-8 h-8" />
                      <span>Upload New Track</span>
                    </div>
                  </Button>
                  <Button
                    data-testid="button-view-tracks"
                    variant="outline"
                    onClick={() => setActiveTab('my-tracks')}
                    className="h-auto py-6 border-white/10 text-white hover:bg-white/5"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <BarChart3 className="w-8 h-8" />
                      <span>View My Tracks</span>
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
                  {myTracks?.items.length === 0 ? (
                    <div className="text-center py-8">
                      <Music className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400">No tracks uploaded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {myTracks?.items.slice(0, 3).map((track) => (
                        <div
                          key={track.id}
                          className="flex items-center gap-3 p-3 rounded-xl bg-white/5"
                        >
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center overflow-hidden">
                            {track.coverUrl ? (
                              <img src={track.coverUrl} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Music className="w-4 h-4 text-cyan-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-medium truncate">{track.title}</p>
                            <p className="text-xs text-slate-400">{track.totalStreams} streams</p>
                          </div>
                          <Badge
                            variant="secondary"
                            className={track.status === 'published' ? 'bg-green-500/20 text-green-300 border-0' : 'bg-slate-500/20 text-slate-300 border-0'}
                          >
                            {track.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="my-tracks">
            {isLoadingTracks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              </div>
            ) : !myTracks?.items.length ? (
              <Card className="bg-[#1a1a1a]/60 border-white/5 p-12 text-center">
                <Music className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  No tracks yet
                </h3>
                <p className="text-slate-400 mb-6">
                  Start your music journey by uploading your first track.
                </p>
                <Button
                  data-testid="button-upload-first"
                  onClick={() => setActiveTab('upload')}
                  className="bg-gradient-to-r from-cyan-600 to-purple-600"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Your First Track
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {myTracks.items.map((track) => (
                  <TrackListItem
                    key={track.id}
                    track={track}
                    onEdit={() =>
                      toast({
                        title: 'Coming Soon',
                        description: 'Edit functionality will be available soon.',
                      })
                    }
                    onTogglePublish={() => {
                      if (track.status === 'published') {
                        toast({
                          title: 'Coming Soon',
                          description: 'Unpublish functionality will be available soon.',
                        });
                      } else {
                        publishMutation.mutate(track.id);
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
                <CardTitle className="text-white">Upload New Music</CardTitle>
                <CardDescription>
                  Fill in the details to upload your track or album
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control as any}
                      name="isAlbum"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Type</FormLabel>
                          <div className="flex gap-4">
                            <Button
                              type="button"
                              data-testid="button-type-track"
                              variant={!field.value ? 'default' : 'outline'}
                              onClick={() => field.onChange(false)}
                              className={!field.value ? 'bg-cyan-600' : 'border-white/10 text-white hover:bg-white/5'}
                            >
                              <Music className="w-4 h-4 mr-2" />
                              Single Track
                            </Button>
                            <Button
                              type="button"
                              data-testid="button-type-album"
                              variant={field.value ? 'default' : 'outline'}
                              onClick={() => field.onChange(true)}
                              className={field.value ? 'bg-purple-600' : 'border-white/10 text-white hover:bg-white/5'}
                            >
                              <Album className="w-4 h-4 mr-2" />
                              Album
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control as any}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Title</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-title"
                              placeholder="Enter track title"
                              className="bg-[#252525] border-white/10 text-white"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control as any}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Description</FormLabel>
                          <FormControl>
                            <Textarea
                              data-testid="input-description"
                              placeholder="Describe your music..."
                              className="bg-[#252525] border-white/10 text-white min-h-[100px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control as any}
                        name="priceUsd"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">
                              Price (USD)
                            </FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-price"
                                type="number"
                                step="0.01"
                                min="0"
                                className="bg-[#252525] border-white/10 text-white"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control as any}
                        name="genre"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">Genre</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger
                                  data-testid="select-genre"
                                  className="bg-[#252525] border-white/10 text-white"
                                >
                                  <SelectValue placeholder="Select genre" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-[#1a1a1a] border-white/10">
                                {genres.map((g) => (
                                  <SelectItem key={g.value} value={g.value}>
                                    {g.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control as any}
                      name="tags"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Tags</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-tags"
                              placeholder="Enter tags separated by commas"
                              className="bg-[#252525] border-white/10 text-white"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            e.g., chill, summer, upbeat
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control as any}
                        name="policy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">
                              Access Policy
                            </FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger
                                  data-testid="select-policy"
                                  className="bg-[#252525] border-white/10 text-white"
                                >
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-[#1a1a1a] border-white/10">
                                <SelectItem value="stream_ppv">
                                  Pay-per-stream
                                </SelectItem>
                                <SelectItem value="perpetual">
                                  Buy Forever
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormDescription className="text-slate-500">
                              How listeners can access your music
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control as any}
                        name="editionTotal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">
                              Limited Edition (optional)
                            </FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-edition"
                                type="number"
                                min="0"
                                placeholder="0 for unlimited"
                                className="bg-[#252525] border-white/10 text-white"
                                {...field}
                              />
                            </FormControl>
                            <FormDescription className="text-slate-500">
                              Leave 0 for unlimited copies
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Audio File
                        </label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="audio/*,.mp3,.wav,.flac,.aac,.ogg,.m4a"
                          onChange={handleFileSelect}
                          className="hidden"
                          data-testid="input-audio-file"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-32 border-dashed border-white/20 text-white hover:bg-white/5 flex flex-col items-center justify-center gap-2"
                          data-testid="button-select-audio"
                        >
                          {selectedFile ? (
                            <>
                              <CheckCircle className="w-8 h-8 text-green-400" />
                              <span className="text-sm text-green-300">
                                {selectedFile.name}
                              </span>
                              <span className="text-xs text-slate-500">
                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            </>
                          ) : (
                            <>
                              <FileAudio className="w-8 h-8 text-slate-400" />
                              <span className="text-sm text-slate-400">
                                Click to upload audio
                              </span>
                              <span className="text-xs text-slate-500">
                                MP3, WAV, FLAC, AAC, OGG, M4A
                              </span>
                            </>
                          )}
                        </Button>
                        {uploadProgress > 0 && uploadProgress < 100 && (
                          <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Cover Art (optional)
                        </label>
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleCoverSelect}
                          className="hidden"
                          data-testid="input-cover-file"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => coverInputRef.current?.click()}
                          className="w-full h-32 border-dashed border-white/20 text-white hover:bg-white/5 flex flex-col items-center justify-center gap-2"
                          data-testid="button-select-cover"
                        >
                          {coverFile ? (
                            <>
                              <CheckCircle className="w-8 h-8 text-green-400" />
                              <span className="text-sm text-green-300">
                                {coverFile.name}
                              </span>
                            </>
                          ) : (
                            <>
                              <Image className="w-8 h-8 text-slate-400" />
                              <span className="text-sm text-slate-400">
                                Click to upload cover
                              </span>
                              <span className="text-xs text-slate-500">
                                PNG, JPG, WebP (1:1 ratio)
                              </span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <Button
                        type="submit"
                        data-testid="button-create-track"
                        className="flex-1 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500"
                        disabled={createMutation.isPending}
                      >
                        {createMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4 mr-2" />
                            Create {form.watch('isAlbum') ? 'Album' : 'Track'}
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        data-testid="button-cancel"
                        onClick={() => {
                          form.reset();
                          setSelectedFile(null);
                          setCoverFile(null);
                          setActiveTab('overview');
                        }}
                        className="border-white/10 text-white hover:bg-white/5"
                      >
                        Cancel
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
