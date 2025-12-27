# P3 Protocol Operations Guide

Production runbooks for operators deploying their own P3 Protocol instances.

## Quick Links

| Runbook | Purpose | Priority |
|---------|---------|----------|
| [Key Rotation](./KEY_ROTATION.md) | Rotate secrets, tokens, wallet keys | Critical |
| [Failure Recovery](./FAILURE_RECOVERY.md) | Diagnose and recover from outages | Critical |
| [Bridge Wallet Management](./BRIDGE_WALLET_MANAGEMENT.md) | Manage treasury and signing wallets | High |
| [Deployment Automation](./DEPLOYMENT_AUTOMATION.md) | CI/CD, environments, infrastructure | High |

## Environment Matrix

| Environment | Purpose | Database | Redis | Blockchain |
|-------------|---------|----------|-------|------------|
| Development | Local testing | SQLite/PostgreSQL | Local | Testnet |
| Staging | Pre-production validation | PostgreSQL | Cluster | Testnet |
| Production | Live users | PostgreSQL HA | Cluster | Mainnet |

## Critical Paths

These systems require immediate attention if they fail:

```
Session Bridge → User authentication
    ↓
Mesh Relay → Real-time communication
    ↓
Receipt Anchor → Blockchain audit trails
    ↓
Bridge Wallet → Treasury operations
```

## Monitoring Checklist

Before deploying, ensure monitoring covers:

- [ ] Session bridge authentication success rate
- [ ] Mesh node connectivity (peer count, latency)
- [ ] Anchor queue depth and processing time
- [ ] Redis cluster health
- [ ] Wallet balance thresholds
- [ ] API response times (p50, p95, p99)

## Emergency Contacts Template

```yaml
incident_response:
  primary_oncall: "[Your oncall rotation]"
  escalation_path:
    - L1: Platform team
    - L2: Security team
    - L3: Leadership
  communication_channel: "[Slack/Discord channel]"
```

## Related Documentation

- [API Reference](../API.md) - Endpoint specifications
- [Mesh Network](../MESH_NETWORK.md) - P2P architecture
- [Integration Guide](../INTEGRATION_GUIDE.md) - Third-party services
- [AI Development Guide](../AI_DEVELOPMENT_GUIDE.md) - Code modification patterns
