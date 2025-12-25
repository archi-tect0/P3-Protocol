# P3 Protocol Smart Contract Suite

Complete smart contract implementation for the P3 Protocol with DAO governance.

## Overview

This suite provides a comprehensive blockchain infrastructure for the P3 Protocol, including event anchoring, consent management, receipt tracking, and decentralized governance.

## Contracts

### 1. AnchorRegistry.sol
**Event anchoring with bundle support**

- Anchor individual events or bundles of events to the blockchain
- Merkle root-based bundle anchoring for efficiency
- Tracks submitter, timestamp, and metadata for each anchor
- Provides verification functions for anchored events

**Key Functions:**
- `anchorEvent()` - Anchor a single event
- `anchorBundle()` - Anchor a bundle of events using Merkle root
- `verifyAnchor()` - Verify if an anchor exists
- `getAnchor()` - Retrieve anchor details

### 2. ConsentRegistry.sol
**User consent tracking**

- Manage user consents for data processing and sharing
- Support consent expiration
- Grant, revoke, and update consents
- Purpose-based consent tracking using hashes

**Key Functions:**
- `grantConsent()` - Grant consent for a specific purpose
- `revokeConsent()` - Revoke previously granted consent
- `hasValidConsent()` - Check if consent is valid and not expired
- `updateConsentExpiration()` - Update consent expiration time

### 3. ReceiptBoundToken.sol
**Non-transferable NFT receipts (Soulbound)**

- ERC-721 compliant receipt tokens
- Non-transferable (soulbound) - can only be minted and burned
- Links receipts to specific event hashes
- Owner-controlled issuance

**Key Functions:**
- `issueReceipt()` - Issue a receipt to a user
- `getReceipt()` - Get receipt details
- `receiptExists()` - Check if receipt exists for an event
- Transfers are blocked (non-transferable)

### 4. GovernanceToken.sol
**ERC20Votes governance token**

- Standard ERC-20 token with voting capabilities
- Implements ERC20Votes for on-chain governance
- Max supply: 1 billion tokens
- Initial supply: 100 million tokens
- Owner can mint additional tokens up to max supply

**Key Functions:**
- `mint()` - Mint new tokens (owner only)
- `burn()` - Burn tokens
- `delegate()` - Delegate voting power
- `getVotes()` - Get current voting power

### 5. GovernorP3.sol
**OpenZeppelin Governor with timelock**

- Full-featured DAO governance contract
- Integrated timelock for execution delays
- Configurable voting delay, period, and quorum
- Proposal threshold: 100 tokens
- Voting period: 1 week
- Quorum: 4% of total supply

**Features:**
- Proposal creation and voting
- Timelock-controlled execution
- Vote counting (for, against, abstain)
- Quorum requirements

### 6. Treasury.sol
**DAO-controlled treasury**

- Manages protocol funds (ETH and ERC20 tokens)
- Proposal-based withdrawal system
- Accept deposits from anyone
- Owner-controlled proposal creation and execution

**Key Functions:**
- `depositToken()` - Deposit ERC20 tokens
- `createProposal()` - Create withdrawal proposal
- `executeProposal()` - Execute approved proposal
- `getBalance()` - Check ETH balance
- Receive ETH directly via receive()

### 7. TrustPolicyRouter.sol
**Rule-based anchoring constraints**

- Role-based access control for policy management
- Create and manage trust policies
- Validation rules with consent requirements
- Trust score tracking for users
- Policy activation/deactivation

**Key Functions:**
- `createPolicy()` - Create a new trust policy
- `createValidationRule()` - Create validation rules
- `validateUser()` - Validate user against rules
- `updateTrustScore()` - Update user trust scores
- `activatePolicy()` / `deactivatePolicy()` - Manage policies

### 8. ZKReceiptsVerifier.sol
**SNARK proof verification stub**

- Zero-knowledge proof verification (stub implementation)
- Submit and verify cryptographic proofs
- Track proof verification status
- Ready for integration with real ZK proof systems (Groth16, PLONK)

