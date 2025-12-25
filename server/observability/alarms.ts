import { EventEmitter } from 'events';
import { StructuredLogger } from './logger';
import { metricsService } from './metrics';

export interface SLOThreshold {
  name: string;
  threshold: number;
  window: number;
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  severity: 'critical' | 'warning' | 'info';
}

export interface AlarmEvent {
  name: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  value: number;
  threshold: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export class AlarmSystem extends EventEmitter {
  private logger: StructuredLogger;
  private thresholds: Map<string, SLOThreshold>;
  private metrics: Map<string, number[]>;
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(logger: StructuredLogger) {
    super();
    this.logger = logger;
    this.thresholds = new Map();
    this.metrics = new Map();
    this.setupDefaultThresholds();
  }

  private setupDefaultThresholds(): void {
    this.addThreshold({
      name: 'anchor_failure_rate',
      threshold: 0.02,
      window: 100,
      operator: 'gt',
      severity: 'critical',
    });

    this.addThreshold({
      name: 'voice_loss_rate',
      threshold: 0.10,
      window: 50,
      operator: 'gt',
      severity: 'warning',
    });

    this.addThreshold({
      name: 'db_latency_p95',
      threshold: 0.25,
      window: 20,
      operator: 'gt',
      severity: 'warning',
    });

    this.addThreshold({
      name: 'api_error_rate',
      threshold: 0.05,
      window: 100,
      operator: 'gt',
      severity: 'critical',
    });

    this.addThreshold({
      name: 'websocket_connection_drops',
      threshold: 10,
      window: 60,
      operator: 'gt',
      severity: 'warning',
    });
  }

  addThreshold(threshold: SLOThreshold): void {
    this.thresholds.set(threshold.name, threshold);
    this.logger.info(`Added SLO threshold: ${threshold.name}`, { threshold });
  }

  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    const values = this.metrics.get(name)!;
    values.push(value);

    const threshold = this.thresholds.get(name);
    if (threshold && values.length > threshold.window) {
      values.shift();
    }
  }

  private checkThreshold(name: string, threshold: SLOThreshold): AlarmEvent | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    let aggregatedValue: number;

    if (name.includes('rate')) {
      const sum = values.reduce((a, b) => a + b, 0);
      aggregatedValue = sum / values.length;
    } else if (name.includes('p95')) {
      const sorted = [...values].sort((a, b) => a - b);
      const index = Math.floor(sorted.length * 0.95);
      aggregatedValue = sorted[index] || 0;
    } else {
      aggregatedValue = values[values.length - 1];
    }

    const isViolation = this.evaluateCondition(
      aggregatedValue,
      threshold.threshold,
      threshold.operator
    );

    if (isViolation) {
      return {
        name,
        severity: threshold.severity,
        message: `SLO violation: ${name} (${aggregatedValue.toFixed(4)}) ${threshold.operator} ${threshold.threshold}`,
        value: aggregatedValue,
        threshold: threshold.threshold,
        timestamp: new Date().toISOString(),
        metadata: {
          window: threshold.window,
          sampleCount: values.length,
        },
      };
    }

    return null;
  }

  private evaluateCondition(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      default:
        return false;
    }
  }

  private async performChecks(): Promise<void> {
    for (const [name, threshold] of this.thresholds.entries()) {
      const alarm = this.checkThreshold(name, threshold);
      if (alarm) {
        this.emitAlarm(alarm);
      }
    }
  }

  private emitAlarm(alarm: AlarmEvent): void {
    this.logger.warn(`ALARM: ${alarm.message}`, {
      alarm,
      severity: alarm.severity,
    });

    this.emit('alarm', alarm);

    if (alarm.severity === 'critical') {
      this.emit('critical', alarm);
    }
  }

  startMonitoring(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      this.logger.warn('Alarm monitoring already started');
      return;
    }

    this.logger.info(`Starting alarm monitoring (interval: ${intervalMs}ms)`);
    
    this.checkInterval = setInterval(() => {
      this.performChecks().catch(error => {
        this.logger.error('Error during alarm checks', error);
      });
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      this.logger.info('Stopped alarm monitoring');
    }
  }

  onAlarm(handler: (alarm: AlarmEvent) => void): void {
    this.on('alarm', handler);
  }

  onCritical(handler: (alarm: AlarmEvent) => void): void {
    this.on('critical', handler);
  }

  async sendToSlack(webhookUrl: string, alarm: AlarmEvent): Promise<void> {
    try {
      const color = alarm.severity === 'critical' ? '#ff0000' : '#ffa500';
      
      const payload = {
        attachments: [
          {
            color,
            title: `🚨 ${alarm.severity.toUpperCase()}: ${alarm.name}`,
            text: alarm.message,
            fields: [
              {
                title: 'Value',
                value: alarm.value.toFixed(4),
                short: true,
              },
              {
                title: 'Threshold',
                value: alarm.threshold.toString(),
                short: true,
              },
              {
                title: 'Timestamp',
                value: alarm.timestamp,
                short: false,
              },
            ],
            footer: 'P3 Protocol Observability',
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Slack API returned ${response.status}`);
      }

      this.logger.info('Alarm sent to Slack', { alarm: alarm.name });
    } catch (error) {
      this.logger.error('Failed to send alarm to Slack', error as Error, { alarm });
    }
  }

  async sendToPagerDuty(routingKey: string, alarm: AlarmEvent): Promise<void> {
    try {
      const payload = {
        routing_key: routingKey,
        event_action: 'trigger',
        payload: {
          summary: alarm.message,
          severity: alarm.severity,
          source: 'p3-protocol-observability',
          timestamp: alarm.timestamp,
          custom_details: {
            value: alarm.value,
            threshold: alarm.threshold,
            metadata: alarm.metadata,
          },
        },
      };

      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API returned ${response.status}`);
      }

      this.logger.info('Alarm sent to PagerDuty', { alarm: alarm.name });
    } catch (error) {
      this.logger.error('Failed to send alarm to PagerDuty', error as Error, { alarm });
    }
  }

  getMetricsSummary(): Record<string, any> {
    const summary: Record<string, any> = {};
    
    for (const [name, values] of this.metrics.entries()) {
      if (values.length === 0) continue;
      
      summary[name] = {
        count: values.length,
        latest: values[values.length - 1],
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }
    
    return summary;
  }
}

export function createAlarmSystem(logger: StructuredLogger): AlarmSystem {
  const alarmSystem = new AlarmSystem(logger);

  const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
  const pagerDutyKey = process.env.PAGERDUTY_ROUTING_KEY;

  if (slackWebhookUrl) {
    alarmSystem.onAlarm((alarm) => {
      alarmSystem.sendToSlack(slackWebhookUrl, alarm).catch(console.error);
    });
    logger.info('Slack integration enabled for alarms');
  }

  if (pagerDutyKey) {
    alarmSystem.onCritical((alarm) => {
      alarmSystem.sendToPagerDuty(pagerDutyKey, alarm).catch(console.error);
    });
    logger.info('PagerDuty integration enabled for critical alarms');
  }

  return alarmSystem;
}
