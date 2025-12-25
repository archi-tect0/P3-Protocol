import { createHmac } from 'crypto';
import { db } from '../db';
import { alertChannels, alertRules } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { rootLogger } from '../observability/logger';

const logger = rootLogger.child({ module: 'alert-delivery' });

interface AlertPayload {
  [key: string]: unknown;
}

interface AlertDeliveryResult {
  channelId: string;
  type: string;
  success: boolean;
  error?: string;
  timestamp: number;
}

interface RuleEvaluationResult {
  ruleId: string;
  eventType: string;
  triggered: boolean;
  threshold: number;
  actual: number;
  windowMinutes: number;
}

type AlertType = 'email' | 'slack' | 'webhook';

function generateWebhookSignature(payload: string, secret: string): string {
  const hmac = createHmac('sha256', secret);
  hmac.update(payload);
  return `sha256=${hmac.digest('hex')}`;
}

async function sendEmailAlert(
  endpoint: string,
  message: string,
  payload?: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  logger.info('Email alert placeholder', { endpoint, message, payload });
  
  return {
    success: true
  };
}

async function sendSlackAlert(
  webhookUrl: string,
  message: string,
  payload?: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const slackPayload: Record<string, unknown> = {
      text: message,
    };
    if (payload?.attachments) {
      slackPayload.attachments = payload.attachments;
    }
    if (payload?.blocks) {
      slackPayload.blocks = payload.blocks;
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(slackPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Slack webhook failed', undefined, { status: response.status, errorText });
      return {
        success: false,
        error: `Slack webhook failed: ${response.status} - ${errorText}`
      };
    }

    logger.info('Slack alert sent successfully', { webhookUrl: webhookUrl.substring(0, 50) + '...' });
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to send Slack alert', err);
    return {
      success: false,
      error: err.message
    };
  }
}

async function sendWebhookAlert(
  webhookUrl: string,
  message: string,
  secret?: string,
  payload?: AlertPayload
): Promise<{ success: boolean; error?: string }> {
  try {
    const webhookPayload = {
      message,
      timestamp: Date.now(),
      ...(payload && { data: payload })
    };

    const payloadString = JSON.stringify(webhookPayload);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Alert-Timestamp': String(Date.now())
    };

    if (secret) {
      headers['X-Webhook-Signature'] = generateWebhookSignature(payloadString, secret);
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: payloadString
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Webhook delivery failed', undefined, { status: response.status, errorText });
      return {
        success: false,
        error: `Webhook failed: ${response.status} - ${errorText}`
      };
    }

    logger.info('Webhook alert sent successfully', { webhookUrl: webhookUrl.substring(0, 50) + '...' });
    return { success: true };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to send webhook alert', err);
    return {
      success: false,
      error: err.message
    };
  }
}

export async function sendAlert(
  tenantId: string,
  type: AlertType,
  message: string,
  payload?: AlertPayload
): Promise<AlertDeliveryResult[]> {
  logger.info('Sending alert', { tenantId, type, message });

  const channels = await db
    .select()
    .from(alertChannels)
    .where(
      and(
        eq(alertChannels.tenantId, tenantId),
        eq(alertChannels.type, type),
        eq(alertChannels.active, true)
      )
    );

  if (channels.length === 0) {
    logger.warn('No active alert channels found', { tenantId, type });
    return [];
  }

  const results: AlertDeliveryResult[] = [];

  for (const channel of channels) {
    let result: { success: boolean; error?: string };

    switch (channel.type) {
      case 'email':
        result = await sendEmailAlert(channel.endpoint, message, payload);
        break;
      case 'slack':
        result = await sendSlackAlert(channel.endpoint, message, payload);
        break;
      case 'webhook':
        result = await sendWebhookAlert(channel.endpoint, message, channel.secret || undefined, payload);
        break;
      default:
        result = { success: false, error: `Unknown channel type: ${channel.type}` };
    }

    results.push({
      channelId: channel.id,
      type: channel.type,
      success: result.success,
      error: result.error,
      timestamp: Date.now()
    });
  }

  const successCount = results.filter(r => r.success).length;
  logger.info('Alert delivery completed', {
    tenantId,
    type,
    total: results.length,
    success: successCount,
    failed: results.length - successCount
  });

  return results;
}

