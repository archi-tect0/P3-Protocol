import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  MessageSquarePlus, Search, Archive, Inbox, ArrowLeft, 
  User, Clock, ChevronRight, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MessageComposer from '@/components/MessageComposer';
import { notify } from '@/lib/notify';
import { cryptoService } from '@/lib/crypto';
import { 
  listThreads, 
  addThreadItem, 
  setThreadArchived,
  type ThreadItem 
} from '@/lib/nexusStore';

interface Message {
  id: string;
  fromWallet: string;
  toWallet: string;
  messageType?: 'text' | 'voice' | 'video';
  encryptedContent: string;
  status: string;
  createdAt: string;
}

type TabType = 'inbox' | 'archived';

export default function MessagesPage() {
  const [activeTab, setActiveTab] = useState<TabType>('inbox');
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [composeRecipient, setComposeRecipient] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [myPublicKey, setMyPublicKey] = useState('');
  const [localThreads, setLocalThreads] = useState<ThreadItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const pubKey = cryptoService.getPublicKey();
      setMyPublicKey(pubKey);
    } catch {
      notify.error('Failed to load encryption keys');
    }
  }, []);

  useEffect(() => {
    loadLocalThreads();
  }, [activeTab]);

  const loadLocalThreads = async () => {
    const threads = await listThreads({ includeArchived: activeTab === 'archived' });
    setLocalThreads(activeTab === 'archived' 
      ? threads.filter(t => t.archived)
      : threads.filter(t => !t.archived)
    );
  };

  const { data: messages = [], isLoading } = useQuery<Message[]>({
    queryKey: ['/api/messages'],
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (messages.length > 0) {
      syncToLocalStore(messages);
    }
  }, [messages, myPublicKey]);

  const syncToLocalStore = async (msgs: Message[]) => {
    const contacts = new Set<string>();
    msgs.forEach(m => {
      const contact = m.fromWallet === myPublicKey ? m.toWallet : m.fromWallet;
      contacts.add(contact);
    });

    for (const contact of contacts) {
      const contactMsgs = msgs.filter(m => 
        m.fromWallet === contact || m.toWallet === contact
      );
      if (contactMsgs.length > 0) {
        const latest = contactMsgs[0];
        await addThreadItem({
          id: contact,
          to: contact,
          kind: (latest.messageType as ThreadItem['kind']) || 'text',
          body: '[Encrypted]',
          ts: new Date(latest.createdAt).getTime(),
        });
      }
    }
    loadLocalThreads();
  };

  const threads = useMemo(() => {
    const threadMap = new Map<string, { contact: string; lastMsg: Message; count: number }>();
    
    messages.forEach(msg => {
      const contact = msg.fromWallet === myPublicKey ? msg.toWallet : msg.fromWallet;
      const existing = threadMap.get(contact);
      
      if (!existing || new Date(msg.createdAt) > new Date(existing.lastMsg.createdAt)) {
        threadMap.set(contact, {
          contact,
          lastMsg: msg,
          count: (existing?.count || 0) + 1,
        });
      } else if (existing) {
        existing.count++;
      }
    });

    return Array.from(threadMap.values())
      .sort((a, b) => new Date(b.lastMsg.createdAt).getTime() - new Date(a.lastMsg.createdAt).getTime());
  }, [messages, myPublicKey]);

  const archivedIds = useMemo(() => {
    return new Set(localThreads.filter(t => t.archived).map(t => t.id));
  }, [localThreads]);

  const filteredThreads = useMemo(() => {
    let filtered = threads.filter(t => 
      activeTab === 'archived' ? archivedIds.has(t.contact) : !archivedIds.has(t.contact)
    );
    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.contact.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [threads, activeTab, archivedIds, searchQuery]);

  const selectedThreadMessages = useMemo(() => {
    if (!selectedContact) return [];
    return messages
      .filter(m => m.fromWallet === selectedContact || m.toWallet === selectedContact)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [messages, selectedContact]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedThreadMessages]);

  const handleArchive = async (contactId: string, archive: boolean) => {
    await setThreadArchived(contactId, archive);
    notify.success(archive ? 'Thread archived' : 'Thread unarchived');
    loadLocalThreads();
  };

  const handleStartCompose = () => {
    setShowCompose(true);
    setComposeRecipient('');
  };

  const decryptContent = (msg: Message): string => {
    try {
      return cryptoService.decryptFromJSON(msg.encryptedContent, myPublicKey);
    } catch {
      return '🔒 [Encrypted]';
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    
    if (diff < 86400000) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const shortenAddress = (addr: string) => 
    addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

  if (selectedContact) {
    return (
      <div className="h-screen flex flex-col bg-[hsl(220,20%,7%)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-[hsl(220,20%,10%)]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedContact(null)}
            className="text-slate-400 hover:text-white"
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
            <User className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-white truncate">{shortenAddress(selectedContact)}</p>
            <p className="text-xs text-slate-500">{selectedThreadMessages.length} messages</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleArchive(selectedContact, !archivedIds.has(selectedContact))}
            className="text-slate-400 hover:text-cyan-400"
            data-testid="button-archive-thread"
          >
            <Archive className="w-5 h-5" />
          </Button>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {selectedThreadMessages.map(msg => {
            const isMine = msg.fromWallet === myPublicKey;
            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-bubble-${msg.id}`}
              >
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isMine 
                    ? 'bg-cyan-600 text-white rounded-br-md' 
                    : 'bg-slate-800 text-slate-100 rounded-bl-md'
                }`}>
                  <p className="text-sm break-words">{decryptContent(msg)}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-cyan-200' : 'text-slate-500'}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-slate-800 bg-[hsl(220,20%,10%)]">
          <MessageComposer
            recipientAddress={selectedContact}
            recipientPublicKey={selectedContact}
            onSent={() => notify.success('Message sent')}
            shouldAnchor={true}
          />
        </div>
      </div>
    );
  }

  if (showCompose) {
    return (
      <div className="h-screen flex flex-col bg-[hsl(220,20%,7%)]">
        <header className="flex items-center gap-3 px-4 py-3 border-b border-slate-800 bg-[hsl(220,20%,10%)]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowCompose(false)}
            className="text-slate-400 hover:text-white"
            data-testid="button-close-compose"
          >
            <X className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold text-white">New Message</h1>
        </header>

        <div className="p-4">
          <label className="text-sm text-slate-400 mb-2 block">Recipient Address</label>
          <Input
            value={composeRecipient}
            onChange={(e) => setComposeRecipient(e.target.value)}
            placeholder="Enter wallet address or public key..."
            className="bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 mb-4"
            data-testid="input-compose-recipient"
          />
        </div>

        {composeRecipient && (
          <div className="flex-1 p-4 pt-0">
            <MessageComposer
              recipientAddress={composeRecipient}
              recipientPublicKey={composeRecipient}
              onSent={() => {
                notify.success('Message sent');
                setShowCompose(false);
                setComposeRecipient('');
              }}
              onCancel={() => setShowCompose(false)}
              shouldAnchor={true}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[hsl(220,20%,7%)]">
      <header className="px-4 py-3 border-b border-slate-800 bg-[hsl(220,20%,10%)]">
        <h1 className="text-xl font-bold text-white mb-3">Messages</h1>
        
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setActiveTab('inbox')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'inbox'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            data-testid="tab-inbox"
          >
            <Inbox className="w-4 h-4" />
            Inbox
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
              activeTab === 'archived'
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
            data-testid="tab-archived"
          >
            <Archive className="w-4 h-4" />
            Archived
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search conversations..."
            className="pl-10 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
            data-testid="input-search-threads"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredThreads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500">
            <MessageSquarePlus className="w-12 h-12 mb-3 text-slate-600" />
            <p className="text-sm">
              {activeTab === 'archived' ? 'No archived messages' : 'No messages yet'}
            </p>
            {activeTab === 'inbox' && (
              <Button
                onClick={handleStartCompose}
                className="mt-4 bg-cyan-600 hover:bg-cyan-700"
                data-testid="button-start-conversation"
              >
                Start a conversation
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredThreads.map(thread => (
              <div
                key={thread.contact}
                onClick={() => setSelectedContact(thread.contact)}
                className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 cursor-pointer transition-colors"
                data-testid={`thread-item-${thread.contact}`}
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-white truncate">
                      {shortenAddress(thread.contact)}
                    </p>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(thread.lastMsg.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 truncate">
                    {thread.lastMsg.messageType === 'voice' ? '🎤 Voice message' :
                     thread.lastMsg.messageType === 'video' ? '🎥 Video message' :
                     '🔒 Encrypted message'}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleStartCompose}
        className="fixed bottom-24 right-6 z-[60] w-14 h-14 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-lg shadow-cyan-600/30 flex items-center justify-center transition-all hover:scale-105 active:scale-95 md:bottom-6"
        data-testid="fab-compose"
      >
        <MessageSquarePlus className="w-6 h-6" />
      </button>
    </div>
  );
}
