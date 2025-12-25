# DID/VC Interoperability Module

This module provides W3C-compliant Decentralized Identifier (DID) and Verifiable Credential (VC) support for the P3 Protocol.

## Features

- **DID Resolution**: Resolve DIDs using the `did:key` method
- **VC Issuance**: Issue W3C-compliant Verifiable Credentials as JWTs
- **VC Verification**: Verify Verifiable Credential JWTs
- **W3C Standards Compliance**: Full compliance with W3C VC Data Model 1.1

## Installation

```bash
cd services/didvc
npm install
npm run build
```

## Configuration

Set the following environment variable to enable DID/VC functionality:

```bash
ENABLE_DID_VC=true  # Set to false to disable DID/VC in demo mode
```

## Usage Examples

### 1. Issue a Verifiable Credential

```typescript
import { issueVC } from './services/didvc';

const issuerDid = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

const signer = async (data: Uint8Array) => {
  // Your signing implementation
  return signature;
};

const subject = {
  actorDID: "did:key:z6MkpTHR8VNsBxYAAWHut2Geadd9jSwuBV8xRoAnwWsdvktH",
  type: "PaymentReceipt",
  amount: "100.00",
  currency: "USD",
  timestamp: new Date().toISOString()
};

const vcJwt = await issueVC(issuerDid, signer, subject);
console.log("Issued VC:", vcJwt);
```

### 2. Verify a Verifiable Credential

```typescript
import { verifyVC } from './services/didvc';

const vcJwt = "eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ...";

const result = await verifyVC(vcJwt);
console.log("Verification result:", result);
```

### 3. Resolve a DID

```typescript
import { resolveDID } from './services/didvc';

const did = "did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK";

const didDocument = await resolveDID(did);
console.log("DID Document:", didDocument);
```

## Integration with P3 Protocol

### Anchored Receipt Credentials

When anchoring receipts on-chain, you can issue VCs to provide portable, verifiable proof:

```typescript
import { issueVC } from './services/didvc';
import { anchorReceipt } from '../server/services/receipts';

async function anchorAndIssueVC(receipt: any, issuerDid: string, signer: any) {
  // First anchor the receipt
  const txHash = await anchorReceipt(receipt);
  
  // Then issue a VC
  const subject = {
    actorDID: receipt.actorDID,
    type: "AnchoredReceipt",
    receiptHash: receipt.hash,
    anchorTxHash: txHash,
    timestamp: new Date().toISOString()
  };
  
  const vcJwt = await issueVC(issuerDid, signer, subject);
  return { txHash, vcJwt };
}
```

### Message Receipt Credentials

Issue VCs for verified message receipts:

```typescript
const messageSubject = {
  actorDID: sender.did,
  type: "MessageReceipt",
  messageHash: messageHash,
  recipient: recipient.did,
  timestamp: new Date().toISOString(),
  zkProof: zkProof
};

const vcJwt = await issueVC(issuerDid, signer, messageSubject);
```

## W3C Compliance

All issued credentials follow the W3C Verifiable Credentials Data Model 1.1:

- `@context`: Includes the standard VC context
- `type`: VerifiableCredential + custom type
- `issuer`: DID of the issuer
- `issuanceDate`: ISO 8601 timestamp
- `credentialSubject`: Claims about the subject

## Dependencies

- `did-resolver`: Core DID resolution
- `key-did-resolver`: Support for did:key method
- `did-jwt-vc`: VC creation and verification
- `did-jwt`: JWT signing and verification
- `jsonld`: JSON-LD processing
- `ajv`: JSON Schema validation

## Security Considerations

1. **Key Management**: Keep private keys secure; never commit to version control
2. **Signature Verification**: Always verify signatures before trusting credentials
3. **Expiration**: Consider adding expiration dates to time-sensitive credentials
4. **Revocation**: Implement credential revocation for compromised credentials

## Future Enhancements

- [ ] Support for additional DID methods (did:ethr, did:web)
- [ ] Credential revocation registry
- [ ] Selective disclosure with BBS+ signatures
- [ ] Integration with DID:SIWE for Web3 authentication
- [ ] Verifiable Presentations for multi-credential proofs
