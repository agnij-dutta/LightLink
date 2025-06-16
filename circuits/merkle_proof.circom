pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/mux1.circom";
include "circomlib/circuits/comparators.circom";

/*
 * Merkle Proof Verification Circuit
 * This circuit verifies that a leaf is included in a Merkle tree
 * Used for proving state inclusion in blockchain verification
 */

template MerkleProof(levels) {
    // Inputs
    signal input leaf;                      // The leaf we want to prove inclusion for
    signal input pathElements[levels];      // Hash values of sibling nodes
    signal input pathIndices[levels];       // 0 if sibling is on the left, 1 if on the right
    
    // Public inputs/outputs
    signal input root;                              // The known Merkle root (public)
    signal output isValid;                          // 1 if proof is valid, 0 otherwise
    
    // Array to store intermediate hash computations
    signal intermediateHashes[levels + 1];
    
    // Start with the leaf
    intermediateHashes[0] <== leaf;
    
    // Compute hashes level by level
    component hashers[levels];
    component mux[levels];
    
    for (var i = 0; i < levels; i++) {
        // Use MUX to select correct order of inputs based on pathIndices
        mux[i] = Mux1();
        mux[i].c[0] <== intermediateHashes[i];      // If pathIndices[i] = 0, current hash goes left
        mux[i].c[1] <== pathElements[i];            // sibling goes right
        mux[i].s <== pathIndices[i];
        
        // Hash the pair
        hashers[i] = Poseidon(2);
        hashers[i].inputs[0] <== mux[i].out;
        hashers[i].inputs[1] <== pathElements[i];
        
        intermediateHashes[i + 1] <== hashers[i].out;
    }
    
    // Check if computed root matches the expected root
    component rootCheck = IsEqual();
    rootCheck.in[0] <== intermediateHashes[levels];
    rootCheck.in[1] <== root;
    
    isValid <== rootCheck.out;
}

// Instantiate main component with 8 levels (256 leaves max)
component main {public [root]} = MerkleProof(8); 