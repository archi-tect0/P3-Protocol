import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Bell, 
  Plus, 
  Trash2, 
  Mail, 
  Webhook, 
  MessageSquare,
  Power,
  CheckCircle2,
  RefreshCw,
  Edit2,
  X,
  Zap,
  Clock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import AdminLayout from "./AdminLayout";

interface AlertChannel {
  id: string;
  name: string;
  type: 'email' | 'webhook' | 'slack';
  endpoint: string;
  enabled: boolean;
  createdAt: string;
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  threshold: number;
  channelIds: string[];
  enabled: boolean;
  lastTriggered: string | null;
  createdAt: string;
}

interface AlertsResponse {
  channels: AlertChannel[];
  rules: AlertRule[];
}

const staticChannels: AlertChannel[] = [
  { id: 'ch-1', name: 'DevOps Email', type: 'email', endpoint: 'devops@company.com', enabled: true, createdAt: '2024-10-15T10:00:00Z' },
  { id: 'ch-2', name: 'Slack Alerts', type: 'slack', endpoint: 'https://hooks.slack.com/...', enabled: true, createdAt: '2024-10-20T14:30:00Z' },
  { id: 'ch-3', name: 'PagerDuty Webhook', type: 'webhook', endpoint: 'https://events.pagerduty.com/...', enabled: false, createdAt: '2024-11-01T09:15:00Z' },
];

const staticRules: AlertRule[] = [
  { id: 'rule-1', name: 'High Error Rate', description: 'Alert when error rate exceeds 5%', condition: 'error_rate > threshold', threshold: 5, channelIds: ['ch-1', 'ch-2'], enabled: true, lastTriggered: '2024-11-25T08:30:00Z', createdAt: '2024-10-15T10:00:00Z' },
  { id: 'rule-2', name: 'Slow Response Time', description: 'Alert when p95 latency exceeds 2s', condition: 'p95_latency > threshold', threshold: 2000, channelIds: ['ch-2'], enabled: true, lastTriggered: null, createdAt: '2024-10-20T14:30:00Z' },
  { id: 'rule-3', name: 'Uptime Drop', description: 'Alert when uptime drops below 99.5%', condition: 'uptime < threshold', threshold: 99.5, channelIds: ['ch-1', 'ch-2', 'ch-3'], enabled: false, lastTriggered: '2024-11-20T16:45:00Z', createdAt: '2024-11-01T09:15:00Z' },
];

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="glass-card-admin rounded-xl p-6 h-64 bg-white/5" />
      <div className="glass-card-admin rounded-xl p-6 h-64 bg-white/5" />
    </div>
  );
}

function ChannelIcon({ type }: { type: AlertChannel['type'] }) {
  const icons = {
    email: <Mail className="w-4 h-4" />,
    webhook: <Webhook className="w-4 h-4" />,
    slack: <MessageSquare className="w-4 h-4" />,
  };
  return icons[type] || <Bell className="w-4 h-4" />;
}

