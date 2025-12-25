import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, Search, Trash2, Star, Clock, FileText, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/lib/notify';
import {
  listNotes,
  addNote,
  updateNote,
  deleteNote,
  setNoteStarred,
  saveDraft,
  getDraft,
  type NoteItem,
} from '@/lib/nexusStore';

type TabFilter = 'all' | 'starred' | 'recent';

function NotesList({
  notes,
  selectedId,
  onSelect,
  onToggleStar,
}: {
  notes: NoteItem[];
  selectedId: string | null;
  onSelect: (note: NoteItem) => void;
  onToggleStar: (id: string, starred: boolean) => void;
}) {
  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-14 h-14 rounded-full bg-[hsl(220,20%,12%)] flex items-center justify-center mb-4">
          <FileText className="w-7 h-7 text-purple-400" />
        </div>
        <p className="text-sm text-slate-400">No notes yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3">
      {notes.map((note) => (
        <div
          key={note.id}
          data-testid={`note-item-${note.id}`}
          onClick={() => onSelect(note)}
          className={`group relative p-4 rounded-xl cursor-pointer transition-all ${
            selectedId === note.id
              ? 'bg-purple-900/30 border border-purple-500/40'
              : 'bg-[hsl(220,20%,10%)] hover:bg-[hsl(220,20%,12%)] border border-transparent'
          }`}
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-medium text-sm text-white line-clamp-1 flex-1">
              {note.title || 'Untitled'}
            </h3>
            <button
              data-testid={`button-star-${note.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(note.id, !note.starred);
              }}
              className={`flex-shrink-0 transition-opacity ${
                note.starred ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
              }`}
            >
              <Star
                className={`w-4 h-4 ${
                  note.starred ? 'fill-yellow-400 text-yellow-400' : 'text-slate-500 hover:text-yellow-400'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-slate-400 line-clamp-2 mb-2">{note.body}</p>
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(note.ts).toLocaleDateString()}
          </span>
        </div>
      ))}
    </div>
  );
}

