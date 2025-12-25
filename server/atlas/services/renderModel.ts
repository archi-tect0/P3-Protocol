import * as crypto from 'crypto';

export type RenderMode = 'idle' | 'feed' | 'metrics' | 'governance' | 'notes' | 'gallery' | 'messages' | 'payments';

export interface RenderArgs {
  mode: RenderMode;
  source?: string;
  metric?: string;
  wallet?: string;
}

export interface RenderResult {
  mode: RenderMode;
  payload: any;
  manifest?: {
    id: string;
    title: string;
    visual?: string;
  };
  receipt?: {
    id: string;
    hash: string;
    scope: string;
    timestamp: number;
  };
}

export async function renderController(args: RenderArgs): Promise<RenderResult> {
  const { mode, source, metric, wallet } = args;
  
  let payload: any;
  let manifest: any;
  
  switch (mode) {
    case 'feed':
      payload = await fetchFeedData(source || 'trending');
      manifest = { id: 'feed', title: 'Content Feed', visual: 'grid.video' };
      break;
      
    case 'metrics':
      payload = await fetchMetricsData(metric || 'users');
      manifest = { id: 'metrics', title: 'Adoption Metrics', visual: 'chart.area' };
      break;
      
    case 'governance':
      payload = await fetchGovernanceData();
      manifest = { id: 'governance', title: 'DAO Governance', visual: 'list.proposals' };
      break;
      
    case 'notes':
      payload = await fetchNotesData(wallet);
      manifest = { id: 'notes', title: 'Encrypted Notes', visual: 'grid.cards' };
      break;
      
    case 'gallery':
      payload = await fetchGalleryData(wallet);
      manifest = { id: 'gallery', title: 'Encrypted Gallery', visual: 'grid.media' };
      break;
      
    case 'messages':
      payload = await fetchMessagesData(wallet);
      manifest = { id: 'messages', title: 'E2EE Messages', visual: 'list.messages' };
      break;
      
    case 'payments':
      payload = await fetchPaymentsData(wallet);
      manifest = { id: 'payments', title: 'Payment History', visual: 'list.transactions' };
      break;
      
    default:
      payload = {};
      manifest = { id: 'idle', title: 'Atlas Idle' };
  }
  
  const receipt = {
    id: crypto.randomUUID(),
    hash: '0x' + crypto.createHash('sha256')
      .update(JSON.stringify({ mode, payload: JSON.stringify(payload).slice(0, 100) }))
      .digest('hex'),
    scope: `atlas.render.${mode}`,
    timestamp: Date.now()
  };
  
  return { mode, payload, manifest, receipt };
}

async function fetchFeedData(source: string) {
  return {
    items: [
      { id: 'v1', title: `${source} Trending #1`, views: 12400, likes: 890 },
      { id: 'v2', title: `${source} Trending #2`, views: 8900, likes: 654 },
      { id: 'v3', title: `${source} Trending #3`, views: 45600, likes: 3200 },
      { id: 'v4', title: `${source} Trending #4`, views: 23100, likes: 1890 },
    ],
    source
  };
}

async function fetchMetricsData(metric: string) {
  const now = Date.now();
  const series = Array.from({ length: 24 }).map((_, i) => ({
    t: new Date(now - (23 - i) * 3600_000).toISOString(),
    value: Math.round(100 + Math.random() * 400 + i * 15),
  }));
  
  return {
    metric,
    series,
    summary: {
      current: series[series.length - 1].value,
      change: '+12.5%',
      trend: 'up'
    }
  };
}

async function fetchGovernanceData() {
  return {
    proposals: [
      { id: 'p1', title: 'Upgrade Anchor Registry to v2', aye: 1247, nay: 89, status: 'active', endsAt: '2 days' },
      { id: 'p2', title: 'Add Polygon Support', aye: 892, nay: 234, status: 'active', endsAt: '5 days' },
      { id: 'p3', title: 'Treasury Allocation Q1', aye: 2341, nay: 156, status: 'passed' },
    ],
    stats: {
      totalProposals: 47,
      activeProposals: 2,
      participation: '68%'
    }
  };
}

async function fetchNotesData(wallet?: string) {
  return {
    notes: [
      { id: 'n1', title: 'Mesh Architecture Notes', encrypted: true, updatedAt: '2 hours ago' },
      { id: 'n2', title: 'Atlas Development Roadmap', encrypted: false, updatedAt: '5 hours ago' },
      { id: 'n3', title: 'Meeting Notes - DAO Call', encrypted: true, updatedAt: '1 day ago' },
    ],
    count: 3
  };
}

async function fetchGalleryData(wallet?: string) {
  return {
    items: [
      { id: 'g1', name: 'Architecture Diagram', encrypted: true, size: '2.4 MB' },
      { id: 'g2', name: 'Screenshot 2024-01', encrypted: false, size: '1.1 MB' },
      { id: 'g3', name: 'Meeting Recording', encrypted: true, size: '45.2 MB' },
    ],
    count: 3
  };
}

async function fetchMessagesData(wallet?: string) {
  return {
    messages: [
      { id: 'm1', from: '0x7B2f...3aE9', preview: 'Hey, did you see the new governance proposal?', read: false, timestamp: '2 min ago' },
      { id: 'm2', from: '0x1F4c...8bD2', preview: 'The anchor batch is ready for review', read: false, timestamp: '15 min ago' },
      { id: 'm3', from: '0x9E3a...5cF7', preview: 'Meeting confirmed for tomorrow at 3pm UTC', read: true, timestamp: '1 hour ago' },
    ],
    unread: 2
  };
}

async function fetchPaymentsData(wallet?: string) {
  return {
    payments: [
      { id: 'p1', type: 'received', amount: '250.00', token: 'USDC', counterparty: '0x7B2f...3aE9', timestamp: '1 hour ago' },
      { id: 'p2', type: 'sent', amount: '0.05', token: 'ETH', counterparty: '0x1F4c...8bD2', timestamp: '3 hours ago' },
      { id: 'p3', type: 'received', amount: '1,500.00', token: 'USDC', counterparty: '0x9E3a...5cF7', timestamp: '1 day ago' },
    ],
    balance: {
      usdc: '1,750.00',
      eth: '0.45'
    }
  };
}
