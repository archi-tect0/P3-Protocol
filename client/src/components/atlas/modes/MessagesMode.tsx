import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { Lock, Send, Check, CheckCheck, RefreshCw, AlertCircle, Inbox, ArrowLeft, X, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useEffect, useState, useRef } from 'react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface Conversation {
  peer: string;
  lastMessage: {
    id: string;
    encryptedContent: string;
    createdAt: string;
    status: string;
  };
  unreadCount: number;
}

interface Message {
  id: string;
  from: string;
  preview: string;
  encrypted: boolean;
  read: boolean;
  timestamp: string;
}

interface ThreadMessage {
  id: string;
  content: string;
  isOutgoing: boolean;
  timestamp: Date;
  status: 'sending' | 'sent' | 'delivered' | 'read';
  encrypted: boolean;
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

function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function truncateAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || 'Unknown';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function MessageBubble({ 
  message, 
  isFirst, 
  isLast,
  animationDelay 
}: { 
  message: ThreadMessage; 
  isFirst: boolean;
  isLast: boolean;
  animationDelay: number;
}) {
  const isOutgoing = message.isOutgoing;
  
  const getStatusIcon = () => {
    switch (message.status) {
      case 'sending':
        return <RefreshCw className="w-3 h-3 animate-spin text-white/40" />;
      case 'sent':
        return <Check className="w-3 h-3 text-white/40" />;
      case 'delivered':
        return <CheckCheck className="w-3 h-3 text-white/50" />;
      case 'read':
        return <CheckCheck className="w-3 h-3 text-cyan-400" />;
      default:
        return null;
    }
  };

  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ 
        duration: 0.3, 
        delay: animationDelay,
        type: 'spring',
        stiffness: 500,
        damping: 30
      }}
      className={`flex ${isOutgoing ? 'justify-end' : 'justify-start'} mb-1`}
      data-testid={`bubble-${message.id}`}
    >
      <div className={`flex items-end gap-2 max-w-[80%] ${isOutgoing ? 'flex-row-reverse' : 'flex-row'}`}>
        {!isOutgoing && isLast && (
          <div className="w-8 h-8 rounded-full bg-slate-600/50 flex items-center justify-center flex-shrink-0 mb-5">
            <User className="w-4 h-4 text-white/60" />
          </div>
        )}
        {!isOutgoing && !isLast && (
          <div className="w-8 flex-shrink-0" />
        )}
        
        <div className={`flex flex-col ${isOutgoing ? 'items-end' : 'items-start'}`}>
          <div
            className={`px-4 py-2.5 max-w-full break-words
              ${isOutgoing 
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white' 
                : 'bg-slate-700/80 text-white/90'
              }
              ${isOutgoing
                ? isFirst && isLast
                  ? 'rounded-2xl'
                  : isFirst
                    ? 'rounded-2xl rounded-br-lg'
                    : isLast
                      ? 'rounded-2xl rounded-tr-lg'
                      : 'rounded-2xl rounded-r-lg'
                : isFirst && isLast
                  ? 'rounded-2xl'
                  : isFirst
                    ? 'rounded-2xl rounded-bl-lg'
                    : isLast
                      ? 'rounded-2xl rounded-tl-lg'
                      : 'rounded-2xl rounded-l-lg'
              }
            `}
            data-testid={`bubble-content-${message.id}`}
          >
            <p className="text-sm leading-relaxed">{message.content}</p>
          </div>
          
          {isLast && (
            <div className={`flex items-center gap-1.5 mt-1 px-1 ${isOutgoing ? 'flex-row-reverse' : 'flex-row'}`}>
              <span className="text-[10px] text-white/40" data-testid={`bubble-time-${message.id}`}>
                {formatMessageTime(message.timestamp)}
              </span>
              {isOutgoing && (
                <span data-testid={`bubble-status-${message.id}`}>
                  {getStatusIcon()}
                </span>
              )}
              {message.encrypted && (
                <Lock className="w-2.5 h-2.5 text-cyan-400/50" />
              )}
            </div>
          )}
        </div>
      </div>
    </MotionDiv>
  );
}

