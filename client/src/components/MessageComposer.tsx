/**
 * Message Composer - Full-featured message composition with autosave drafts
 * Supports text, voice, and video modes with attachment handling
 */

import { useState, useEffect, useCallback } from 'react';
import { Send, Mic, Video, Paperclip, X, Loader2, Archive, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { 
  saveDraft, 
  deleteDraft, 
  listDrafts,
  type Draft 
} from '@/lib/nexusStore';
import { notify } from '@/lib/notify';
import { cryptoService } from '@/lib/crypto';
import { apiRequest } from '@/lib/queryClient';
import MediaRecorder from '@/components/MediaRecorder';
import { compressAudio, compressVideo, blobToBase64 } from '@/lib/media-compression';

type ComposerMode = 'text' | 'voice' | 'video';

interface MessageComposerProps {
  recipientAddress: string;
  recipientPublicKey?: string;
  onSent?: () => void;
  onCancel?: () => void;
  shouldAnchor?: boolean;
}

export default function MessageComposer({
  recipientAddress,
  recipientPublicKey,
  onSent,
  onCancel,
  shouldAnchor = true,
}: MessageComposerProps) {
  const [mode, setMode] = useState<ComposerMode>('text');
  const [body, setBody] = useState('');
  const [draftId, setDraftId] = useState<string>(() => crypto.randomUUID());
  const [attachments, setAttachments] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  useEffect(() => {
    loadDrafts();
  }, []);
  
  useEffect(() => {
    if (!body && attachments.length === 0) return;
    
    const timer = setTimeout(() => {
      autosave();
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [body, attachments, recipientAddress]);
  
  const loadDrafts = async () => {
    const d = await listDrafts('message');
    setDrafts(d.filter(draft => draft.to === recipientAddress || !draft.to));
  };
  
  const autosave = useCallback(async () => {
    if (!body && attachments.length === 0) return;
    
    const draft: Draft = {
      id: draftId,
      kind: 'message',
      to: recipientAddress,
      body,
      attachments,
      updatedAt: Date.now(),
    };
    
    await saveDraft(draft);
    setLastSaved(new Date());
    loadDrafts();
  }, [draftId, recipientAddress, body, attachments]);
  
  const loadDraft = async (draft: Draft) => {
    setDraftId(draft.id);
    setBody(draft.body);
    setAttachments(draft.attachments || []);
    setShowDrafts(false);
    notify.info('Draft loaded');
  };
  
  const clearDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDraft(id);
    loadDrafts();
    notify.info('Draft deleted');
  };
  
  const handleSend = async () => {
    if (!recipientPublicKey) {
      notify.error('Recipient public key required for encryption');
      return;
    }
    
    if (!body && attachments.length === 0) {
      notify.warn('Please enter a message or add attachments');
      return;
    }
    
    setIsSending(true);
    
    try {
      const encryptedContent = cryptoService.encryptToJSON(body, recipientPublicKey);
      
      await apiRequest('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          toWallet: recipientAddress,
          messageType: 'text',
          encryptedContent,
          shouldAnchor,
          attachments,
        }),
      });
      
      await deleteDraft(draftId);
      setDraftId(crypto.randomUUID());
      setBody('');
      setAttachments([]);
      setLastSaved(null);
      
      notify.success('Message sent');
      onSent?.();
      loadDrafts();
    } catch (error) {
      console.error('[Composer] Send failed:', error);
      notify.error(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };
  
  const handleRecordingComplete = async (blob: Blob, _duration: number, thumbnail?: string) => {
    if (!recipientPublicKey) {
      notify.error('Recipient public key required');
      return;
    }
    
    setIsRecording(false);
    setIsSending(true);
    
    try {
      notify.info('Processing recording...');
      
      const compression = mode === 'voice' 
        ? await compressAudio(blob)
        : await compressVideo(blob);
      
      if (compression.compressed) {
        notify.info(`Compressed: ${Math.round(compression.originalSize / 1024)}KB → ${Math.round(compression.size / 1024)}KB`);
      }
      
      const base64Data = await blobToBase64(compression.blob);
      const encryptedContent = cryptoService.encryptToJSON(base64Data, recipientPublicKey);
      
      notify.info('Uploading to IPFS...');
      
      await apiRequest('/api/messages', {
        method: 'POST',
        body: JSON.stringify({
          toWallet: recipientAddress,
          messageType: mode,
          encryptedContent,
          shouldAnchor,
          uploadToIPFS: true,
          metadata: {
            duration: compression.duration,
            size: compression.size,
            format: compression.format,
            thumbnail: thumbnail || '',
          },
        }),
      });
      
      await deleteDraft(draftId);
      setDraftId(crypto.randomUUID());
      setBody('');
      setAttachments([]);
      
      notify.success(`${mode === 'voice' ? 'Voice' : 'Video'} message sent`);
      onSent?.();
    } catch (error) {
      console.error('[Composer] Media send failed:', error);
      notify.error(error instanceof Error ? error.message : 'Failed to send media');
    } finally {
      setIsSending(false);
    }
  };
  
  const handleAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    notify.info('Uploading attachment...');
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const res = await fetch('/api/ipfs/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!res.ok) throw new Error('Upload failed');
      
      const { IpfsHash, cid } = await res.json();
      const cidValue = IpfsHash || cid;
      
      setAttachments(a => [...a, cidValue]);
      notify.success('Attachment added');
    } catch (error) {
      notify.error('Failed to upload attachment');
    }
  };
  
  const removeAttachment = (index: number) => {
    setAttachments(a => a.filter((_, i) => i !== index));
  };
  
  if (isRecording) {
    return (
      <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50">
        <MediaRecorder
          type={mode as 'voice' | 'video'}
          onRecordingComplete={handleRecordingComplete}
          onCancel={() => setIsRecording(false)}
          maxDuration={60}
        />
      </div>
    );
  }
  
  return (
    <div className="space-y-3" data-testid="message-composer">
      {/* Mode Selector */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setMode('text')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            mode === 'text'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
          data-testid="button-mode-text"
        >
          Text
        </button>
        <button
          onClick={() => setMode('voice')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
            mode === 'voice'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
          data-testid="button-mode-voice"
        >
          <Mic className="w-3.5 h-3.5" />
          Voice
        </button>
        <button
          onClick={() => setMode('video')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
            mode === 'video'
              ? 'bg-purple-600 text-white'
              : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
          }`}
          data-testid="button-mode-video"
        >
          <Video className="w-3.5 h-3.5" />
          Video
        </button>
        
        <div className="flex-1" />
        
        {/* Drafts Toggle */}
        {drafts.length > 0 && (
          <button
            onClick={() => setShowDrafts(!showDrafts)}
            className="px-2 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-400 hover:bg-slate-700 flex items-center gap-1.5"
            data-testid="button-toggle-drafts"
          >
            <Archive className="w-3.5 h-3.5" />
            {drafts.length} draft{drafts.length !== 1 ? 's' : ''}
          </button>
        )}
      </div>
      
      {/* Drafts List */}
      {showDrafts && drafts.length > 0 && (
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 space-y-2">
          <p className="text-xs font-medium text-slate-400 mb-2">Saved Drafts</p>
          {drafts.map((draft) => (
            <div
              key={draft.id}
              onClick={() => loadDraft(draft)}
              className="flex items-center justify-between p-2 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 cursor-pointer transition-colors"
              data-testid={`draft-item-${draft.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {draft.body.slice(0, 50) || '[Empty draft]'}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(draft.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={(e) => clearDraft(draft.id, e)}
                className="p-1.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                data-testid={`button-delete-draft-${draft.id}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Text Mode */}
      {mode === 'text' && (
        <>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type your encrypted message..."
            className="min-h-[100px] bg-slate-900/50 border-slate-700/50 resize-none"
            data-testid="textarea-message-body"
          />
          
          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((cid, i) => (
                <div
                  key={cid}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800 text-sm"
                >
                  <span className="text-slate-300 font-mono text-xs">
                    {cid.slice(0, 8)}...
                  </span>
                  <button
                    onClick={() => removeAttachment(i)}
                    className="p-0.5 rounded-full hover:bg-red-500/20 text-slate-500 hover:text-red-400"
                    data-testid={`button-remove-attachment-${i}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            <label className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 cursor-pointer transition-colors">
              <Paperclip className="w-5 h-5 text-slate-400" />
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                onChange={handleAttachment}
                data-testid="input-attachment"
              />
            </label>
            
            <div className="flex-1">
              {lastSaved && (
                <span className="text-xs text-slate-500">
                  Draft saved {lastSaved.toLocaleTimeString()}
                </span>
              )}
            </div>
            
            {onCancel && (
              <Button
                variant="ghost"
                onClick={onCancel}
                data-testid="button-cancel-compose"
              >
                Cancel
              </Button>
            )}
            
            <Button
              onClick={handleSend}
              disabled={isSending || (!body && attachments.length === 0)}
              className="bg-purple-600 hover:bg-purple-700"
              data-testid="button-send-message"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </>
      )}
      
      {/* Voice/Video Mode */}
      {(mode === 'voice' || mode === 'video') && (
        <div className="flex flex-col items-center gap-4 p-6 bg-slate-900/50 rounded-xl border border-slate-700/50">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
            mode === 'voice' ? 'bg-purple-500/20' : 'bg-blue-500/20'
          }`}>
            {mode === 'voice' ? (
              <Mic className="w-8 h-8 text-purple-400" />
            ) : (
              <Video className="w-8 h-8 text-blue-400" />
            )}
          </div>
          
          <p className="text-sm text-slate-400">
            Record a {mode === 'voice' ? 'voice' : 'video'} message (max 60 seconds)
          </p>
          
          <Button
            onClick={() => setIsRecording(true)}
            disabled={isSending}
            className={mode === 'voice' 
              ? 'bg-purple-600 hover:bg-purple-700' 
              : 'bg-blue-600 hover:bg-blue-700'
            }
            data-testid="button-start-recording"
          >
            {mode === 'voice' ? (
              <Mic className="w-4 h-4 mr-2" />
            ) : (
              <Video className="w-4 h-4 mr-2" />
            )}
            Start Recording
          </Button>
        </div>
      )}
    </div>
  );
}