function NoteEditor({
  note,
  onSave,
  onDelete,
  saveStatus,
}: {
  note: NoteItem | null;
  onSave: (title: string, body: string) => void;
  onDelete: () => void;
  saveStatus: 'idle' | 'saving' | 'saved';
}) {
  const [title, setTitle] = useState(note?.title || '');
  const [body, setBody] = useState(note?.body || '');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(note?.title || '');
    setBody(note?.body || '');
  }, [note?.id]);

  const triggerAutosave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (title || body) {
        onSave(title, body);
      }
    }, 1500);
  }, [title, body, onSave]);

  useEffect(() => {
    triggerAutosave();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [title, body, triggerAutosave]);

  return (
    <div className="flex flex-col h-full bg-[hsl(220,20%,7%)]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(220,20%,14%)]">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          {saveStatus === 'saving' && (
            <>
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {saveStatus === 'saved' && (
            <>
              <span className="w-2 h-2 rounded-full bg-green-500" />
              <span>Saved</span>
            </>
          )}
        </div>
        {note && (
          <Button
            data-testid="button-delete-note"
            variant="ghost"
            size="sm"
            onClick={onDelete}
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        )}
      </div>

      <div className="flex-1 flex flex-col p-4 gap-4 overflow-auto">
        <Input
          data-testid="input-note-title"
          placeholder="Note title..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-transparent border-none text-xl font-semibold text-white placeholder:text-slate-500 focus-visible:ring-0 px-0"
        />
        <Textarea
          data-testid="textarea-note-body"
          placeholder="Start writing..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="flex-1 min-h-[300px] bg-transparent border-none text-slate-200 placeholder:text-slate-500 resize-none focus-visible:ring-0 px-0"
        />
      </div>
    </div>
  );
}

export default function NotesPage() {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabFilter>('all');
  const [search, setSearch] = useState('');
  const [selectedNote, setSelectedNote] = useState<NoteItem | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showEditor, setShowEditor] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      const result = await listNotes({
        starred: tab === 'starred' ? true : undefined,
        recent: tab === 'recent' ? true : undefined,
      });
      setNotes(result);
    } catch (err) {
      notify.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  useEffect(() => {
    const loadDraft = async () => {
      const draft = await getDraft('note-draft');
      if (draft && !selectedNote) {
        setSelectedNote({
          id: 'draft',
          title: draft.title,
          body: draft.body,
          ts: draft.updatedAt,
        });
        setShowEditor(true);
      }
    };
    loadDraft();
  }, []);

  const filteredNotes = notes.filter((note) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (note.title?.toLowerCase().includes(q) || false) ||
      note.body.toLowerCase().includes(q)
    );
  });

  const handleNewNote = () => {
    setSelectedNote(null);
    setShowEditor(true);
  };

  const handleSelectNote = (note: NoteItem) => {
    setSelectedNote(note);
    setShowEditor(true);
  };

  const handleToggleStar = async (id: string, starred: boolean) => {
    try {
      await setNoteStarred(id, starred);
      notify.success(starred ? 'Note starred' : 'Note unstarred');
      loadNotes();
    } catch {
      notify.error('Failed to update note');
    }
  };

  const handleSave = async (title: string, body: string) => {
    if (!title && !body) return;
    setSaveStatus('saving');

    try {
      await saveDraft({
        id: 'note-draft',
        kind: 'note',
        title,
        body,
        updatedAt: Date.now(),
      });

      if (selectedNote && selectedNote.id !== 'draft') {
        await updateNote(selectedNote.id, { title, body });
      } else {
        const newNote: NoteItem = {
          id: crypto.randomUUID(),
          title,
          body,
          starred: false,
          ts: Date.now(),
        };
        await addNote(newNote);
        setSelectedNote(newNote);
      }

      setSaveStatus('saved');
      loadNotes();
    } catch {
      notify.error('Failed to save note');
      setSaveStatus('idle');
    }
  };

  const handleDelete = async () => {
    if (!selectedNote || selectedNote.id === 'draft') return;
    try {
      await deleteNote(selectedNote.id);
      notify.success('Note deleted');
      setSelectedNote(null);
      setShowEditor(false);
      loadNotes();
    } catch {
      notify.error('Failed to delete note');
    }
  };

  const tabs: { key: TabFilter; label: string; icon: typeof FolderOpen }[] = [
    { key: 'all', label: 'All Notes', icon: FolderOpen },
    { key: 'starred', label: 'Starred', icon: Star },
    { key: 'recent', label: 'Recent', icon: Clock },
  ];

  return (
    <div className="h-full flex flex-col bg-[hsl(220,20%,7%)]">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-b border-[hsl(220,20%,14%)] gap-2">
        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" />
          Notes
        </h1>
        <div className="flex gap-1 overflow-x-auto pb-1 -mb-1 scrollbar-hide">
          {tabs.map((t) => (
            <button
              key={t.key}
              data-testid={`tab-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${
                tab === t.key
                  ? 'bg-purple-900/40 text-purple-300'
                  : 'text-slate-400 hover:bg-[hsl(220,20%,12%)]'
              }`}
            >
              <t.icon className="w-3.5 h-3.5 inline mr-1.5" />
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.key === 'all' ? 'All' : t.key === 'starred' ? '★' : '⏱'}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 border-b border-[hsl(220,20%,14%)]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            data-testid="input-search"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 bg-[hsl(220,20%,10%)] border-[hsl(220,20%,18%)] text-white placeholder:text-slate-500"
          />
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div
          className={`w-full md:w-80 border-r border-[hsl(220,20%,14%)] overflow-y-auto ${
            showEditor ? 'hidden md:block' : ''
          }`}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
            </div>
          ) : (
            <NotesList
              notes={filteredNotes}
              selectedId={selectedNote?.id || null}
              onSelect={handleSelectNote}
              onToggleStar={handleToggleStar}
            />
          )}
        </div>

        <div className={`flex-1 ${!showEditor ? 'hidden md:flex' : 'flex'} flex-col`}>
          {showEditor ? (
            <>
              <button
                data-testid="button-back"
                onClick={() => setShowEditor(false)}
                className="md:hidden px-4 py-2 text-sm text-purple-400 text-left border-b border-[hsl(220,20%,14%)]"
              >
                ← Back to list
              </button>
              <NoteEditor
                note={selectedNote}
                onSave={handleSave}
                onDelete={handleDelete}
                saveStatus={saveStatus}
              />
            </>
          ) : (
            <div className="hidden md:flex flex-1 items-center justify-center text-slate-500">
              <div className="text-center">
                <FileText className="w-12 h-12 mx-auto mb-3 text-slate-600" />
                <p>Select a note or create a new one</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <button
        data-testid="button-new-note"
        onClick={handleNewNote}
        className="fixed bottom-24 right-6 z-[60] w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-900/50 flex items-center justify-center transition-colors md:bottom-6"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  );
}
