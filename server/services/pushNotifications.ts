import { db } from '../db';
import { pushSubscriptions, notifications } from '@shared/schema';
import { eq, and, arrayContains, sql, or } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';
import { webPush } from './vapidKeys';

const logger = rootLogger.child({ module: 'push-notifications' });

export interface NotificationPayload {
  type: 'message' | 'news' | 'wiki' | 'system';
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  data?: Record<string, any>;
}

export interface SendNotificationOptions {
  walletAddresses?: string[];
  topics?: string[];
  broadcast?: boolean;
}

export interface SendResult {
  sent: number;
  failed: number;
  removed: number;
}

export async function sendPushNotification(
  payload: NotificationPayload,
  options: SendNotificationOptions = {}
): Promise<SendResult> {
  const startTime = Date.now();
  const { walletAddresses, topics, broadcast } = options;

  try {
    let subscriptionsList: Array<{
      id: string;
      walletAddress: string;
      endpoint: string;
      keys: any;
      topics: string[] | null;
    }> = [];

    if (broadcast) {
      subscriptionsList = await db.select().from(pushSubscriptions);
    } else if (walletAddresses && walletAddresses.length > 0) {
      const normalizedWallets = walletAddresses.map(w => w.toLowerCase());
      subscriptionsList = await db.select().from(pushSubscriptions)
        .where(sql`${pushSubscriptions.walletAddress} = ANY(${normalizedWallets})`);
    } else if (topics && topics.length > 0) {
      subscriptionsList = await db.select().from(pushSubscriptions)
        .where(sql`${pushSubscriptions.topics} && ${topics}`);
    }

    if (subscriptionsList.length === 0) {
      logger.info('No push subscriptions found for notification', { 
        type: payload.type, 
        walletAddresses, 
        topics, 
        broadcast 
      });
      return { sent: 0, failed: 0, removed: 0 };
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      tag: payload.tag || payload.type,
      data: {
        type: payload.type,
        url: payload.url || '/',
        timestamp: new Date().toISOString(),
        ...payload.data,
      },
    });

    const results = await Promise.allSettled(
      subscriptionsList.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: sub.keys as { p256dh: string; auth: string },
        };
        return webPush.sendNotification(pushSubscription, pushPayload);
      })
    );

    let sent = 0;
    let failed = 0;
    let removed = 0;

    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 'fulfilled') {
        sent++;
      } else {
        failed++;
        const err = (results[i] as PromiseRejectedResult).reason;
        if (err.statusCode === 410 || err.statusCode === 404) {
          await db.delete(pushSubscriptions)
            .where(eq(pushSubscriptions.endpoint, subscriptionsList[i].endpoint));
          removed++;
          logger.info('Removed stale push subscription', { 
            endpoint: subscriptionsList[i].endpoint.substring(0, 50) 
          });
        }
      }
    }

    const latencyMs = Date.now() - startTime;
    logger.info('Push notifications sent', {
      type: payload.type,
      sent,
      failed,
      removed,
      total: subscriptionsList.length,
      latencyMs,
    });

    return { sent, failed, removed };
  } catch (error: any) {
    logger.error('Failed to send push notifications', { 
      error: error.message,
      type: payload.type,
    });
    return { sent: 0, failed: 0, removed: 0 };
  }
}

export async function sendMessageNotification(
  recipientWallet: string,
  senderWallet: string,
  messagePreview?: string
): Promise<SendResult> {
  const truncatedSender = `${senderWallet.slice(0, 6)}...${senderWallet.slice(-4)}`;
  const body = messagePreview 
    ? `${truncatedSender}: ${messagePreview.slice(0, 100)}${messagePreview.length > 100 ? '...' : ''}`
    : `New message from ${truncatedSender}`;

  const result = await sendPushNotification(
    {
      type: 'message',
      title: 'New Message',
      body,
      url: `/atlas?mode=messages&peer=${senderWallet}`,
      tag: `message-${senderWallet}`,
      icon: '/icons/message-icon.png',
      data: {
        sender: senderWallet,
        recipient: recipientWallet,
      },
    },
    { walletAddresses: [recipientWallet] }
  );

  if (result.sent > 0) {
    try {
      await db.insert(notifications).values({
        walletAddress: recipientWallet.toLowerCase(),
        type: 'message',
        title: 'New Message',
        body,
        source: 'nexus-messaging',
        meta: { sender: senderWallet },
      });
    } catch (err: any) {
      logger.warn('Failed to store notification in DB', { error: err.message });
    }
  }

  return result;
}

export async function sendNewsNotification(
  headline: string,
  source: string,
  articleUrl?: string
): Promise<SendResult> {
  const result = await sendPushNotification(
    {
      type: 'news',
      title: `Breaking: ${source}`,
      body: headline.slice(0, 200),
      url: articleUrl || '/atlas?mode=news',
      tag: 'breaking-news',
      icon: '/icons/news-icon.png',
      data: {
        source,
        articleUrl,
      },
    },
    { topics: ['news', 'breaking-news'] }
  );

  return result;
}

export async function sendWikiNotification(
  title: string,
  extract: string,
  articleUrl: string
): Promise<SendResult> {
  const result = await sendPushNotification(
    {
      type: 'wiki',
      title: `📚 ${title}`,
      body: extract.slice(0, 200) + (extract.length > 200 ? '...' : ''),
      url: articleUrl,
      tag: 'random-wiki',
      icon: '/icons/wiki-icon.png',
      data: {
        articleUrl,
        wikiTitle: title,
      },
    },
    { topics: ['wiki', 'knowledge', 'random-wiki'] }
  );

  return result;
}

export async function fetchRandomWikipedia(): Promise<{
  title: string;
  extract: string;
  url: string;
  thumbnail?: string;
} | null> {
  try {
    const response = await fetch(
      'https://en.wikipedia.org/api/rest_v1/page/random/summary',
      {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'P3Protocol/1.0 (https://p3protocol.app)',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      title: data.title,
      extract: data.extract || data.description || 'Discover something new!',
      url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
      thumbnail: data.thumbnail?.source,
    };
  } catch (error: any) {
    logger.error('Failed to fetch random Wikipedia article', { error: error.message });
    return null;
  }
}
