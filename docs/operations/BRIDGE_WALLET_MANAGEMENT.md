# Bridge Wallet Management Runbook

Procedures for managing treasury, signing, and operational wallets in P3 Protocol.

## Wallet Inventory

| Wallet | Purpose | Type | Access Level |
|--------|---------|------|--------------|
| Treasury (P3Treasury) | Fee collection & payouts | Contract | Owner-controlled |
| Router Wallets | Cross-chain settlements | Authorized | Per-router |
| API Wallets | Direct settlements | Authorized | Per-wallet |
| Operator | Gas fees for transactions | Hot (server) | Automated |

> **Note:** The current P3Treasury contract uses single-owner access control via OpenZeppelin's `Ownable`. For production deployments requiring multi-sig, deploy behind a Gnosis Safe or similar.

## Access Control

### Admin Wallet Configuration

Admin and moderator wallets for the Atlas UI are configured via environment variables:

```bash
# Comma-separated wallet addresses (lowercase)
VITE_ADMIN_WALLETS="0xabc...123,0xdef...456"
VITE_MOD_WALLETS="0x111...aaa,0x222...bbb"
```

**Code Reference:** `client/src/pages/atlas/AtlasShell.tsx:268-269`

### P3Treasury Contract Roles

| Role | Function | Who Can Set |
|------|----------|-------------|
| Owner | Full control, payouts, role management | Deployer (transfer with `transferOwnership`) |
| Router | Can call `settleFeeUSDC`, `settleFeeNative`, `recordExternalUSDC` | Owner via `setRouter()` |
| API Wallet | Can call `settleFeeUSDC`, `settleFeeNative` | Owner via `setApiWallet()` |
| Payout Recipient | Receives funds from `payout()` | Owner via `setPayoutRecipient()` |

**Code Reference:** `contracts/P3Treasury.sol`

## Wallet Setup

### 1. P3Treasury Contract Deployment

```bash
# Deploy P3Treasury using Hardhat
# Create your deployment script or use Hardhat console:
npx hardhat console --network base

# In console:
const Treasury = await ethers.getContractFactory("P3Treasury");
const treasury = await Treasury.deploy(
  "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  "0xYourPayoutRecipient"
);
await treasury.waitForDeployment();
console.log("Treasury deployed to:", await treasury.getAddress());
```

> **TODO:** Create `scripts/deploy-treasury.ts` deployment script for automated deployments.

### 2. Authorize Routers and API Wallets

```bash
# Using cast (foundry)
cast send $TREASURY_CONTRACT "setRouter(address,bool)" $ROUTER_ADDRESS true \
  --private-key $OWNER_KEY --rpc-url $RPC_URL

cast send $TREASURY_CONTRACT "setApiWallet(address,bool)" $API_WALLET true \
  --private-key $OWNER_KEY --rpc-url $RPC_URL
```

**Code Reference:** `contracts/P3Treasury.sol:166-180`

### 3. Operator Wallet

```bash
# Generate dedicated wallet for gas fees
# Fund with small amounts (0.5-1 ETH)

# Server-side env var
export WALLET_PRIVATE_KEY="..." # Store in secrets manager
# OR
export PRIVATE_KEY="..."
```

**Code Reference:** `server/protocol/settlement.ts:88-94`

> **TODO:** Automatic refill is not currently implemented. Monitor balance manually or implement a keeper bot.

## Balance Monitoring

### Alert Thresholds

```yaml
wallet_alerts:
  anchor_wallet:
    low_balance: 0.1 ETH
    critical_balance: 0.05 ETH
    refill_amount: 0.5 ETH
    
  operator_wallet:
    low_balance: 0.05 ETH
    critical_balance: 0.02 ETH
    refill_amount: 0.2 ETH
    
  treasury:
    large_withdrawal: 10 ETH
    unusual_activity: 5 transactions/hour
```

### Monitoring Script

```bash
#!/bin/bash
# Check wallet balances

check_balance() {
  local wallet=$1
  local threshold=$2
  local balance=$(cast balance $wallet --rpc-url $RPC_URL)
  
  if (( $(echo "$balance < $threshold" | bc -l) )); then
    echo "ALERT: $wallet balance ($balance) below threshold ($threshold)"
    # Send alert to monitoring system
  fi
}

check_balance $ANCHOR_WALLET 0.1
check_balance $OPERATOR_WALLET 0.05
```

## Transaction Approval Workflow

> **Note:** The current P3Treasury uses single-owner control. For multi-sig workflows, deploy the contract behind a Gnosis Safe.

### Current Flow (Single Owner)

```
1. Owner initiates transaction
   ↓
2. Transaction executed immediately
   ↓
3. Event emitted (FeeSettled, Payout, etc.)
   ↓
4. Log in audit trail
```

### Recommended Production Flow (with Gnosis Safe)

```
1. Request submitted via Safe UI
   ↓
2. Required signers approve
   ↓
3. Transaction executed when threshold met
   ↓
4. Confirmation logged
```

## Treasury Operations

