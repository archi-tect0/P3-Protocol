/**
 * Note Editor - Enhanced note composition with autosave drafts
 * Features: autosave, drafts list, starred toggle, IPFS export
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  Save, Star, Clock, Archive, Upload, X, Loader2, 
  Hash, Bold, Italic, List, Quote, Code, Link as LinkIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  saveDraft, 
  deleteDraft, 
  listDrafts,
  addNote,
  type Draft,
  type NoteItem 
} from '@/lib/nexusStore';
import { notify } from '@/lib/notify';
import { apiRequest } from '@/lib/queryClient';

interface NoteEditorProps {
  existingNote?: NoteItem;
  onSave?: (note: NoteItem) => void;
  onCancel?: () => void;
}

export default function NoteEditor({
  existingNote,
  onSave,
  onCancel,
}: NoteEditorProps) {
  const [title, setTitle] = useState(existingNote?.title || '');
  const [body, setBody] = useState(existingNote?.body || '');
  const [starred, setStarred] = useState(existingNote?.starred || false);
  const [tags, setTags] = useState('');
  const [draftId, setDraftId] = useState<string>(() => existingNote?.id || crypto.randomUUID());
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [showDrafts, setShowDrafts] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  useEffect(() => {
    loadDrafts();
  }, []);
  
  useEffect(() => {
    if (!title && !body) return;
    
    const timer = setTimeout(() => {
      autosave();
    }, 1500);
    
    return () => clearTimeout(timer);
  }, [title, body, starred]);
  
  const loadDrafts = async () => {
    const d = await listDrafts('note');
    setDrafts(d);
  };
  
  const autosave = useCallback(async () => {
    if (!title && !body) return;
    
    const draft: Draft = {
      id: draftId,
      kind: 'note',
      title,
      body,
      updatedAt: Date.now(),
    };
    
    await saveDraft(draft);
    setLastSaved(new Date());
    loadDrafts();
  }, [draftId, title, body]);
  
  const loadDraft = async (draft: Draft) => {
    setDraftId(draft.id);
    setTitle(draft.title || '');
    setBody(draft.body);
    setShowDrafts(false);
    notify.info('Draft loaded');
  };
  
  const clearDraft = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteDraft(id);
    loadDrafts();
    notify.info('Draft deleted');
  };
  
  const handleSave = async () => {
    if (!title && !body) {
      notify.warn('Please add a title or content');
      return;
    }
    
    setIsSaving(true);
    
    try {
      const encryptedBody = btoa(body);
      const tagsArray = tags.split(',').map(t => t.trim()).filter(Boolean);
      
      let savedNote;
      
      if (existingNote) {
        savedNote = await apiRequest(`/api/notes/${existingNote.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            title,
            encryptedBody,
            searchableContent: body,
            tags: tagsArray,
            isPinned: starred ? 1 : 0,
          }),
        });
      } else {
        savedNote = await apiRequest('/api/notes', {
          method: 'POST',
          body: JSON.stringify({
            title,
            encryptedBody,
            searchableContent: body,
            tags: tagsArray,
            shouldAnchor: false,
          }),
        });
      }
      
      const localNote: NoteItem = {
        id: savedNote.id || crypto.randomUUID(),
        title,
        body: encryptedBody,
        starred,
        ts: Date.now(),
      };
      await addNote(localNote);
      
      await deleteDraft(draftId);
      
      setDraftId(crypto.randomUUID());
      setTitle('');
      setBody('');
      setStarred(false);
      setTags('');
      setLastSaved(null);
      
      notify.success('Note saved');
      onSave?.(localNote);
      loadDrafts();
    } catch (error) {
      console.error('[NoteEditor] Save failed:', error);
      notify.error(error instanceof Error ? error.message : 'Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };
  
  const handleExportToIPFS = async () => {
    if (!body) {
      notify.warn('Nothing to export');
      return;
    }
    
    setIsExporting(true);
    
    try {
      const encryptedContent = btoa(body);
      
      const res = await apiRequest('/api/ipfs/pin', {
        method: 'POST',
        body: JSON.stringify({ 
          content: encryptedContent, 
          type: 'note',
          metadata: { title }
        }),
      });
      
      const { cid } = res;
      notify.success(`Exported to IPFS: ${cid.slice(0, 12)}...`);
    } catch (error) {
      notify.error('Failed to export to IPFS');
    } finally {
      setIsExporting(false);
    }
  };
  
  const insertMarkdown = (syntax: string) => {
    const textarea = document.querySelector('[data-testid="textarea-note-body"]') as HTMLTextAreaElement;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = body.substring(start, end);
    
    let newText = '';
    let cursorOffset = 0;
    
    switch (syntax) {
      case 'bold':
        newText = `**${selectedText || 'bold'}**`;
        cursorOffset = selectedText ? newText.length : 2;
        break;
      case 'italic':
        newText = `*${selectedText || 'italic'}*`;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case 'code':
        newText = `\`${selectedText || 'code'}\``;
        cursorOffset = selectedText ? newText.length : 1;
        break;
      case 'quote':
        newText = `> ${selectedText || 'quote'}`;
        cursorOffset = 2;
        break;
      case 'list':
        newText = `- ${selectedText || 'item'}`;
        cursorOffset = 2;
        break;
      case 'heading':
        newText = `# ${selectedText || 'heading'}`;
        cursorOffset = 2;
        break;
      case 'link':
        newText = `[${selectedText || 'text'}](url)`;
        cursorOffset = selectedText ? newText.length - 4 : 1;
        break;
    }
    
    const newBody = body.substring(0, start) + newText + body.substring(end);
    setBody(newBody);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + cursorOffset, start + cursorOffset);
    }, 0);
  };
  
  return (
    <div className="space-y-4" data-testid="note-editor">
      {/* Title */}
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Note title (optional)"
        className="text-lg font-semibold bg-slate-900/50 border-slate-700/50"
        data-testid="input-note-title"
      />
      
      {/* Formatting Toolbar */}
      <div className="flex items-center gap-1 p-1 bg-slate-900/50 rounded-lg border border-slate-700/50">
        <button
          onClick={() => insertMarkdown('heading')}
          className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Heading"
        >
          <Hash className="w-4 h-4" />
        </button>
        <button
          onClick={() => insertMarkdown('bold')}
          className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </button>
        <button
          onClick={() => insertMarkdown('italic')}
          className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </button>
        <button
          onClick={() => insertMarkdown('list')}
          className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="List"
        >
          <List className="w-4 h-4" />
        </button>
        <button
          onClick={() => insertMarkdown('quote')}
          className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Quote"
        >
          <Quote className="w-4 h-4" />
        </button>
        <button
          onClick={() => insertMarkdown('code')}
          className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Code"
        >
          <Code className="w-4 h-4" />
        </button>
        <button
          onClick={() => insertMarkdown('link')}
          className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          title="Link"
        >
          <LinkIcon className="w-4 h-4" />
        </button>
        
        <div className="flex-1" />
        
        {/* Starred Toggle */}
        <button
          onClick={() => setStarred(!starred)}
          className={`p-2 rounded transition-colors ${
            starred 
              ? 'text-yellow-400 bg-yellow-500/20' 
              : 'text-slate-400 hover:text-yellow-400 hover:bg-slate-800'
          }`}
          title={starred ? 'Remove star' : 'Add star'}
          data-testid="button-toggle-starred"
        >
          <Star className={`w-4 h-4 ${starred ? 'fill-current' : ''}`} />
        </button>
        
        {/* Drafts Toggle */}
        {drafts.length > 0 && (
          <button
            onClick={() => setShowDrafts(!showDrafts)}
            className="p-2 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            data-testid="button-toggle-drafts"
          >
            <Archive className="w-4 h-4" />
            <span className="text-xs">{drafts.length}</span>
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
              data-testid={`note-draft-item-${draft.id}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">
                  {draft.title || draft.body.slice(0, 50) || '[Empty draft]'}
                </p>
                <p className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(draft.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={(e) => clearDraft(draft.id, e)}
                className="p-1.5 rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                data-testid={`button-delete-note-draft-${draft.id}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      {/* Body */}
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your encrypted note..."
        className="min-h-[200px] bg-slate-900/50 border-slate-700/50 resize-none font-mono text-sm"
        data-testid="textarea-note-body"
      />
      
      {/* Tags */}
      <div className="flex items-center gap-2">
        <Hash className="w-4 h-4 text-slate-500" />
        <Input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="Tags (comma-separated)"
          className="flex-1 bg-slate-900/50 border-slate-700/50"
          data-testid="input-note-tags"
        />
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2 pt-2">
        {lastSaved && (
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Draft saved {lastSaved.toLocaleTimeString()}
          </span>
        )}
        
        <div className="flex-1" />
        
        <Button
          variant="outline"
          onClick={handleExportToIPFS}
          disabled={isExporting || !body}
          className="border-slate-700"
          data-testid="button-export-ipfs"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Upload className="w-4 h-4 mr-2" />
          )}
          Export to IPFS
        </Button>
        
        {onCancel && (
          <Button
            variant="ghost"
            onClick={onCancel}
            data-testid="button-cancel-note"
          >
            Cancel
          </Button>
        )}
        
        <Button
          onClick={handleSave}
          disabled={isSaving || (!title && !body)}
          className="bg-indigo-600 hover:bg-indigo-700"
          data-testid="button-save-note"
        >
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : (
            <Save className="w-4 h-4 mr-2" />
          )}
          {isSaving ? 'Saving...' : 'Save Note'}
        </Button>
      </div>
    </div>
  );
}
