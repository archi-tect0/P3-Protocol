# Observability System

Production-grade observability implementation for P3 Protocol with metrics, logging, health monitoring, and alerting.

## Components

### 1. Metrics (`metrics.ts`)

Prometheus-compatible metrics collection:

**Standard Metrics:**
- `api_requests_total` - Counter for API requests (by endpoint, method, status)
- `api_request_duration_seconds` - Histogram for request duration
- `active_websocket_connections` - Gauge for active WebSocket connections
- `db_connection_pool_size` - Gauge for database connection pool (idle, active, total)

**Custom Application Metrics:**
- `zk_proving_time_seconds` - Histogram for ZK proof generation time (by proof_type)
- `bridge_relay_latency_seconds` - Histogram for bridge relay latency (by source_chain, dest_chain)
- `anchor_success_rate` - Gauge for anchor operation success rate (0-1)

**Usage:**
```typescript
import { metricsService } from './observability/metrics';

// Record ZK proving time
metricsService.recordZkProving('payment_receipt', 2.5);

// Record bridge relay
metricsService.recordBridgeRelay('ethereum', 'polygon', 1.2);

// Record anchor attempt
metricsService.recordAnchorAttempt(true);

// Update WebSocket connections
metricsService.incrementWebsocketConnections();
metricsService.decrementWebsocketConnections();

// Update DB connection pool
metricsService.updateDbConnectionPool(5, 10); // 5 idle, 10 total
```

**Endpoint:**
```
GET /metrics
```
Returns Prometheus-formatted metrics.

### 2. Structured Logging (`logger.ts`)

High-performance JSON logging using Pino:

**Features:**
- JSON-formatted structured logs
- Log levels: fatal, error, warn, info, debug
- Automatic secret redaction (passwords, tokens, API keys, etc.)
- Correlation ID injection for request tracing
- Pretty printing in development mode
- Request/response serialization

**Usage:**
```typescript
import { rootLogger, createRequestLogger } from './observability/logger';

// Root logger
rootLogger.info('Application started', { port: 5000 });
rootLogger.error('Database connection failed', error, { host: 'localhost' });

// Request-scoped logger with correlation ID
const logger = createRequestLogger(correlationId);
logger.info('Processing payment', { userId: '123', amount: 100 });
logger.warn('High latency detected', { duration: 5000 });

// In route handlers (logger is automatically injected)
app.get('/api/users', (req, res) => {
  req.logger.info('Fetching users', { limit: 10 });
});
```

**Redacted Fields:**
- password, passwordHash, secret, token, apiKey, privateKey
- authorization, cookie headers
- Any field matching common secret patterns

### 3. Health Monitoring (`health.ts`)

Comprehensive health checks:

**Checks:**
- Database connectivity (with latency measurement)
- Redis connectivity (optional)
- WebSocket server status
- Memory usage (total, used, free, percentage)
- CPU load (1min, 5min, 15min averages)
- Disk space usage

**Health Status:**
- `healthy` - All checks passing
- `degraded` - Warning level issues detected
- `unhealthy` - Critical issues detected

**Usage:**
```typescript
import { HealthMonitor } from './observability/health';

const healthMonitor = new HealthMonitor(logger);

// Configure checkers
healthMonitor.setDatabaseChecker(async () => {
  const result = await db.execute('SELECT 1');
  return !!result;
});

healthMonitor.setRedisChecker(async () => {
  return redis.ping();
});

healthMonitor.setWebSocketChecker(() => {
  return wsServer.isRunning;
});

// Perform health check
const health = await healthMonitor.performHealthCheck();
console.log(health.status); // 'healthy', 'degraded', or 'unhealthy'
```

**Endpoint:**
```
GET /health
```
Returns detailed health status with all check results.

### 4. Alarm System (`alarms.ts`)

SLO-based alerting with integration support:

**Default Thresholds:**
- `anchor_failure_rate` > 2% (critical)
- `voice_loss_rate` > 10% (warning)
- `db_latency_p95` > 250ms (warning)
- `api_error_rate` > 5% (critical)
- `websocket_connection_drops` > 10/min (warning)

