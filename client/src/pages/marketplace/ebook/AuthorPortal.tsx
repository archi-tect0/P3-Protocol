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
  BookOpen,
  Upload,
  Plus,
  Edit,
  Eye,
  EyeOff,
  DollarSign,
  Loader2,
  FileText,
  Image,
  CheckCircle,
  TrendingUp,
  Download,
  PenTool,
  Wallet,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { P3Marketplace, type Asset, type CreateAssetRequest } from '@/lib/sdk/marketplace';
import { queryClient } from '@/lib/queryClient';

const sdk = new P3Marketplace();

const categories = [
  { value: 'fiction', label: 'Fiction' },
  { value: 'non-fiction', label: 'Non-Fiction' },
  { value: 'technical', label: 'Technical' },
  { value: 'business', label: 'Business' },
  { value: 'self-help', label: 'Self Help' },
  { value: 'biography', label: 'Biography' },
  { value: 'science', label: 'Science' },
];

const createEbookSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional(),
  priceUsd: z.coerce.number().min(0, 'Price must be positive'),
  category: z.string().min(1, 'Category is required'),
  tags: z.string().optional(),
  policy: z.enum(['perpetual', 'lend_days']),
  editionTotal: z.coerce.number().int().min(0).optional(),
});

type CreateEbookForm = z.infer<typeof createEbookSchema>;

