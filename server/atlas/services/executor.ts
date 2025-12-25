import type { Session, FlowStep } from '../types';
import type { Note } from '@shared/schema';
import { getEndpoint } from './registryAdapter';
import { playUris, pause as pauseSpotify, getCurrentTrack, search as spotifySearch } from '../../proxy/spotify';
import { getUnreadSummary, sendMessage as sendSlackMessage } from '../../proxy/slack';
import { showLauncher } from '../../flows/launcher';
import { getStorageInstance } from '../../storage-accessor';
import { flowEventBus } from '../../flows/eventBus';
import crypto from 'crypto';

function getStorage() {
  return getStorageInstance();
}

export class ExecutionError extends Error {
  constructor(
    public endpointKey: string,
    public originalError: Error,
    message?: string
  ) {
    super(message || `Execution failed for ${endpointKey}: ${originalError.message}`);
    this.name = 'ExecutionError';
  }
}

export class ValidationError extends Error {
  constructor(
    public endpointKey: string,
    public invalidArgs: string[],
    message?: string
  ) {
    super(message || `Invalid arguments for ${endpointKey}: ${invalidArgs.join(', ')}`);
    this.name = 'ValidationError';
  }
}

type EndpointHandler = (args: Record<string, any>, session: Session) => Promise<any> | any;

