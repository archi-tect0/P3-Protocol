# Self-Healing Automation - Advanced Systems

This guide documents P3 Protocol's automated systems for mesh resilience, including the rules engine and immutable audit sequences.

## Rules Engine

The rules engine enables condition-action automation for self-healing mesh behavior.

### Architecture

**Code Reference:** `server/rules/engine.ts`, `server/rules/actions.ts`

```typescript
// Condition operators
type ConditionOperator =
  | 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte'
  | 'in' | 'nin' | 'contains' | 'not_contains'
  | 'matches' | 'not_matches' | 'exists' | 'not_exists';

// Condition structure
interface Condition {
  field?: string;
  operator: ConditionOperator;
  value?: any;
  conditions?: Condition[];  // Nested for AND/OR
  logic?: 'and' | 'or';
}
```

### Action Types

Four action types are supported:

```typescript
// 1. Anchor - Hash to blockchain
{ type: 'anchor', eventHash: '...', metadata: '...' }

// 2. Webhook - HTTP POST to external URL
{ type: 'webhook', url: 'https://...', payload: {...}, encryption: { enabled: true } }

// 3. Plugin Emit - Trigger plugin event
{ type: 'plugin_emit', pluginId: 'my-plugin', eventType: 'alert', payload: {...} }

// 4. Ledger Allocate - Split payment across buckets
{ type: 'ledger_allocate', ledgerEventId: '...', allocations: [...] }
```

### Creating Rules

```typescript
import { RuleEngine, createRuleEngine } from './rules/engine';

const engine = createRuleEngine({
  storage,
  pluginRegistry,
  pluginRuntime,
});

// Example rule: Alert on high latency
const rule = {
  id: 'lane-latency-alert',
  name: 'Lane Latency Alert',
  status: 'active',
  priority: 100,
  condition: {
    logic: 'and',
    conditions: [
      { field: 'lane', operator: 'eq', value: 1 },
      { field: 'latencyMs', operator: 'gt', value: 100 }
    ]
  },
  action: {
    type: 'webhook',
    url: 'https://alerts.example.com/webhook',
    payload: { alert: 'High latency on Lane 1' }
  }
};
```

### Evaluating Events

```typescript
// Single rule evaluation
const result = await engine.evaluateRule(rule, event);

// Evaluate all active rules against an event
const results = await engine.evaluateAllRules(event);

// Results include:
{
  matched: true,
  ruleId: 'lane-latency-alert',
  ruleName: 'Lane Latency Alert',
  executed: true,
  actionResults: [{ success: true, result: {...} }],
  duration: 15 // ms
}
```

### Dry Run Mode

Test rules without executing actions:

```typescript
// Dry run - conditions evaluated, actions simulated
const result = await engine.evaluateRule(rule, event, true /* dryRun */);

// Action result shows simulation
{
  success: true,
  result: {
    simulated: true,
    url: 'https://alerts.example.com/webhook',
    payload: {...}
  },
  metadata: { action: 'webhook', dryRun: true }
}
```

### Condition Validation

Validate rule conditions before saving:

```typescript
const validation = engine.validateCondition(condition);

if (!validation.valid) {
  console.log('Errors:', validation.errors);
  // ["Operator gt requires a value", "Sub-condition 0: field required"]
}
```

### Self-Healing Patterns

These examples show how to configure rules for automated mesh responses. Webhook URLs should point to your own endpoints or external services.

**Pattern 1: Latency Alert with External Webhook**
```json
{
  "condition": {
    "logic": "and",
    "conditions": [
      { "field": "lane", "operator": "eq", "value": 1 },
      { "field": "latencyMs", "operator": "gt", "value": 100 }
    ]
  },
  "action": {
    "type": "webhook",
    "url": "https://your-service.com/alerts/latency",
    "payload": { "lane": 1, "reason": "high_latency" }
  }
}
```

**Pattern 2: Bandwidth Degradation Alert**
```json
{
  "condition": {
    "logic": "and",
    "conditions": [
      { "field": "streamType", "operator": "eq", "value": "4K" },
      { "field": "bandwidthMbps", "operator": "lt", "value": 25 }
    ]
  },
  "action": {
    "type": "plugin_emit",
    "pluginId": "quality-monitor",
    "eventType": "degrade",
    "payload": { "suggestedQuality": "1080p" }
  }
}
```

