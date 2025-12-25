import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Send, 
  Lock, 
  Search, 
  User, 
  Shield,
  CheckCheck,
  Loader2,
  MessageSquare
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { SDK } from '@/lib/sdk';

export default function MessagingPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messageText, setMessageText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [newContact, setNewContact] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messagesData, isLoading, error } = useQuery({
    queryKey: ['/api/nexus/messaging/list'],
    queryFn: () => SDK.messaging.list(),
    staleTime: 10000,
  });

  const sendMutation = useMutation({
    mutationFn: ({ to, content }: { to: string; content: string }) =>
      SDK.messaging.send(to, content, true),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/messaging/list'] });
      setMessageText('');
      toast({
        title: 'Message sent',
        description: 'Your encrypted message has been delivered.',
      });
    },
    onError: () => {
      toast({
        variant: 'destructive',
        title: 'Failed to send',
        description: 'Could not send your message. Please try again.',
      });
    },
  });

  const threads = messagesData?.threads || [];
  const messages = messagesData?.messages || [];

  const threadMessages = messages.filter(
    (msg) => msg.from === selectedThread || msg.to === selectedThread
  );

  const filteredThreads = threads.filter((thread) =>
    thread.participants.some((p) =>
      p.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadMessages]);

  const handleSendMessage = () => {
    if (!selectedThread || !messageText.trim()) return;
    sendMutation.mutate({ to: selectedThread, content: messageText });
  };

  const handleStartNewChat = () => {
    if (newContact.trim()) {
      setSelectedThread(newContact.trim());
      setNewContact('');
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#141414] flex items-center justify-center">
        <Card className="bg-[#1a1a1a]/80 backdrop-blur-xl border-white/5 p-8 text-center max-w-md">
          <Lock className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Connection Error</h2>
          <p className="text-slate-400 mb-6">
            Could not connect to messaging service.
          </p>
          <Button
            data-testid="button-retry-messaging"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/nexus/messaging/list'] })}
            className="bg-gradient-to-r from-purple-600 to-indigo-600"
          >
            Retry
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/10 via-transparent to-indigo-900/10 pointer-events-none" />
      
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
              <h1 className="text-lg font-semibold text-white">Messages</h1>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                data-testid="input-search-threads"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#252525] border-white/5 text-white placeholder:text-slate-500 text-sm"
              />
            </div>
          </div>

          <div className="p-4 border-b border-white/5">
            <div className="flex gap-2">
              <Input
                data-testid="input-new-contact"
                placeholder="Wallet address..."
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                className="bg-[#252525] border-white/5 text-white placeholder:text-slate-500 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleStartNewChat()}
              />
              <Button
                data-testid="button-new-chat"
                size="sm"
                onClick={handleStartNewChat}
                className="bg-purple-600 hover:bg-purple-500"
              >
                Chat
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Loading conversations...</p>
              </div>
            ) : filteredThreads.length === 0 ? (
              <div className="p-8 text-center">
                <MessageSquare className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No conversations yet</p>
                <p className="text-xs text-slate-600 mt-1">Start a new chat above</p>
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const contactWallet = thread.participants.find(p => p !== localStorage.getItem('walletAddress')) || thread.participants[0];
                return (
                  <button
                    key={thread.id}
                    data-testid={`button-thread-${thread.id}`}
                    onClick={() => setSelectedThread(contactWallet)}
                    className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors ${
                      selectedThread === contactWallet ? 'bg-purple-600/10 border-l-2 border-purple-500' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-medium text-white">
                        {contactWallet.slice(0, 6)}...{contactWallet.slice(-4)}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {thread.lastMessage?.content || '[Encrypted message]'}
                      </p>
                    </div>
                    {thread.unreadCount > 0 && (
                      <Badge className="bg-purple-600 text-white text-xs">{thread.unreadCount}</Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {selectedThread ? (
            <>
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-[#1a1a1a]/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">
                      {selectedThread.slice(0, 8)}...{selectedThread.slice(-6)}
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-xs text-slate-500">Online</span>
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-0">
                  <Shield className="w-3 h-3 mr-1" />
                  E2EE
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {threadMessages.map((msg) => {
                  const isOwn = msg.from === localStorage.getItem('walletAddress');
                  return (
                    <div
                      key={msg.id}
                      data-testid={`message-${msg.id}`}
                      className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                          isOwn
                            ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white'
                            : 'bg-[#252525] text-white'
                        }`}
                      >
                        <p className="text-sm">{msg.encrypted ? '[Encrypted content]' : msg.content}</p>
                        <div className={`flex items-center gap-2 mt-1 ${isOwn ? 'justify-end' : ''}`}>
                          <span className="text-[10px] opacity-60">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {isOwn && <CheckCheck className="w-3 h-3 opacity-60" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              <div className="p-4 pb-24 md:pb-4 border-t border-white/5 bg-[#1a1a1a]/40">
                <div className="flex items-center gap-2">
                  <Input
                    data-testid="input-message"
                    placeholder="Type a message..."
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                    className="flex-1 bg-[#252525] border-white/5 text-white placeholder:text-slate-500"
                  />
                  <Button
                    data-testid="button-send-message"
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sendMutation.isPending}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-[#252525] flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Select a conversation</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Choose a conversation from the sidebar or start a new one to begin messaging.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