const liveHandlers: Record<string, EndpointHandler> = {
  'launcher.show': async (args, session) => {
    const result = await showLauncher(session.wallet);
    
    return {
      type: 'launcher',
      ...result.data,
      flowId: result.flowId,
      correlationId: result.correlationId,
    };
  },

  'devkit.query': async (args) => {
    const { processDevKitQuery } = await import('./devkitRegistry');
    const result = processDevKitQuery(args.query || '');
    return {
      type: 'devkit',
      ...result,
      ts: Date.now(),
    };
  },

  'devkit.endpoints': async () => {
    const { listAllEndpoints, getQuickStats } = await import('./devkitRegistry');
    const endpoints = listAllEndpoints();
    const stats = getQuickStats();
    return {
      type: 'devkit',
      endpoints,
      stats,
      count: endpoints.length,
      ts: Date.now(),
    };
  },

  'devkit.help': async () => {
    const { getDevKitHelp, getQuickStats } = await import('./devkitRegistry');
    return {
      type: 'devkit',
      help: getDevKitHelp(),
      stats: getQuickStats(),
      ts: Date.now(),
    };
  },

  'devkit.flows': async () => {
    const { listAllFlows, getQuickStats } = await import('./devkitRegistry');
    const flows = listAllFlows();
    const stats = getQuickStats();
    return {
      type: 'devkit',
      flows,
      stats,
      count: flows.length,
      ts: Date.now(),
    };
  },

  'devkit.apps': async () => {
    const { listAllApps, getQuickStats } = await import('./devkitRegistry');
    const apps = listAllApps();
    const stats = getQuickStats();
    return {
      type: 'devkit',
      apps,
      stats,
      count: apps.length,
      ts: Date.now(),
    };
  },

  'devkit.describe': async (args) => {
    const { describeEndpoint } = await import('./devkitRegistry');
    const endpoint = describeEndpoint(args.endpoint || '');
    return {
      type: 'devkit',
      endpoint,
      found: !!endpoint,
      ts: Date.now(),
    };
  },

  // Admin Analytics - wallet-gated to ADMIN_WALLET
  // This pattern demonstrates how developers can add private endpoints for their own apps
  'analytics.overview': async (args, session) => {
    const flowId = `analytics-overview-${Date.now()}`;
    const adminWallet = (process.env.ADMIN_WALLET || '').toLowerCase();
    
    flowEventBus.emit(flowId, { type: 'flow-start', flowId, feature: 'analytics.overview', timestamp: Date.now() });
    
    if (!adminWallet || session.wallet.toLowerCase() !== adminWallet) {
      flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'failed', reason: 'unauthorized', timestamp: Date.now() });
      return {
        type: 'analytics',
        error: 'unauthorized',
        message: 'Analytics access is restricted to platform administrators.',
        ts: Date.now(),
      };
    }
    const storage = getStorage();
    const range = args.range || '24h';
    const analytics = await storage.getPageAnalytics(range as '24h' | '7d' | '30d');
    
    flowEventBus.emit(flowId, { type: 'step-complete', flowId, stepName: 'fetch-analytics', data: { range, totalViews: analytics.totalViews }, timestamp: Date.now() });
    flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'success', timestamp: Date.now() });
    
    return {
      type: 'analytics',
      action: 'overview',
      range,
      flowId,
      data: analytics,
      message: `In the last ${range}, you had ${analytics.totalViews} page views from ${analytics.uniqueVisitors} unique visitors.`,
      ts: Date.now(),
    };
  },

  'analytics.traffic': async (args, session) => {
    const flowId = `analytics-traffic-${Date.now()}`;
    const adminWallet = (process.env.ADMIN_WALLET || '').toLowerCase();
    
    flowEventBus.emit(flowId, { type: 'flow-start', flowId, feature: 'analytics.traffic', timestamp: Date.now() });
    
    if (!adminWallet || session.wallet.toLowerCase() !== adminWallet) {
      flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'failed', reason: 'unauthorized', timestamp: Date.now() });
      return {
        type: 'analytics',
        error: 'unauthorized',
        message: 'Analytics access is restricted to platform administrators.',
        ts: Date.now(),
      };
    }
    const storage = getStorage();
    const range = args.range || '24h';
    const analytics = await storage.getPageAnalytics(range as '24h' | '7d' | '30d');
    
    flowEventBus.emit(flowId, { type: 'step-complete', flowId, stepName: 'fetch-traffic', data: { range, views: analytics.totalViews }, timestamp: Date.now() });
    flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'success', timestamp: Date.now() });
    
    return {
      type: 'analytics',
      action: 'traffic',
      range,
      flowId,
      data: {
        totalViews: analytics.totalViews,
        uniqueVisitors: analytics.uniqueVisitors,
      },
      message: `You had ${analytics.totalViews} page views and ${analytics.uniqueVisitors} unique visitors in the last ${range}.`,
      ts: Date.now(),
    };
  },

  'analytics.referrers': async (args, session) => {
    const flowId = `analytics-referrers-${Date.now()}`;
    const adminWallet = (process.env.ADMIN_WALLET || '').toLowerCase();
    
    flowEventBus.emit(flowId, { type: 'flow-start', flowId, feature: 'analytics.referrers', timestamp: Date.now() });
    
    if (!adminWallet || session.wallet.toLowerCase() !== adminWallet) {
      flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'failed', reason: 'unauthorized', timestamp: Date.now() });
      return {
        type: 'analytics',
        error: 'unauthorized',
        message: 'Analytics access is restricted to platform administrators.',
        ts: Date.now(),
      };
    }
    const storage = getStorage();
    const range = args.range || '24h';
    const analytics = await storage.getPageAnalytics(range as '24h' | '7d' | '30d');
    const referrerFilter = args.referrerFilter?.toLowerCase();
    
    flowEventBus.emit(flowId, { type: 'step-complete', flowId, stepName: 'fetch-referrers', data: { range, count: analytics.topReferrers.length }, timestamp: Date.now() });
    
    if (referrerFilter) {
      const filtered = analytics.topReferrers.filter(r => 
        r.referrer.toLowerCase().includes(referrerFilter)
      );
      const totalFromSource = filtered.reduce((sum, r) => sum + r.views, 0);
      flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'success', timestamp: Date.now() });
      return {
        type: 'analytics',
        action: 'referrers',
        range,
        flowId,
        filter: referrerFilter,
        data: { referrers: filtered, totalFromSource },
        message: totalFromSource > 0 
          ? `You had ${totalFromSource} visitors from ${referrerFilter} in the last ${range}.`
          : `No visitors from ${referrerFilter} in the last ${range}.`,
        ts: Date.now(),
      };
    }
    
    const topRefs = analytics.topReferrers.slice(0, 5);
    const refList = topRefs.map(r => `${r.referrer} (${r.views})`).join(', ');
    flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'success', timestamp: Date.now() });
    return {
      type: 'analytics',
      action: 'referrers',
      range,
      flowId,
      data: { referrers: analytics.topReferrers },
      message: topRefs.length > 0 
        ? `Top referrers in the last ${range}: ${refList}`
        : 'No referrer data yet.',
      ts: Date.now(),
    };
  },

  'analytics.pages': async (args, session) => {
    const flowId = `analytics-pages-${Date.now()}`;
    const adminWallet = (process.env.ADMIN_WALLET || '').toLowerCase();
    
    flowEventBus.emit(flowId, { type: 'flow-start', flowId, feature: 'analytics.pages', timestamp: Date.now() });
    
    if (!adminWallet || session.wallet.toLowerCase() !== adminWallet) {
      flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'failed', reason: 'unauthorized', timestamp: Date.now() });
      return {
        type: 'analytics',
        error: 'unauthorized',
        message: 'Analytics access is restricted to platform administrators.',
        ts: Date.now(),
      };
    }
    const storage = getStorage();
    const range = args.range || '24h';
    const analytics = await storage.getPageAnalytics(range as '24h' | '7d' | '30d');
    const topPages = analytics.topPages.slice(0, 5);
    const pageList = topPages.map(p => `${p.route} (${p.views})`).join(', ');
    
    flowEventBus.emit(flowId, { type: 'step-complete', flowId, stepName: 'fetch-pages', data: { range, count: topPages.length }, timestamp: Date.now() });
    flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'success', timestamp: Date.now() });
    
    return {
      type: 'analytics',
      action: 'pages',
      range,
      flowId,
      data: { pages: analytics.topPages },
      message: topPages.length > 0 
        ? `Top pages in the last ${range}: ${pageList}`
        : 'No page view data yet.',
      ts: Date.now(),
    };
  },

  'analytics.devices': async (args, session) => {
    const flowId = `analytics-devices-${Date.now()}`;
    const adminWallet = (process.env.ADMIN_WALLET || '').toLowerCase();
    
    flowEventBus.emit(flowId, { type: 'flow-start', flowId, feature: 'analytics.devices', timestamp: Date.now() });
    
    if (!adminWallet || session.wallet.toLowerCase() !== adminWallet) {
      flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'failed', reason: 'unauthorized', timestamp: Date.now() });
      return {
        type: 'analytics',
        error: 'unauthorized',
        message: 'Analytics access is restricted to platform administrators.',
        ts: Date.now(),
      };
    }
    const storage = getStorage();
    const range = args.range || '24h';
    const analytics = await storage.getPageAnalytics(range as '24h' | '7d' | '30d');
    const deviceList = analytics.topDevices.map(d => `${d.device} (${d.views})`).join(', ');
    const browserList = analytics.topBrowsers.map(b => `${b.browser} (${b.views})`).join(', ');
    
    flowEventBus.emit(flowId, { type: 'step-complete', flowId, stepName: 'fetch-devices', data: { range }, timestamp: Date.now() });
    flowEventBus.emit(flowId, { type: 'flow-complete', flowId, status: 'success', timestamp: Date.now() });
    
    return {
      type: 'analytics',
      action: 'devices',
      range,
      flowId,
      data: { 
        devices: analytics.topDevices,
        browsers: analytics.topBrowsers,
      },
      message: `Devices: ${deviceList || 'No data'}. Browsers: ${browserList || 'No data'}.`,
      ts: Date.now(),
    };
  },

  'memory.pinned': async (args, session) => {
    const { getPinnedApps } = await import('./sessionMemory');
    const pinned = getPinnedApps(session.wallet);
    return {
      type: 'memory',
      action: 'list_pinned',
      data: { pinned },
      count: pinned.length,
      message: pinned.length > 0 
        ? `You have ${pinned.length} pinned app${pinned.length === 1 ? '' : 's'}: ${pinned.join(', ')}`
        : 'You have no pinned apps yet. Say "pin Slack" to add one.',
      ts: Date.now(),
    };
  },

  'memory.pin': async (args, session) => {
    const { addPinned, getPinnedApps } = await import('./sessionMemory');
    const appId = (args.appId || '').toLowerCase().trim();
    if (!appId) {
      return {
        type: 'memory',
        action: 'pin',
        data: { error: 'No app specified' },
        count: 0,
        message: 'No app specified. Say "pin Slack" or "pin Spotify".',
        ts: Date.now(),
      };
    }
    addPinned(session.wallet, appId);
    const pinned = getPinnedApps(session.wallet);
    return {
      type: 'memory',
      action: 'pin',
      data: { appId, pinned },
      count: pinned.length,
      message: `Pinned ${appId}. You now have ${pinned.length} pinned app${pinned.length === 1 ? '' : 's'}.`,
      ts: Date.now(),
    };
  },

  'memory.unpin': async (args, session) => {
    const { removePinned, getPinnedApps } = await import('./sessionMemory');
    const appId = (args.appId || '').toLowerCase().trim();
    if (!appId) {
      return {
        type: 'memory',
        action: 'unpin',
        data: { error: 'No app specified' },
        count: 0,
        message: 'No app specified. Say "unpin Slack" to remove it.',
        ts: Date.now(),
      };
    }
    removePinned(session.wallet, appId);
    const pinned = getPinnedApps(session.wallet);
    return {
      type: 'memory',
      action: 'unpin',
      data: { appId, pinned },
      count: pinned.length,
      message: `Unpinned ${appId}.`,
      ts: Date.now(),
    };
  },

  'memory.flows': async (args, session) => {
    const { getRecentFlows } = await import('./sessionMemory');
    const limit = args.limit || 10;
    const flows = getRecentFlows(session.wallet, limit);
    return {
      type: 'memory',
      action: 'list_flows',
      data: { flows },
      count: flows.length,
      message: flows.length > 0
        ? `Your last ${flows.length} flow${flows.length === 1 ? '' : 's'}: ${flows.slice(0, 5).join(', ')}${flows.length > 5 ? '...' : ''}`
        : 'No recent flows yet.',
      ts: Date.now(),
    };
  },

  'memory.queries': async (args, session) => {
    const { getRecentQueries } = await import('./sessionMemory');
    const limit = args.limit || 20;
    const queries = getRecentQueries(session.wallet, limit);
    return {
      type: 'memory',
      action: 'list_queries',
      data: { queries },
      count: queries.length,
      message: queries.length > 0
        ? `Your last ${queries.length} quer${queries.length === 1 ? 'y' : 'ies'}.`
        : 'No recent queries yet.',
      ts: Date.now(),
    };
  },

  'memory.clear': async (args, session) => {
    const { clearHistory } = await import('./sessionMemory');
    const type = (args.type || 'all') as 'flows' | 'queries' | 'all';
    clearHistory(session.wallet, type);
    return {
      type: 'memory',
      action: 'clear',
      data: { cleared: type },
      count: 0,
      message: type === 'all' 
        ? 'Cleared all history (flows and queries).'
        : `Cleared ${type} history.`,
      ts: Date.now(),
    };
  },
  
  'proxy.spotify.play': async (args, session) => {
    let uris = args.uris as string[] | undefined;
    
    if (!uris && args.query) {
      const searchResult = await spotifySearch(session.wallet, args.query as string, 'track', 5);
      if (searchResult.items.length > 0) {
        uris = searchResult.items.map(item => item.uri);
      }
    }
    
    const result = await playUris(session.wallet, uris, {
      correlationId: `exec-${Date.now()}`,
    });
    
    return {
      action: 'play',
      searchQuery: args.query,
      tracksFound: uris?.length || 0,
      ...result,
      wallet: session.wallet,
      ts: Date.now(),
    };
  },

  'proxy.spotify.pause': async (args, session) => {
    const result = await pauseSpotify(session.wallet);
    return {
      action: 'pause',
      ...result,
      wallet: session.wallet,
      ts: Date.now(),
    };
  },

  'proxy.spotify.current': async (args, session) => {
    const result = await getCurrentTrack(session.wallet);
    return {
      ...result,
      wallet: session.wallet,
      ts: Date.now(),
    };
  },

  'proxy.slack.send': async (args, session) => {
    const result = await sendSlackMessage(
      session.wallet,
      args.channel,
      args.message,
      { correlationId: `exec-${Date.now()}` }
    );
    return {
      action: 'send',
      ...result,
      wallet: session.wallet,
      ts: Date.now(),
    };
  },

  'proxy.slack.unread': async (args, session) => {
    const result = await getUnreadSummary(session.wallet, {
      correlationId: `exec-${Date.now()}`,
    });
    return {
      ...result,
      wallet: session.wallet,
      ts: Date.now(),
    };
  },

  'meta.apis.list': async () => {
    const { getAllApis, getStats } = await import('./metaAdapter');
    const apis = getAllApis();
    const stats = getStats();
    return {
      type: 'meta',
      action: 'list_apis',
      apis: apis.map(a => ({ name: a.name, category: a.category, auth: a.auth })),
      count: apis.length,
      stats,
      message: `${apis.length} public APIs available across ${Object.keys(stats.byCategory).length} categories.`,
      ts: Date.now(),
    };
  },

  'meta.apis.search': async (args) => {
    const { searchApis } = await import('./metaAdapter');
    const query = args.query || '';
    const apis = searchApis(query);
    return {
      type: 'meta',
      action: 'search_apis',
      query,
      apis: apis.map(a => ({ name: a.name, category: a.category, description: a.description })),
      count: apis.length,
      message: apis.length > 0 
        ? `Found ${apis.length} APIs matching "${query}".`
        : `No APIs found for "${query}".`,
      ts: Date.now(),
    };
  },

  'meta.flows.list': async () => {
    const { listAutoFlows, getFlowStats } = await import('./metaAdapter');
    const flows = listAutoFlows();
    const stats = getFlowStats();
    return {
      type: 'meta',
      action: 'list_flows',
      flows: flows.map(f => ({ id: f.id, name: f.name, description: f.description, steps: f.steps.length })),
      count: flows.length,
      stats,
      message: `${flows.length} auto-generated flows available.`,
      ts: Date.now(),
    };
  },

  'meta.demo': async () => {
    const { quickDemo } = await import('./metaAdapter');
    const result = await quickDemo();
    return {
      type: 'meta',
      action: 'demo',
      ...result,
      ts: Date.now(),
    };
  },

  'public.open_meteo.forecast': async (args) => {
    const { executeAutoEndpoint } = await import('./metaAdapter');
    const result = await executeAutoEndpoint('public.open_meteo.forecast', {
      lat: args.lat || '40.7128',
      lon: args.lon || '-74.0060',
    });
    return {
      type: 'meta',
      action: 'weather',
      ...result,
      message: result.success ? 'Weather data retrieved!' : 'Failed to get weather.',
      ts: Date.now(),
    };
  },

  'public.jokeapi.random': async () => {
    const { executeAutoEndpoint } = await import('./metaAdapter');
    const result = await executeAutoEndpoint('public.jokeapi.random');
    let joke = '';
    if (result.success && result.data) {
      if (result.data.type === 'single') {
        joke = result.data.joke;
      } else if (result.data.setup && result.data.delivery) {
        joke = `${result.data.setup} ... ${result.data.delivery}`;
      }
    }
    return {
      type: 'meta',
      action: 'joke',
      ...result,
      joke,
      message: joke || 'No joke found.',
      ts: Date.now(),
    };
  },

  'public.coingecko.prices': async () => {
    const { executeAutoEndpoint } = await import('./metaAdapter');
    const result = await executeAutoEndpoint('public.coingecko.prices');
    let message = 'Failed to get crypto prices.';
    if (result.success && result.data) {
      const btc = result.data.bitcoin?.usd;
      const eth = result.data.ethereum?.usd;
      if (btc || eth) {
        message = `Bitcoin: $${btc?.toLocaleString() || 'N/A'}, Ethereum: $${eth?.toLocaleString() || 'N/A'}`;
      }
    }
    return {
      type: 'meta',
      action: 'crypto',
      ...result,
      message,
      ts: Date.now(),
    };
  },

  'public.nager_date.nextHoliday': async (args) => {
    const { executeAutoEndpoint } = await import('./metaAdapter');
    const country = args.country || 'US';
    const result = await executeAutoEndpoint('public.nager_date.nextHoliday', { country });
    let message = 'Failed to get holiday info.';
    if (result.success && Array.isArray(result.data) && result.data.length > 0) {
      const next = result.data[0];
      message = `Next holiday: ${next.name} on ${next.date}`;
    }
    return {
      type: 'meta',
      action: 'holiday',
      ...result,
      message,
      ts: Date.now(),
    };
  },

  'public.dog_ceo.random': async () => {
    const { executeAutoEndpoint } = await import('./metaAdapter');
    const result = await executeAutoEndpoint('public.dog_ceo.random');
    const imageUrl = result.data?.message || null;
    return {
      type: 'meta',
      action: 'dog',
      ...result,
      imageUrl,
      message: imageUrl ? 'Here\'s a random dog!' : 'Failed to get dog picture.',
      ts: Date.now(),
    };
  },

  'public.cat_facts.fact': async () => {
    const { executeAutoEndpoint } = await import('./metaAdapter');
    const result = await executeAutoEndpoint('public.cat_facts.fact');
    const fact = result.data?.fact || null;
    return {
      type: 'meta',
      action: 'cat_fact',
      ...result,
      fact,
      message: fact || 'Failed to get cat fact.',
      ts: Date.now(),
    };
  },

  'public.quotable.random': async () => {
    const { executeAutoEndpoint } = await import('./metaAdapter');
    const result = await executeAutoEndpoint('public.quotable.random');
    let quote = '';
    if (result.success && result.data) {
      quote = `"${result.data.content}" — ${result.data.author}`;
    }
    return {
      type: 'meta',
      action: 'quote',
      ...result,
      quote,
      message: quote || 'Failed to get quote.',
      ts: Date.now(),
    };
  },

  'meta.flow.weather-and-joke': async () => {
    const { executeAutoFlow } = await import('./metaAdapter');
    const result = await executeAutoFlow('weather-and-joke');
    return {
      type: 'meta',
      action: 'flow',
      flowId: 'weather-and-joke',
      ...result,
      message: result.success 
        ? `Flow completed: ${result.steps.length} steps executed.`
        : 'Flow execution failed.',
      ts: Date.now(),
    };
  },

  'meta.flow.morning-brief': async () => {
    const { executeAutoFlow } = await import('./metaAdapter');
    const result = await executeAutoFlow('morning-brief');
    return {
      type: 'meta',
      action: 'flow',
      flowId: 'morning-brief',
      ...result,
      message: result.success 
        ? `Morning brief ready: ${result.steps.length} updates.`
        : 'Morning brief failed.',
      ts: Date.now(),
    };
  },

  // Web3 Handlers
  'web3.moralis.wallet_balance': async (args, session) => {
    const { executeWeb3Endpoint } = await import('./metaAdapter');
    const address = args.address || session.wallet;
    const result = await executeWeb3Endpoint('web3.moralis.wallet_balance', {
      address,
      chain: args.chain || 'eth',
    });
    let balance = 'N/A';
    if (result.success && result.data) {
      const wei = BigInt(result.data.balance || '0');
      const eth = Number(wei) / 1e18;
      balance = `${eth.toFixed(4)} ETH`;
    }
    return {
      type: 'web3',
      action: 'wallet_balance',
      address,
      chain: args.chain || 'eth',
      balance,
      ...result,
      message: result.success ? `Balance: ${balance}` : `Failed: ${result.error}`,
      ts: Date.now(),
    };
  },

  'web3.moralis.token_balances': async (args, session) => {
    const { executeWeb3Endpoint } = await import('./metaAdapter');
    const address = args.address || session.wallet;
    const result = await executeWeb3Endpoint('web3.moralis.token_balances', {
      address,
      chain: args.chain || 'eth',
    });
    let tokens: any[] = [];
    if (result.success && Array.isArray(result.data)) {
      tokens = result.data.slice(0, 10).map((t: any) => ({
        symbol: t.symbol,
        name: t.name,
        balance: t.balance,
        decimals: t.decimals,
      }));
    }
    return {
      type: 'web3',
      action: 'token_balances',
      address,
      tokens,
      count: tokens.length,
      ...result,
      message: result.success ? `Found ${tokens.length} tokens.` : `Failed: ${result.error}`,
      ts: Date.now(),
    };
  },

  'web3.moralis.nfts': async (args, session) => {
    const { executeWeb3Endpoint } = await import('./metaAdapter');
    const address = args.address || session.wallet;
    const result = await executeWeb3Endpoint('web3.moralis.nfts', {
      address,
      chain: args.chain || 'eth',
    });
    let nfts: any[] = [];
    if (result.success && result.data?.result) {
      nfts = result.data.result.slice(0, 10).map((n: any) => ({
        name: n.name,
        tokenId: n.token_id,
        collection: n.token_address,
        symbol: n.symbol,
      }));
    }
    return {
      type: 'web3',
      action: 'nfts',
      address,
      nfts,
      count: nfts.length,
      ...result,
      message: result.success ? `Found ${nfts.length} NFTs.` : `Failed: ${result.error}`,
      ts: Date.now(),
    };
  },

  'web3.alchemy.gas_price': async () => {
    const { executeWeb3Endpoint } = await import('./metaAdapter');
    const result = await executeWeb3Endpoint('web3.alchemy.gas_price', {});
    let gasGwei = 'N/A';
    if (result.success && result.data?.result) {
      const wei = parseInt(result.data.result, 16);
      gasGwei = `${(wei / 1e9).toFixed(2)} Gwei`;
    }
    return {
      type: 'web3',
      action: 'gas_price',
      gasGwei,
      ...result,
      message: result.success ? `Gas Price: ${gasGwei}` : `Failed: ${result.error}`,
      ts: Date.now(),
    };
  },

  'web3.moralis.transactions': async (args, session) => {
    const { executeWeb3Endpoint } = await import('./metaAdapter');
    const address = args.address || session.wallet;
    const result = await executeWeb3Endpoint('web3.moralis.transactions', {
      address,
      chain: args.chain || 'eth',
    });
    let transactions: any[] = [];
    if (result.success && result.data?.result) {
      transactions = result.data.result.slice(0, 5).map((tx: any) => ({
        hash: tx.hash,
        from: tx.from_address,
        to: tx.to_address,
        value: tx.value,
        blockNumber: tx.block_number,
      }));
    }
    return {
      type: 'web3',
      action: 'transactions',
      address,
      transactions,
      count: transactions.length,
      ...result,
      message: result.success ? `Found ${transactions.length} recent transactions.` : `Failed: ${result.error}`,
      ts: Date.now(),
    };
  },

  'web3.flow.wallet-check': async (args, session) => {
    const { executeWeb3Endpoint } = await import('./metaAdapter');
    const address = args.address || session.wallet;
    const steps: any[] = [];
    
    const balanceResult = await executeWeb3Endpoint('web3.moralis.wallet_balance', {
      address,
      chain: 'eth',
    });
    steps.push({ name: 'ETH Balance', ...balanceResult });
    
    const tokenResult = await executeWeb3Endpoint('web3.moralis.token_balances', {
      address,
      chain: 'eth',
    });
    steps.push({ name: 'Token Balances', ...tokenResult });
    
    const successCount = steps.filter(s => s.success).length;
    return {
      type: 'web3',
      action: 'flow',
      flowId: 'wallet-check',
      address,
      steps,
      success: successCount > 0,
      message: `Wallet check: ${successCount}/${steps.length} steps completed.`,
      ts: Date.now(),
    };
  },

  'web3.flow.portfolio-brief': async (args, session) => {
    const { executeWeb3Endpoint } = await import('./metaAdapter');
    const address = args.address || session.wallet;
    const steps: any[] = [];
    
    const balanceResult = await executeWeb3Endpoint('web3.moralis.wallet_balance', {
      address,
      chain: 'eth',
    });
    steps.push({ name: 'ETH Balance', ...balanceResult });
    
    const tokenResult = await executeWeb3Endpoint('web3.moralis.token_balances', {
      address,
      chain: 'eth',
    });
    steps.push({ name: 'Token Balances', ...tokenResult });
    
    const gasResult = await executeWeb3Endpoint('web3.alchemy.gas_price', {});
    steps.push({ name: 'Gas Price', ...gasResult });
    
    const successCount = steps.filter(s => s.success).length;
    return {
      type: 'web3',
      action: 'flow',
      flowId: 'portfolio-brief',
      address,
      steps,
      success: successCount > 0,
      message: `Portfolio brief: ${successCount}/${steps.length} steps completed.`,
      ts: Date.now(),
    };
  },

  'web3.demo': async (args, session) => {
    const { web3Demo } = await import('./metaAdapter');
    const address = args.address || session.wallet || '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
    const result = await web3Demo(address);
    return {
      type: 'web3',
      action: 'demo',
      address,
      ...result,
      ts: Date.now(),
    };
  },

  // Roku/TV Pairing
  'roku.pair': async (args, session) => {
    const apiBase = process.env.VITE_API_URL || 'https://p3protocol.com';
    
    try {
      const response = await fetch(`${apiBase}/api/atlas/roku/session/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          device: 'roku', 
          model: 'user-initiated',
          walletAddress: session.wallet 
        }),
      });
      
      if (!response.ok) {
        return {
          type: 'roku',
          action: 'pair',
          success: false,
          message: 'Could not generate pairing code. Please try again.',
          ts: Date.now(),
        };
      }
      
      const data = await response.json();
      
      return {
        type: 'roku',
        action: 'pair',
        success: true,
        sessionId: data.sessionId,
        pairingCode: data.pairingCode,
        pairUrl: data.pairUrl || `${apiBase}/atlas/pair?code=${data.pairingCode}`,
        expiresIn: data.expiresIn || 300,
        message: `Your Roku pairing code is: ${data.pairingCode}. Enter this code on your Roku TV to connect Atlas to your session. The code expires in 5 minutes.`,
        instructions: [
          '1. On your Roku, open the Atlas channel',
          '2. Select "Enter Code Manually" on the pairing screen',
          `3. Enter code: ${data.pairingCode}`,
          '4. Your Atlas session will be connected to your TV',
        ],
        ts: Date.now(),
      };
    } catch (error) {
      return {
        type: 'roku',
        action: 'pair',
        success: false,
        message: 'Failed to connect to pairing service. Please try again.',
        error: error instanceof Error ? error.message : 'Unknown error',
        ts: Date.now(),
      };
    }
  },

  // Atlas capability/help
  'atlas.capability.open': async (args, session) => {
    return {
      type: 'atlas',
      action: 'capabilities',
      capabilities: [
        { name: 'Atlas Chat', command: 'chat with atlas', description: 'Talk to Atlas AI' },
        { name: 'Atlas TV', command: 'open atlas tv', description: 'Watch live TV, movies, shows' },
        { name: 'GameDeck', command: 'open gamedeck', description: 'Play games, claim giveaways' },
        { name: 'Reader', command: 'open reader', description: 'Read books and documents' },
        { name: 'News', command: 'show me the news', description: 'Get live news updates' },
        { name: 'Wikipedia', command: 'search wikipedia for [topic]', description: 'Search Wikipedia' },
        { name: 'Pair Roku', command: 'pair my roku', description: 'Connect Atlas to your TV' },
        { name: 'Weather', command: 'what is the weather', description: 'Get weather info' },
        { name: 'Wallet', command: 'show my wallet', description: 'View your Web3 balance' },
        { name: 'Messages', command: 'show my messages', description: 'View encrypted messages' },
        { name: 'Launcher', command: 'show my launcher', description: 'View pinned apps' },
      ],
      message: 'Atlas can help you with: TV & Movies, Games, Books, News, Wikipedia, Weather, Wallet, Messages, and connecting to your Roku TV. Try saying "show me the news" or "search wikipedia for quantum physics".',
      ts: Date.now(),
    };
  },

  // News search and top stories
  'atlas.news.search': async (args) => {
    const { searchNews } = await import('./newsService');
    const topic = args.topic || args.query || 'technology';
    const articles = await searchNews(topic);
    return {
      type: 'news',
      action: 'search',
      topic,
      articles,
      count: articles.length,
      canvasMode: 'news',
      renderPayload: { topic, mode: 'news' },
      message: articles.length > 0 
        ? `Found ${articles.length} news articles about ${topic}.`
        : `No news found for ${topic}.`,
      ts: Date.now(),
    };
  },

  'atlas.news.top': async () => {
    const { getTopStories } = await import('./newsService');
    const articles = await getTopStories();
    return {
      type: 'news',
      action: 'top',
      articles,
      count: articles.length,
      canvasMode: 'news',
      renderPayload: { mode: 'news' },
      message: `Here are today's top ${articles.length} stories.`,
      ts: Date.now(),
    };
  },

  // Wikipedia search
  'atlas.wikipedia.search': async (args) => {
    const { searchWikipedia } = await import('./wikipediaService');
    const term = args.term || args.query || '';
    if (!term) {
      return {
        type: 'wikipedia',
        action: 'search',
        error: 'no_term',
        message: 'Please specify a search term for Wikipedia.',
        ts: Date.now(),
      };
    }
    const results = await searchWikipedia(term);
    return {
      type: 'wikipedia',
      action: 'search',
      term,
      results,
      count: results.length,
      canvasMode: 'news',
      renderPayload: { topic: term, mode: 'wikipedia' },
      message: results.length > 0 
        ? `Found ${results.length} Wikipedia articles about "${term}".`
        : `No Wikipedia articles found for "${term}".`,
      ts: Date.now(),
    };
  },
};

