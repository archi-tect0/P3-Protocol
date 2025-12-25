import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { P3, modFetch, Roles } from '@/lib/sdk';
import { 
  Flag,
  Star,
  Package,
  Puzzle,
  User,
  Wallet,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
  Trash2,
  Check,
  X,
  Ban,
  UserMinus,
  RefreshCw,
  LayoutGrid,
  Plus,
  Edit,
  Palette
} from 'lucide-react';

function hapticFeedback(pattern: 'light' | 'medium' | 'heavy' = 'light') {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 25, heavy: 50 };
    navigator.vibrate(patterns[pattern]);
  }
}

type TabId = 'reports' | 'reviews' | 'apps' | 'widgets' | 'users' | 'categories';

interface Report {
  id: string;
  type: 'app' | 'review' | 'user';
  appId?: string;
  reason: string;
  reportedBy: string;
  createdAt: number;
}

interface ReviewItem {
  id: string;
  appId: string;
  rating: number;
  text: string;
  author: string;
  createdAt: number;
}

interface AppItem {
  id: string;
  title: string;
  category: string;
  visible: boolean;
}

interface WidgetItem {
  id: string;
  title: string;
  size: 'small' | 'medium' | 'large';
  appId: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface BannedUser {
  address: string;
  reason?: string;
  bannedAt: number;
}

interface CategoryItem {
  id: string;
  name: string;
  icon: string;
  color: string;
  appCount: number;
  createdAt: number;
}

const TABS: { id: TabId; label: string; emoji: string; icon: typeof Flag }[] = [
  { id: 'reports', label: 'Reports', emoji: '🚩', icon: Flag },
  { id: 'reviews', label: 'Reviews', emoji: '⭐', icon: Star },
  { id: 'apps', label: 'Apps', emoji: '📦', icon: Package },
  { id: 'widgets', label: 'Widgets', emoji: '🧩', icon: Puzzle },
  { id: 'users', label: 'Users', emoji: '👤', icon: User },
  { id: 'categories', label: 'Categories', emoji: '🗂️', icon: LayoutGrid },
];

const CATEGORIES = [
  'security',
  'payments',
  'creative',
  'social',
  'governance',
  'analytics',
  'developer',
  'games'
];

function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function ReportsTab() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const res = await modFetch('/api/mod/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      toast({ title: 'Failed to load reports', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleHideApp(report: Report) {
    hapticFeedback('medium');
    try {
      const res = await modFetch(`/api/mod/apps/${report.appId}/hide`, {
        method: 'POST',
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: 'hide_app',
          appId: report.appId,
          reportId: report.id,
          ts: Date.now()
        });
        setReports(prev => prev.filter(r => r.id !== report.id));
        toast({ title: 'App hidden', description: `${report.appId} is now hidden` });
      }
    } catch (err) {
      console.error('Failed to hide app:', err);
      toast({ title: 'Failed to hide app', variant: 'destructive' });
    }
  }

  async function handleDismiss(reportId: string) {
    hapticFeedback('light');
    try {
      const res = await modFetch(`/api/mod/reports/${reportId}/dismiss`, {
        method: 'POST',
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: 'dismiss_report',
          reportId,
          ts: Date.now()
        });
        setReports(prev => prev.filter(r => r.id !== reportId));
        toast({ title: 'Report dismissed' });
      }
    } catch (err) {
      console.error('Failed to dismiss report:', err);
      toast({ title: 'Failed to dismiss report', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#4fe1a8]" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="text-center py-12">
        <Flag className="w-12 h-12 mx-auto mb-3 text-slate-500" />
        <p className="text-slate-400">No pending reports</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map(report => (
        <div 
          key={report.id}
          className="glass-card-mod p-4 rounded-xl animate-fadeIn"
          data-testid={`report-card-${report.id}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge 
                  variant="outline" 
                  className={`text-xs ${
                    report.type === 'app' ? 'border-blue-500/50 text-blue-400' :
                    report.type === 'review' ? 'border-yellow-500/50 text-yellow-400' :
                    'border-red-500/50 text-red-400'
                  }`}
                >
                  {report.type}
                </Badge>
                {report.appId && (
                  <span className="text-xs text-slate-500 truncate">
                    {report.appId}
                  </span>
                )}
              </div>
              <p className="text-sm text-[#eaf6ff]">{report.reason}</p>
              <p className="text-xs text-slate-500 mt-1">
                by {truncateAddress(report.reportedBy)}
              </p>
            </div>
            <div className="flex gap-2">
              {report.appId && (
                <Button
                  size="sm"
                  variant="destructive"
                  className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border-red-500/30"
                  onClick={() => handleHideApp(report)}
                  data-testid={`button-hide-app-${report.id}`}
                >
                  <EyeOff className="w-3 h-3 mr-1" />
                  Hide
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-400 hover:text-white hover:bg-white/10"
                onClick={() => handleDismiss(report.id)}
                data-testid={`button-dismiss-${report.id}`}
              >
                <X className="w-3 h-3 mr-1" />
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReviewsTab() {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchReviews();
  }, []);

  async function fetchReviews() {
    setLoading(true);
    try {
      const res = await modFetch('/api/mod/reviews');
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
      toast({ title: 'Failed to load reviews', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(reviewId: string) {
    hapticFeedback('medium');
    try {
      const res = await modFetch(`/api/mod/reviews/${reviewId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: 'remove_review',
          reviewId,
          ts: Date.now()
        });
        setReviews(prev => prev.filter(r => r.id !== reviewId));
        toast({ title: 'Review removed' });
      }
    } catch (err) {
      console.error('Failed to remove review:', err);
      toast({ title: 'Failed to remove review', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#4fe1a8]" />
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12">
        <Star className="w-12 h-12 mx-auto mb-3 text-slate-500" />
        <p className="text-slate-400">No reviews to moderate</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reviews.map(review => (
        <div 
          key={review.id}
          className="glass-card-mod p-4 rounded-xl animate-fadeIn"
          data-testid={`review-card-${review.id}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-slate-400">{review.appId}</span>
                <span className="text-yellow-400">
                  {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                </span>
              </div>
              <p className="text-sm text-[#eaf6ff] line-clamp-2">{review.text}</p>
              <p className="text-xs text-slate-500 mt-1">
                by {truncateAddress(review.author)}
              </p>
            </div>
            <Button
              size="sm"
              variant="destructive"
              className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border-red-500/30"
              onClick={() => handleRemove(review.id)}
              data-testid={`button-remove-review-${review.id}`}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function AppsTab() {
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchApps();
  }, []);

  async function fetchApps() {
    setLoading(true);
    try {
      const res = await modFetch('/api/mod/apps');
      if (res.ok) {
        const data = await res.json();
        setApps(data.apps || []);
      }
    } catch (err) {
      console.error('Failed to fetch apps:', err);
      toast({ title: 'Failed to load apps', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleVisibility(app: AppItem) {
    hapticFeedback('medium');
    try {
      const res = await modFetch(`/api/mod/apps/${app.id}/visibility`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible: !app.visible })
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: app.visible ? 'hide_app' : 'unhide_app',
          appId: app.id,
          ts: Date.now()
        });
        setApps(prev => prev.map(a => 
          a.id === app.id ? { ...a, visible: !a.visible } : a
        ));
        toast({ title: app.visible ? 'App hidden' : 'App unhidden', description: app.title });
      }
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
      toast({ title: 'Failed to toggle visibility', variant: 'destructive' });
    }
  }

  async function handleCategoryChange(appId: string, newCategory: string) {
    hapticFeedback('light');
    try {
      const res = await modFetch(`/api/mod/apps/${appId}/category`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: newCategory })
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: 'change_category',
          appId,
          category: newCategory,
          ts: Date.now()
        });
        setApps(prev => prev.map(a => 
          a.id === appId ? { ...a, category: newCategory } : a
        ));
        toast({ title: 'Category updated', description: `Changed to ${newCategory}` });
      }
    } catch (err) {
      console.error('Failed to change category:', err);
      toast({ title: 'Failed to change category', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#4fe1a8]" />
      </div>
    );
  }

  if (apps.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 mx-auto mb-3 text-slate-500" />
        <p className="text-slate-400">No apps to manage</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {apps.map(app => (
        <div 
          key={app.id}
          className="glass-card-mod p-4 rounded-xl animate-fadeIn"
          data-testid={`app-card-${app.id}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-[#eaf6ff] truncate">
                {app.title}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <Select
                  value={app.category}
                  onValueChange={(val) => handleCategoryChange(app.id, val)}
                >
                  <SelectTrigger className="h-7 text-xs bg-white/5 border-white/10 text-slate-300 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0d1b2a] border-white/10">
                    {CATEGORIES.map(cat => (
                      <SelectItem 
                        key={cat} 
                        value={cat}
                        className="text-slate-300 focus:bg-white/10 focus:text-white"
                      >
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge 
                  variant="outline"
                  className={`text-xs ${
                    app.visible 
                      ? 'border-emerald-500/50 text-emerald-400' 
                      : 'border-red-500/50 text-red-400'
                  }`}
                >
                  {app.visible ? 'Visible' : 'Hidden'}
                </Badge>
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className={`${
                app.visible 
                  ? 'text-slate-400 hover:text-red-400 hover:bg-red-500/10' 
                  : 'text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10'
              }`}
              onClick={() => handleToggleVisibility(app)}
              data-testid={`button-toggle-visibility-${app.id}`}
            >
              {app.visible ? (
                <>
                  <EyeOff className="w-4 h-4 mr-1" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-1" />
                  Unhide
                </>
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function WidgetsTab() {
  const [widgets, setWidgets] = useState<WidgetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchWidgets();
  }, []);

  async function fetchWidgets() {
    setLoading(true);
    try {
      const res = await modFetch('/api/mod/widgets/pending');
      if (res.ok) {
        const data = await res.json();
        setWidgets(data.widgets || []);
      }
    } catch (err) {
      console.error('Failed to fetch widgets:', err);
      toast({ title: 'Failed to load widgets', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(widgetId: string) {
    hapticFeedback('medium');
    try {
      const res = await modFetch(`/api/mod/widgets/${widgetId}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: 'approve_widget',
          widgetId,
          ts: Date.now()
        });
        setWidgets(prev => prev.filter(w => w.id !== widgetId));
        toast({ title: 'Widget approved' });
      }
    } catch (err) {
      console.error('Failed to approve widget:', err);
      toast({ title: 'Failed to approve widget', variant: 'destructive' });
    }
  }

  async function handleReject(widgetId: string) {
    hapticFeedback('medium');
    try {
      const res = await modFetch(`/api/mod/widgets/${widgetId}/reject`, {
        method: 'POST',
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: 'reject_widget',
          widgetId,
          ts: Date.now()
        });
        setWidgets(prev => prev.filter(w => w.id !== widgetId));
        toast({ title: 'Widget rejected' });
      }
    } catch (err) {
      console.error('Failed to reject widget:', err);
      toast({ title: 'Failed to reject widget', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#4fe1a8]" />
      </div>
    );
  }

  if (widgets.length === 0) {
    return (
      <div className="text-center py-12">
        <Puzzle className="w-12 h-12 mx-auto mb-3 text-slate-500" />
        <p className="text-slate-400">No pending widgets</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {widgets.map(widget => (
        <div 
          key={widget.id}
          className="glass-card-mod p-4 rounded-xl animate-fadeIn"
          data-testid={`widget-card-${widget.id}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-[#eaf6ff] truncate">
                {widget.title}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  variant="outline"
                  className="text-xs border-purple-500/50 text-purple-400"
                >
                  {widget.size}
                </Badge>
                <span className="text-xs text-slate-500">{widget.appId}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
                onClick={() => handleApprove(widget.id)}
                data-testid={`button-approve-widget-${widget.id}`}
              >
                <Check className="w-3 h-3 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="bg-red-600/20 hover:bg-red-600/40 text-red-400 border-red-500/30"
                onClick={() => handleReject(widget.id)}
                data-testid={`button-reject-widget-${widget.id}`}
              >
                <X className="w-3 h-3 mr-1" />
                Reject
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function UsersTab() {
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [banAddress, setBanAddress] = useState('');
  const [banning, setBanning] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBannedUsers();
  }, []);

  async function fetchBannedUsers() {
    setLoading(true);
    try {
      const res = await modFetch('/api/mod/users/banned');
      if (res.ok) {
        const data = await res.json();
        setBannedUsers(data.users || []);
      }
    } catch (err) {
      console.error('Failed to fetch banned users:', err);
      toast({ title: 'Failed to load banned users', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleBan() {
    if (!banAddress.trim() || !/^0x[a-fA-F0-9]{40}$/.test(banAddress)) {
      toast({ title: 'Invalid wallet address', variant: 'destructive' });
      return;
    }
    
    hapticFeedback('heavy');
    setBanning(true);
    try {
      const res = await modFetch('/api/mod/users/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: banAddress.toLowerCase() })
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: 'ban_user',
          address: banAddress.toLowerCase(),
          ts: Date.now()
        });
        setBannedUsers(prev => [
          { address: banAddress.toLowerCase(), bannedAt: Date.now() },
          ...prev
        ]);
        setBanAddress('');
        toast({ title: 'User banned', description: truncateAddress(banAddress) });
      }
    } catch (err) {
      console.error('Failed to ban user:', err);
      toast({ title: 'Failed to ban user', variant: 'destructive' });
    } finally {
      setBanning(false);
    }
  }

  async function handleUnban(address: string) {
    hapticFeedback('medium');
    try {
      const res = await modFetch('/api/mod/users/unban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: 'unban_user',
          address,
          ts: Date.now()
        });
        setBannedUsers(prev => prev.filter(u => u.address !== address));
        toast({ title: 'User unbanned', description: truncateAddress(address) });
      }
    } catch (err) {
      console.error('Failed to unban user:', err);
      toast({ title: 'Failed to unban user', variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-card-mod p-4 rounded-xl">
        <h4 className="text-sm font-medium text-[#eaf6ff] mb-3">Ban User</h4>
        <div className="flex gap-2">
          <Input
            placeholder="0x..."
            value={banAddress}
            onChange={(e) => setBanAddress(e.target.value)}
            className="flex-1 bg-white/5 border-white/10 text-[#eaf6ff] placeholder:text-slate-500"
            data-testid="input-ban-address"
          />
          <Button
            onClick={handleBan}
            disabled={banning || !banAddress.trim()}
            className="bg-red-600/80 hover:bg-red-600 text-white"
            data-testid="button-ban-user"
          >
            {banning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Ban className="w-4 h-4 mr-1" />
                Ban
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-[#4fe1a8]" />
        </div>
      ) : bannedUsers.length === 0 ? (
        <div className="text-center py-12">
          <User className="w-12 h-12 mx-auto mb-3 text-slate-500" />
          <p className="text-slate-400">No banned users</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bannedUsers.map(user => (
            <div 
              key={user.address}
              className="glass-card-mod p-4 rounded-xl animate-fadeIn"
              data-testid={`banned-user-${user.address}`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-mono text-[#eaf6ff] truncate">
                    {user.address}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Banned {new Date(user.bannedAt).toLocaleDateString()}
                  </p>
                </div>
                <Button
                  size="sm"
                  className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
                  onClick={() => handleUnban(user.address)}
                  data-testid={`button-unban-${user.address}`}
                >
                  <UserMinus className="w-3 h-3 mr-1" />
                  Unban
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CategoriesTab() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryIcon, setNewCategoryIcon] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState('violet');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const { toast } = useToast();

  const colorOptions = [
    { value: 'violet', label: 'Violet', class: 'bg-violet-500' },
    { value: 'emerald', label: 'Green', class: 'bg-emerald-500' },
    { value: 'amber', label: 'Amber', class: 'bg-amber-500' },
    { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
    { value: 'pink', label: 'Pink', class: 'bg-pink-500' },
    { value: 'cyan', label: 'Cyan', class: 'bg-cyan-500' },
    { value: 'red', label: 'Red', class: 'bg-red-500' },
    { value: 'indigo', label: 'Indigo', class: 'bg-indigo-500' },
  ];

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    setLoading(true);
    try {
      const res = await modFetch('/api/mod/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Failed to fetch categories:', err);
      toast({ title: 'Failed to load categories', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleAddCategory() {
    if (!newCategoryName.trim()) {
      toast({ title: 'Category name required', variant: 'destructive' });
      return;
    }
    
    hapticFeedback('medium');
    setAdding(true);
    try {
      const res = await modFetch('/api/mod/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newCategoryName.trim(),
          icon: newCategoryIcon || '📦',
          color: newCategoryColor
        })
      });
      if (res.ok) {
        const data = await res.json();
        await P3.proofs.publish('mod_action', {
          action: 'create_category',
          categoryId: data.category?.id,
          name: newCategoryName.trim(),
          ts: Date.now()
        });
        setCategories(prev => [data.category, ...prev]);
        setNewCategoryName('');
        setNewCategoryIcon('');
        setNewCategoryColor('violet');
        toast({ title: 'Category created', description: newCategoryName.trim() });
      }
    } catch (err) {
      console.error('Failed to add category:', err);
      toast({ title: 'Failed to create category', variant: 'destructive' });
    } finally {
      setAdding(false);
    }
  }

  async function handleUpdateCategory(categoryId: string) {
    if (!editName.trim()) return;
    
    hapticFeedback('light');
    try {
      const res = await modFetch(`/api/mod/categories/${categoryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() })
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: 'update_category',
          categoryId,
          name: editName.trim(),
          ts: Date.now()
        });
        setCategories(prev => prev.map(c => 
          c.id === categoryId ? { ...c, name: editName.trim() } : c
        ));
        setEditingId(null);
        setEditName('');
        toast({ title: 'Category updated' });
      }
    } catch (err) {
      console.error('Failed to update category:', err);
      toast({ title: 'Failed to update category', variant: 'destructive' });
    }
  }

  async function handleDeleteCategory(categoryId: string, name: string) {
    hapticFeedback('heavy');
    try {
      const res = await modFetch(`/api/mod/categories/${categoryId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await P3.proofs.publish('mod_action', {
          action: 'delete_category',
          categoryId,
          name,
          ts: Date.now()
        });
        setCategories(prev => prev.filter(c => c.id !== categoryId));
        toast({ title: 'Category deleted', description: name });
      }
    } catch (err) {
      console.error('Failed to delete category:', err);
      toast({ title: 'Failed to delete category', variant: 'destructive' });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-[#4fe1a8]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="glass-card-mod p-4 rounded-xl animate-fadeIn">
        <h3 className="text-sm font-medium text-[#eaf6ff] mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#4fe1a8]" />
          Add Category
        </h3>
        <div className="space-y-3">
          <Input
            placeholder="Category name (e.g., DeFi, NFTs, Social)"
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            className="bg-white/5 border-white/10 text-[#eaf6ff] placeholder:text-slate-500"
            data-testid="input-category-name"
          />
          <div className="flex gap-2">
            <Input
              placeholder="Icon emoji"
              value={newCategoryIcon}
              onChange={e => setNewCategoryIcon(e.target.value)}
              className="w-24 bg-white/5 border-white/10 text-[#eaf6ff] placeholder:text-slate-500 text-center"
              data-testid="input-category-icon"
            />
            <Select value={newCategoryColor} onValueChange={setNewCategoryColor}>
              <SelectTrigger className="flex-1 bg-white/5 border-white/10 text-[#eaf6ff]" data-testid="select-category-color">
                <SelectValue placeholder="Color" />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map(color => (
                  <SelectItem key={color.value} value={color.value}>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${color.class}`} />
                      {color.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleAddCategory}
            disabled={adding || !newCategoryName.trim()}
            className="w-full bg-gradient-to-r from-[#4fe1a8] to-emerald-500 hover:from-[#4fe1a8]/90 hover:to-emerald-500/90 text-[#0d1b2a] font-medium"
            data-testid="button-add-category"
          >
            {adding ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Create Category
              </>
            )}
          </Button>
        </div>
      </div>

      {categories.length === 0 ? (
        <div className="text-center py-12">
          <LayoutGrid className="w-12 h-12 mx-auto mb-3 text-slate-500" />
          <p className="text-slate-400">No categories yet</p>
          <p className="text-sm text-slate-500 mt-1">Create the first category above</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-400 flex items-center gap-2">
            <Palette className="w-4 h-4" />
            Existing Categories ({categories.length})
          </h3>
          {categories.map(category => (
            <div 
              key={category.id}
              className="glass-card-mod p-4 rounded-xl animate-fadeIn"
              data-testid={`category-card-${category.id}`}
            >
              {editingId === category.id ? (
                <div className="flex gap-2">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="flex-1 bg-white/5 border-white/10 text-[#eaf6ff]"
                    autoFocus
                    data-testid={`input-edit-category-${category.id}`}
                  />
                  <Button
                    size="sm"
                    className="bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-400 border border-emerald-500/30"
                    onClick={() => handleUpdateCategory(category.id)}
                    data-testid={`button-save-category-${category.id}`}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-slate-400 hover:text-white"
                    onClick={() => { setEditingId(null); setEditName(''); }}
                    data-testid={`button-cancel-edit-${category.id}`}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg bg-${category.color}-500/20 flex items-center justify-center`}>
                      <span className="text-lg">{category.icon}</span>
                    </div>
                    <div>
                      <p className="text-[#eaf6ff] font-medium capitalize">{category.name}</p>
                      <p className="text-xs text-slate-500">{category.appCount || 0} apps</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
                      onClick={() => { setEditingId(category.id); setEditName(category.name); }}
                      data-testid={`button-edit-category-${category.id}`}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => handleDeleteCategory(category.id, category.name)}
                      data-testid={`button-delete-category-${category.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectPrompt({ onConnect, isConnecting }: { onConnect: () => void; isConnecting: boolean }) {
  return (
    <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center p-4">
      <div className="text-center max-w-sm animate-fadeIn">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-[#4fe1a8]/20 to-[#4fe1a8]/5 flex items-center justify-center border border-[#4fe1a8]/30">
          <Wallet className="w-10 h-10 text-[#4fe1a8]" />
        </div>
        <h1 className="text-2xl font-bold text-[#eaf6ff] mb-2">Connect Wallet</h1>
        <p className="text-slate-400 mb-6">
          Connect your wallet to access the Moderator Panel
        </p>
        <Button
          onClick={onConnect}
          disabled={isConnecting}
          className="bg-gradient-to-r from-[#4fe1a8] to-emerald-500 hover:from-[#4fe1a8]/90 hover:to-emerald-500/90 text-[#0d1b2a] font-semibold px-8 py-3 h-auto"
          data-testid="button-connect-wallet"
        >
          {isConnecting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Connecting...
            </>
          ) : (
            <>
              <Wallet className="w-5 h-5 mr-2" />
              Connect Wallet
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center p-4">
      <div className="text-center max-w-sm animate-fadeIn">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-500/5 flex items-center justify-center border border-red-500/30">
          <ShieldAlert className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-[#eaf6ff] mb-2">Access Denied</h1>
        <p className="text-slate-400 mb-6">
          You don't have moderator permissions to access this panel.
        </p>
        <Button
          onClick={() => window.location.href = '/launcher'}
          variant="outline"
          className="border-white/20 text-[#eaf6ff] hover:bg-white/10"
          data-testid="button-back-hub"
        >
          Back to Hub
        </Button>
      </div>
    </div>
  );
}

export default function ModeratorPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('reports');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isModerator, setIsModerator] = useState<boolean | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      const connected = await P3.session.connected();
      setIsConnected(connected);
      
      if (connected) {
        const address = await P3.session.address();
        setWalletAddress(address);
        
        const modStatus = await Roles.isModerator(address);
        setIsModerator(modStatus);
      } else {
        setIsModerator(false);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setIsConnected(false);
      setIsModerator(false);
    }
  }

  async function handleConnect() {
    setIsConnecting(true);
    try {
      if (typeof window !== 'undefined' && (window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        if (accounts.length > 0) {
          setIsConnected(true);
          setWalletAddress(accounts[0]);
          
          const modStatus = await Roles.isModerator(accounts[0]);
          setIsModerator(modStatus);
        }
      }
    } catch (err) {
      console.error('Connect failed:', err);
    } finally {
      setIsConnecting(false);
    }
  }

  if (isConnected === null) {
    return (
      <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#4fe1a8]" />
      </div>
    );
  }

  if (!isConnected) {
    return <ConnectPrompt onConnect={handleConnect} isConnecting={isConnecting} />;
  }

  if (isModerator === null) {
    return (
      <div className="min-h-screen bg-[#0d1b2a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#4fe1a8]" />
      </div>
    );
  }

  if (!isModerator) {
    return <AccessDenied />;
  }

  return (
    <div className="min-h-screen bg-[#0d1b2a] text-[#eaf6ff] pb-20">
      <style>{`
        .glass-card-mod {
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        
        .animate-fadeIn {
          animation: fadeIn 240ms ease-out forwards;
        }
        
        .animate-riseIn {
          animation: riseIn 220ms ease-out forwards;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes riseIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <header className="sticky top-0 z-40 glass-card-mod border-b border-white/10 border-x-0 border-t-0 rounded-none">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#4fe1a8] to-emerald-600 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-[#0d1b2a]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold">P3 Moderator Panel</h1>
              <p className="text-xs text-slate-400">Content moderation tools</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="text-slate-400 hover:text-white hover:bg-white/10 h-9 w-9"
              onClick={() => window.location.reload()}
              data-testid="button-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <div className="px-3 py-1.5 rounded-full bg-[#4fe1a8]/10 border border-[#4fe1a8]/20">
              <span className="text-xs text-[#4fe1a8] font-medium">
                {walletAddress ? truncateAddress(walletAddress) : '...'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="px-4 py-4">
        <div className="max-w-2xl mx-auto animate-riseIn">
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'reviews' && <ReviewsTab />}
          {activeTab === 'apps' && <AppsTab />}
          {activeTab === 'widgets' && <WidgetsTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'categories' && <CategoriesTab />}
        </div>
      </main>

      <nav 
        className="fixed bottom-0 left-0 right-0 z-50 glass-card-mod border-t border-white/10 border-x-0 border-b-0 rounded-none"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        data-testid="nav-bottom-tabs"
      >
        <div className="grid grid-cols-6 h-16">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${
                  isActive 
                    ? 'text-[#4fe1a8]' 
                    : 'text-slate-500 hover:text-slate-300'
                }`}
                style={{
                  transform: isActive ? 'translateY(-2px)' : 'translateY(0)'
                }}
                data-testid={`tab-${tab.id}`}
              >
                <span className="text-lg leading-none">{tab.emoji}</span>
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
