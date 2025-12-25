import { getRecentTraces, type FlowTrace } from './tracing';
import { getUnreadSummary } from '../proxy/slack';
import { getCurrentTrack } from '../proxy/spotify';
import { createPipeline } from './pipeline';

export interface PinnedApp {
  id: string;
  name: string;
  icon: string;
  gradient: string;
  category: string;
}

export interface RecentFlow {
  flowId: string;
  name: string;
  status: 'success' | 'failed' | 'partial';
  completedAt: number;
  stepCount: number;
}

export interface LiveStatus {
  slack?: {
    unread: number;
    channels: Array<{ id: string; name: string; unread: number }>;
  };
  spotify?: {
    playing: boolean;
    track?: string;
    artist?: string;
  };
}

export interface LauncherData {
  pinned: PinnedApp[];
  recent: RecentFlow[];
  status: LiveStatus;
}

const defaultPinnedApps: PinnedApp[] = [
  { id: 'messaging', name: 'Messages', icon: '💬', gradient: 'from-blue-500 to-indigo-600', category: 'communication' },
  { id: 'notes', name: 'Notes', icon: '📝', gradient: 'from-yellow-500 to-orange-500', category: 'productivity' },
  { id: 'payments', name: 'Payments', icon: '💳', gradient: 'from-green-500 to-emerald-600', category: 'finance' },
  { id: 'identity', name: 'Identity Vault', icon: '🔐', gradient: 'from-purple-500 to-violet-600', category: 'security' },
  { id: 'dao', name: 'Governance', icon: '🗳️', gradient: 'from-cyan-500 to-blue-600', category: 'governance' },
  { id: 'atlas', name: 'Atlas', icon: '🧠', gradient: 'from-pink-500 to-rose-600', category: 'ai' },
  { id: 'one', name: 'Atlas One', icon: '🛒', gradient: 'from-amber-500 to-orange-600', category: 'marketplace' },
];

const walletPinnedApps = new Map<string, PinnedApp[]>();

export function getPinnedApps(wallet: string): PinnedApp[] {
  const normalized = wallet.toLowerCase();
  return walletPinnedApps.get(normalized) || defaultPinnedApps;
}

export function setPinnedApps(wallet: string, apps: PinnedApp[]): void {
  walletPinnedApps.set(wallet.toLowerCase(), apps);
}

export function addPinnedApp(wallet: string, app: PinnedApp): void {
  const current = getPinnedApps(wallet);
  if (!current.find(a => a.id === app.id)) {
    walletPinnedApps.set(wallet.toLowerCase(), [...current, app]);
  }
}

export function removePinnedApp(wallet: string, appId: string): void {
  const current = getPinnedApps(wallet);
  walletPinnedApps.set(wallet.toLowerCase(), current.filter(a => a.id !== appId));
}

export function getRecentFlows(wallet: string, limit: number = 10): RecentFlow[] {
  const traces = getRecentTraces(limit * 2);
  const normalized = wallet.toLowerCase();
  
  return traces
    .filter(t => t.wallet === normalized)
    .slice(0, limit)
    .map(traceToRecentFlow);
}

function traceToRecentFlow(trace: FlowTrace): RecentFlow {
  const failedSteps = trace.steps.filter(s => s.status === 'failed').length;
  const successSteps = trace.steps.filter(s => s.status === 'success').length;
  
  let status: 'success' | 'failed' | 'partial' = 'success';
  if (failedSteps > 0 && successSteps === 0) {
    status = 'failed';
  } else if (failedSteps > 0) {
    status = 'partial';
  }

  const stepNames = trace.steps.map(s => s.name);
  const name = stepNames.length > 0 
    ? stepNames.slice(0, 2).join(' → ') + (stepNames.length > 2 ? ' ...' : '')
    : 'Flow';

  const lastStep = trace.steps[trace.steps.length - 1];
  const completedAt = lastStep?.completedAt || trace.startedAt;

  return {
    flowId: trace.flowId,
    name,
    status,
    completedAt,
    stepCount: trace.steps.length,
  };
}

export async function getLiveStatus(wallet: string): Promise<LiveStatus> {
  const status: LiveStatus = {};

  try {
    const slackSummary = await getUnreadSummary(wallet, { correlationId: `launcher-${Date.now()}` });
    status.slack = {
      unread: slackSummary.totalUnread,
      channels: slackSummary.channels,
    };
  } catch {
    status.slack = { unread: 0, channels: [] };
  }

  try {
    const spotify = await getCurrentTrack(wallet);
    status.spotify = {
      playing: spotify.isPlaying,
      track: spotify.track,
      artist: spotify.artist,
    };
  } catch {
    status.spotify = { playing: false };
  }

  return status;
}

export async function showLauncher(wallet: string, onUpdate?: (snapshot: unknown) => void): Promise<{
  flowId: string;
  correlationId: string;
  data: LauncherData;
  errors?: string[];
}> {
  const pipe = createPipeline();

  if (onUpdate) {
    pipe.subscribe(onUpdate);
  }

  pipe
    .add('get_pinned_apps', async (ctx) => {
      const pinned = getPinnedApps(wallet);
      return { ...ctx, data: { ...ctx.data, pinned } };
    })
    .add('get_recent_flows', async (ctx) => {
      const recent = getRecentFlows(wallet);
      return { ...ctx, data: { ...ctx.data, recent } };
    })
    .add('get_live_status', async (ctx) => {
      const status = await getLiveStatus(wallet);
      return { ...ctx, data: { ...ctx.data, status } };
    }, { critical: false });

  const result = await pipe.runParallel({ wallet, data: {} });

  return {
    flowId: pipe.getFlowId()!,
    correlationId: pipe.getCorrelationId()!,
    data: {
      pinned: (result.data.pinned as PinnedApp[]) || defaultPinnedApps,
      recent: (result.data.recent as RecentFlow[]) || [],
      status: (result.data.status as LiveStatus) || {},
    },
    errors: result.errors,
  };
}