**Key Functions:**
- `submitProof()` - Submit a ZK proof
- `verifyProof()` - Verify submitted proof
- `isProofVerified()` - Check verification status
- `getStats()` - Get verification statistics

**Note:** This is a stub implementation. In production, integrate with actual SNARK verification libraries.

## Deployment

### Prerequisites

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
# Create .env file
PRIVATE_KEY=your_private_key_here
BASE_RPC_URL=https://mainnet.base.org
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
BASESCAN_API_KEY=your_basescan_api_key
```

### Compile Contracts

```bash
npx hardhat compile
```

### Deploy to Base Network

```bash
# Deploy to Base Sepolia testnet
npx hardhat run scripts/deploy.ts --network baseSepolia

# Deploy to Base mainnet
npx hardhat run scripts/deploy.ts --network base
```

The deployment script will:
1. Deploy all contracts in the correct order
2. Configure the Governor and Timelock roles
3. Save deployment addresses to a JSON file

## Testing

Run the test suite:

```bash
# Run all tests
npx hardhat test

# Run specific test file
npx hardhat test test/AnchorRegistry.test.ts

# Run with gas reporting
REPORT_GAS=true npx hardhat test
```

### Test Coverage

- ✅ AnchorRegistry: Event and bundle anchoring
- ✅ ConsentRegistry: Consent management and expiration
- ✅ ReceiptBoundToken: Receipt issuance and non-transferability
- ✅ GovernanceToken: Minting, burning, and voting
- ✅ Treasury: Deposits, proposals, and withdrawals
- ✅ ZKReceiptsVerifier: Proof submission and verification

## Architecture

### Governance Flow

1. **Token Distribution**: GovernanceToken distributed to stakeholders
2. **Delegation**: Token holders delegate voting power
3. **Proposal Creation**: Proposals created in GovernorP3
4. **Voting**: Token holders vote on proposals
5. **Timelock**: Approved proposals queued in Timelock
6. **Execution**: Proposals executed after timelock delay

### Trust & Policy Flow

1. **Consent Registration**: Users grant consents in ConsentRegistry
2. **Policy Creation**: Admins create policies in TrustPolicyRouter
3. **Validation**: System validates users against policies
4. **Trust Scoring**: Validators update user trust scores

### Event Anchoring Flow

1. **Event Creation**: Events created off-chain
2. **Anchoring**: Events anchored via AnchorRegistry
3. **Receipt Issuance**: Receipts issued via ReceiptBoundToken
4. **Verification**: ZK proofs verified via ZKReceiptsVerifier

## Network Configuration

### Base Mainnet
- Chain ID: 8453
- RPC: https://mainnet.base.org
- Explorer: https://basescan.org

### Base Sepolia Testnet
- Chain ID: 84532
- RPC: https://sepolia.base.org
- Explorer: https://sepolia.basescan.org

## Security Considerations

1. **Access Control**: All privileged functions protected by ownership or roles
2. **Reentrancy Protection**: Critical functions use ReentrancyGuard
3. **Input Validation**: All inputs validated before processing
4. **Time-based Security**: Governance includes timelock delays
5. **Non-transferability**: Receipt tokens cannot be transferred

## Technical Specifications

- **Solidity Version**: 0.8.24
- **OpenZeppelin Version**: 5.0+
- **EVM Target**: Cancun
- **License**: Apache-2.0
- **Optimization**: Enabled (200 runs)

## Gas Optimization

All contracts are optimized for gas efficiency:
- Structs packed for storage optimization
- Events used for off-chain data indexing
- Batch operations supported (bundles)
- Minimal storage reads/writes

## Upgradeability

These contracts are **not upgradeable** by design for security and immutability. To upgrade:
1. Deploy new contract versions
2. Create governance proposal to migrate
3. Update protocol references after community approval

## License

Apache License 2.0 - See LICENSE file for details

## Support

For issues and questions:
- Review the test files for usage examples
- Check deployment logs for contract addresses
- Refer to OpenZeppelin documentation for standard patterns