const storageHandlers: Record<string, EndpointHandler> = {
  'messages.compose': async (args, session) => {
    const body = args.body || args.encryptedBody || '';
    const contentHash = crypto.createHash('sha256').update(body).digest('hex');
    const message = await getStorage().createMessage({
      fromWallet: session.wallet,
      toWallet: args.to,
      encryptedContent: body,
      contentHash,
      messageType: args.type || 'text',
    });
    return {
      messageId: message.id,
      to: args.to,
      status: message.status,
      createdAt: message.createdAt,
      ts: Date.now(),
    };
  },

  'messages.list': async (args, session) => {
    const messages = await getStorage().listMessages({
      walletAddress: session.wallet,
    });
    const offset = args.offset || 0;
    const limit = args.limit || 20;
    const sliced = messages.slice(offset, offset + limit);
    return {
      messages: sliced,
      total: messages.length,
      limit,
      offset,
    };
  },

  'notes.create': async (args, session) => {
    const note = await getStorage().createNote({
      walletAddress: session.wallet,
      title: args.title || 'Untitled',
      encryptedBody: args.body || args.encryptedBody || '',
      isPinned: args.starred ? 1 : 0,
      tags: args.tags || null,
      searchableContent: args.searchableContent || null,
    });
    return {
      noteId: note.id,
      title: note.title,
      starred: note.isPinned === 1,
      createdAt: note.createdAt,
      ts: Date.now(),
    };
  },

  'notes.list': async (args, session) => {
    const notes = await getStorage().listNotes({
      walletAddress: session.wallet,
      searchQuery: args.search,
    });
    return {
      notes: notes.map((n: Note) => ({
        id: n.id,
        title: n.title,
        starred: n.isPinned === 1,
        tags: n.tags,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
      total: notes.length,
    };
  },

  'calls.start': async (args, session) => {
    const roomId = `room_${crypto.randomUUID().slice(0, 8)}`;
    const initiatorHash = crypto.createHash('sha256').update(session.wallet).digest('hex').slice(0, 16);
    const targetHash = crypto.createHash('sha256').update(args.target || '').digest('hex').slice(0, 16);
    const callSession = await getStorage().createCallSession({
      roomId,
      participantsHashes: [initiatorHash, targetHash],
      mediaType: args.type === 'audio' ? 'audio' : 'video',
      startedAt: new Date(),
      immutableSeq: Date.now(),
    });
    return {
      callId: callSession.id,
      roomId: callSession.roomId,
      type: callSession.mediaType,
      target: args.target,
      status: 'initiated',
      ts: Date.now(),
    };
  },

  'admin.metrics': async () => {
    const metrics = await getStorage().getMetrics();
    return {
      liveUsers: metrics.liveUsers,
      geo: metrics.geo,
      funnel: metrics.funnel,
      devices: metrics.devices,
      fraud: metrics.fraud,
      ts: Date.now(),
    };
  },

  'admin.logs': async (args) => {
    const logs = await getStorage().getAuditLog({
      entityType: args.entityType,
    });
    const limit = args.limit || 50;
    return {
      logs: logs.slice(0, limit),
      level: args.level,
      limit,
      total: logs.length,
    };
  },
};

const oauthRequiredHandlers: Record<string, EndpointHandler> = {
  'payments.send': (args) => ({
    action: 'send_payment',
    to: args.to,
    amount: args.amount,
    token: args.token || 'ETH',
    status: 'requires_wallet_signature',
    signatureUrl: `/api/payments/sign?to=${encodeURIComponent(args.to)}&amount=${args.amount}`,
    ts: Date.now(),
  }),

  'payments.history': async (args, session) => {
    const ledgerEvents = await getStorage().getLedgerEvents({ direction: 'outflow' });
    const walletHash = crypto.createHash('sha256').update(session.wallet).digest('hex').slice(0, 16);
    const walletEvents = ledgerEvents.filter(e => e.counterparty === walletHash);
    return {
      transactions: walletEvents.slice(0, args.limit || 50),
      total: walletEvents.length,
      limit: args.limit || 50,
    };
  },

  'anchors.create': async (args, session) => {
    const contentHash = crypto.createHash('sha256').update(JSON.stringify(args)).digest('hex');
    const receipt = await getStorage().createReceipt({
      type: 'message',
      subjectId: session.wallet,
      contentHash,
      proofBlob: args,
      createdBy: session.wallet,
      immutableSeq: Date.now(),
    });
    return {
      anchorId: receipt.id,
      eventType: args.eventType,
      contentHash: receipt.contentHash,
      status: 'pending_blockchain_submission',
      ts: Date.now(),
    };
  },

  'dao.vote': (args) => ({
    action: 'cast_vote',
    proposalId: args.proposalId,
    choice: args.choice,
    status: 'requires_wallet_signature',
    governanceUrl: `/api/dao/proposals/${args.proposalId}/vote`,
    ts: Date.now(),
  }),

  'dao.proposals': async () => {
    return {
      proposals: [],
      total: 0,
      governanceUrl: '/api/dao/proposals',
      ts: Date.now(),
    };
  },

  'moderation.flag': async (args, session) => {
    await getStorage().appendAuditLog({
      action: 'content_flagged',
      entityType: 'moderation',
      entityId: args.targetId,
      actor: session.wallet,
      meta: { reason: args.reason },
    });
    return {
      flagId: `flag_${Date.now()}`,
      targetId: args.targetId,
      reason: args.reason,
      status: 'submitted_for_review',
      ts: Date.now(),
    };
  },

  'proxy.gmail.compose': (args, session) => ({
    action: 'compose',
    to: args.to,
    subject: args.subject || '',
    launchUrl: `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(args.to || '')}&su=${encodeURIComponent(args.subject || '')}`,
    requiresOAuth: true,
    provider: 'google',
    wallet: session.wallet,
    ts: Date.now(),
  }),

  'proxy.gmail.unread': (args, session) => ({
    action: 'check_unread',
    requiresOAuth: true,
    provider: 'google',
    wallet: session.wallet,
    ts: Date.now(),
  }),

  'proxy.discord.send': (args, session) => ({
    action: 'send',
    channel: args.channel,
    message: args.message,
    requiresOAuth: true,
    provider: 'discord',
    wallet: session.wallet,
    ts: Date.now(),
  }),

  'proxy.github.repos': (args, session) => ({
    action: 'list_repos',
    requiresOAuth: true,
    provider: 'github',
    wallet: session.wallet,
    ts: Date.now(),
  }),

  'proxy.github.notifications': (args, session) => ({
    action: 'list_notifications',
    requiresOAuth: true,
    provider: 'github',
    wallet: session.wallet,
    ts: Date.now(),
  }),

  'proxy.calendar.events': (args, session) => ({
    action: 'list_events',
    range: args.range || 'today',
    requiresOAuth: true,
    provider: 'google',
    wallet: session.wallet,
    ts: Date.now(),
  }),

  'proxy.twitter.post': (args, session) => ({
    action: 'post',
    content: args.content,
    requiresOAuth: true,
    provider: 'twitter',
    wallet: session.wallet,
    ts: Date.now(),
  }),
};

async function validateArgs(endpointKey: string, args: Record<string, any>): Promise<string[]> {
  const endpoint = await getEndpoint(endpointKey);
  
  if (!endpoint) {
    return [];
  }
  
  const invalidArgs: string[] = [];
  const argSchema = endpoint.args;
  
  for (const [argName, expectedType] of Object.entries(argSchema)) {
    const value = args[argName];
    
    if (value === undefined) {
      continue;
    }
    
    const actualType = Array.isArray(value) ? 'array' : typeof value;
    const normalizedExpected = expectedType.replace('[]', '');
    
    if (expectedType.endsWith('[]')) {
      if (!Array.isArray(value)) {
        invalidArgs.push(argName);
      }
    } else if (normalizedExpected === 'number' && actualType === 'string') {
      if (isNaN(parseFloat(value))) {
        invalidArgs.push(argName);
      }
    } else if (normalizedExpected !== actualType && normalizedExpected !== 'object') {
      invalidArgs.push(argName);
    }
  }
  
  return invalidArgs;
}

export async function executeEndpoint(
  endpointKey: string,
  args: Record<string, any>,
  session: Session
): Promise<any> {
  const invalidArgs = await validateArgs(endpointKey, args);
  
  if (invalidArgs.length > 0) {
    throw new ValidationError(endpointKey, invalidArgs);
  }
  
  const liveHandler = liveHandlers[endpointKey];
  if (liveHandler) {
    try {
      return await liveHandler(args, session);
    } catch (error) {
      throw new ExecutionError(endpointKey, error as Error);
    }
  }
  
  const storageHandler = storageHandlers[endpointKey];
  if (storageHandler) {
    try {
      return await storageHandler(args, session);
    } catch (error) {
      throw new ExecutionError(endpointKey, error as Error);
    }
  }
  
  const oauthHandler = oauthRequiredHandlers[endpointKey];
  if (oauthHandler) {
    try {
      return await oauthHandler(args, session);
    } catch (error) {
      throw new ExecutionError(endpointKey, error as Error);
    }
  }
  
  return {
    endpointKey,
    args,
    status: 'not_implemented',
    message: `Endpoint ${endpointKey} requires implementation or OAuth connection`,
    ts: Date.now(),
  };
}

export function isImplemented(endpointKey: string): boolean {
  return endpointKey in liveHandlers;
}

export function hasStorageHandler(endpointKey: string): boolean {
  return endpointKey in storageHandlers;
}

export function requiresOAuth(endpointKey: string): boolean {
  return endpointKey in oauthRequiredHandlers;
}

export function getImplementedEndpoints(): string[] {
  return Object.keys(liveHandlers);
}

export function getStorageEndpoints(): string[] {
  return Object.keys(storageHandlers);
}

export function getOAuthEndpoints(): string[] {
  return Object.keys(oauthRequiredHandlers);
}

interface IntentExecution {
  intent: string;
  feature: string;
  params: Record<string, any>;
}

interface IntentContext {
  wallet: string;
  roles: string[];
}

export async function executeIntent(
  execution: IntentExecution,
  context: IntentContext
): Promise<{ message: string; result?: any; intent?: string; feature?: string }> {
  const { intent, feature, params } = execution;
  const { wallet, roles } = context;
  
  const session: Session = {
    wallet,
    roles,
    connectedApps: [],
    pinnedApps: [],
    preferences: {},
    startedAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  const endpointKey = feature ? `${feature}.${intent.replace(`${feature}_`, '')}` : intent;
  
  try {
    if (liveHandlers[endpointKey]) {
      const result = await liveHandlers[endpointKey](params, session);
      return {
        message: result.message || `Executed ${intent} successfully`,
        result,
        intent,
        feature,
      };
    }
    
    if (storageHandlers[endpointKey]) {
      const result = await storageHandlers[endpointKey](params, session);
      return {
        message: result.message || `Executed ${intent} successfully`,
        result,
        intent,
        feature,
      };
    }

    const intentMappings: Record<string, string> = {
      'notes_list': 'notes.list',
      'notes_create': 'notes.create',
      'notes_get': 'notes.get',
      'gallery_list': 'gallery.list',
      'gallery_upload': 'gallery.upload',
      'messages_inbox': 'messages.inbox',
      'messages_send': 'messages.send',
      'payments_history': 'payments.history',
      'payments_send': 'payments.send',
      'dao_proposals': 'governance.proposals',
      'dao_vote': 'governance.vote',
      'meta_weather': 'weather.current',
      'web3_wallet_balance': 'tokens.balance',
      'web3_token_balances': 'tokens.list',
      'web3_nfts': 'tokens.nfts',
    };

    const mappedEndpoint = intentMappings[intent];
    if (mappedEndpoint && (liveHandlers[mappedEndpoint] || storageHandlers[mappedEndpoint])) {
      const handler = liveHandlers[mappedEndpoint] || storageHandlers[mappedEndpoint];
      const result = await handler(params, session);
      return {
        message: result.message || `Executed ${intent} successfully`,
        result,
        intent,
        feature,
      };
    }

    return {
      message: `I understood "${intent}" but no handler is available for this action yet.`,
      intent,
      feature,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      message: `Failed to execute ${intent}: ${errorMessage}`,
      intent,
      feature,
    };
  }
}