**Usage:**
```typescript
import { createAlarmSystem } from './observability/alarms';

const alarmSystem = createAlarmSystem(logger);

// Record metrics
alarmSystem.recordMetric('anchor_failure_rate', 0.025);
alarmSystem.recordMetric('db_latency_p95', 0.3);

// Listen for alarms
alarmSystem.onAlarm((alarm) => {
  console.log(`ALARM: ${alarm.message}`);
});

alarmSystem.onCritical((alarm) => {
  console.log(`CRITICAL: ${alarm.message}`);
});

// Start monitoring (checks every 60 seconds)
alarmSystem.startMonitoring(60000);
```

**Integration:**

Set environment variables for automatic integration:

```bash
# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# PagerDuty (critical alarms only)
PAGERDUTY_ROUTING_KEY=your_routing_key_here
```

### 5. Correlation ID Middleware (`correlation-id.ts`)

Request tracing middleware:

**Features:**
- Generates unique correlation ID for each request
- Accepts existing correlation ID from headers
- Injects correlation ID into request object
- Returns correlation ID in response headers

**Headers:**
- `X-Correlation-ID` - Correlation ID for the request
- `X-Request-ID` - Alternative header name (also supported)

## Integration

The observability system is automatically integrated into the server:

```typescript
// server/index.ts

import { correlationIdMiddleware } from './middleware/correlation-id';
import { metricsService } from './observability/metrics';
import { rootLogger, loggingMiddleware } from './observability/logger';
import { HealthMonitor } from './observability/health';
import { createAlarmSystem } from './observability/alarms';

// Middleware stack
app.use(correlationIdMiddleware);
app.use(loggingMiddleware);
app.use(metricsService.createTimingMiddleware());

// Endpoints
app.get('/metrics', metricsService.metricsEndpoint());
app.get('/health', healthMonitor.healthEndpoint());
```

## Environment Variables

```bash
# Logging
LOG_LEVEL=info  # fatal, error, warn, info, debug

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
PAGERDUTY_ROUTING_KEY=your_key_here
```

## Monitoring Setup

### Prometheus Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'p3-protocol'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
```

### Grafana Dashboard

Import the included dashboard or create custom panels:
- API request rate and latency
- ZK proving time distribution
- Bridge relay latency
- Anchor success rate
- System resources (CPU, memory, disk)

### Alerting

Configure Prometheus alerting rules:

```yaml
groups:
  - name: p3_protocol
    rules:
      - alert: HighErrorRate
        expr: rate(api_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
      
      - alert: SlowZKProving
        expr: histogram_quantile(0.95, zk_proving_time_seconds) > 10
        for: 10m
        annotations:
          summary: "ZK proving time is slow"
```

## Testing

Run the observability test suite:

```bash
npx tsx test-observability.ts
```

## Architecture

```
┌─────────────────────────────────────────┐
│           Application Code              │
└────────────┬────────────────────────────┘
             │
             ├─► Correlation ID Middleware
             ├─► Logging Middleware
             ├─► Metrics Timing Middleware
             │
             v
┌────────────────────────────────────────┐
│        Observability System            │
├────────────────────────────────────────┤
│ Metrics    │ Logging  │ Health │ Alarms│
├────────────┼──────────┼────────┼───────┤
│ Prometheus │ Pino     │ System │ SLO   │
│ Counters   │ JSON     │ Checks │ Based │
│ Histograms │ Redact   │ Status │ Alert │
│ Gauges     │ Context  │ Report │ Fire  │
└────────────┴──────────┴────────┴───────┘
             │
             ├─► /metrics (Prometheus)
             ├─► /health (JSON)
             ├─► Slack Webhooks
             └─► PagerDuty Events
```

## Best Practices

1. **Use correlation IDs** - Track requests across services
2. **Add context to logs** - Include userId, operation, relevant IDs
3. **Record custom metrics** - Track business-specific operations
4. **Set SLO thresholds** - Define acceptable performance levels
5. **Monitor continuously** - Set up Prometheus + Grafana
6. **Alert on SLO violations** - Integrate with on-call rotation
7. **Review logs regularly** - Look for patterns and anomalies
8. **Test under load** - Verify observability scales with traffic
