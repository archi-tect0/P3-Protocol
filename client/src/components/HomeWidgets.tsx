/**
 * Home Widgets - Dashboard widgets for Nexus home screen
 * Shows recent messages, notes, quick actions
 */

import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { 
  MessageSquare, 
  FileText, 
  Phone, 
  CreditCard, 
  Vote, 
  Clock,
  ChevronRight,
  Send,
  Mic,
  Video,
  Plus
} from 'lucide-react';
import { listThreads, listNotes, type ThreadItem, type NoteItem } from '@/lib/nexusStore';
import { Button } from '@/components/ui/button';

interface RecentMessagesWidgetProps {
  limit?: number;
  onCompose?: () => void;
}

export function RecentMessagesWidget({ limit = 5, onCompose }: RecentMessagesWidgetProps) {
  const [recent, setRecent] = useState<ThreadItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadRecent();
  }, []);
  
  const loadRecent = async () => {
    try {
      const items = await listThreads({ limit });
      setRecent(items);
    } catch (e) {
      console.error('[Widget] Failed to load recent messages:', e);
    } finally {
      setLoading(false);
    }
  };
  
  const getTypeIcon = (kind: string) => {
    switch (kind) {
      case 'voice': return <Mic className="w-3 h-3 text-purple-400" />;
      case 'video': return <Video className="w-3 h-3 text-blue-400" />;
      default: return <MessageSquare className="w-3 h-3 text-slate-400" />;
    }
  };
  
  return (
    <div 
      className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4"
      data-testid="widget-recent-messages"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-purple-400" />
          Recent Messages
        </h3>
        <Link href="/app/messages" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-slate-700/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : recent.length === 0 ? (
        <div className="text-center py-6">
          <MessageSquare className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No messages yet</p>
          {onCompose && (
            <Button
              onClick={onCompose}
              size="sm"
              className="mt-3 bg-purple-600 hover:bg-purple-700"
              data-testid="button-compose-first-message"
            >
              <Send className="w-3 h-3 mr-1.5" />
              Send first message
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {recent.map(item => (
            <li 
              key={item.id}
              className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 transition-colors cursor-pointer"
              data-testid={`recent-message-${item.id}`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                {getTypeIcon(item.kind)}
                <span className="text-sm text-slate-300 truncate font-mono">
                  {item.to.slice(0, 6)}...{item.to.slice(-4)}
                </span>
              </div>
              <span className="text-xs text-slate-500 flex items-center gap-1 flex-shrink-0">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(item.ts)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface RecentNotesWidgetProps {
  limit?: number;
  onNewNote?: () => void;
}

export function RecentNotesWidget({ limit = 3, onNewNote }: RecentNotesWidgetProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadNotes();
  }, []);
  
  const loadNotes = async () => {
    try {
      const items = await listNotes({ recent: true, limit });
      setNotes(items);
    } catch (e) {
      console.error('[Widget] Failed to load notes:', e);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div 
      className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4"
      data-testid="widget-recent-notes"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          Recent Notes
        </h3>
        <Link href="/app/notes" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => (
            <div key={i} className="h-14 bg-slate-700/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : notes.length === 0 ? (
        <div className="text-center py-6">
          <FileText className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500">No notes yet</p>
          {onNewNote && (
            <Button
              onClick={onNewNote}
              size="sm"
              className="mt-3 bg-indigo-600 hover:bg-indigo-700"
              data-testid="button-create-first-note"
            >
              <Plus className="w-3 h-3 mr-1.5" />
              Create note
            </Button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {notes.map(note => (
            <li 
              key={note.id}
              className="p-2.5 rounded-lg bg-slate-900/50 hover:bg-slate-800/50 transition-colors cursor-pointer"
              data-testid={`recent-note-${note.id}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {note.title || 'Untitled'}
                  </p>
                  <p className="text-xs text-slate-500 truncate mt-0.5">
                    [Encrypted content]
                  </p>
                </div>
                <span className="text-xs text-slate-500 flex-shrink-0">
                  {formatTimeAgo(note.ts)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function QuickActionsWidget() {
  const actions = [
    { icon: Send, label: 'New Message', href: '/app/messages', color: 'text-purple-400 bg-purple-500/20' },
    { icon: FileText, label: 'New Note', href: '/app/notes', color: 'text-indigo-400 bg-indigo-500/20' },
    { icon: CreditCard, label: 'Send Payment', href: '/app/payments', color: 'text-emerald-400 bg-emerald-500/20' },
    { icon: Phone, label: 'Start Call', href: '/app/calls', color: 'text-blue-400 bg-blue-500/20' },
    { icon: Vote, label: 'DAO Governance', href: '/app/dao', color: 'text-amber-400 bg-amber-500/20' },
  ];
  
  return (
    <div 
      className="bg-slate-800/50 backdrop-blur-xl rounded-2xl border border-slate-700/50 p-4"
      data-testid="widget-quick-actions"
    >
      <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {actions.map(action => (
          <Link
            key={action.label}
            href={action.href}
            className="flex flex-col items-center gap-2 p-3 rounded-xl bg-slate-900/50 hover:bg-slate-800/50 transition-colors"
            data-testid={`quick-action-${action.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <div className={`p-2.5 rounded-xl ${action.color}`}>
              <action.icon className="w-5 h-5" />
            </div>
            <span className="text-xs font-medium text-slate-400">{action.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function WelcomeWidget({ walletAddress }: { walletAddress: string }) {
  const shortened = walletAddress 
    ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
    : '';
  
  return (
    <div 
      className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-6"
      data-testid="widget-welcome"
    >
      <h2 className="text-xl font-bold text-white mb-1">
        Welcome to Nexus
      </h2>
      <p className="text-sm text-purple-200/70 mb-4">
        Your encrypted communication hub
      </p>
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 w-fit">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-mono text-purple-200">{shortened}</span>
      </div>
    </div>
  );
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return new Date(ts).toLocaleDateString();
}

export default function HomeWidgets({ walletAddress }: { walletAddress: string }) {
  return (
    <div className="space-y-4">
      <WelcomeWidget walletAddress={walletAddress} />
      <QuickActionsWidget />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RecentMessagesWidget />
        <RecentNotesWidget />
      </div>
    </div>
  );
}
