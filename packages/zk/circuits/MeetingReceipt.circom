pragma circom 2.0.0;

include "../../../node_modules/circomlib/circuits/poseidon.circom";
include "../../../node_modules/circomlib/circuits/comparators.circom";
include "../../../node_modules/circomlib/circuits/mux1.circom";

template MeetingReceipt() {
    // Private inputs - hidden from verifier
    signal input participantAddresses[8][4];  // Up to 8 participants, 4 field elements each
    signal input participantCount;             // Actual number of participants
    signal input rawMetrics[16];              // Raw metrics (duration, quality, etc.)
    signal input roomId[32];                  // Room ID as bytes
    
    // Public inputs - visible to verifier
    signal input roomIdHash;                  // Expected hash of room ID
    signal input participantsRoot;            // Merkle root of participants
    signal input startTime;                   // Meeting start time
    signal input endTime;                     // Meeting end time
    signal input metricsRoot;                 // Hash of metrics
    
    // Output signals
    signal output valid;
    
    // Verify room ID hash
    component roomHasher = Poseidon(32);
    for (var i = 0; i < 32; i++) {
        roomHasher.inputs[i] <== roomId[i];
    }
    signal computedRoomHash;
    computedRoomHash <== roomHasher.out;
    signal roomMatch;
    roomMatch <== IsEqual()([computedRoomHash, roomIdHash]);
    
    // Compute participants merkle root (simplified - hash all participants)
    component participantsHasher = Poseidon(32);  // 8 participants * 4 elements each
    for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 4; j++) {
            participantsHasher.inputs[i * 4 + j] <== participantAddresses[i][j];
        }
    }
    signal computedParticipantsRoot;
    computedParticipantsRoot <== participantsHasher.out;
    signal participantsMatch;
    participantsMatch <== IsEqual()([computedParticipantsRoot, participantsRoot]);
    
    // Verify metrics hash
    component metricsHasher = Poseidon(16);
    for (var i = 0; i < 16; i++) {
        metricsHasher.inputs[i] <== rawMetrics[i];
    }
    signal computedMetricsRoot;
    computedMetricsRoot <== metricsHasher.out;
    signal metricsMatch;
    metricsMatch <== IsEqual()([computedMetricsRoot, metricsRoot]);
    
    // Verify time order (endTime > startTime)
    component timeOrder = GreaterThan(64);
    timeOrder.in[0] <== endTime;
    timeOrder.in[1] <== startTime;
    signal timeOrderValid;
    timeOrderValid <== timeOrder.out;
    
    // Verify participant count is in valid range (1-8)
    component countGte = GreaterEqThan(8);
    countGte.in[0] <== participantCount;
    countGte.in[1] <== 1;
    
    component countLte = LessEqThan(8);
    countLte.in[0] <== participantCount;
    countLte.in[1] <== 8;
    
    signal countValid;
    countValid <== countGte.out * countLte.out;
    
    // All checks must pass
    signal allChecks;
    allChecks <== roomMatch * participantsMatch * metricsMatch * timeOrderValid * countValid;
    valid <== allChecks;
    
    // Constrain output to be 1
    valid === 1;
}

component main = MeetingReceipt();
