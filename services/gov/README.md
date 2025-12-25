# Programmable Governance Module

Modular policy engine for flexible governance supporting multiple policy types.

## Features

- **Multisig**: Multi-signature approval mechanism
- **Timelock**: Time-delayed execution for proposals
- **Quadratic**: Quadratic voting for fairer representation
- **Role-Weighted**: Role-based weighted voting system

## Installation

```bash
npm install
npm run build
```

## Usage

### Basic Setup

```typescript
import { PolicyRegistry, validateProposal, tallyVotes } from "gov";
import { PolicyConfig } from "gov/policy";

const registry = new PolicyRegistry();
```

### Policy Type Examples

#### 1. Multisig Policy

```typescript
const multisigPolicy: PolicyConfig = {
  id: "multisig-treasury",
  type: "multisig",
  params: {
    threshold: 3,
    signers: ["0x123...", "0x456...", "0x789..."]
  }
};

registry.register(multisigPolicy);
```

#### 2. Timelock Policy

```typescript
const timelockPolicy: PolicyConfig = {
  id: "timelock-upgrade",
  type: "timelock",
  params: {
    delay: 172800, // 48 hours in seconds
    minDelay: 86400, // 24 hours minimum
    gracePeriod: 604800 // 7 days grace period
  }
};

registry.register(timelockPolicy);
```

#### 3. Quadratic Voting Policy

```typescript
const quadraticPolicy: PolicyConfig = {
  id: "quadratic-community",
  type: "quadratic",
  params: {
    threshold: 100, // Required quadratic vote total
    votingPeriod: 259200 // 3 days in seconds
  }
};

registry.register(quadraticPolicy);
```

#### 4. Role-Weighted Policy

```typescript
const roleWeightedPolicy: PolicyConfig = {
  id: "roleweighted-council",
  type: "roleweighted",
  params: {
    threshold: 50, // Percentage threshold
    weights: {
      "admin": 10,
      "moderator": 5,
      "member": 1
    }
  },
  roles: ["admin", "moderator", "member"]
};

registry.register(roleWeightedPolicy);
```

### Validating Proposals

```typescript
const isValid = validateProposal(
  "0xProposerAddress",
  quadraticPolicy
);

if (isValid) {
  console.log("Proposal is valid");
}
```

### Tallying Votes

```typescript
const votes = [
  { voter: "0x123...", weight: 10 },
  { voter: "0x456...", weight: 5 },
  { voter: "0x789...", weight: 8 }
];

const result = tallyVotes(votes, quadraticPolicy);
console.log(`Passed: ${result.passed}, Total: ${result.total}`);
```

## Creating a Proposal

```typescript
import { Proposal } from "gov";

const proposal: Proposal = {
  id: "prop-001",
  actions: [
    {
      target: "0xContractAddress",
      value: 0,
      signature: "execute(address,uint256)",
      data: "0x..."
    }
  ],
  createdBy: "0xCreatorAddress",
  policyId: "quadratic-community",
  start: Date.now() / 1000,
  end: Date.now() / 1000 + 259200 // 3 days
};
```

## Environment Configuration

Enable/disable programmable governance in your `.env` file:

```bash
ENABLE_PROGRAMMABLE_GOV=true  # Modular governance policies
```

When disabled, the module will:
- Skip policy registration
- Always return `true` for validation
- Return minimal tally results

## Policy Registry Methods

- `register(cfg: PolicyConfig)` - Register a new policy
- `get(id: string)` - Retrieve a policy by ID
- `list()` - Get all registered policies

## API Reference

### Types

- `PolicyConfig` - Policy configuration schema
- `Proposal` - Proposal structure

### Functions

- `validateProposal(proposer: string, cfg: PolicyConfig): boolean` - Validate a proposal against policy rules
- `tallyVotes(votes: any[], cfg: PolicyConfig)` - Tally votes according to policy type

## License

Apache-2.0