export async function evaluateRules(
  tenantId: string,
  eventType: string,
  metrics: { count: number; windowStart?: Date; windowEnd?: Date }
): Promise<RuleEvaluationResult[]> {
  logger.info('Evaluating alert rules', { tenantId, eventType, metrics });

  const rules = await db
    .select()
    .from(alertRules)
    .where(
      and(
        eq(alertRules.tenantId, tenantId),
        eq(alertRules.eventType, eventType),
        eq(alertRules.active, true)
      )
    );

  if (rules.length === 0) {
    logger.debug('No active rules found for event type', { tenantId, eventType });
    return [];
  }

  const results: RuleEvaluationResult[] = [];

  for (const rule of rules) {
    const triggered = metrics.count >= rule.threshold;

    results.push({
      ruleId: rule.id,
      eventType: rule.eventType,
      triggered,
      threshold: rule.threshold,
      actual: metrics.count,
      windowMinutes: rule.windowMinutes
    });

    if (triggered) {
      logger.warn('Alert rule triggered', {
        ruleId: rule.id,
        tenantId,
        eventType,
        threshold: rule.threshold,
        actual: metrics.count
      });
    }
  }

  return results;
}

export async function broadcastAlert(
  tenantId: string,
  message: string,
  payload?: AlertPayload
): Promise<AlertDeliveryResult[]> {
  logger.info('Broadcasting alert to all channels', { tenantId });

  const channels = await db
    .select()
    .from(alertChannels)
    .where(
      and(
        eq(alertChannels.tenantId, tenantId),
        eq(alertChannels.active, true)
      )
    );

  if (channels.length === 0) {
    logger.warn('No active alert channels found for tenant', { tenantId });
    return [];
  }

  const results: AlertDeliveryResult[] = [];

  for (const channel of channels) {
    let result: { success: boolean; error?: string };

    switch (channel.type) {
      case 'email':
        result = await sendEmailAlert(channel.endpoint, message, payload);
        break;
      case 'slack':
        result = await sendSlackAlert(channel.endpoint, message, payload);
        break;
      case 'webhook':
        result = await sendWebhookAlert(channel.endpoint, message, channel.secret || undefined, payload);
        break;
      default:
        result = { success: false, error: `Unknown channel type: ${channel.type}` };
    }

    results.push({
      channelId: channel.id,
      type: channel.type,
      success: result.success,
      error: result.error,
      timestamp: Date.now()
    });
  }

  return results;
}

export async function evaluateAndAlert(
  tenantId: string,
  eventType: string,
  metrics: { count: number; windowStart?: Date; windowEnd?: Date },
  payload?: AlertPayload
): Promise<{
  evaluations: RuleEvaluationResult[];
  deliveries: AlertDeliveryResult[];
}> {
  const evaluations = await evaluateRules(tenantId, eventType, metrics);
  const triggeredRules = evaluations.filter(e => e.triggered);

  if (triggeredRules.length === 0) {
    return { evaluations, deliveries: [] };
  }

  const message = `Alert: ${eventType} threshold exceeded. ` +
    `${triggeredRules.length} rule(s) triggered. ` +
    `Count: ${metrics.count}`;

  const alertPayload = {
    ...payload,
    triggeredRules: triggeredRules.map(r => ({
      ruleId: r.ruleId,
      threshold: r.threshold,
      actual: r.actual
    }))
  };

  const deliveries = await broadcastAlert(tenantId, message, alertPayload);

  return { evaluations, deliveries };
}

export { AlertPayload, AlertDeliveryResult, RuleEvaluationResult, AlertType };
