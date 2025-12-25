import { FlowPipeline, createPipeline } from './pipeline';
import { playUris, pause as pauseSpotify } from '../proxy/spotify';
import { getUnreadSummary, sendMessage as sendSlackMessage } from '../proxy/slack';

export async function playMusicAndCheckSlack(
  wallet: string,
  trackUris?: string[]
): Promise<{
  flowId: string;
  correlationId: string;
  spotify?: { ok: boolean };
  slack?: { channels: Array<{ id: string; name: string; unread: number }>; totalUnread: number };
  errors?: string[];
}> {
  const pipe = createPipeline();

  pipe
    .add(
      'spotify_play',
      async (ctx) => {
        const result = await playUris(wallet, trackUris, {
          correlationId: ctx.correlationId,
        });
        return {
          ...ctx,
          data: { ...ctx.data, spotify: result },
        };
      },
      {
        rollback: async () => {
          await pauseSpotify(wallet);
        },
        critical: false,
      }
    )
    .add(
      'slack_unread',
      async (ctx) => {
        const summary = await getUnreadSummary(wallet, {
          correlationId: ctx.correlationId,
        });
        return {
          ...ctx,
          data: { ...ctx.data, slack: summary },
        };
      }
    );

  const result = await pipe.run({ wallet, data: {} });

  return {
    flowId: pipe.getFlowId()!,
    correlationId: pipe.getCorrelationId()!,
    spotify: result.data.spotify as { ok: boolean } | undefined,
    slack: result.data.slack as {
      channels: Array<{ id: string; name: string; unread: number }>;
      totalUnread: number;
    } | undefined,
    errors: result.errors,
  };
}

export async function notifyAndPlay(
  wallet: string,
  slackChannel: string,
  message: string,
  trackUris?: string[]
): Promise<{
  flowId: string;
  correlationId: string;
  slackSent?: { ok: boolean; ts?: string };
  spotifyPlaying?: { ok: boolean };
  errors?: string[];
}> {
  const pipe = createPipeline();

  pipe
    .add(
      'slack_notify',
      async (ctx) => {
        const result = await sendSlackMessage(wallet, slackChannel, message, {
          correlationId: ctx.correlationId,
        });
        return {
          ...ctx,
          data: { ...ctx.data, slackSent: result },
        };
      },
      { critical: true }
    )
    .add(
      'spotify_play',
      async (ctx) => {
        const result = await playUris(wallet, trackUris, {
          correlationId: ctx.correlationId,
        });
        return {
          ...ctx,
          data: { ...ctx.data, spotifyPlaying: result },
        };
      }
    );

  const result = await pipe.run({ wallet, data: {} });

  return {
    flowId: pipe.getFlowId()!,
    correlationId: pipe.getCorrelationId()!,
    slackSent: result.data.slackSent as { ok: boolean; ts?: string } | undefined,
    spotifyPlaying: result.data.spotifyPlaying as { ok: boolean } | undefined,
    errors: result.errors,
  };
}

export async function parallelAppCheck(
  wallet: string
): Promise<{
  flowId: string;
  correlationId: string;
  results: Record<string, unknown>;
  errors?: string[];
}> {
  const pipe = createPipeline();

  pipe
    .add('slack_check', async (ctx) => {
      const summary = await getUnreadSummary(wallet, {
        correlationId: ctx.correlationId,
      });
      return { ...ctx, data: { slack: summary } };
    })
    .add('spotify_status', async (ctx) => {
      const { getCurrentTrack } = await import('../proxy/spotify');
      const current = await getCurrentTrack(wallet);
      return { ...ctx, data: { spotify: current } };
    });

  const result = await pipe.runParallel({ wallet, data: {} });

  return {
    flowId: pipe.getFlowId()!,
    correlationId: pipe.getCorrelationId()!,
    results: result.data,
    errors: result.errors,
  };
}