**Pattern 3: Fraud Detection**
```json
{
  "condition": {
    "logic": "and",
    "conditions": [
      { "field": "eventType", "operator": "eq", "value": "login" },
      { "field": "failedAttempts", "operator": "gte", "value": 5 }
    ]
  },
  "action": [
    { "type": "webhook", "url": "/api/security/lockout", "payload": {} },
    { "type": "anchor", "eventHash": "{{event}}", "metadata": "lockout" }
  ]
}
```

---

## Immutable Audit Sequences

P3 Protocol uses PostgreSQL sequences to create tamper-evident audit trails.

### Architecture

**Code Reference:** `server/migrations/001_init.sql`, `server/migrations/003_app_schema.sql`

```sql
-- Receipts immutable sequence
CREATE SEQUENCE IF NOT EXISTS receipts_immutable_seq START 1;

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY,
  -- ... other columns ...
  immutable_seq INTEGER NOT NULL UNIQUE DEFAULT nextval('receipts_immutable_seq')
);

-- Ledger events immutable sequence
CREATE SEQUENCE IF NOT EXISTS ledger_events_immutable_seq START 1;

CREATE TABLE IF NOT EXISTS ledger_events (
  id UUID PRIMARY KEY,
  -- ... other columns ...
  immutable_seq INTEGER NOT NULL UNIQUE DEFAULT nextval('ledger_events_immutable_seq')
);

-- Call sessions immutable sequence
CREATE SEQUENCE IF NOT EXISTS call_sessions_immutable_seq START 1;

CREATE TABLE IF NOT EXISTS call_sessions (
  id UUID PRIMARY KEY,
  -- ... other columns ...
  immutable_seq INTEGER NOT NULL UNIQUE DEFAULT nextval('call_sessions_immutable_seq')
);
```

### Tamper Detection

Each record gets a strictly incrementing, unique integer. Gaps in the sequence indicate tampering:

```sql
-- Detect missing sequence numbers (tampering)
SELECT
  immutable_seq,
  immutable_seq - LAG(immutable_seq) OVER (ORDER BY immutable_seq) AS gap
FROM receipts
WHERE immutable_seq - LAG(immutable_seq) OVER (ORDER BY immutable_seq) > 1;
```

### Integrity Verification

```typescript
async function verifyAuditIntegrity(tableName: string): Promise<{
  valid: boolean;
  gaps: number[];
  lastSeq: number;
}> {
  const result = await db.execute(sql`
    WITH gaps AS (
      SELECT
        immutable_seq,
        immutable_seq - LAG(immutable_seq) OVER (ORDER BY immutable_seq) AS gap
      FROM ${sql.identifier(tableName)}
    )
    SELECT immutable_seq, gap FROM gaps WHERE gap > 1
  `);

  const lastSeq = await db.execute(sql`
    SELECT MAX(immutable_seq) as max_seq FROM ${sql.identifier(tableName)}
  `);

  return {
    valid: result.rows.length === 0,
    gaps: result.rows.map(r => r.immutable_seq),
    lastSeq: lastSeq.rows[0].max_seq
  };
}
```

### Use Cases

1. **Financial Audits**: Prove no transactions were deleted
2. **Compliance**: Demonstrate complete call records
3. **Legal Discovery**: Verify receipt chain integrity
4. **Forensics**: Detect unauthorized database access

### Protection Guarantees

- **Deletion Detection**: Any deleted row creates a gap
- **Insertion Integrity**: Sequence always increases
- **Replication Safe**: Works across database replicas
- **No Rollback**: Sequences never decrement

### Combining with Blockchain Anchoring

For maximum assurance, combine immutable sequences with blockchain anchoring:

```typescript
// Periodically anchor sequence checkpoints
async function anchorSequenceCheckpoint(tableName: string) {
  const { lastSeq } = await verifyAuditIntegrity(tableName);
  
  await anchorToBlockchain(
    createHash('sha256')
      .update(`${tableName}:${lastSeq}:${Date.now()}`)
      .digest('hex'),
    'sequence_checkpoint',
    true
  );
}
```

This creates an on-chain record of sequence state, making retroactive tampering cryptographically detectable.
