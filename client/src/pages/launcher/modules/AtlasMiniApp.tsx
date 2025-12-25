import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Send, 
  Globe,
  Loader2,
  Sparkles,
  MessageSquare,
  Zap,
  ExternalLink,
  Info,
  ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getWalletAddress } from '../config';

interface Message {
  id: string;
  type: 'user' | 'atlas';
  content: string;
  timestamp: number;
  suggestions?: string[];
}

const QUICK_ACTIONS = [
  { label: 'Open News', query: 'Open News canvas' },
  { label: 'Game Deck', query: 'Launch Game Deck' },
  { label: 'Start Pulse', query: 'Start Pulse Node' },
  { label: 'Send message', query: 'Send a message to...' },
];

const ABOUT_CONTENT = {
  title: 'What is Atlas?',
  tagline: 'The conversational membrane around the P3 mesh',
  description: `Atlas is a neutral orchestrator that routes natural language to whatever developers manifest. It doesn't dictate language models or interaction patterns — developers own their dialects, Atlas just surfaces them.`,
  capabilities: [
    { icon: MessageSquare, label: 'Natural Language', desc: 'Talk to your apps like you talk to people' },
    { icon: Zap, label: 'Cross-App Actions', desc: '"Pay Alice and notify her" — atomic, consented' },
    { icon: Globe, label: 'Universal Interface', desc: 'One conversation, all your connected apps' },
  ],
};

export default function AtlasMiniApp() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [walletAddress] = useState(getWalletAddress());
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      type: 'atlas',
      content: "Hey! I'm Atlas. Ask me anything about your connected apps, or try a quick action below.",
      timestamp: Date.now(),
      suggestions: QUICK_ACTIONS.map(a => a.label),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (walletAddress && !sessionStarted) {
      startSession();
    }
  }, [walletAddress]);

  async function startSession() {
    try {
      const res = await fetch('/api/atlas/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: walletAddress, roles: ['user'] }),
      });
      if (res.ok) {
        setSessionStarted(true);
      }
    } catch (err) {
      console.warn('Atlas session start failed:', err);
    }
  }

  async function sendMessage(text?: string) {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      type: 'user',
      content: messageText,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/atlas/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet: walletAddress,
          message: messageText,
          params: {},
        }),
      });

      const data = await response.json();

      let content = '';
      if (data.message) {
        content = data.message;
      } else if (data.receipts?.length > 0) {
        const successCount = data.receipts.filter((r: any) => r.status === 'ok').length;
        content = `Done! Executed ${successCount} action(s).`;
      } else if (data.intent) {
        content = `I understood "${data.intent}" but need more apps connected to help with that.`;
      } else {
        content = data.error || "I processed your request.";
      }

      const atlasMessage: Message = {
        id: `atlas-${Date.now()}`,
        type: 'atlas',
        content,
        timestamp: Date.now(),
        suggestions: data.suggestions,
      };

      setMessages(prev => [...prev, atlasMessage]);
    } catch (err: any) {
      console.error('Atlas query failed:', err);
      const errorMessage: Message = {
        id: `atlas-${Date.now()}`,
        type: 'atlas',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
      toast({ title: 'Query failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  function handleQuickAction(query: string) {
    setInput(query);
    if (!query.endsWith('...')) {
      sendMessage(query);
    }
  }

  if (showAbout) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <header className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              data-testid="button-back-from-about"
              variant="ghost"
              size="icon"
              onClick={() => setShowAbout(false)}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">About Atlas</span>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
              <Globe className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{ABOUT_CONTENT.title}</h1>
            <p className="text-purple-400 font-medium">{ABOUT_CONTENT.tagline}</p>
          </div>

          <Card className="bg-white/5 border-white/10 p-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              {ABOUT_CONTENT.description}
            </p>
          </Card>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Capabilities</h3>
            {ABOUT_CONTENT.capabilities.map((cap, i) => {
              const Icon = cap.icon;
              return (
                <Card key={i} className="bg-white/5 border-white/10 p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">{cap.label}</h4>
                    <p className="text-sm text-slate-400">{cap.desc}</p>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="bg-gradient-to-r from-purple-600/20 to-indigo-600/20 border-purple-500/30 p-4">
            <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-400" />
              For Developers
            </h3>
            <p className="text-sm text-slate-300 mb-3">
              Atlas routes to whatever you manifest. Declare custom endpoints (including your own LLM) and Atlas surfaces them to users automatically.
            </p>
            <Button
              data-testid="button-view-sdk"
              variant="outline"
              size="sm"
              onClick={() => setLocation('/launcher/sdk#atlas-developer')}
              className="text-purple-400 border-purple-500/30 hover:bg-purple-500/10"
            >
              View SDK Docs
              <ExternalLink className="w-3 h-3 ml-2" />
            </Button>
          </Card>

          <Button
            data-testid="button-open-full-atlas"
            onClick={() => setLocation('/atlas')}
            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
          >
            Open Full Atlas
            <ChevronRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col">
      <header className="sticky top-0 z-50 bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              data-testid="button-back"
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/launcher')}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">Atlas</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              data-testid="button-about"
              variant="ghost"
              size="icon"
              onClick={() => setShowAbout(true)}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <Info className="w-5 h-5" />
            </Button>
            <Button
              data-testid="button-expand"
              variant="ghost"
              size="icon"
              onClick={() => setLocation('/atlas')}
              className="text-slate-400 hover:text-white hover:bg-white/10"
            >
              <ExternalLink className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {!walletAddress && (
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="bg-white/5 border-white/10 p-6 text-center max-w-sm">
            <Globe className="w-12 h-12 mx-auto mb-4 text-purple-400" />
            <h2 className="font-semibold text-white mb-2">Connect Wallet</h2>
            <p className="text-sm text-slate-400 mb-4">
              Connect your wallet in the Hub to start talking to Atlas.
            </p>
            <Button
              data-testid="button-go-hub"
              onClick={() => setLocation('/launcher')}
              className="bg-purple-600 hover:bg-purple-500"
            >
              Go to Hub
            </Button>
          </Card>
        </div>
      )}

      {walletAddress && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                    msg.type === 'user'
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/10 text-white'
                  }`}
                >
                  <p className="text-sm">{msg.content}</p>
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {msg.suggestions.slice(0, 3).map((s, i) => (
                        <Badge
                          key={i}
                          data-testid={`suggestion-${i}`}
                          className="bg-purple-500/30 text-purple-200 border-purple-500/50 cursor-pointer hover:bg-purple-500/50"
                          onClick={() => handleQuickAction(QUICK_ACTIONS.find(a => a.label === s)?.query || s)}
                        >
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/10 rounded-2xl px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-white/5 bg-[#0a0a0a]">
            <div className="flex gap-2">
              <Input
                data-testid="input-message"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Ask Atlas anything..."
                className="flex-1 bg-white/10 border-white/10 text-white placeholder:text-slate-500"
              />
              <Button
                data-testid="button-send"
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="bg-purple-600 hover:bg-purple-500"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
