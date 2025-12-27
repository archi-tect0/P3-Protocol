# Failure Recovery Runbook

Procedures for diagnosing and recovering from system failures in P3 Protocol.

## Incident Classification

| Severity | Definition | Response Time | Examples |
|----------|------------|---------------|----------|
| SEV-1 | Complete outage | Immediate | Database down, all auth failing |
| SEV-2 | Major degradation | 15 minutes | Mesh relay down, payments failing |
| SEV-3 | Partial impact | 1 hour | Single region affected, slow queries |
| SEV-4 | Minor issue | 4 hours | Non-critical feature broken |

## System Health Checks

### Quick Diagnostics

```bash
# 1. Check health endpoint
curl http://localhost:5000/health

# 2. Check database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# 3. Check Redis cluster
redis-cli -u $REDIS_URL PING

# 4. Check pulse status (if PULSE_DIAGNOSTICS_ENABLED=true)
curl http://localhost:5000/pulse/status

# 5. Check Prometheus metrics
curl http://localhost:5000/metrics
```

### Service Dependencies

```
┌─────────────────┐
│   Load Balancer │
└────────┬────────┘
         │
    ┌────▼────┐
    │ Express │ ← Entry point
    └────┬────┘
         │
    ┌────┴────────────┬─────────────────┐
    │                 │                 │
┌───▼───┐      ┌──────▼──────┐   ┌──────▼──────┐
│ Redis │      │ PostgreSQL  │   │ Blockchain  │
│Cluster│      │   (Neon)    │   │   (Base)    │
└───────┘      └─────────────┘   └─────────────┘
```

## Failure Scenarios

### 1. Session Bridge Failure

**Symptoms:**
- Users cannot authenticate
- "Session expired" errors
- 401 responses from protected endpoints

**Diagnosis:**
```bash
# Check session bridge logs
grep "sessionBridge" /var/log/p3/*.log | tail -100

# Verify Redis connectivity
redis-cli -u $REDIS_URL KEYS "session:*" | head -10

# Test session handshake
curl -X POST http://localhost:5000/api/protocol/session/handshake \
  -H "Content-Type: application/json" \
  -d '{"deviceId":"test","capabilities":{"encoding":["json"]}}'
```

**Recovery:**
```bash
# 1. Restart application (adapt to your process manager)
npm run dev  # or your production restart command

# 2. If Redis is the issue, failover to replica
redis-cli -u $REDIS_URL CLUSTER FAILOVER

# 3. Clear corrupt sessions if necessary
redis-cli -u $REDIS_URL KEYS "session:*" | xargs redis-cli DEL
```

**Code Reference:** `server/services/sessionBridge.ts`

---

### 2. Mesh Relay Outage

**Symptoms:**
- Real-time messages not delivering
- WebSocket disconnections
- Peer count dropping to zero

**Diagnosis:**
```bash
# Check WebSocket pulse stream
curl http://localhost:5000/pulse/status

# Check Redis pub/sub
redis-cli -u $REDIS_URL PUBSUB CHANNELS "mesh:*"

# Monitor metrics
curl http://localhost:5000/metrics | grep websocket
```

**Recovery:**
```bash
# 1. Check for connection storms
netstat -an | grep :5000 | wc -l

# 2. Restart application (adapt to your process manager)
npm run dev  # or your production restart command

# 3. Force reconnection of all clients
redis-cli -u $REDIS_URL PUBLISH mesh:control '{"action":"reconnect"}'
```

**Code Reference:** `server/mesh/globalRelay.ts`, `server/redis/pubsub.ts`

---

### 3. Anchor Queue Backup

**Symptoms:**
- Blockchain receipts not appearing
- Queue depth increasing
- Anchor worker errors in logs

**Diagnosis:**
```bash
# Check anchor queue in Redis (BullMQ)
redis-cli -u $REDIS_URL LLEN "bull:anchor:waiting"

# Check failed jobs
redis-cli -u $REDIS_URL LRANGE "bull:anchor:failed" 0 10

# Verify blockchain connectivity
curl -X POST $RPC_URL -d '{"jsonrpc":"2.0","method":"eth_blockNumber","id":1}'
```

**Code Reference:** `server/anchor/queue.ts`

**Recovery:**
```bash
# 1. Check anchor wallet balance
cast balance $ANCHOR_WALLET --rpc-url $RPC_URL

# 2. If gas issues, fund wallet
cast send $ANCHOR_WALLET --value 0.1ether --rpc-url $RPC_URL

# 3. Retry failed jobs
redis-cli -u $REDIS_URL LRANGE "bull:anchor:failed" 0 -1 | \
  xargs -I {} redis-cli RPUSH "bull:anchor:waiting" {}

# 4. Increase concurrency if needed
export ANCHOR_CONCURRENCY=128
# Restart application (adapt to your process manager)
npm run dev  # or your production restart command
```

**Code Reference:** `server/anchor/queue.ts`, `server/services/receipts.ts`

---

### 4. Database Connection Exhaustion

**Symptoms:**
- "Too many connections" errors
- Slow queries
- Timeouts on database operations

**Diagnosis:**
```bash
# Check active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Find long-running queries
psql $DATABASE_URL -c "SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC LIMIT 10;"
```

**Recovery:**
```bash
# 1. Kill long-running queries
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity WHERE duration > interval '5 minutes';"

# 2. Restart application to reset pool (adapt to your process manager)
npm run dev  # or your production restart command

# 3. If persistent, increase pool size in drizzle config
```

---

### 5. Redis Cluster Partition

**Symptoms:**
- Intermittent failures
- Some operations succeed, others fail
- "MOVED" or "CLUSTERDOWN" errors

**Diagnosis:**
```bash
# Check cluster state
redis-cli -u $REDIS_URL CLUSTER INFO

# Check node status
redis-cli -u $REDIS_URL CLUSTER NODES
```

**Recovery:**
```bash
# 1. Identify failed nodes
redis-cli -u $REDIS_URL CLUSTER NODES | grep fail

# 2. If master failed, promote replica
redis-cli -u $REDIS_URL CLUSTER FAILOVER

# 3. If cluster is split-brain, fix slots
redis-cli -u $REDIS_URL CLUSTER FIX
```

---

## Recovery Order

When multiple systems fail, recover in this order:

1. **Database** - Core data persistence
2. **Redis** - Sessions and cache
3. **Express** - API server
4. **Mesh Relay** - Real-time communication
5. **Anchor Worker** - Blockchain operations

## Postmortem Template

After any SEV-1 or SEV-2 incident:

```markdown
## Incident Summary
- **Date:** YYYY-MM-DD
- **Duration:** X hours Y minutes
- **Severity:** SEV-X
- **Impact:** [Description of user impact]

## Timeline
- HH:MM - Issue detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Service restored

## Root Cause
[Technical explanation]

## Resolution
[What was done to fix it]

## Action Items
- [ ] [Preventive measure 1]
- [ ] [Monitoring improvement]
- [ ] [Documentation update]

## Lessons Learned
[What we learned from this incident]
```

## Monitoring Alerts

Configure alerts for early detection:

```yaml
alerts:
  - name: session_auth_failure_rate
    condition: error_rate > 5%
    severity: SEV-2
    
  - name: mesh_peer_count_low
    condition: peer_count < 10
    severity: SEV-3
    
  - name: anchor_queue_backup
    condition: queue_depth > 1000
    severity: SEV-2
    
  - name: database_connection_high
    condition: active_connections > 80%
    severity: SEV-3
    
  - name: redis_memory_high
    condition: used_memory > 90%
    severity: SEV-2
```
