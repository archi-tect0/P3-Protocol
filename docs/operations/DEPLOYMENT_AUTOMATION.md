# Deployment Automation Runbook

CI/CD pipelines, environment configuration, and infrastructure setup for P3 Protocol.

## Environment Matrix

| Environment | Branch | Database | Redis | Blockchain | Auto-Deploy |
|-------------|--------|----------|-------|------------|-------------|
| Development | `*` | Local/SQLite | Local | Testnet | No |
| Staging | `main` | PostgreSQL | Cluster | Testnet | Yes |
| Production | `release/*` | PostgreSQL HA | Cluster | Mainnet | Manual |

## Infrastructure Requirements

### Minimum Production Requirements

| Component | Specification | Notes |
|-----------|---------------|-------|
| CPU | 4 cores | 8+ recommended for high traffic |
| Memory | 8 GB | 16+ for Redis caching |
| Storage | 100 GB SSD | NVMe recommended |
| Network | 1 Gbps | Low latency to RPC nodes |

### Service Dependencies

```yaml
services:
  postgresql:
    version: "15+"
    high_availability: true
    backup: "hourly"
    
  redis:
    version: "7+"
    cluster_mode: true
    persistence: "RDB + AOF"
    
  node:
    version: "20+"
    
  blockchain_rpc:
    provider: "Alchemy/Infura/QuickNode"
    rate_limit: "1000 req/s minimum"
```

## Environment Variables

### Required (All Environments)

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Redis
REDIS_URL="redis://host:6379"
REDIS_CLUSTER_NODES="host1:6379,host2:6379,host3:6379"

# Session
SESSION_SECRET="[32+ char random string]"

# Region
REGION="us"
REGION_PREFIX="us-east-1"
```

### Required (Production Only)

```bash
# Blockchain
MORALIS_API_KEY="..."
ALCHEMY_API_KEY="..."
COINGECKO_API_KEY="..."

# Webhooks
WEBHOOK_ENCRYPTION_KEY="..."

# WebRTC (client-side, prefix with VITE_)
VITE_TURN_US="..."
VITE_TURN_EU="..."
VITE_TURN_AP="..."

# WalletConnect
VITE_P3_WALLETCONNECT_PROJECT_ID="..."

# Admin access
VITE_ADMIN_WALLETS="0x...,0x..."
VITE_MOD_WALLETS="0x...,0x..."
```

### Feature Flags

```bash
# Production defaults
FLAG_REDIS_CLUSTER=true
FLAG_ANCHOR_QUEUE=true
FLAG_WS_SHARDS=true
FLAG_EDGE_CACHE=true
FLAG_UPLOADS_DIRECT=false
FLAG_MULTI_TURN=false
FLAG_GLOBAL_CDN=true

# Development overrides
FLAG_REDIS_CLUSTER=false
FLAG_ANCHOR_QUEUE=false
```

**Code Reference:** `server/config/flags.ts`

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy

on:
  push:
    branches: [main]
  release:
    types: [published]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
      - run: npm run lint

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    needs: build
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
      - name: Deploy to staging
        run: |
          # Deploy to staging infrastructure
          rsync -avz dist/ staging-server:/app/

  deploy-production:
    if: startsWith(github.ref, 'refs/tags/v')
    needs: build
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: dist
      - name: Deploy to production
        run: |
          # Customize for your production deployment
          # TODO: Add your deployment script
          echo "Deploy to production infrastructure"
```

## Deployment Procedures

### 1. Standard Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
npm ci

# 3. Run database migrations
npm run db:push

# 4. Build application
npm run build

# 5. Start/restart application (adapt to your process manager)
npm run dev  # Development
# OR for production: use your preferred process manager (PM2, systemd, Docker)

# 6. Verify health
curl http://localhost:5000/health
```

> **Note:** Process management depends on your deployment environment. Configure PM2, systemd, or Docker as needed for production.

### 2. Blue-Green Deployment

> **TODO:** Blue-green deployment scripts are not included in the repository. Below is a reference pattern - adapt for your infrastructure (Kubernetes, Docker Swarm, cloud-native, etc.).

```bash
#!/bin/bash
# Example blue-green pattern (customize for your environment)

# 1. Deploy new version to inactive environment
# 2. Run health checks on new version
curl -s http://new-instance:5000/health | grep -q "ok"

