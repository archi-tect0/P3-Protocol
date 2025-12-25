import { sdkReq } from './core';

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  topic?: string;
  data?: Record<string, unknown>;
  createdAt: number;
};

export type GetNotificationsResult = {
  notifications: Notification[];
  unreadCount: number;
};

export type MarkReadResult = {
  ok: boolean;
};

export type SubscribeResult = {
  ok: boolean;
  subscribed: string[];
};

export type DeleteNotificationResult = {
  ok: boolean;
};

export async function getNotifications(): Promise<GetNotificationsResult> {
  return sdkReq<GetNotificationsResult>('/api/nexus/inbox', {
    method: 'GET',
  });
}

export async function markRead(id: string): Promise<MarkReadResult> {
  return sdkReq<MarkReadResult>('/api/nexus/inbox/mark', {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
}

export async function subscribe(topics: string[]): Promise<SubscribeResult> {
  return sdkReq<SubscribeResult>('/api/nexus/inbox/subscribe', {
    method: 'POST',
    body: JSON.stringify({ topics }),
  });
}

export async function deleteNotification(id: string): Promise<DeleteNotificationResult> {
  return sdkReq<DeleteNotificationResult>(`/api/nexus/inbox/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export type InboxAPI = {
  getNotifications: typeof getNotifications;
  markRead: typeof markRead;
  subscribe: typeof subscribe;
  delete: typeof deleteNotification;
};

export function createInboxAPI(): InboxAPI {
  return {
    getNotifications,
    markRead,
    subscribe,
    delete: deleteNotification,
  };
}