### Check Balances

```bash
# ETH balance
cast call $TREASURY_CONTRACT "getBalance()" --rpc-url $RPC_URL

# USDC balance
cast call $TREASURY_CONTRACT "getUsdcBalance()" --rpc-url $RPC_URL

# Any token balance
cast call $TREASURY_CONTRACT "getTokenBalance(address)" $TOKEN_ADDRESS --rpc-url $RPC_URL
```

### Payout Funds

```bash
# Payout ETH (owner only)
cast send $TREASURY_CONTRACT "payout(address,uint256)" \
  0x0000000000000000000000000000000000000000 $AMOUNT_WEI \
  --private-key $OWNER_KEY --rpc-url $RPC_URL

# Payout USDC (owner only)
cast send $TREASURY_CONTRACT "payout(address,uint256)" \
  $USDC_ADDRESS $AMOUNT_USDC \
  --private-key $OWNER_KEY --rpc-url $RPC_URL
```

**Code Reference:** `contracts/P3Treasury.sol:146-159`

### Update Payout Recipient

```bash
cast send $TREASURY_CONTRACT "setPayoutRecipient(address)" $NEW_RECIPIENT \
  --private-key $OWNER_KEY --rpc-url $RPC_URL
```

> **Note:** The current contract does not have pause/unpause functionality. Consider adding via upgrade or wrapper contract for production.

## Security Practices

### Key Storage

| Environment | Storage Method |
|-------------|----------------|
| Development | Environment variables |
| Staging | Secrets manager (encrypted) |
| Production | HSM + secrets manager |

### Access Audit

```bash
# Review wallet access quarterly
# 1. List all addresses with admin privileges
# 2. Verify each address is still authorized
# 3. Revoke access for departed team members
# 4. Update VITE_ADMIN_WALLETS and VITE_MOD_WALLETS
```

### Transaction Logging

All wallet operations should be logged:

```yaml
transaction_log:
  - tx_hash: "0x..."
    wallet: "treasury"
    action: "withdrawal"
    amount: "5 ETH"
    destination: "0x..."
    approved_by: ["0xabc...", "0xdef...", "0x123..."]
    timestamp: "2024-01-15T10:00:00Z"
```

## Recovery Procedures

### Lost Access to Operator Wallet

```bash
# 1. Stop the application (adapt to your process manager)
# Using npm: Ctrl+C or kill the process
# Using PM2 (if configured): pm2 stop p3-server
# Using systemd: systemctl stop p3-server

# 2. Generate new wallet
# 3. Update environment variables (WALLET_PRIVATE_KEY or PRIVATE_KEY)
# 4. Transfer remaining funds from old wallet (if accessible)
# 5. Restart services
npm run dev  # or your production start command
```

> **Note:** Process management commands depend on your deployment setup. Adapt for your environment (PM2, systemd, Docker, etc.).

### Compromised Wallet

**If Router/API Wallet is compromised:**

```bash
# 1. Revoke compromised wallet's router permissions
cast send $TREASURY_CONTRACT "setRouter(address,bool)" $COMPROMISED_ADDRESS false \
  --private-key $OWNER_KEY --rpc-url $RPC_URL

# 2. Revoke API wallet permissions (if applicable)
cast send $TREASURY_CONTRACT "setApiWallet(address,bool)" $COMPROMISED_ADDRESS false \
  --private-key $OWNER_KEY --rpc-url $RPC_URL

# 3. Generate new wallet
# 4. Authorize new wallet
cast send $TREASURY_CONTRACT "setRouter(address,bool)" $NEW_WALLET true \
  --private-key $OWNER_KEY --rpc-url $RPC_URL

# 5. Update server configuration
# 6. Conduct security review
```

**Code Reference:** `contracts/P3Treasury.sol:166-180`

**If Owner Wallet is compromised:**

```bash
# 1. Immediately transfer ownership to secure wallet
cast send $TREASURY_CONTRACT "transferOwnership(address)" $SECURE_WALLET \
  --private-key $OWNER_KEY --rpc-url $RPC_URL

# 2. Revoke all potentially compromised routers/API wallets
# 3. Audit all transactions from compromised period
# 4. Consider redeploying contract if funds were stolen
```

> **Note:** The current P3Treasury uses single-owner control. If the owner key is fully compromised before you can transfer, funds may be at risk.

### Lost Owner Access

If owner private key is lost:

```bash
# No recovery possible with current single-owner design
# Funds in contract are permanently inaccessible
# Redeploy new contract and update all integrations
```

> **Recommendation:** For production, deploy P3Treasury behind a Gnosis Safe multi-sig to prevent single point of failure.

## Checklist: Adding New Router/API Wallet

- [ ] Verify identity of wallet operator
- [ ] Confirm wallet is properly secured
- [ ] Authorize via `setRouter()` or `setApiWallet()`
- [ ] Update documentation
- [ ] Conduct test settlement transaction
- [ ] Add wallet to monitoring alerts
- [ ] Update VITE_ADMIN_WALLETS if UI access needed
