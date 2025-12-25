import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, User, CheckCircle, Edit2, Save } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface DirectoryEntry {
  id: string;
  walletAddress: string;
  ensName?: string;
  basename?: string;
  avatarUrl?: string;
  bio?: string;
  isVerified: number;
  metadata?: any;
  lastResolvedAt: string;
  createdAt: string;
  updatedAt: string;
}

export default function DirectoryPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [ensName, setEnsName] = useState('');
  const [basename, setBasename] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');

  const { data: entries = [], isLoading } = useQuery<DirectoryEntry[]>({
    queryKey: ['/api/directory', searchQuery],
    queryFn: async () => {
      const params = searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '';
      return apiRequest(`/api/directory${params}`);
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (data: { ensName?: string; basename?: string; avatarUrl?: string; bio?: string }) => {
      return apiRequest('/api/directory', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/directory'] });
      setIsEditingProfile(false);
      toast({
        title: 'Profile updated',
        description: 'Your directory profile has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Failed to update profile',
        description: error.message,
      });
    },
  });

  const handleSaveProfile = () => {
    updateProfile.mutate({
      ensName: ensName || undefined,
      basename: basename || undefined,
      avatarUrl: avatarUrl || undefined,
      bio: bio || undefined,
    });
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Directory</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              Contact directory with ENS and Basename resolution
            </p>
          </div>
          <Button
            data-testid="button-edit-profile"
            onClick={() => setIsEditingProfile(!isEditingProfile)}
            variant="outline"
            className="border-slate-200 dark:border-slate-800"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            {isEditingProfile ? 'Cancel' : 'Edit Profile'}
          </Button>
        </div>

        {isEditingProfile && (
          <Card className="mb-6" data-testid="card-edit-profile">
            <CardHeader>
              <CardTitle>Edit Your Profile</CardTitle>
              <CardDescription>Update your directory information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="input-ens-name">ENS Name</Label>
                <Input
                  id="input-ens-name"
                  data-testid="input-ens-name"
                  placeholder="vitalik.eth"
                  value={ensName}
                  onChange={(e) => setEnsName(e.target.value)}
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="input-basename">Basename</Label>
                <Input
                  id="input-basename"
                  data-testid="input-basename"
                  placeholder="user.base.eth"
                  value={basename}
                  onChange={(e) => setBasename(e.target.value)}
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="input-avatar-url">Avatar URL</Label>
                <Input
                  id="input-avatar-url"
                  data-testid="input-avatar-url"
                  placeholder="https://..."
                  value={avatarUrl}
                  onChange={(e) => setAvatarUrl(e.target.value)}
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="textarea-bio">Bio</Label>
                <Textarea
                  id="textarea-bio"
                  data-testid="textarea-bio"
                  placeholder="Tell us about yourself..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                />
              </div>

              <Button
                data-testid="button-save-profile"
                onClick={handleSaveProfile}
                disabled={updateProfile.isPending}
                className="bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Profile
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              data-testid="input-search-directory"
              placeholder="Search by address, ENS, or Basename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            Loading directory...
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            {searchQuery ? 'No entries found matching your search.' : 'Directory is empty.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {entries.map((entry) => (
              <Card key={entry.id} data-testid={`directory-entry-${entry.id}`} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start gap-3">
                    {entry.avatarUrl ? (
                      <img
                        src={entry.avatarUrl}
                        alt={entry.ensName || entry.walletAddress}
                        className="w-12 h-12 rounded-full object-cover border-2 border-slate-200 dark:border-slate-800"
                        data-testid={`avatar-${entry.id}`}
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-purple-600 flex items-center justify-center">
                        <User className="w-6 h-6 text-white" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg line-clamp-1">
                          {entry.ensName || entry.basename || shortenAddress(entry.walletAddress)}
                        </CardTitle>
                        {entry.isVerified === 1 && (
                          <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" data-testid={`verified-${entry.id}`} />
                        )}
                      </div>
                      <CardDescription className="text-xs font-mono">
                        {shortenAddress(entry.walletAddress)}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {entry.ensName && entry.basename && (
                    <div className="flex flex-wrap gap-2">
                      {entry.ensName && (
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          {entry.ensName}
                        </span>
                      )}
                      {entry.basename && (
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          {entry.basename}
                        </span>
                      )}
                    </div>
                  )}
                  {entry.bio && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                      {entry.bio}
                    </p>
                  )}
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Last resolved: {new Date(entry.lastResolvedAt).toLocaleDateString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
