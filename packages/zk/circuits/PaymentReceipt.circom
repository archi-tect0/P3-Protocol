pragma circom 2.0.0;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";

template PaymentReceipt() {
    // Private inputs - hidden from verifier
    signal input rawAddress[4];              // Raw counterparty address
    signal input memo[128];                  // Private memo field
    signal input txData[64];                 // Raw transaction data
    
    // Public inputs - visible to verifier
    signal input ledgerEventHash;            // Hash of ledger event
    signal input amount;                     // Payment amount (public)
    signal input asset[32];                  // Asset identifier (token address, etc.)
    signal input counterpartyHash;           // Hash of counterparty address
    signal input minAmount;                  // Minimum allowed amount
    signal input maxAmount;                  // Maximum allowed amount
    
    // Output signals
    signal output valid;
    
    // Verify counterparty address hash
    component addressHasher = Poseidon(4);
    for (var i = 0; i < 4; i++) {
        addressHasher.inputs[i] <== rawAddress[i];
    }
    signal computedAddressHash;
    computedAddressHash <== addressHasher.out;
    signal addressMatch;
    addressMatch <== IsEqual()([computedAddressHash, counterpartyHash]);
    
    // Verify ledger event hash (includes all tx data + memo)
    component ledgerHasher = Poseidon(196);  // 4 addr + 128 memo + 64 txData
    for (var i = 0; i < 4; i++) {
        ledgerHasher.inputs[i] <== rawAddress[i];
    }
    for (var i = 0; i < 128; i++) {
        ledgerHasher.inputs[4 + i] <== memo[i];
    }
    for (var i = 0; i < 64; i++) {
        ledgerHasher.inputs[132 + i] <== txData[i];
    }
    signal computedLedgerHash;
    computedLedgerHash <== ledgerHasher.out;
    signal ledgerMatch;
    ledgerMatch <== IsEqual()([computedLedgerHash, ledgerEventHash]);
    
    // Verify amount is in allowed range
    component amountGte = GreaterEqThan(128);
    amountGte.in[0] <== amount;
    amountGte.in[1] <== minAmount;
    
    component amountLte = LessEqThan(128);
    amountLte.in[0] <== amount;
    amountLte.in[1] <== maxAmount;
    
    signal amountInRange;
    amountInRange <== amountGte.out * amountLte.out;
    
    // Verify amount is positive (non-zero)
    component amountPositive = GreaterThan(128);
    amountPositive.in[0] <== amount;
    amountPositive.in[1] <== 0;
    signal amountValid;
    amountValid <== amountPositive.out;
    
    // All checks must pass
    signal allChecks;
    allChecks <== addressMatch * ledgerMatch * amountInRange * amountValid;
    valid <== allChecks;
    
    // Constrain output to be 1
    valid === 1;
}

component main = PaymentReceipt();
