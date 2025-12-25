import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  User,
  Users,
  Search,
  Loader2,
  Save,
  X,
  CheckCircle,
  Copy
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { SDK } from '@/lib/sdk';
import type { DirectoryEntry } from '@/lib/sdk/modules/directory';

export default function DirectoryPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedEntry, setSelectedEntry] = useState<DirectoryEntry | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formWallet, setFormWallet] = useState('');
  const [formName, setFormName] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formAvatar, setFormAvatar] = useState('');

  const { data: directoryData, isLoading } = useQuery({
    queryKey: ['/api/nexus/directory'],
    queryFn: () => SDK.directory.list(),
  });

  const addMutation = useMutation({
    mutationFn: ({ wallet, metadata }: { wallet: string; metadata: { name?: string; bio?: string; avatar?: string } }) =>
      SDK.directory.add(wallet, metadata),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/directory'] });
      setIsAdding(false);
      setSelectedEntry(result.entry);
      resetForm();
      toast({ title: 'Contact added' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to add contact' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ wallet, data }: { wallet: string; data: { name?: string; bio?: string; avatar?: string } }) =>
      SDK.directory.update(wallet, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/directory'] });
      setIsEditing(false);
      setSelectedEntry(result.entry);
      toast({ title: 'Contact updated' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to update contact' });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (wallet: string) => SDK.directory.remove(wallet),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/directory'] });
      setSelectedEntry(null);
      toast({ title: 'Contact removed' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to remove contact' });
    },
  });

  const entries = directoryData?.entries || [];

  const filteredEntries = entries.filter(
    (entry) =>
      entry.wallet.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setFormWallet('');
    setFormName('');
    setFormBio('');
    setFormAvatar('');
  };

  const startEditing = (entry: DirectoryEntry) => {
    setFormWallet(entry.wallet);
    setFormName(entry.name || '');
    setFormBio(entry.bio || '');
    setFormAvatar(entry.avatar || '');
    setIsEditing(true);
  };

  const startAdding = () => {
    resetForm();
    setIsAdding(true);
    setSelectedEntry(null);
  };

  const handleSave = () => {
    if (isAdding) {
      if (!formWallet.trim()) {
        toast({ variant: 'destructive', title: 'Wallet address is required' });
        return;
      }
      addMutation.mutate({
        wallet: formWallet,
        metadata: { name: formName, bio: formBio, avatar: formAvatar },
      });
    } else if (selectedEntry) {
      updateMutation.mutate({
        wallet: selectedEntry.wallet,
        data: { name: formName, bio: formBio, avatar: formAvatar },
      });
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setIsEditing(false);
    resetForm();
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({ title: 'Address copied' });
  };

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/10 via-transparent to-teal-900/10 pointer-events-none" />

      <div className="relative z-10 h-screen flex">
        <div className="w-80 border-r border-white/5 flex flex-col bg-[#1a1a1a]/40">
          <div className="p-4 border-b border-white/5">
            <div className="flex items-center gap-3 mb-4">
              <Button
                data-testid="button-back-hub"
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/launcher')}
                className="text-slate-400 hover:text-white hover:bg-white/5"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-lg font-semibold text-white">Directory</h1>
              <Button
                data-testid="button-add-contact"
                size="sm"
                onClick={startAdding}
                className="ml-auto bg-emerald-600 hover:bg-emerald-500"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                data-testid="input-search-contacts"
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#252525] border-white/5 text-white placeholder:text-slate-500 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Loading contacts...</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="p-8 text-center">
                <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No contacts yet</p>
                <p className="text-xs text-slate-600 mt-1">Add your first contact</p>
              </div>
            ) : (
              filteredEntries.map((entry) => (
                <button
                  key={entry.wallet}
                  data-testid={`button-contact-${entry.wallet.slice(0, 8)}`}
                  onClick={() => {
                    setSelectedEntry(entry);
                    setIsAdding(false);
                    setIsEditing(false);
                  }}
                  className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors border-b border-white/5 ${
                    selectedEntry?.wallet === entry.wallet ? 'bg-emerald-600/10 border-l-2 border-l-emerald-500' : ''
                  }`}
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center overflow-hidden">
                    {entry.avatar ? (
                      <img src={entry.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {entry.name || `${entry.wallet.slice(0, 6)}...${entry.wallet.slice(-4)}`}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {entry.wallet.slice(0, 10)}...{entry.wallet.slice(-6)}
                    </p>
                  </div>
                  {entry.verified && (
                    <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {isAdding || isEditing ? (
            <div className="flex-1 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-white">
                  {isAdding ? 'Add Contact' : 'Edit Contact'}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    data-testid="button-cancel-form"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    data-testid="button-save-contact"
                    size="sm"
                    onClick={handleSave}
                    disabled={addMutation.isPending || updateMutation.isPending}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600"
                  >
                    {(addMutation.isPending || updateMutation.isPending) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-4 max-w-lg">
                {isAdding && (
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Wallet Address *</label>
                    <Input
                      data-testid="input-wallet"
                      placeholder="0x..."
                      value={formWallet}
                      onChange={(e) => setFormWallet(e.target.value)}
                      className="bg-[#252525] border-white/5 text-white"
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Display Name</label>
                  <Input
                    data-testid="input-name"
                    placeholder="Enter name..."
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="bg-[#252525] border-white/5 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Avatar URL</label>
                  <Input
                    data-testid="input-avatar"
                    placeholder="https://..."
                    value={formAvatar}
                    onChange={(e) => setFormAvatar(e.target.value)}
                    className="bg-[#252525] border-white/5 text-white"
                  />
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">Bio</label>
                  <Textarea
                    data-testid="input-bio"
                    placeholder="Write a short bio..."
                    value={formBio}
                    onChange={(e) => setFormBio(e.target.value)}
                    className="bg-[#252525] border-white/5 text-white resize-none"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          ) : selectedEntry ? (
            <div className="flex-1 flex flex-col">
              <div className="p-6 border-b border-white/5">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center overflow-hidden">
                    {selectedEntry.avatar ? (
                      <img src={selectedEntry.avatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-8 h-8 text-white" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-white">
                        {selectedEntry.name || 'Unknown'}
                      </h2>
                      {selectedEntry.verified && (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-0">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Verified
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-sm text-slate-400 font-mono">
                        {selectedEntry.wallet.slice(0, 12)}...{selectedEntry.wallet.slice(-8)}
                      </p>
                      <Button
                        data-testid="button-copy-address"
                        variant="ghost"
                        size="sm"
                        onClick={() => copyAddress(selectedEntry.wallet)}
                        className="h-6 w-6 p-0 text-slate-400 hover:text-white"
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      data-testid="button-edit-contact"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(selectedEntry)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit3 className="w-4 h-4" />
                    </Button>
                    <Button
                      data-testid="button-remove-contact"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeMutation.mutate(selectedEntry.wallet)}
                      disabled={removeMutation.isPending}
                      className="text-red-400 hover:text-red-300"
                    >
                      {removeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              <div className="flex-1 p-6">
                {selectedEntry.bio ? (
                  <div>
                    <h3 className="text-sm font-medium text-slate-400 mb-2">Bio</h3>
                    <p className="text-sm text-slate-300">{selectedEntry.bio}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No bio provided</p>
                )}
                <div className="mt-6 text-xs text-slate-600">
                  Added: {new Date(selectedEntry.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-[#252525] flex items-center justify-center mx-auto mb-4">
                  <Users className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Select a contact</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Choose a contact from the sidebar or add a new one.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
