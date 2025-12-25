# Privacy-Preserving Analytics

GDPR-compliant analytics module using **Differential Privacy (DP)** and **k-anonymity** to protect user privacy while enabling meaningful data insights.

## Overview

This module provides privacy-preserving analytics functions that add calibrated noise to aggregate statistics, ensuring individual user data cannot be extracted from published results.

## Key Concepts

### Differential Privacy (DP)

Differential privacy provides mathematical guarantees that the presence or absence of any single individual's data doesn't significantly affect the output of a query. This is achieved by adding carefully calibrated random noise to query results.

**Key principle**: An observer cannot determine whether any specific individual's data was included in the dataset, even if they have access to all other information.

### k-Anonymity

k-anonymity ensures that each record is indistinguishable from at least k-1 other records. In this module, we suppress statistics for event types with fewer than k occurrences.

**Key principle**: Groups must have at least k members before their statistics are published, preventing identification of individuals in small groups.

### Laplace Mechanism

The Laplace mechanism adds noise drawn from a Laplace distribution to numerical results. The amount of noise is calibrated using the **epsilon (ε)** privacy parameter.

## API Reference

### `dpCount(rawCount: number, epsilon = 1.0): number`

Adds differential privacy noise to a count value.

**Parameters:**
- `rawCount`: The true count value
- `epsilon`: Privacy budget (default: 1.0). Lower values = more privacy, less accuracy

**Returns:** Noisy count (always ≥ 0)

**Example:**
```typescript
import { dpCount } from './services/analytics';

const trueCount = 100;
const noisyCount = dpCount(trueCount, 1.0);
console.log(noisyCount); // ~100 ± noise
```

### `aggregate(events: Event[], k = 50, epsilon = 1.0): Record<string, number>`

Aggregates events by type with k-anonymity and differential privacy.

**Parameters:**
- `events`: Array of events to aggregate
- `k`: Minimum group size for k-anonymity (default: 50)
- `epsilon`: Privacy budget (default: 1.0)

**Returns:** Object mapping event types to noisy counts (only for types with ≥ k occurrences)

**Example:**
```typescript
import { aggregate } from './services/analytics';

const events = [
  { type: 'login', ts: Date.now(), hashedUserId: 'hash1' },
  { type: 'login', ts: Date.now(), hashedUserId: 'hash2' },
  // ... more events
];

const stats = aggregate(events, 50, 1.0);
console.log(stats); // { 'login': 102, 'logout': 95 } (if counts ≥ 50)
```

### `analyzeUserBehavior(events: Event[], epsilon = 0.5)`

Analyzes temporal patterns in user behavior with privacy preservation.

**Parameters:**
- `events`: Array of events to analyze
- `epsilon`: Privacy budget (default: 0.5)

**Returns:** Object containing:
  - `totalEvents`: Noisy total event count
  - `peakHour`: Hour with most activity (0-23)
  - `averageEventsPerHour`: Noisy average events per hour

**Example:**
```typescript
import { analyzeUserBehavior } from './services/analytics';

const events = [...]; // Your events
const analysis = analyzeUserBehavior(events, 0.5);
console.log(analysis);
// {
//   totalEvents: 1203,
//   peakHour: 14,
//   averageEventsPerHour: 50
// }
```

## Epsilon (ε) Tuning Guide

The **epsilon** parameter controls the privacy-accuracy tradeoff:

| Epsilon | Privacy Level | Use Case | Noise Level |
|---------|---------------|----------|-------------|
| 0.1 | Very High | Highly sensitive data (health, financial) | Very High |
| 0.5 | High | Personal behavior, preferences | High |
| 1.0 | Moderate | General usage analytics | Moderate |
| 2.0 | Low | Public-facing metrics | Low |
| 5.0+ | Minimal | Non-sensitive aggregate stats | Minimal |

### Choosing Epsilon

1. **Start conservative**: Begin with ε = 0.5 or 1.0
2. **Consider sensitivity**: Lower epsilon for more sensitive data
3. **Balance utility**: If results are too noisy, gradually increase epsilon
4. **Composition**: Multiple queries consume privacy budget additively

### Privacy Budget Composition

If you perform multiple queries on the same dataset:
- Total privacy loss = ε₁ + ε₂ + ... + εₙ
- Budget carefully: If you have ε_total = 1.0 and need 5 queries, use ε = 0.2 per query

## Configuration

Enable/disable privacy analytics via environment variable:

```bash
ENABLE_PRIVACY_ANALYTICS=true  # Default: enabled (false disables)
```

When disabled, functions return raw counts without noise or k-anonymity filtering (useful for testing).

## GDPR Compliance

This module helps achieve GDPR compliance through:

1. **Data Minimization**: Only aggregate statistics are computed
2. **Privacy by Design**: DP ensures individual data cannot be extracted
3. **Anonymization**: k-anonymity prevents re-identification
4. **Transparency**: Clear documentation of privacy parameters

## Best Practices

1. **Hash User IDs**: Always use hashed/pseudonymized user identifiers
2. **Set Appropriate k**: Use k ≥ 50 for general analytics, k ≥ 100 for sensitive data
3. **Monitor Privacy Budget**: Track cumulative epsilon across queries
4. **Document Parameters**: Log epsilon and k values used for each analysis
5. **Regular Audits**: Periodically review privacy parameter choices

## Example Integration

```typescript
import { aggregate, analyzeUserBehavior } from './services/analytics';

// Collect events
const events = await collectEvents();

// Get privacy-preserving event type distribution
const eventStats = aggregate(events, 50, 1.0);

// Analyze temporal patterns
const behaviorAnalysis = analyzeUserBehavior(events, 0.5);

// Publish results safely
console.log('Event Distribution (k≥50):', eventStats);
console.log('Behavior Analysis:', behaviorAnalysis);
```

## References

- [Differential Privacy (Dwork et al.)](https://www.microsoft.com/en-us/research/publication/differential-privacy/)
- [k-Anonymity (Sweeney)](https://dataprivacylab.org/dataprivacy/projects/kanonymity/paper3.pdf)
- [GDPR Article 25: Data Protection by Design](https://gdpr-info.eu/art-25-gdpr/)

## Security Considerations

- **Do not** use epsilon < 0.1 (theoretical guarantees may not hold in practice)
- **Do not** publish results from queries with k < 3 (trivial to de-anonymize)
- **Do** use cryptographically secure hashing for user IDs
- **Do** implement rate limiting on analytics queries
- **Do** audit and log all analytics queries for compliance
