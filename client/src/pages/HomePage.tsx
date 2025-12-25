import { useState, useEffect } from "react";
import { Link } from "wouter";
import { MessageSquare, FileText, Mic, ChevronRight, Star, Clock } from "lucide-react";
import OwlLogo from "@/components/OwlLogo";
import { notify } from "@/lib/notify";
import { listThreads, listNotes, listQueue, type ThreadItem, type NoteItem } from "@/lib/nexusStore";

const shortenAddress = (addr: string) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "Not connected";

function WelcomeWidget({ address }: { address: string }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div className="glass-card p-6" data-testid="widget-welcome">
      <div className="flex items-center gap-4">
        <OwlLogo className="w-14 h-14" />
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-slate-100" data-testid="text-greeting">{greeting}</h1>
          <p className="text-cyan-400 font-mono text-sm" data-testid="text-wallet-address">{shortenAddress(address)}</p>
        </div>
      </div>
    </div>
  );
}

function QuickActions() {
  const actions = [
    { href: "/app/messages", icon: MessageSquare, label: "New Message", color: "cyan", testId: "button-new-message", toast: "Opening new message composer..." },
    { href: "/app/notes", icon: FileText, label: "New Note", color: "purple", testId: "button-new-note", toast: "Opening new note editor..." },
    { href: "/app/voice", icon: Mic, label: "Voice Clip", color: "amber", testId: "button-voice-clip", toast: "Starting voice recording..." },
  ];
  return (
    <div className="grid grid-cols-3 gap-3" data-testid="widget-quick-actions">
      {actions.map(({ href, icon: Icon, label, color, testId, toast }) => (
        <Link key={testId} href={href}>
          <button
            onClick={() => notify.info(toast)}
            className="glass-card p-4 flex flex-col items-center gap-2 hover:bg-cyan-500/10 transition-colors w-full"
            data-testid={testId}
          >
            <div className={`w-10 h-10 rounded-full bg-${color}-500/20 flex items-center justify-center`}>
              <Icon className={`w-5 h-5 text-${color}-400`} />
            </div>
            <span className="text-xs font-medium text-slate-300">{label}</span>
          </button>
        </Link>
      ))}
    </div>
  );
}

function StatsBar({ starredCount, pendingCount }: { starredCount: number; pendingCount: number }) {
  return (
    <div className="flex gap-3" data-testid="widget-stats">
      <div className="glass-card px-4 py-3 flex-1 flex items-center gap-3">
        <Star className="w-4 h-4 text-amber-400" />
        <div>
          <p className="text-lg font-semibold text-slate-100" data-testid="text-starred-count">{starredCount}</p>
          <p className="text-xs text-slate-400">Starred</p>
        </div>
      </div>
      <div className="glass-card px-4 py-3 flex-1 flex items-center gap-3">
        <Clock className="w-4 h-4 text-cyan-400" />
        <div>
          <p className="text-lg font-semibold text-slate-100" data-testid="text-pending-count">{pendingCount}</p>
          <p className="text-xs text-slate-400">Pending</p>
        </div>
      </div>
    </div>
  );
}

function RecentMessagesWidget({ threads }: { threads: ThreadItem[] }) {
  return (
    <div className="glass-card p-4" data-testid="widget-recent-messages">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-200">Recent Messages</h2>
        <Link href="/app/messages">
          <button className="text-cyan-400 text-xs flex items-center gap-1 hover:text-cyan-300" data-testid="link-view-all-messages">
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
      {threads.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-4" data-testid="text-no-messages">No messages yet</p>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <Link key={thread.id} href="/app/messages">
              <div className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors cursor-pointer" data-testid={`card-message-${thread.id}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-200 truncate" data-testid={`text-message-to-${thread.id}`}>{shortenAddress(thread.to)}</p>
                  <span className="text-xs text-slate-500">{new Date(thread.ts).toLocaleDateString()}</span>
                </div>
                {thread.body && <p className="text-xs text-slate-400 truncate mt-1">{thread.body}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function RecentNotesWidget({ notes }: { notes: NoteItem[] }) {
  return (
    <div className="glass-card p-4" data-testid="widget-recent-notes">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-200">Recent Notes</h2>
        <Link href="/app/notes">
          <button className="text-cyan-400 text-xs flex items-center gap-1 hover:text-cyan-300" data-testid="link-view-all-notes">
            View all <ChevronRight className="w-3 h-3" />
          </button>
        </Link>
      </div>
      {notes.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-4" data-testid="text-no-notes">No notes yet</p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <Link key={note.id} href="/app/notes">
              <div className="p-3 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 transition-colors cursor-pointer" data-testid={`card-note-${note.id}`}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-200 truncate" data-testid={`text-note-title-${note.id}`}>{note.title || "Untitled"}</p>
                  {note.starred && <Star className="w-3 h-3 text-amber-400" />}
                </div>
                <p className="text-xs text-slate-400 truncate mt-1">{note.body}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  const [threads, setThreads] = useState<ThreadItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [starredCount, setStarredCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const walletAddress = localStorage.getItem("walletAddress") || "";

  useEffect(() => {
    async function loadData() {
      try {
        const [recentThreads, recentNotes, starredNotes, pendingQueue] = await Promise.all([
          listThreads({ limit: 5 }),
          listNotes({ recent: true, limit: 5 }),
          listNotes({ starred: true }),
          listQueue("pending"),
        ]);
        setThreads(recentThreads);
        setNotes(recentNotes);
        setStarredCount(starredNotes.length);
        setPendingCount(pendingQueue.length);
      } catch (error) {
        console.error("[HomePage] Failed to load data:", error);
        notify.error("Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="loading-spinner">
        <div className="w-10 h-10 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-full p-4 space-y-4 max-w-lg mx-auto" data-testid="page-home">
      <WelcomeWidget address={walletAddress} />
      <QuickActions />
      <StatsBar starredCount={starredCount} pendingCount={pendingCount} />
      <RecentMessagesWidget threads={threads} />
      <RecentNotesWidget notes={notes} />
    </div>
  );
}
