import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { MotionDiv, MotionButton, AnimatePresence } from '@/lib/motion';
import { useAtlasStore } from '@/state/useAtlasStore';
import { 
  Bot, Plus, Send, Trash2, RefreshCw, AlertCircle,
  Loader2, Sparkles, X, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface AiThread {
  id: string;
  walletAddress: string;
  provider: 'openai' | 'anthropic' | 'gemini';
  title: string | null;
  model: string | null;
  systemPrompt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AiMessage {
  id: string;
  threadId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tokenCount: number | null;
  createdAt: string;
}

interface ThreadsResponse {
  threads: AiThread[];
  count: number;
  receipt: { status: string };
}

interface ThreadDetailResponse {
  thread: AiThread;
  messages: AiMessage[];
  receipt: { status: string };
}

const PROVIDER_CONFIG = {
  openai: { label: 'GPT-4o', color: 'from-green-400/20 to-emerald-400/20', border: 'border-green-400/30', icon: '🤖' },
  anthropic: { label: 'Claude', color: 'from-orange-400/20 to-amber-400/20', border: 'border-orange-400/30', icon: '🎭' },
  gemini: { label: 'Gemini', color: 'from-blue-400/20 to-indigo-400/20', border: 'border-blue-400/30', icon: '💎' },
};

export default function AIChatMode() {
  const { pushReceipt, wallet } = useAtlasStore();
  const { toast } = useToast();
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: threadsData, isLoading: loadingThreads, error: threadsError, refetch } = useQuery<ThreadsResponse>({
    queryKey: ['/api/ai/threads', wallet],
    enabled: !!wallet,
  });

  const { data: threadDetail, isLoading: loadingDetail } = useQuery<ThreadDetailResponse>({
    queryKey: ['/api/ai/threads', selectedThread],
    enabled: !!selectedThread && !!wallet,
  });

  const createThread = useMutation({
    mutationFn: async (provider: 'openai' | 'anthropic' | 'gemini') => {
      return apiRequest('/api/ai/threads', {
        method: 'POST',
        body: JSON.stringify({ provider }),
      });
    },
    onSuccess: (data: { thread: AiThread }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/threads'] });
      setSelectedThread(data.thread.id);
      setShowCreate(false);
      toast({ title: `Created ${PROVIDER_CONFIG[data.thread.provider].label} chat` });
      pushReceipt({
        id: `receipt-ai-create-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.ai.thread.create',
        endpoint: '/api/ai/threads',
        timestamp: Date.now()
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Failed to create chat', description: err.message, variant: 'destructive' });
    },
  });

  const deleteThread = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/ai/threads/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai/threads'] });
      setSelectedThread(null);
      toast({ title: 'Chat deleted' });
    },
  });

  const sendMessage = async () => {
    if (!message.trim() || !selectedThread || streaming) return;

    const userMessage = message;
    setMessage('');
    setStreaming(true);
    setStreamedText('');

    try {
      const response = await fetch('/api/ai/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'x-wallet-address': wallet || '',
        },
        body: JSON.stringify({
          threadId: selectedThread,
          content: userMessage,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Failed to send message' }));
        throw new Error(errData.error || 'Failed to send message');
      }

      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('text/event-stream')) {
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        if (!reader) throw new Error('No response body');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === 'token' && data.token) {
                  fullText += data.token;
                  setStreamedText(fullText);
                } else if (data.type === 'done') {
                  pushReceipt({
                    id: `receipt-ai-msg-${Date.now()}`,
                    hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
                    scope: 'atlas.ai.message',
                    endpoint: '/api/ai/messages',
                    timestamp: Date.now(),
                    data: { latencyMs: data.latencyMs, inputTokens: data.inputTokens, outputTokens: data.outputTokens }
                  });
                } else if (data.type === 'error') {
                  toast({ title: 'AI Error', description: data.error, variant: 'destructive' });
                }
              } catch {}
            }
          }
        }
      } else {
        const data = await response.json();
        pushReceipt({
          id: `receipt-ai-msg-${Date.now()}`,
          hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
          scope: 'atlas.ai.message',
          endpoint: '/api/ai/messages',
          timestamp: Date.now(),
          data: { latencyMs: data.receipt?.latencyMs, inputTokens: data.receipt?.inputTokens, outputTokens: data.receipt?.outputTokens }
        });
      }

      queryClient.invalidateQueries({ queryKey: ['/api/ai/threads', selectedThread] });
    } catch (err: any) {
      toast({ title: 'Failed to send message', description: err.message, variant: 'destructive' });
    } finally {
      setStreaming(false);
      setStreamedText('');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [threadDetail?.messages, streamedText]);

  useEffect(() => {
    if (threadsData?.receipt?.status === 'success') {
      pushReceipt({
        id: `receipt-ai-${Date.now()}`,
        hash: `0x${crypto.randomUUID().replace(/-/g, '').slice(0, 32)}`,
        scope: 'atlas.render.ai',
        endpoint: '/api/ai/threads',
        timestamp: Date.now()
      });
    }
  }, [threadsData]);

  if (!wallet) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="ai-no-wallet">
        <Bot className="w-12 h-12 text-white/20" />
        <p className="text-white/60 text-center">Connect your wallet to chat with AI</p>
      </div>
    );
  }

  if (loadingThreads && !threadsData) {
    return (
      <div className="h-full flex items-center justify-center" data-testid="ai-loading">
        <MotionDiv
          className="w-8 h-8 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </div>
    );
  }

  if (threadsError) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 p-6" data-testid="ai-error">
        <AlertCircle className="w-12 h-12 text-amber-400/60" />
        <p className="text-white/60 text-center">Failed to load AI chats</p>
        <Button 
          variant="outline" 
          onClick={() => refetch()}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-ai-retry"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <MotionDiv
      className="h-full flex flex-col overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      data-testid="ai-mode"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-400/20 to-pink-400/20">
            <Bot className="w-5 h-5 text-purple-400" />
          </div>
          <h2 className="text-xl font-light text-white/80" data-testid="text-ai-title">AI Chat</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowCreate(!showCreate)}
            className="text-white/60 hover:text-white"
            data-testid="button-new-chat"
          >
            <Plus className="w-4 h-4" />
          </Button>
          {selectedThread && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setSelectedThread(null)}
              className="text-white/60 hover:text-white"
              data-testid="button-back-to-list"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <MotionDiv
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 p-4 rounded-xl bg-white/5 border border-white/10"
            data-testid="create-chat-panel"
          >
            <p className="text-sm text-white/60 mb-3">Choose an AI provider:</p>
            <div className="grid grid-cols-3 gap-3">
              {(['openai', 'anthropic', 'gemini'] as const).map((provider) => {
                const config = PROVIDER_CONFIG[provider];
                return (
                  <MotionButton
                    key={provider}
                    onClick={() => createThread.mutate(provider)}
                    disabled={createThread.isPending}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gradient-to-br ${config.color} border ${config.border} hover:scale-105 transition-transform`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    data-testid={`button-create-${provider}`}
                  >
                    <span className="text-2xl">{config.icon}</span>
                    <span className="text-sm text-white/80">{config.label}</span>
                  </MotionButton>
                );
              })}
            </div>
          </MotionDiv>
        )}
      </AnimatePresence>

      {!selectedThread ? (
        <div className="flex-1 overflow-y-auto">
          {(!threadsData?.threads || threadsData.threads.length === 0) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center" data-testid="ai-empty">
              <Sparkles className="w-16 h-16 text-white/20 mb-4" />
              <p className="text-white/60 mb-2">No AI chats yet</p>
              <p className="text-white/40 text-sm mb-4">Start a conversation with GPT, Claude, or Gemini</p>
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-purple-500/20 text-purple-400 hover:bg-purple-500/30"
                data-testid="button-start-first-chat"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Chat
              </Button>
            </div>
          ) : (
            <div className="space-y-3" data-testid="ai-threads-list">
              {threadsData.threads.map((thread, index) => {
                const config = PROVIDER_CONFIG[thread.provider];
                return (
                  <MotionDiv
                    key={thread.id}
                    className={`group p-4 rounded-xl bg-gradient-to-br ${config.color} border ${config.border} hover:scale-[1.02] transition-all cursor-pointer`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedThread(thread.id)}
                    data-testid={`thread-card-${thread.id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{config.icon}</span>
                        <div>
                          <h3 className="font-medium text-white/90">{thread.title}</h3>
                          <p className="text-xs text-white/50">{config.label} • {thread.model}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MotionButton
                          onClick={(e) => { e.stopPropagation(); deleteThread.mutate(thread.id); }}
                          className="p-2 rounded-lg bg-white/5 text-white/50 hover:text-red-400 hover:bg-red-500/10"
                          whileHover={{ scale: 1.1 }}
                          data-testid={`button-delete-${thread.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </MotionButton>
                      </div>
                    </div>
                    <p className="text-xs text-white/40 mt-2">
                      Updated {new Date(thread.updatedAt).toLocaleDateString()}
                    </p>
                  </MotionDiv>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {loadingDetail ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto space-y-4 pb-4" data-testid="ai-messages-list">
                {threadDetail?.messages.map((msg, index) => (
                  <MotionDiv
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.02 }}
                    data-testid={`message-${msg.id}`}
                  >
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.role === 'user' 
                        ? 'bg-cyan-500/20 text-cyan-400' 
                        : 'bg-purple-500/20 text-purple-400'
                    }`}>
                      {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                    </div>
                    <div className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-cyan-500/20 border border-cyan-400/20'
                        : 'bg-white/5 border border-white/10'
                    }`}>
                      <p className="text-white/90 text-sm whitespace-pre-wrap">{msg.content}</p>
                    </div>
                  </MotionDiv>
                ))}
                
                {streaming && streamedText && (
                  <MotionDiv
                    className="flex gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-purple-500/20 text-purple-400">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-white/5 border border-white/10">
                      <p className="text-white/90 text-sm whitespace-pre-wrap">{streamedText}</p>
                      <span className="inline-block w-2 h-4 bg-purple-400 animate-pulse ml-1" />
                    </div>
                  </MotionDiv>
                )}
                
                <div ref={messagesEndRef} />
              </div>

              <div className="flex gap-3 p-4 bg-black/20 rounded-xl border border-white/10" data-testid="ai-input-area">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder="Type your message..."
                  disabled={streaming}
                  className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-white/40"
                  data-testid="input-message"
                />
                <MotionButton
                  onClick={sendMessage}
                  disabled={streaming || !message.trim()}
                  className="px-4 py-2 rounded-lg bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 disabled:opacity-50"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  data-testid="button-send-message"
                >
                  {streaming ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </MotionButton>
              </div>
            </>
          )}
        </div>
      )}
    </MotionDiv>
  );
}
