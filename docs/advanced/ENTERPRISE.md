# Enterprise Controls - Advanced Systems

This guide documents P3 Protocol's enterprise-grade features including tenant sandboxing, SSO integration, and multi-tenant zone management.

## Tenant Sandbox

The sandbox system isolates development/testing environments from production, preventing accidental mainnet operations.

### Architecture

**Code Reference:** `server/middleware/tenant-sandbox.ts`

```typescript
const TESTNET_CHAINS = ['sepolia', 'goerli', 'base-sepolia', 'mumbai', 'amoy'];
const SETTLEMENT_PATHS = [
  '/api/protocol/settlement',
  '/api/payments/transfer',
  '/api/anchor/batch'
];
```

### Middleware Stack

```typescript
// Load tenant policy from database
app.use(loadTenantPolicy);

// Inject sandbox headers for client awareness
app.use(injectSandboxHeaders);

// Block mainnet operations when in sandbox mode
app.use(blockSettlementInSandbox);
```

### Response Headers

When sandbox mode is active:

```
X-P3-Sandbox: true
X-P3-Sandbox-Chain: sepolia
```

### Sandbox Enforcement

Attempting mainnet operations in sandbox mode returns:

```json
{
  "error": "Settlement operations blocked in sandbox mode",
  "code": "SANDBOX_SETTLEMENT_BLOCKED",
  "sandboxChain": "sepolia",
  "allowedChains": ["sepolia", "goerli", "base-sepolia", "mumbai", "amoy"],
  "tip": "Pass chain=sepolia to use sandbox settlement on testnet"
}
```

### Managing Sandbox Mode

```typescript
import { createTenantPolicy, getTenantPolicy } from './middleware/tenant-sandbox';

// Enable sandbox for a tenant
await createTenantPolicy('tenant-123', true, 'sepolia');

// Check tenant sandbox status
const policy = await getTenantPolicy('tenant-123');
console.log(policy.sandbox); // true
console.log(policy.sandboxChain); // 'sepolia'

// Disable sandbox (enable production)
await createTenantPolicy('tenant-123', false);
```

### Use Cases

1. **Developer Testing**: Build without risking real funds
2. **CI/CD Pipelines**: Automated tests against sandbox
3. **Demo Environments**: Sales demos without mainnet exposure
4. **Compliance Testing**: Verify behavior before production

---

## SSO Integration

P3 Protocol supports enterprise Single Sign-On via OIDC and SAML.

### Architecture

**Code Reference:** `server/routes/enterprise/sso.ts`

The SSO system links corporate identities to P3 wallet addresses, enabling organizations to use existing identity providers while maintaining wallet-based authentication.

### Database Schema

```sql
-- SSO Providers (per-tenant configuration)
CREATE TABLE sso_providers (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  type TEXT CHECK (type IN ('oidc', 'saml')),
  issuer TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT,
  callback_url TEXT,
  metadata_url TEXT,
  active BOOLEAN DEFAULT TRUE
);

-- SSO Identities (linked accounts)
CREATE TABLE sso_identities (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  subject TEXT NOT NULL,
  wallet TEXT NOT NULL,
  roles JSONB DEFAULT '{"default": ["user"]}'
);
```

### API Endpoints

```bash
# List SSO providers for tenant
GET /api/enterprise/sso/providers?tenantId=xxx

# Create SSO provider (admin only)
POST /api/enterprise/sso/providers
{
  "tenantId": "org-123",
  "type": "oidc",
  "issuer": "https://login.microsoftonline.com/xxx",
  "clientId": "app-client-id",
  "callbackUrl": "https://app.p3protocol.com/sso/callback"
}

# Initiate SSO login
GET /api/enterprise/sso/login/:providerId
# Returns redirect URL for IdP

# Handle SSO callback
POST /api/enterprise/sso/callback
{
  "code": "auth-code",
  "state": "state-value",
  "providerId": "provider-id",
  "wallet": "0x..."
}

# List linked identities
GET /api/enterprise/sso/identities?tenantId=xxx

# Unlink identity (admin only)
DELETE /api/enterprise/sso/identities/:id
```

### OIDC Flow

```
1. User clicks "Login with Corporate SSO"
2. GET /api/enterprise/sso/login/:providerId
   → Returns { redirectUrl, state, nonce }
3. User redirected to IdP (Azure AD, Okta, etc.)
4. IdP authenticates user
5. IdP redirects to callback with code
6. POST /api/enterprise/sso/callback
   → Links SSO subject to wallet address
7. User has both SSO identity and wallet
```

### SAML Support

SAML providers are configured with:
- `metadataUrl`: IdP metadata XML location
- SP-initiated flow supported

```json
{
  "message": "SAML SSO stub - redirect to IdP",
  "metadataUrl": "https://idp.example.com/metadata.xml",
  "state": "random-state",
  "hint": "Implement SAML request generation for production"
}
```

### Role Mapping

SSO identities include role assignments:

```json
{
  "roles": {
    "default": ["user"],
    "org-123": ["admin", "billing"],
    "project-456": ["editor"]
  }
}
```

---

## Multi-Tenant Zones

P3 Protocol supports isolated tenant environments with customizable policies.

### Architecture

**Code Reference:** `server/routes/tenancy.ts`, `server/routes/policy.ts`

```sql
-- Tenant policies
CREATE TABLE tenant_policies (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  sandbox BOOLEAN DEFAULT FALSE,
  sandbox_chain TEXT,
  rate_limit_rpm INTEGER DEFAULT 1000,
  max_sessions INTEGER DEFAULT 100,
  allowed_features JSONB
);
```

### Policy Configuration

```typescript
interface TenantPolicy {
  tenantId: string;
  sandbox: boolean;           // Sandbox mode enabled
  sandboxChain?: string;      // Which testnet to use
  rateLimitRpm?: number;      // Requests per minute
  maxSessions?: number;       // Concurrent session limit
  allowedFeatures?: string[]; // Feature flags
}
```

### Tenant Isolation

Each tenant operates in isolation:

```
Tenant A (Production)
├── mainnet settlement enabled
├── production database schema
└── full feature access

Tenant B (Sandbox)
├── testnet only
├── isolated test data
└── limited features

Tenant C (Enterprise)
├── dedicated resources
├── SSO integration
└── custom rate limits
```

### API Key Tenancy

API keys are scoped to tenants:

```typescript
interface ApiKey {
  tenantId: string;      // Tenant scope
  keyId: string;         // Unique key identifier
  walletOwner: string;   // Key owner's wallet
  tier?: number;         // Rate limit tier
  quotaMonthly: number;  // Monthly request quota
}
```

### Cross-Tenant Access

By default, tenants cannot access each other's data. Guardian mode enables controlled cross-tenant operations for enterprise federations.

### Compliance Features

1. **Data Residency**: Configure per-tenant data storage regions
2. **Audit Logging**: All cross-tenant operations logged
3. **Retention Policies**: Per-tenant data retention rules
4. **Export Controls**: Per-tenant data export restrictions
