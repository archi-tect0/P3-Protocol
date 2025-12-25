pragma circom 2.0.0;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";

template MessageReceipt() {
    // Private inputs - hidden from verifier
    signal input rawContent[256];        // Raw message content (max 256 chars/bytes)
    signal input senderAddress[4];       // Sender wallet address as field elements
    signal input recipientAddress[4];    // Recipient wallet address as field elements
    signal input timestamp;              // Exact timestamp
    
    // Public inputs - visible to verifier
    signal input contentHash;            // Expected hash of content
    signal input senderHash;             // Expected hash of sender
    signal input recipientHash;          // Expected hash of recipient
    signal input timestampMin;           // Min timestamp range
    signal input timestampMax;           // Max timestamp range
    
    // Output signals
    signal output valid;
    
    // Verify content hash
    component contentHasher = Poseidon(256);
    for (var i = 0; i < 256; i++) {
        contentHasher.inputs[i] <== rawContent[i];
    }
    signal computedContentHash;
    computedContentHash <== contentHasher.out;
    signal contentMatch;
    contentMatch <== IsEqual()([computedContentHash, contentHash]);
    
    // Verify sender hash
    component senderHasher = Poseidon(4);
    for (var i = 0; i < 4; i++) {
        senderHasher.inputs[i] <== senderAddress[i];
    }
    signal computedSenderHash;
    computedSenderHash <== senderHasher.out;
    signal senderMatch;
    senderMatch <== IsEqual()([computedSenderHash, senderHash]);
    
    // Verify recipient hash
    component recipientHasher = Poseidon(4);
    for (var i = 0; i < 4; i++) {
        recipientHasher.inputs[i] <== recipientAddress[i];
    }
    signal computedRecipientHash;
    computedRecipientHash <== recipientHasher.out;
    signal recipientMatch;
    recipientMatch <== IsEqual()([computedRecipientHash, recipientHash]);
    
    // Verify timestamp is in range
    component timestampGte = GreaterEqThan(64);
    timestampGte.in[0] <== timestamp;
    timestampGte.in[1] <== timestampMin;
    
    component timestampLte = LessEqThan(64);
    timestampLte.in[0] <== timestamp;
    timestampLte.in[1] <== timestampMax;
    
    signal timestampInRange;
    timestampInRange <== timestampGte.out * timestampLte.out;
    
    // All checks must pass
    signal allChecks;
    allChecks <== contentMatch * senderMatch * recipientMatch * timestampInRange;
    valid <== allChecks;
    
    // Constrain output to be 1
    valid === 1;
}

component main = MessageReceipt();