function EbookListItem({
  ebook,
  onEdit,
  onTogglePublish,
}: {
  ebook: Asset;
  onEdit: () => void;
  onTogglePublish: () => void;
}) {
  const isPublished = ebook.status === 'published';

  return (
    <Card
      data-testid={`card-my-ebook-${ebook.id}`}
      className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5"
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="w-16 h-20 rounded-lg bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {ebook.coverUrl ? (
              <img
                src={ebook.coverUrl}
                alt={ebook.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <BookOpen className="w-6 h-6 text-purple-400" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-white truncate">
                  {ebook.title}
                </h3>
                <p className="text-sm text-slate-400">
                  {ebook.category || 'Uncategorized'}
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
                {ebook.priceUsd}
              </span>
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3" />
                {ebook.totalDownloads}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              data-testid={`button-toggle-publish-${ebook.id}`}
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
              data-testid={`button-edit-${ebook.id}`}
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
}: {
  icon: typeof BookOpen;
  label: string;
  value: string | number;
  trend?: string;
}) {
  return (
    <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-purple-400" />
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

export default function AuthorPortal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const walletAddress = localStorage.getItem('walletAddress');

  const form = useForm<CreateEbookForm>({
    resolver: zodResolver(createEbookSchema),
    defaultValues: {
      title: '',
      description: '',
      priceUsd: 9.99,
      category: '',
      tags: '',
      policy: 'perpetual',
      editionTotal: 0,
    },
  });

  const { data: myEbooks, isLoading: isLoadingEbooks } = useQuery<{
    items: Asset[];
    total: number;
  }>({
    queryKey: ['/api/marketplace/assets/mine'],
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
    mutationFn: async (data: CreateEbookForm) => {
      const request: CreateAssetRequest = {
        type: 'ebook',
        title: data.title,
        description: data.description,
        priceUsd: data.priceUsd,
        category: data.category,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()) : [],
        policy: data.policy,
        editionTotal: data.editionTotal || undefined,
      };
      return sdk.ebook.createAsset(request);
    },
    onSuccess: async (result) => {
      if (selectedFile) {
        try {
          await sdk.ebook.uploadContent(result.assetId, selectedFile);
          toast({
            title: 'Ebook Created',
            description: 'Your ebook has been created and content uploaded.',
          });
        } catch (error) {
          toast({
            variant: 'destructive',
            title: 'Upload Failed',
            description: 'Ebook created but content upload failed.',
          });
        }
      } else {
        toast({
          title: 'Ebook Created',
          description: 'Your ebook draft has been created.',
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/assets/mine'] });
      form.reset();
      setSelectedFile(null);
      setCoverFile(null);
      setActiveTab('my-ebooks');
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Creation Failed',
        description: error.message || 'Unable to create ebook.',
      });
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (assetId: string) => {
      return sdk.ebook.publishAsset(assetId);
    },
    onSuccess: () => {
      toast({
        title: 'Ebook Published',
        description: 'Your ebook is now live in the marketplace.',
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

  const unpublishMutation = useMutation({
    mutationFn: async (assetId: string) => {
      return sdk.ebook.unpublishAsset(assetId);
    },
    onSuccess: () => {
      toast({
        title: 'Ebook Unpublished',
        description: 'Your ebook has been removed from the marketplace.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/assets/mine'] });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Unpublish Failed',
        description: error.message,
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/epub+zip',
        'application/pdf',
        'application/x-mobipocket-ebook',
      ];
      if (!validTypes.includes(file.type)) {
        toast({
          variant: 'destructive',
          title: 'Invalid File Type',
          description: 'Please upload an EPUB, PDF, or MOBI file.',
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

  const onSubmit = (data: CreateEbookForm) => {
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
            Author Portal.
          </p>
          <Button
            data-testid="button-go-launcher"
            onClick={() => setLocation('/launcher')}
            className="bg-gradient-to-r from-purple-600 to-indigo-600"
          >
            Go to Launcher
          </Button>
        </Card>
      </div>
    );
  }

  const totalDownloads =
    myEbooks?.items.reduce((sum, e) => sum + e.totalDownloads, 0) || 0;
  const publishedCount =
    myEbooks?.items.filter((e) => e.status === 'published').length || 0;

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
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <PenTool className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Author Portal</h1>
              <p className="text-xs text-slate-400">
                Manage your ebooks and earnings
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
              data-testid="tab-my-ebooks"
              value="my-ebooks"
              data-state={activeTab === 'my-ebooks' ? 'active' : 'inactive'}
              onClick={() => setActiveTab('my-ebooks')}
              className="data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300"
            >
              My Ebooks
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
                icon={BookOpen}
                label="Total Ebooks"
                value={myEbooks?.total || 0}
              />
              <StatCard
                icon={Eye}
                label="Published"
                value={publishedCount}
              />
              <StatCard
                icon={Download}
                label="Total Downloads"
                value={totalDownloads}
              />
              <StatCard
                icon={DollarSign}
                label="Total Earnings"
                value={`$${treasuryData?.totalEarned || '0.00'}`}
                trend={treasuryData?.pending ? `$${treasuryData.pending} pending` : undefined}
              />
            </div>

            <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5">
              <CardHeader>
                <CardTitle className="text-white">Quick Actions</CardTitle>
                <CardDescription>Get started with your author journey</CardDescription>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-4">
                <Button
                  data-testid="button-create-ebook"
                  onClick={() => setActiveTab('create')}
                  className="h-auto py-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                >
                  <div className="flex flex-col items-center gap-2">
                    <Plus className="w-8 h-8" />
                    <span>Create New Ebook</span>
                  </div>
                </Button>
                <Button
                  data-testid="button-view-analytics"
                  variant="outline"
                  onClick={() => setActiveTab('my-ebooks')}
                  className="h-auto py-6 border-white/10 text-white hover:bg-white/5"
                >
                  <div className="flex flex-col items-center gap-2">
                    <TrendingUp className="w-8 h-8" />
                    <span>View My Ebooks</span>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="my-ebooks" style={{ display: activeTab === 'my-ebooks' ? 'block' : 'none' }}>
            {isLoadingEbooks ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
              </div>
            ) : !myEbooks?.items.length ? (
              <Card className="bg-[#1a1a1a]/60 border-white/5 p-12 text-center">
                <BookOpen className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-white mb-2">
                  No ebooks yet
                </h3>
                <p className="text-slate-400 mb-6">
                  Start your author journey by creating your first ebook.
                </p>
                <Button
                  data-testid="button-create-first"
                  onClick={() => setActiveTab('create')}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Ebook
                </Button>
              </Card>
            ) : (
              <div className="space-y-4">
                {myEbooks.items.map((ebook) => (
                  <EbookListItem
                    key={ebook.id}
                    ebook={ebook}
                    onEdit={() =>
                      toast({
                        title: 'Coming Soon',
                        description: 'Edit functionality will be available soon.',
                      })
                    }
                    onTogglePublish={() => {
                      if (ebook.status === 'published') {
                        unpublishMutation.mutate(ebook.id);
                      } else {
                        publishMutation.mutate(ebook.id);
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
                <CardTitle className="text-white">Create New Ebook</CardTitle>
                <CardDescription>
                  Fill in the details to create your ebook
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white">Title</FormLabel>
                          <FormControl>
                            <Input
                              data-testid="input-title"
                              placeholder="Enter ebook title"
                              className="bg-[#252525] border-white/10 text-white"
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
                              placeholder="Describe your ebook..."
                              className="bg-[#252525] border-white/10 text-white min-h-[120px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
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
                                  className="bg-[#252525] border-white/10 text-white"
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
                              placeholder="Enter tags separated by commas"
                              className="bg-[#252525] border-white/10 text-white"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription className="text-slate-500">
                            Separate multiple tags with commas
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="policy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">
                              License Policy
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
                                <SelectItem value="perpetual">
                                  Perpetual (Buy Forever)
                                </SelectItem>
                                <SelectItem value="lend_days">
                                  Lending (Borrow for Days)
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="editionTotal"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white">
                              Edition Limit (0 = unlimited)
                            </FormLabel>
                            <FormControl>
                              <Input
                                data-testid="input-edition"
                                type="number"
                                min="0"
                                className="bg-[#252525] border-white/10 text-white"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Ebook File (EPUB, PDF, MOBI)
                        </label>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".epub,.pdf,.mobi,application/epub+zip,application/pdf,application/x-mobipocket-ebook"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          data-testid="button-upload-file"
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full border-white/10 text-white hover:bg-white/5"
                        >
                          {selectedFile ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                              {selectedFile.name}
                            </>
                          ) : (
                            <>
                              <FileText className="w-4 h-4 mr-2" />
                              Choose File
                            </>
                          )}
                        </Button>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-white mb-2">
                          Cover Image (optional)
                        </label>
                        <input
                          ref={coverInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleCoverSelect}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          data-testid="button-upload-cover"
                          variant="outline"
                          onClick={() => coverInputRef.current?.click()}
                          className="w-full border-white/10 text-white hover:bg-white/5"
                        >
                          {coverFile ? (
                            <>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                              {coverFile.name}
                            </>
                          ) : (
                            <>
                              <Image className="w-4 h-4 mr-2" />
                              Choose Cover
                            </>
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                      <Button
                        type="submit"
                        data-testid="button-create-submit"
                        disabled={createMutation.isPending}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                      >
                        {createMutation.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4 mr-2" />
                        )}
                        {createMutation.isPending
                          ? 'Creating...'
                          : 'Create Ebook'}
                      </Button>
                      <Button
                        type="button"
                        data-testid="button-cancel"
                        variant="outline"
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
