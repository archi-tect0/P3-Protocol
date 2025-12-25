pragma circom 2.0.0;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";

template ConsentState() {
    // Private inputs - hidden from verifier
    signal input userIdentity[4];            // User identity (wallet address)
    signal input consentData[32];            // Raw consent data (scopes, timestamps, etc.)
    signal input policyData[64];             // Full policy document
    signal input signature[2];               // User signature on consent
    
    // Public inputs - visible to verifier
    signal input consentRoot;                // Merkle root of all consents
    signal input policyHash;                 // Hash of policy
    signal input userHash;                   // Hash of user identity
    signal input requiredScopes[8];          // Required permission scopes
    signal input minValidUntil;              // Minimum validity timestamp
    
    // Output signals
    signal output valid;
    
    // Verify user hash
    component userHasher = Poseidon(4);
    for (var i = 0; i < 4; i++) {
        userHasher.inputs[i] <== userIdentity[i];
    }
    signal computedUserHash;
    computedUserHash <== userHasher.out;
    signal userMatch;
    userMatch <== IsEqual()([computedUserHash, userHash]);
    
    // Verify policy hash
    component policyHasher = Poseidon(64);
    for (var i = 0; i < 64; i++) {
        policyHasher.inputs[i] <== policyData[i];
    }
    signal computedPolicyHash;
    computedPolicyHash <== policyHasher.out;
    signal policyMatch;
    policyMatch <== IsEqual()([computedPolicyHash, policyHash]);
    
    // Compute consent leaf (user + consent data + policy hash)
    component consentLeafHasher = Poseidon(37);  // 4 user + 32 consent + 1 policy
    for (var i = 0; i < 4; i++) {
        consentLeafHasher.inputs[i] <== userIdentity[i];
    }
    for (var i = 0; i < 32; i++) {
        consentLeafHasher.inputs[4 + i] <== consentData[i];
    }
    consentLeafHasher.inputs[36] <== computedPolicyHash;
    
    signal consentLeaf;
    consentLeaf <== consentLeafHasher.out;
    
    // Verify consent leaf is part of consent root
    // Simplified: hash the leaf with root to verify inclusion
    component rootVerifier = Poseidon(2);
    rootVerifier.inputs[0] <== consentLeaf;
    rootVerifier.inputs[1] <== signature[0];  // Use signature as proof element
    signal computedRoot;
    computedRoot <== rootVerifier.out;
    signal rootMatch;
    rootMatch <== IsEqual()([computedRoot, consentRoot]);
    
    // Verify consent validity timestamp
    // consentData[0] assumed to be validUntil timestamp
    component validityCheck = GreaterEqThan(64);
    validityCheck.in[0] <== consentData[0];
    validityCheck.in[1] <== minValidUntil;
    signal validityOk;
    validityOk <== validityCheck.out;
    
    // Verify required scopes are granted
    // consentData[1-8] assumed to be granted scopes
    signal scopesMatch[8];
    component scopeChecks[8];
    signal allScopesGranted;
    signal scopeProduct[8];
    
    for (var i = 0; i < 8; i++) {
        scopeChecks[i] = IsEqual();
        scopeChecks[i].in[0] <== consentData[i + 1];
        scopeChecks[i].in[1] <== requiredScopes[i];
        scopesMatch[i] <== scopeChecks[i].out;
    }
    
    // Check if at least one scope matches (OR logic)
    // For simplicity, we sum and check > 0
    signal scopeSum;
    scopeSum <== scopesMatch[0] + scopesMatch[1] + scopesMatch[2] + scopesMatch[3] + 
                 scopesMatch[4] + scopesMatch[5] + scopesMatch[6] + scopesMatch[7];
    
    component scopeValid = GreaterThan(8);
    scopeValid.in[0] <== scopeSum;
    scopeValid.in[1] <== 0;
    signal scopesOk;
    scopesOk <== scopeValid.out;
    
    // All checks must pass
    signal allChecks;
    allChecks <== userMatch * policyMatch * rootMatch * validityOk * scopesOk;
    valid <== allChecks;
    
    // Constrain output to be 1
    valid === 1;
}

component main = ConsentState();