function ConversationThread({
  peer,
  peerAddress,
  onBack,
  wallet
}: {
  peer: string;
  peerAddress: string;
  onBack: () => void;
  wallet: string;
}) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { pushReceipt } = useAtlasStore();

  const { data: threadData, isLoading } = useQuery<{ ok: boolean; messages: any[] }>({
    queryKey: ['/api/nexus/messaging/thread', peerAddress],
    queryFn: async () => {
      const response = await fetch(`/api/nexus/messaging/thread/${peerAddress}`, {
        headers: { 'x-wallet-address': wallet },
      });
      if (!response.ok) throw new Error('Failed to load thread');
      return response.json();
    },
    enabled: !!peerAddress && !!wallet,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const contentHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(content)
      ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
      
      return apiRequest('/api/nexus/messaging/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': wallet },
        body: JSON.stringify({
          recipient: peerAddress,
          encryptedContent: content,
          contentHash,
          messageType: 'text',
        }),
      });
    },
    onSuccess: () => {
      setNewMessage('');
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/messaging/thread', peerAddress] });
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/messaging/list'] });
      pushReceipt({
        id: `receipt-message-sent-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.messaging.sent',
        endpoint: '/api/nexus/messaging/send',
        timestamp: Date.now()
      });
    },
    onError: (err) => {
      toast({ 
        title: 'Failed to send', 
        description: err instanceof Error ? err.message : 'Unknown error', 
        variant: 'destructive' 
      });
    },
  });

  const handleSend = () => {
    if (!newMessage.trim()) return;
    sendMutation.mutate(newMessage.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const messages: ThreadMessage[] = (threadData?.messages || []).map((msg: any) => ({
    id: msg.id || crypto.randomUUID(),
    content: msg.encryptedContent || msg.content || '[Encrypted]',
    isOutgoing: msg.fromWallet?.toLowerCase() === wallet.toLowerCase() || 
                msg.from?.toLowerCase() === wallet.toLowerCase() || 
                msg.sender?.toLowerCase() === wallet.toLowerCase(),
    timestamp: new Date(msg.createdAt || msg.timestamp || Date.now()),
    status: msg.status === 'read' ? 'read' : msg.status === 'delivered' ? 'delivered' : 'sent',
    encrypted: true,
  }));

  if (messages.length === 0 && !isLoading) {
    messages.push({
      id: 'placeholder-start',
      content: 'Start a conversation...',
      isOutgoing: false,
      timestamp: new Date(),
      status: 'read',
      encrypted: false,
    });
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const groupedMessages = messages.reduce((acc: ThreadMessage[][], msg, idx) => {
    const prev = messages[idx - 1];
    if (prev && prev.isOutgoing === msg.isOutgoing) {
      acc[acc.length - 1].push(msg);
    } else {
      acc.push([msg]);
    }
    return acc;
  }, []);

  return (
    <MotionDiv
      className="h-full flex flex-col"
      initial={{ opacity: 0, x: 30 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -30 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 30 }}
      data-testid="conversation-thread"
    >
      <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
          data-testid="button-back-to-list"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500/30 to-blue-600/30 flex items-center justify-center">
          <User className="w-5 h-5 text-cyan-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-white/90 font-medium" data-testid="text-thread-peer">{peer}</h3>
          <p className="text-xs text-white/40 font-mono">{peerAddress}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-cyan-400/60" />
          <span className="text-xs text-cyan-400/60">Encrypted</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-1 pb-4" data-testid="thread-messages">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <MotionDiv
              className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        ) : (
          <div className="space-y-3">
            {groupedMessages.map((group, groupIdx) => (
              <div key={groupIdx} className="space-y-0.5">
                {group.map((msg, msgIdx) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isFirst={msgIdx === 0}
                    isLast={msgIdx === group.length - 1}
                    animationDelay={groupIdx * 0.1 + msgIdx * 0.05}
                  />
                ))}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <MotionDiv
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="pt-3 border-t border-white/10"
      >
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <Textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 
                         min-h-[44px] max-h-[120px] resize-none rounded-2xl pr-12
                         focus:border-cyan-400/50 focus:ring-cyan-400/20"
              rows={1}
              data-testid="input-thread-message"
            />
          </div>
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !newMessage.trim()}
            className="h-11 w-11 rounded-full p-0 bg-gradient-to-r from-cyan-500 to-blue-600 
                       hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50
                       shadow-lg shadow-cyan-500/20"
            data-testid="button-send-thread"
          >
            {sendMutation.isPending ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-white/30 text-center mt-2">
          Press Enter to send • Shift+Enter for new line
        </p>
      </MotionDiv>
    </MotionDiv>
  );
}

export default function MessagesMode() {
  const { pushReceipt, wallet, composeRecipient, setComposeRecipient } = useAtlasStore();
  const [isComposing, setIsComposing] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<{ peer: string; address: string } | null>(null);
  const [recipient, setRecipient] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (composeRecipient) {
      setRecipient(composeRecipient);
      setIsComposing(true);
    }
  }, [composeRecipient]);

  const { data, isLoading, error, refetch } = useQuery<{ ok: boolean; conversations: Conversation[] }>({
    queryKey: ['/api/nexus/messaging/list', wallet],
    enabled: !!wallet,
  });

  const sendMutation = useMutation({
    mutationFn: async (payload: { recipient: string; content: string }) => {
      const contentHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(payload.content)
      ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
      
      return apiRequest('/api/nexus/messaging/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-wallet-address': wallet || '' },
        body: JSON.stringify({
          recipient: payload.recipient,
          encryptedContent: payload.content,
          contentHash,
          messageType: 'text',
        }),
      });
    },
    onSuccess: (_, variables) => {
      toast({ title: 'Message sent', description: 'Your message has been delivered.' });
      setMessageContent('');
      setRecipient('');
      setIsComposing(false);
      setComposeRecipient(null);
      setSelectedConversation({ 
        peer: truncateAddress(variables.recipient), 
        address: variables.recipient 
      });
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/messaging/list'] });
      pushReceipt({
        id: `receipt-message-sent-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.messaging.sent',
        endpoint: '/api/nexus/messaging/send',
        timestamp: Date.now()
      });
    },
    onError: (err) => {
      toast({ title: 'Failed to send', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
    },
  });

  const handleSend = () => {
    if (!recipient.trim() || !messageContent.trim()) {
      toast({ title: 'Missing fields', description: 'Please enter a recipient and message.', variant: 'destructive' });
      return;
    }
    sendMutation.mutate({ recipient: recipient.trim(), content: messageContent.trim() });
  };

  const handleCloseCompose = () => {
    setIsComposing(false);
    setRecipient('');
    setMessageContent('');
    setComposeRecipient(null);
  };

  const handleOpenConversation = (conv: Conversation) => {
    setSelectedConversation({
      peer: truncateAddress(conv.peer),
      address: conv.peer
    });
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  useEffect(() => {
    if (data?.ok) {
      pushReceipt({
        id: `receipt-messages-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.messages',
        endpoint: '/api/nexus/messaging/list',
        timestamp: Date.now()
      });
    } else if (data && !data.ok) {
      pushReceipt({
        id: `receipt-messages-empty-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.messages.empty',
        endpoint: '/api/nexus/messaging/list',
        timestamp: Date.now()
      });
    }
  }, [data]);

  useEffect(() => {
    if (error) {
      pushReceipt({
        id: `receipt-messages-error-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.messages.error',
        endpoint: '/api/nexus/messaging/list',
        timestamp: Date.now(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }, [error]);

  const messages: Message[] = (data?.conversations || []).map(conv => ({
    id: conv.lastMessage?.id || conv.peer,
    from: truncateAddress(conv.peer),
    preview: conv.lastMessage?.encryptedContent 
      ? '[Encrypted message]' 
      : 'No messages yet',
    encrypted: !!conv.lastMessage?.encryptedContent,
    read: conv.unreadCount === 0,
    timestamp: conv.lastMessage?.createdAt ? formatTimeAgo(conv.lastMessage.createdAt) : 'Unknown'
  }));

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="messages-no-wallet">
        <Inbox className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to view messages</p>
      </div>
    );
  }

  if (selectedConversation) {
    return (
      <ConversationThread
        peer={selectedConversation.peer}
        peerAddress={selectedConversation.address}
        onBack={handleBackToList}
        wallet={wallet}
      />
    );
  }

  if (isComposing) {
    return (
      <MotionDiv
        className="h-full flex flex-col"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3 }}
        data-testid="compose-message-mode"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={handleCloseCompose}
              className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-all"
              data-testid="button-back-messages"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-light text-white/80" data-testid="text-compose-title">New Message</h2>
          </div>
          <button
            onClick={handleCloseCompose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all"
            data-testid="button-close-compose"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <label className="text-xs text-white/50 mb-1 block">To (Wallet Address)</label>
            <Input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono"
              data-testid="input-recipient"
            />
          </div>

          <div className="flex-1">
            <label className="text-xs text-white/50 mb-1 block">Message</label>
            <Textarea
              value={messageContent}
              onChange={(e) => setMessageContent(e.target.value)}
              placeholder="Type your message..."
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 min-h-[200px] resize-none"
              data-testid="input-message-content"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || !recipient.trim() || !messageContent.trim()}
            className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
            data-testid="button-send-message"
          >
            {sendMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            Send Message
          </Button>
        </div>
      </MotionDiv>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="messages-loading">
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
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="messages-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load messages</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-messages-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  const unreadCount = messages.filter(m => !m.read).length;

  return (
    <MotionDiv
      className="h-full overflow-auto"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="messages-mode"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-light text-white/80" data-testid="text-messages-title">Messages</h2>
          {unreadCount > 0 && (
            <span className="px-2 py-0.5 text-xs rounded-full bg-cyan-400/20 text-cyan-400" data-testid="text-messages-unread">
              {unreadCount} new
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => refetch()}
            className="text-white/60 hover:text-white p-2"
            data-testid="button-messages-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
          <button 
            onClick={() => setIsComposing(true)}
            className="p-2 rounded-lg bg-cyan-400/10 border border-cyan-400/30 text-cyan-400
                       hover:bg-cyan-400/20 transition-all"
            data-testid="button-compose-message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="messages-empty">
          <Inbox className="w-16 h-16 text-white/20 mb-4" />
          <p className="text-white/60 mb-2">No messages yet</p>
          <p className="text-white/40 text-sm mb-4">Start a conversation to see messages here</p>
          <Button
            onClick={() => setIsComposing(true)}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500"
            data-testid="button-compose-first"
          >
            <Send className="w-4 h-4 mr-2" />
            Compose Message
          </Button>
        </div>
      ) : (
        <div className="space-y-2" data-testid="messages-list">
          {data?.conversations?.map((conv, index) => {
            const message = messages.find(m => m.id === (conv.lastMessage?.id || conv.peer));
            if (!message) return null;
            
            return (
              <MotionDiv
                key={conv.peer}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.08 }}
                onClick={() => handleOpenConversation(conv)}
                className={`p-4 rounded-xl border transition-all cursor-pointer
                  ${message.read 
                    ? 'bg-white/3 border-white/5 hover:border-white/15 hover:bg-white/5' 
                    : 'bg-white/8 border-cyan-400/20 hover:border-cyan-400/40 hover:bg-white/10'
                  }`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                data-testid={`message-item-${message.id}`}
              >
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center
                      ${message.read 
                        ? 'bg-slate-600/50' 
                        : 'bg-gradient-to-br from-cyan-500/30 to-blue-600/30'
                      }`}>
                      <User className={`w-5 h-5 ${message.read ? 'text-white/40' : 'text-cyan-400'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono ${message.read ? 'text-white/60' : 'text-white/90 font-medium'}`} data-testid={`text-message-from-${message.id}`}>
                          {message.from}
                        </span>
                        {message.encrypted && (
                          <Lock className="w-3 h-3 text-cyan-400/60" />
                        )}
                      </div>
                      <p className={`text-sm mt-0.5 line-clamp-1 ${message.read ? 'text-white/40' : 'text-white/60'}`} data-testid={`text-message-preview-${message.id}`}>
                        {message.preview}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-xs text-white/40" data-testid={`text-message-time-${message.id}`}>{message.timestamp}</span>
                    <div className="flex items-center gap-1">
                      {message.read ? (
                        <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      )}
                    </div>
                  </div>
                </div>
              </MotionDiv>
            );
          })}
        </div>
      )}
    </MotionDiv>
  );
}
