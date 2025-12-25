import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Send, MessageCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const ATLAS_INBOX = '0x134248507502fe5a0C56Eb7bC8fa710aC62136C3';

export default function ContactAtlasTile() {
  const [message, setMessage] = useState('');
  const [senderName, setSenderName] = useState('');
  const [sent, setSent] = useState(false);
  const { toast } = useToast();

  const walletAddress = typeof window !== 'undefined' 
    ? localStorage.getItem('p3-session-wallet') || sessionStorage.getItem('p3-session-wallet')
    : null;

  const sendMutation = useMutation({
    mutationFn: async () => {
      const fullMessage = senderName ? `From: ${senderName}\n\n${message}` : message;
      const contentHash = await crypto.subtle.digest(
        'SHA-256',
        new TextEncoder().encode(fullMessage)
      ).then(buf => Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join(''));
      
      return apiRequest('/api/nexus/messaging/send', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'x-wallet-address': walletAddress || 'anonymous' 
        },
        body: JSON.stringify({
          recipient: ATLAS_INBOX,
          encryptedContent: fullMessage,
          contentHash,
          messageType: 'text',
          metadata: { type: 'feedback', senderName },
        }),
      });
    },
    onSuccess: () => {
      setSent(true);
      setMessage('');
      setSenderName('');
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/messaging/list'] });
      toast({ title: 'Message sent!', description: 'Thank you for your feedback.' });
    },
    onError: (err) => {
      toast({ 
        title: 'Failed to send', 
        description: err instanceof Error ? err.message : 'Please try again later.',
        variant: 'destructive' 
      });
    },
  });

  if (sent) {
    return (
      <div className="p-6 text-center space-y-4" data-testid="contact-atlas-sent">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
          <CheckCircle className="w-8 h-8 text-emerald-400" />
        </div>
        <h3 className="text-lg font-medium text-white">Message Sent!</h3>
        <p className="text-sm text-white/60">
          Thank you for reaching out. We'll get back to you soon.
        </p>
        <Button
          variant="outline"
          onClick={() => setSent(false)}
          className="border-white/20 text-white/80 hover:bg-white/10"
          data-testid="button-send-another"
        >
          Send Another Message
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4" data-testid="contact-atlas-tile">
      <div className="text-center mb-4">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
          <MessageCircle className="w-7 h-7 text-white" />
        </div>
        <h3 className="font-medium text-white mb-1">Contact Atlas</h3>
        <p className="text-xs text-white/50">
          Send us feedback, suggestions, or questions
        </p>
      </div>

      <div className="space-y-3">
        <Input
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="Your name (optional)"
          className="bg-white/5 border-white/10 text-white text-sm placeholder:text-white/30"
          data-testid="input-sender-name"
        />

        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message..."
          className="bg-white/5 border-white/10 text-white text-sm placeholder:text-white/30 min-h-[100px] resize-none"
          data-testid="input-contact-message"
        />

        <Button
          onClick={() => sendMutation.mutate()}
          disabled={sendMutation.isPending || !message.trim()}
          className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white"
          data-testid="button-send-contact"
        >
          {sendMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Send className="w-4 h-4 mr-2" />
          )}
          Send Message
        </Button>

        <p className="text-[10px] text-center text-white/30">
          Messages are sent via Nexus to Atlas inbox
        </p>
      </div>
    </div>
  );
}