# 3. Switch load balancer/reverse proxy to new version
# 4. Verify traffic is flowing correctly
# 5. Keep old version available for quick rollback
```

### 3. Rollback Procedure

```bash
# Quick rollback (adapt to your deployment method)
# 1. Point load balancer back to previous version
# 2. Verify health
curl http://localhost:5000/health

# For Replit deployments: Use checkpoint rollback feature
```

### 4. Database Migration

```bash
# Always use Drizzle push (never raw SQL)
npm run db:push

# If data-loss warning, review carefully then:
npm run db:push --force

# For complex migrations, use staging first:
DATABASE_URL=$STAGING_DB npm run db:push
# Verify staging
DATABASE_URL=$PROD_DB npm run db:push
```

## Secret Management

### Secrets Hierarchy

```
Production Secrets (never in code)
├── DATABASE_URL
├── REDIS_URL
├── SESSION_SECRET
├── WEBHOOK_ENCRYPTION_KEY
├── *_API_KEY (all third-party keys)
└── *_WALLET_PRIVATE_KEY

Build-time Secrets (in CI)
├── VITE_* (client-side, public after build)
└── NPM_TOKEN

Runtime Configuration (can be in config files)
├── REGION
├── FLAG_* (feature flags)
└── NODE_ENV
```

### Secrets Providers

| Provider | Use Case | Setup |
|----------|----------|-------|
| GitHub Secrets | CI/CD | Repository settings |
| AWS Secrets Manager | Production | IAM roles |
| HashiCorp Vault | Multi-cloud | Vault agent |
| Doppler | Developer friendly | CLI integration |

### Injecting Secrets

```bash
# Option 1: Environment file
source /etc/p3/secrets.env
npm start

# Option 2: Secrets manager
eval $(aws secretsmanager get-secret-value --secret-id p3-prod | jq -r '.SecretString | fromjson | to_entries | .[] | "export \(.key)=\(.value)"')
npm start

# Option 3: Process manager (if configured)
# pm2 start ecosystem.config.js --env production
# Or use systemd, Docker, etc.
```

## Monitoring Setup

### Health Endpoints

```bash
# Application health
GET /health
# Returns: { status: "ok", timestamp: "..." }

# Prometheus metrics
GET /metrics
# Returns: Prometheus-formatted metrics

# Pulse diagnostics (if PULSE_DIAGNOSTICS_ENABLED=true)
GET /pulse/status
# Returns: Node status and diagnostics
```

**Code Reference:** `server/routes/pulse.ts`

### Log Aggregation

```bash
# Configure structured logging
export LOG_FORMAT=json
export LOG_LEVEL=info

# Log output is written to stdout
# Forward to your preferred log aggregator (Datadog, CloudWatch, etc.)
# Example: pipe to centralized logging
./your-app 2>&1 | nc logs.example.com 514
```

> **Note:** Configure log rotation and aggregation based on your deployment environment.

### Metrics Export

```bash
# Prometheus metrics endpoint
GET /metrics

# Key metrics to monitor:
# - http_request_duration_seconds
# - mesh_peer_count
# - anchor_queue_depth
# - redis_connection_pool_size
# - database_query_duration_seconds
```

## Pre-Deployment Checklist

### Before Any Deployment

- [ ] All tests passing
- [ ] Linting passes
- [ ] Build completes successfully
- [ ] Database migrations tested on staging
- [ ] Feature flags configured correctly
- [ ] Secrets verified in target environment
- [ ] Rollback plan documented
- [ ] Team notified of deployment window

### Before Production Deployment

- [ ] Staging tested with production-like data
- [ ] Performance benchmarks acceptable
- [ ] Security scan completed
- [ ] Change log updated
- [ ] On-call engineer available
- [ ] Monitoring dashboards ready
- [ ] Backup verified

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
rm -rf node_modules dist .cache
npm ci
npm run build
```

### Migration Failures

```bash
# Check migration status
npx drizzle-kit check

# Introspect current schema
npx drizzle-kit introspect

# Generate migration (if needed)
npx drizzle-kit generate
```

### Service Won't Start

```bash
# Check for port conflicts
lsof -i :5000

# Check logs (adapt to your logging setup)
# Using PM2: pm2 logs p3-server --lines 100
# Using stdout: Check terminal output or log files
tail -100 /var/log/p3/app.log  # if using file logging

# Verify environment
node -e "console.log(process.env.DATABASE_URL ? 'DB OK' : 'DB MISSING')"
```
