import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft,
  Plus,
  Trash2,
  Edit3,
  Lock,
  FileText,
  Search,
  Loader2,
  Save,
  X
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { SDK } from '@/lib/sdk';
import type { Note } from '@/lib/sdk/modules/notes';

export default function NotesPanel() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editEncrypted, setEditEncrypted] = useState(true);

  const { data: notesData, isLoading } = useQuery({
    queryKey: ['/api/nexus/notes'],
    queryFn: () => SDK.notes.list(),
  });

  const createMutation = useMutation({
    mutationFn: ({ title, content, encrypted }: { title: string; content: string; encrypted: boolean }) =>
      SDK.notes.create(title, content, encrypted),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/notes'] });
      setIsCreating(false);
      setSelectedNote(result.note);
      resetForm();
      toast({ title: 'Note created' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to create note' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { title?: string; content?: string; encrypted?: boolean } }) =>
      SDK.notes.update(id, data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/notes'] });
      setIsEditing(false);
      setSelectedNote(result.note);
      toast({ title: 'Note updated' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to update note' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => SDK.notes.deleteNote(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/nexus/notes'] });
      setSelectedNote(null);
      toast({ title: 'Note deleted' });
    },
    onError: () => {
      toast({ variant: 'destructive', title: 'Failed to delete note' });
    },
  });

  const notes = notesData?.notes || [];

  const filteredNotes = notes.filter(
    (note) =>
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const resetForm = () => {
    setEditTitle('');
    setEditContent('');
    setEditEncrypted(true);
  };

  const startEditing = (note: Note) => {
    setEditTitle(note.title);
    setEditContent(note.content);
    setEditEncrypted(note.encrypted);
    setIsEditing(true);
  };

  const startCreating = () => {
    resetForm();
    setIsCreating(true);
    setSelectedNote(null);
  };

  const handleSave = () => {
    if (!editTitle.trim()) {
      toast({ variant: 'destructive', title: 'Title is required' });
      return;
    }

    if (isCreating) {
      createMutation.mutate({ title: editTitle, content: editContent, encrypted: editEncrypted });
    } else if (selectedNote) {
      updateMutation.mutate({
        id: selectedNote.id,
        data: { title: editTitle, content: editContent, encrypted: editEncrypted },
      });
    }
  };

  const handleCancel = () => {
    setIsCreating(false);
    setIsEditing(false);
    resetForm();
  };

  return (
    <div className="min-h-screen bg-[#141414]">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-900/10 via-transparent to-orange-900/10 pointer-events-none" />

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
              <h1 className="text-lg font-semibold text-white">Notes</h1>
              <Button
                data-testid="button-new-note"
                size="sm"
                onClick={startCreating}
                className="ml-auto bg-purple-600 hover:bg-purple-500"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <Input
                data-testid="input-search-notes"
                placeholder="Search notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#252525] border-white/5 text-white placeholder:text-slate-500 text-sm"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-8 h-8 text-amber-500 animate-spin mx-auto mb-3" />
                <p className="text-sm text-slate-500">Loading notes...</p>
              </div>
            ) : filteredNotes.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500">No notes yet</p>
                <p className="text-xs text-slate-600 mt-1">Create your first note</p>
              </div>
            ) : (
              filteredNotes.map((note) => (
                <button
                  key={note.id}
                  data-testid={`button-note-${note.id}`}
                  onClick={() => {
                    setSelectedNote(note);
                    setIsCreating(false);
                    setIsEditing(false);
                  }}
                  className={`w-full p-4 text-left hover:bg-white/5 transition-colors border-b border-white/5 ${
                    selectedNote?.id === note.id ? 'bg-purple-600/10 border-l-2 border-l-purple-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{note.title}</p>
                      <p className="text-xs text-slate-500 truncate mt-1">
                        {note.encrypted ? '[Encrypted content]' : note.content.slice(0, 50)}
                      </p>
                    </div>
                    {note.encrypted && (
                      <Lock className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600 mt-2">
                    {new Date(note.updatedAt).toLocaleDateString()}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col">
          {isCreating || isEditing ? (
            <div className="flex-1 flex flex-col p-6">
              <div className="flex items-center justify-between mb-4">
                <Input
                  data-testid="input-note-title"
                  placeholder="Note title..."
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="text-lg font-semibold bg-transparent border-none text-white placeholder:text-slate-500 p-0 focus-visible:ring-0"
                />
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-slate-400" />
                    <Switch
                      data-testid="switch-encrypt-note"
                      checked={editEncrypted}
                      onCheckedChange={setEditEncrypted}
                    />
                  </div>
                  <Button
                    data-testid="button-cancel-edit"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancel}
                    className="text-slate-400"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    data-testid="button-save-note"
                    size="sm"
                    onClick={handleSave}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-gradient-to-r from-amber-600 to-orange-600"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <Textarea
                data-testid="textarea-note-content"
                placeholder="Start writing..."
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="flex-1 bg-transparent border-none text-white placeholder:text-slate-500 resize-none focus-visible:ring-0 text-sm"
              />
              {editEncrypted && (
                <Badge className="self-start mt-4 bg-amber-500/20 text-amber-300 border-0">
                  <Lock className="w-3 h-3 mr-1" />
                  Content will be encrypted
                </Badge>
              )}
            </div>
          ) : selectedNote ? (
            <div className="flex-1 flex flex-col">
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-white">{selectedNote.title}</h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Last updated: {new Date(selectedNote.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {selectedNote.encrypted && (
                    <Badge className="bg-amber-500/20 text-amber-300 border-0">
                      <Lock className="w-3 h-3 mr-1" />
                      Encrypted
                    </Badge>
                  )}
                  <Button
                    data-testid="button-edit-note"
                    variant="ghost"
                    size="sm"
                    onClick={() => startEditing(selectedNote)}
                    className="text-slate-400 hover:text-white"
                  >
                    <Edit3 className="w-4 h-4" />
                  </Button>
                  <Button
                    data-testid="button-delete-note"
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteMutation.mutate(selectedNote.id)}
                    disabled={deleteMutation.isPending}
                    className="text-red-400 hover:text-red-300"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex-1 p-6 overflow-y-auto">
                <p className="text-sm text-slate-300 whitespace-pre-wrap">
                  {selectedNote.encrypted ? '[Encrypted content - Decryption required]' : selectedNote.content}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-[#252525] flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-lg font-medium text-white mb-2">Select a note</h3>
                <p className="text-sm text-slate-500 max-w-sm">
                  Choose a note from the sidebar or create a new one.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
