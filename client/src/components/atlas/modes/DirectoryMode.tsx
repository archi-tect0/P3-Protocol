import { useQuery } from '@tanstack/react-query';
import { MotionDiv, MotionButton } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { User, UserPlus, Search, CheckCircle, RefreshCw, AlertCircle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';

interface Contact {
  id: string;
  walletAddress: string;
  ensName?: string;
  basename?: string;
  avatarUrl?: string;
  bio?: string;
  isVerified?: boolean;
  createdAt: string;
}

interface ContactDisplay {
  id: string;
  address: string;
  displayName: string;
  avatar?: string;
  bio: string;
  verified: boolean;
  addedAt: string;
}

function formatTimeAgo(dateStr: string | number): string {
  if (!dateStr) return 'Unknown';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || 'Unknown';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function DirectoryMode() {
  const { pushReceipt, wallet } = useAtlasStore();
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, error, refetch } = useQuery<{ ok: boolean; contacts: Contact[]; total: number }>({
    queryKey: ['/api/nexus/directory', wallet],
    enabled: !!wallet,
    meta: { headers: { 'x-wallet-address': wallet || '' } }
  });

  useEffect(() => {
    if (data?.ok) {
      pushReceipt({
        id: `receipt-directory-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: data.contacts?.length ? 'atlas.render.directory' : 'atlas.render.directory.empty',
        endpoint: '/api/nexus/directory',
        timestamp: Date.now()
      });
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      pushReceipt({
        id: `receipt-directory-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.directory.error',
        endpoint: '/api/nexus/directory',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [error]);

  const contacts: ContactDisplay[] = (data?.contacts || []).map(c => ({
    id: c.id,
    address: c.walletAddress,
    displayName: c.ensName || c.basename || truncateAddress(c.walletAddress),
    avatar: c.avatarUrl,
    bio: c.bio || 'No bio available',
    verified: c.isVerified || false,
    addedAt: formatTimeAgo(c.createdAt)
  }));

  const filteredContacts = searchQuery 
    ? contacts.filter(c => 
        c.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.address.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : contacts;

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="directory-no-wallet">
        <Users className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to view directory</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="directory-loading">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="directory-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load directory</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-directory-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="directory-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-light text-white/80" data-testid="text-directory-title">Directory</h2>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            className="text-white/60 hover:text-white p-2"
            data-testid="button-directory-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <MotionButton
            className="flex items-center gap-2 px-3 py-2 rounded-lg
                       bg-cyan-400/10 border border-cyan-400/30 text-cyan-400
                       hover:bg-cyan-400/20 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            data-testid="button-add-contact"
          >
            <UserPlus className="w-4 h-4" />
            <span className="text-sm">Add Contact</span>
          </MotionButton>
        </div>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 
                     text-white/90 text-sm placeholder:text-white/30
                     focus:outline-none focus:border-cyan-400/50"
          data-testid="input-directory-search"
        />
      </div>

      {filteredContacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="directory-empty">
          <Users className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">
            {searchQuery ? 'No contacts found' : 'No contacts yet'}
          </p>
          <p className="text-white/40 text-sm">
            {searchQuery ? 'Try a different search term' : 'Add contacts to see them here'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" data-testid="directory-list">
          {filteredContacts.map((contact, index) => (
            <MotionDiv
              key={contact.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 
                         hover:border-white/20 cursor-pointer transition-all group"
              data-testid={`contact-item-${contact.id}`}
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400/30 to-purple-400/30 
                                flex items-center justify-center overflow-hidden">
                  {contact.avatar ? (
                    <img src={contact.avatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-white/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-medium text-white/90 group-hover:text-white truncate" data-testid={`text-contact-name-${contact.id}`}>
                      {contact.displayName}
                    </span>
                    {contact.verified && (
                      <CheckCircle className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    )}
                  </div>
                  <div className="text-xs font-mono text-white/40 mb-2 truncate" data-testid={`text-contact-address-${contact.id}`}>
                    {truncateAddress(contact.address)}
                  </div>
                  <p className="text-sm text-white/50 line-clamp-2" data-testid={`text-contact-bio-${contact.id}`}>
                    {contact.bio}
                  </p>
                </div>
              </div>
              <div className="text-xs text-white/30 mt-3 text-right" data-testid={`text-contact-added-${contact.id}`}>
                Added {contact.addedAt}
              </div>
            </MotionDiv>
          ))}
        </div>
      )}
    </MotionDiv>
  );
}