function CreateChannelModal({ 
  isOpen, 
  onClose, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AlertChannel['type']>('email');
  const [endpoint, setEndpoint] = useState('');
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; type: string; endpoint: string }) => {
      const walletAddress = localStorage.getItem('walletAddress') || '';
      return await apiRequest('/api/enterprise/alerts/channels', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-P3-Addr': walletAddress,
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/alerts'] });
      onSuccess();
      setName('');
      setType('email');
      setEndpoint('');
      toast({
        title: 'Channel Created',
        description: 'Alert channel has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !endpoint.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name and endpoint are required',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({ name: name.trim(), type, endpoint: endpoint.trim() });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="glass-card-admin rounded-xl w-full max-w-md p-6"
        data-testid="modal-create-channel"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#4fe1a8]/20">
              <Bell className="w-5 h-5 text-[#4fe1a8]" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#eaf6ff]">Create Alert Channel</h3>
              <p className="text-xs text-slate-400">Configure a new notification destination</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-[#eaf6ff] transition-colors"
            data-testid="button-close-channel-modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="channel-name" className="text-sm text-slate-300">
              Channel Name *
            </Label>
            <Input
              id="channel-name"
              data-testid="input-channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., DevOps Team Email"
              className="mt-1.5 bg-white/5 border-white/10 text-[#eaf6ff] placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label htmlFor="channel-type" className="text-sm text-slate-300">
              Channel Type *
            </Label>
            <Select value={type} onValueChange={(v) => setType(v as AlertChannel['type'])}>
              <SelectTrigger 
                className="mt-1.5 bg-white/5 border-white/10 text-[#eaf6ff]"
                data-testid="select-channel-type"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2d42] border-white/10">
                <SelectItem value="email" data-testid="option-email">
                  <span className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Email
                  </span>
                </SelectItem>
                <SelectItem value="webhook" data-testid="option-webhook">
                  <span className="flex items-center gap-2">
                    <Webhook className="w-4 h-4" />
                    Webhook
                  </span>
                </SelectItem>
                <SelectItem value="slack" data-testid="option-slack">
                  <span className="flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Slack
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="channel-endpoint" className="text-sm text-slate-300">
              Endpoint *
            </Label>
            <Input
              id="channel-endpoint"
              data-testid="input-channel-endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder={type === 'email' ? 'alerts@company.com' : 'https://...'}
              className="mt-1.5 bg-white/5 border-white/10 text-[#eaf6ff] placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500 mt-1">
              {type === 'email' ? 'Email address for notifications' : 'Webhook URL for POST requests'}
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
              data-testid="button-cancel-channel"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-[#4fe1a8] text-[#0d1b2a] hover:bg-[#4fe1a8]/90"
              data-testid="button-create-channel"
            >
              {createMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                'Create Channel'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateRuleModal({ 
  isOpen, 
  onClose, 
  onSuccess,
  channels,
  editRule
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onSuccess: () => void;
  channels: AlertChannel[];
  editRule?: AlertRule | null;
}) {
  const [name, setName] = useState(editRule?.name || '');
  const [description, setDescription] = useState(editRule?.description || '');
  const [condition, setCondition] = useState(editRule?.condition || 'error_rate > threshold');
  const [threshold, setThreshold] = useState(editRule?.threshold?.toString() || '5');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(editRule?.channelIds || []);
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const walletAddress = localStorage.getItem('walletAddress') || '';
      const endpoint = editRule 
        ? `/api/enterprise/alerts/rules/${editRule.id}`
        : '/api/enterprise/alerts/rules';
      return await apiRequest(endpoint, {
        method: editRule ? 'PATCH' : 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-P3-Addr': walletAddress,
        },
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/alerts'] });
      onSuccess();
      toast({
        title: editRule ? 'Rule Updated' : 'Rule Created',
        description: `Alert rule has been ${editRule ? 'updated' : 'created'} successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Rule name is required',
        variant: 'destructive',
      });
      return;
    }
    createMutation.mutate({ 
      name: name.trim(), 
      description: description.trim(),
      condition,
      threshold: parseFloat(threshold),
      channelIds: selectedChannels,
    });
  };

  const toggleChannel = (channelId: string) => {
    setSelectedChannels(prev => 
      prev.includes(channelId) 
        ? prev.filter(id => id !== channelId)
        : [...prev, channelId]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div 
        className="glass-card-admin rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        data-testid="modal-create-rule"
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Zap className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#eaf6ff]">
                {editRule ? 'Edit Alert Rule' : 'Create Alert Rule'}
              </h3>
              <p className="text-xs text-slate-400">Define conditions for triggering alerts</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-[#eaf6ff] transition-colors"
            data-testid="button-close-rule-modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="rule-name" className="text-sm text-slate-300">
              Rule Name *
            </Label>
            <Input
              id="rule-name"
              data-testid="input-rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., High Error Rate Alert"
              className="mt-1.5 bg-white/5 border-white/10 text-[#eaf6ff] placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label htmlFor="rule-description" className="text-sm text-slate-300">
              Description
            </Label>
            <Input
              id="rule-description"
              data-testid="input-rule-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe when this alert triggers..."
              className="mt-1.5 bg-white/5 border-white/10 text-[#eaf6ff] placeholder:text-slate-500"
            />
          </div>

          <div>
            <Label htmlFor="rule-condition" className="text-sm text-slate-300">
              Condition
            </Label>
            <Select value={condition} onValueChange={setCondition}>
              <SelectTrigger 
                className="mt-1.5 bg-white/5 border-white/10 text-[#eaf6ff]"
                data-testid="select-rule-condition"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1a2d42] border-white/10">
                <SelectItem value="error_rate > threshold">Error rate exceeds threshold (%)</SelectItem>
                <SelectItem value="p95_latency > threshold">P95 latency exceeds threshold (ms)</SelectItem>
                <SelectItem value="uptime < threshold">Uptime drops below threshold (%)</SelectItem>
                <SelectItem value="request_count > threshold">Request count exceeds threshold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="rule-threshold" className="text-sm text-slate-300">
              Threshold Value
            </Label>
            <Input
              id="rule-threshold"
              data-testid="input-rule-threshold"
              type="number"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="mt-1.5 bg-white/5 border-white/10 text-[#eaf6ff]"
            />
          </div>

          <div>
            <Label className="text-sm text-slate-300 mb-2 block">
              Notification Channels
            </Label>
            <div className="space-y-2 p-3 rounded-lg bg-white/[0.02] border border-white/5">
              {channels.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">No channels configured</p>
              ) : (
                channels.map(channel => (
                  <label 
                    key={channel.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded bg-white/5">
                        <ChannelIcon type={channel.type} />
                      </div>
                      <span className="text-sm text-[#eaf6ff]">{channel.name}</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={selectedChannels.includes(channel.id)}
                      onChange={() => toggleChannel(channel.id)}
                      className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#4fe1a8] focus:ring-[#4fe1a8]"
                      data-testid={`checkbox-channel-${channel.id}`}
                    />
                  </label>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1 border-white/10 text-slate-300 hover:bg-white/5"
              data-testid="button-cancel-rule"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending}
              className="flex-1 bg-[#4fe1a8] text-[#0d1b2a] hover:bg-[#4fe1a8]/90"
              data-testid="button-save-rule"
            >
              {createMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                editRule ? 'Save Changes' : 'Create Rule'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<AlertsResponse>({
    queryKey: ['/api/enterprise/alerts'],
    retry: false,
  });

  const channels = data?.channels || staticChannels;
  const rules = data?.rules || staticRules;

  const toggleChannelMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const walletAddress = localStorage.getItem('walletAddress') || '';
      return await apiRequest(`/api/enterprise/alerts/channels/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-P3-Addr': walletAddress,
        },
        body: JSON.stringify({ enabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/alerts'] });
      toast({ title: 'Channel Updated', description: 'Channel status has been toggled.' });
    },
    onError: () => {
      toast({ title: 'Demo Mode', description: 'Toggle simulated in demo mode.', variant: 'default' });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const walletAddress = localStorage.getItem('walletAddress') || '';
      return await apiRequest(`/api/enterprise/alerts/rules/${id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'X-P3-Addr': walletAddress,
        },
        body: JSON.stringify({ enabled }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/alerts'] });
      toast({ title: 'Rule Updated', description: 'Rule status has been toggled.' });
    },
    onError: () => {
      toast({ title: 'Demo Mode', description: 'Toggle simulated in demo mode.', variant: 'default' });
    },
  });

  const deleteChannelMutation = useMutation({
    mutationFn: async (id: string) => {
      const walletAddress = localStorage.getItem('walletAddress') || '';
      return await apiRequest(`/api/enterprise/alerts/channels/${id}`, {
        method: 'DELETE',
        headers: { 'X-P3-Addr': walletAddress },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/enterprise/alerts'] });
      toast({ title: 'Channel Deleted', description: 'Alert channel has been removed.' });
    },
    onError: () => {
      toast({ title: 'Demo Mode', description: 'Deletion simulated in demo mode.', variant: 'default' });
    },
  });

  const handleEditRule = (rule: AlertRule) => {
    setEditingRule(rule);
    setShowRuleModal(true);
  };

  const handleCloseRuleModal = () => {
    setShowRuleModal(false);
    setEditingRule(null);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#eaf6ff]" data-testid="alerts-title">
            Alert Configuration
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage notification channels and alert rules
          </p>
        </div>

        {isLoading ? (
          <LoadingSkeleton />
        ) : (
          <>
            <div className="glass-card-admin rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-[#4fe1a8]/20">
                    <Bell className="w-5 h-5 text-[#4fe1a8]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#eaf6ff]">Alert Channels</h3>
                    <p className="text-xs text-slate-400">Configure where notifications are sent</p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowChannelModal(true)}
                  className="bg-[#4fe1a8] text-[#0d1b2a] hover:bg-[#4fe1a8]/90"
                  size="sm"
                  data-testid="button-add-channel"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Channel
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full" data-testid="table-channels">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Channel</th>
                      <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Type</th>
                      <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Endpoint</th>
                      <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Status</th>
                      <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wider py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {channels.map((channel) => (
                      <tr 
                        key={channel.id}
                        className="hover:bg-white/[0.02] transition-colors"
                        data-testid={`row-channel-${channel.id}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-white/5">
                              <ChannelIcon type={channel.type} />
                            </div>
                            <span className="text-sm font-medium text-[#eaf6ff]">{channel.name}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 capitalize">
                            {channel.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <code className="text-xs text-slate-400 bg-white/5 px-2 py-1 rounded">
                            {channel.endpoint.length > 30 
                              ? `${channel.endpoint.slice(0, 30)}...` 
                              : channel.endpoint}
                          </code>
                        </td>
                        <td className="py-3 px-4">
                          <Switch
                            checked={channel.enabled}
                            onCheckedChange={(checked) => toggleChannelMutation.mutate({ id: channel.id, enabled: checked })}
                            data-testid={`switch-channel-${channel.id}`}
                          />
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteChannelMutation.mutate(channel.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            data-testid={`button-delete-channel-${channel.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {channels.length === 0 && (
                  <div className="text-center py-12">
                    <Bell className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No alert channels configured</p>
                    <p className="text-xs text-slate-500 mt-1">Add a channel to start receiving notifications</p>
                  </div>
                )}
              </div>
            </div>

            <div className="glass-card-admin rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/20">
                    <Zap className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#eaf6ff]">Alert Rules</h3>
                    <p className="text-xs text-slate-400">Define conditions that trigger alerts</p>
                  </div>
                </div>
                <Button
                  onClick={() => setShowRuleModal(true)}
                  className="bg-cyan-500 text-[#0d1b2a] hover:bg-cyan-400"
                  size="sm"
                  data-testid="button-add-rule"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Rule
                </Button>
              </div>

              <div className="space-y-3">
                {rules.map((rule) => (
                  <div 
                    key={rule.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors border border-white/5"
                    data-testid={`row-rule-${rule.id}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${rule.enabled ? 'bg-green-500/20' : 'bg-slate-500/20'}`}>
                        {rule.enabled ? (
                          <CheckCircle2 className="w-5 h-5 text-green-400" />
                        ) : (
                          <Power className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-[#eaf6ff]">{rule.name}</h4>
                        <p className="text-xs text-slate-400 mt-0.5">{rule.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className="bg-white/5 text-slate-400 border-white/10 text-xs">
                            {rule.condition.replace('threshold', rule.threshold.toString())}
                          </Badge>
                          {rule.lastTriggered && (
                            <span className="flex items-center gap-1 text-xs text-slate-500">
                              <Clock className="w-3 h-3" />
                              Last: {new Date(rule.lastTriggered).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-1">
                        {rule.channelIds.slice(0, 3).map((channelId, idx) => {
                          const channel = channels.find(c => c.id === channelId);
                          return channel ? (
                            <div 
                              key={channelId}
                              className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-slate-400"
                              style={{ zIndex: 3 - idx }}
                              title={channel.name}
                            >
                              <ChannelIcon type={channel.type} />
                            </div>
                          ) : null;
                        })}
                        {rule.channelIds.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-slate-400">
                            +{rule.channelIds.length - 3}
                          </div>
                        )}
                      </div>
                      <Switch
                        checked={rule.enabled}
                        onCheckedChange={(checked) => toggleRuleMutation.mutate({ id: rule.id, enabled: checked })}
                        data-testid={`switch-rule-${rule.id}`}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditRule(rule)}
                        className="text-slate-400 hover:text-[#eaf6ff] hover:bg-white/5"
                        data-testid={`button-edit-rule-${rule.id}`}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}

                {rules.length === 0 && (
                  <div className="text-center py-12">
                    <Zap className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400">No alert rules configured</p>
                    <p className="text-xs text-slate-500 mt-1">Create a rule to start monitoring</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <CreateChannelModal 
        isOpen={showChannelModal} 
        onClose={() => setShowChannelModal(false)} 
        onSuccess={() => setShowChannelModal(false)}
      />

      <CreateRuleModal 
        isOpen={showRuleModal} 
        onClose={handleCloseRuleModal} 
        onSuccess={handleCloseRuleModal}
        channels={channels}
        editRule={editingRule}
      />

      <style>{`
        .glass-card-admin {
          background: rgba(255, 255, 255, 0.04);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
      `}</style>
    </AdminLayout>
  );
}
