import { sdkReq } from './core';

export type Message = {
  id: string;
  from: string;
  to: string;
  content: string;
  encrypted: boolean;
  timestamp: number;
  threadId?: string;
};

export type Thread = {
  id: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: number;
};

export type SendMessageResult = {
  ok: boolean;
  messageId: string;
  threadId: string;
};

export type ListMessagesResult = {
  messages: Message[];
  threads: Thread[];
};

export type ThreadResult = {
  thread: Thread;
  messages: Message[];
};

export async function send(to: string, content: string, encrypted = false): Promise<SendMessageResult> {
  return sdkReq<SendMessageResult>('/api/nexus/messaging/send', {
    method: 'POST',
    body: JSON.stringify({ to, content, encrypted }),
  });
}

export async function list(): Promise<ListMessagesResult> {
  return sdkReq<ListMessagesResult>('/api/nexus/messaging/list', {
    method: 'GET',
  });
}

export async function getThread(id: string): Promise<ThreadResult> {
  return sdkReq<ThreadResult>(`/api/nexus/messaging/thread/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
}

export type MessagingAPI = {
  send: typeof send;
  list: typeof list;
  getThread: typeof getThread;
};

export function createMessagingAPI(): MessagingAPI {
  return {
    send,
    list,
    getThread,
  };
}
