# Key Rotation Runbook

Procedures for rotating secrets, API keys, and cryptographic keys in P3 Protocol.

## Key Inventory

### Server-Side Secrets

| Key | Location | Rotation Cadence | Impact if Leaked |
|-----|----------|------------------|------------------|
| `SESSION_SECRET` | Environment | 90 days | Session hijacking |
| `WEBHOOK_ENCRYPTION_KEY` | Environment | 90 days | Webhook tampering |
| `DATABASE_URL` | Environment | On compromise | Full data access |
| `REDIS_URL` | Environment | On compromise | Cache poisoning |

### API Keys (Third-Party)

| Key | Service | Rotation Cadence | Fallback |
|-----|---------|------------------|----------|
| `MORALIS_API_KEY` | Moralis | 180 days | Rate-limited mode |
| `ALCHEMY_API_KEY` | Alchemy | 180 days | Public RPC |
| `COINGECKO_API_KEY` | CoinGecko | 180 days | Cached data |

### Client-Side Keys

| Key | Location | Rotation Cadence | Notes |
|-----|----------|------------------|-------|
| `VITE_P3_WALLETCONNECT_PROJECT_ID` | Environment | Yearly | WalletConnect project |
| `VITE_VAPID_PUBLIC_KEY` | Environment | On compromise | Push notifications |
| `VITE_TURN_*` | Environment | 90 days | WebRTC TURN servers |

### Wallet Keys

| Wallet | Purpose | Storage | Rotation |
|--------|---------|---------|----------|
| Bridge Wallet | Treasury operations | Cold storage | Never (transfer funds) |
| Anchor Wallet | Receipt signing | HSM/Vault | Yearly |
| Operator Wallet | Gas fees | Hot wallet | On compromise |

## Rotation Procedures

### 1. Session Secret Rotation

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -hex 32)

# 2. Update environment (zero-downtime)
# Add both old and new secrets temporarily
export SESSION_SECRET_OLD=$SESSION_SECRET
export SESSION_SECRET=$NEW_SECRET

# 3. Deploy with dual-secret support
# Sessions signed with old secret remain valid during transition

# 4. After 24 hours, remove old secret
unset SESSION_SECRET_OLD
```

**Code Reference:** `server/routes/gamedeck.ts:3268`

### 2. Webhook Encryption Key Rotation

```bash
# 1. Generate new key
NEW_KEY=$(openssl rand -hex 32)

# 2. Notify webhook consumers of pending rotation
# 3. Update environment
export WEBHOOK_ENCRYPTION_KEY=$NEW_KEY

# 4. Restart services (adapt to your process manager)
npm run dev  # or your production restart command
```

**Code Reference:** `server/services-routes.ts:76`

### 3. API Key Rotation

```bash
# For each third-party service:
# 1. Generate new key in provider dashboard
# 2. Update environment variable
# 3. Verify connectivity
curl -H "X-API-Key: $NEW_KEY" https://api.moralis.io/health

# 4. Revoke old key in provider dashboard
```

### 4. TURN Server Credentials

```bash
# 1. Update TURN server configuration
# 2. Update client environment variables
export VITE_TURN_US="new_credential"
export VITE_TURN_EU="new_credential"
export VITE_TURN_AP="new_credential"

# 3. Rebuild frontend
npm run build

# 4. Deploy new frontend bundle
```

**Code Reference:** `client/src/lib/media/rtcConfig.ts`

### 5. Wallet Key Rotation

> ⚠️ **CRITICAL**: Wallet private keys should never be rotated. Instead, transfer funds to a new wallet.

```bash
# 1. Generate new wallet
# 2. Transfer all funds from old wallet
# 3. Update all references to new wallet address
# 4. Revoke old wallet permissions in smart contracts
# 5. Update VITE_ADMIN_WALLETS if applicable
```

## Emergency Rotation

If a key is compromised:

```bash
# 1. Immediately rotate the compromised key
# 2. Audit access logs for unauthorized usage
# 3. Revoke old key/sessions
# 4. Notify affected users if necessary
# 5. Document incident in postmortem
```

### Redis Session Flush (Nuclear Option)

```bash
# Invalidate ALL sessions (use only if session secret is compromised)
redis-cli FLUSHDB
```

## Automation Scripts

### Scheduled Rotation Check

```bash
#!/bin/bash
# Add to cron: 0 9 1 * * /path/to/rotation-check.sh

ROTATION_THRESHOLD_DAYS=90

check_key_age() {
  local key_name=$1
  local last_rotated=$2
  local age_days=$(( ($(date +%s) - $(date -d "$last_rotated" +%s)) / 86400 ))
  
  if [ $age_days -gt $ROTATION_THRESHOLD_DAYS ]; then
    echo "WARNING: $key_name is $age_days days old (threshold: $ROTATION_THRESHOLD_DAYS)"
  fi
}

# Check each key against rotation log
check_key_age "SESSION_SECRET" "2024-01-15"
check_key_age "WEBHOOK_ENCRYPTION_KEY" "2024-02-01"
```

## Rotation Log Template

Maintain a rotation log for audit purposes:

```yaml
rotations:
  - key: SESSION_SECRET
    rotated_at: "2024-01-15T10:00:00Z"
    rotated_by: "ops@example.com"
    reason: "Scheduled rotation"
    verified: true
    
  - key: MORALIS_API_KEY
    rotated_at: "2024-02-01T14:30:00Z"
    rotated_by: "ops@example.com"
    reason: "Suspected exposure in logs"
    verified: true
    incident_id: "INC-2024-042"
```

## Verification Checklist

After any rotation:

- [ ] New key is deployed to all environments
- [ ] Old key is revoked/deleted
- [ ] Services are healthy (check `/health`)
- [ ] No authentication errors in logs
- [ ] Rotation logged in audit trail
- [ ] Team notified of rotation
