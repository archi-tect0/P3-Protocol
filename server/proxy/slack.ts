import { ensureFreshToken } from './refresh';

interface SlackChannel {
  id: string;
  name: string;
  unread: number;
}

interface SlackUnreadSummary {
  channels: SlackChannel[];
  totalUnread: number;
}

interface ProxyOptions {
  correlationId?: string;
}

export async function getUnreadSummary(
  wallet: string,
  options?: ProxyOptions
): Promise<SlackUnreadSummary> {
  const token = await ensureFreshToken(wallet, 'slack', 'notifications');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (options?.correlationId) {
    headers['X-Correlation-ID'] = options.correlationId;
  }

  const convRes = await fetch(
    'https://slack.com/api/conversations.list?types=public_channel,private_channel,im,mpim&limit=200',
    { headers }
  );

  const convJson = (await convRes.json()) as {
    ok: boolean;
    channels?: Array<{
      id: string;
      name?: string;
      user?: string;
      is_member?: boolean;
      unread_count_display?: number;
    }>;
    error?: string;
  };

  if (!convJson.ok) {
    throw new Error(convJson.error || 'slack_list_failed');
  }

  const channels = (convJson.channels || []).filter((c) => c.is_member);

  const summaries: SlackChannel[] = channels.map((c) => ({
    id: c.id,
    name: c.name || c.user || 'channel',
    unread: c.unread_count_display ?? 0,
  }));

  const totalUnread = summaries.reduce((sum, ch) => sum + ch.unread, 0);

  return { channels: summaries, totalUnread };
}

export async function sendMessage(
  wallet: string,
  channel: string,
  text: string,
  options?: ProxyOptions
): Promise<{ ok: boolean; ts?: string; channel?: string }> {
  const token = await ensureFreshToken(wallet, 'slack', 'messages');

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (options?.correlationId) {
    headers['X-Correlation-ID'] = options.correlationId;
  }

  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers,
    body: JSON.stringify({ channel, text }),
  });

  const json = (await res.json()) as {
    ok: boolean;
    ts?: string;
    channel?: string;
    error?: string;
  };

  if (!json.ok) {
    throw new Error(json.error || 'slack_send_failed');
  }

  return { ok: true, ts: json.ts, channel: json.channel };
}
