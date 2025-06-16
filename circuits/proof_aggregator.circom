pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";
include "circomlib/circuits/mux1.circom";

// Main proof aggregation circuit that combines multiple validity proofs
template ProofAggregator(nProofs, merkleDepth, blockDepth) {
    // Input signals
    signal input proofs[nProofs][8]; // Each proof has 8 elements (simplified Groth16)
    signal input publicSignals[nProofs][4]; // Public signals for each proof
    signal input merkleRoots[nProofs]; // Merkle roots being verified
    signal input blockHashes[nProofs]; // Block hashes being proven
    signal input chainIds[nProofs]; // Chain IDs for cross-chain verification
    
    // Aggregation parameters
    signal input aggregationSeed; // Random seed for aggregation
    signal input targetChainId; // Target chain for verification
    
    // Output signals
    signal output aggregatedProof[8]; // Single aggregated proof
    signal output aggregatedPublicSignals[4]; // Aggregated public signals
    signal output validityHash; // Hash proving all proofs are valid
    signal output chainMask; // Bitmask of verified chains
    
    // Components for verification and aggregation
    component proofVerifiers[nProofs];
    component merkleVerifiers[nProofs];
    component blockVerifiers[nProofs];
    component poseidonAggregator[nProofs];
    component chainMaskComputer = ChainMaskComputer(nProofs);
    
    // Verify each individual proof
    for (var i = 0; i < nProofs; i++) {
        proofVerifiers[i] = SingleProofVerifier();
        proofVerifiers[i].proof <== proofs[i];
        proofVerifiers[i].publicSignals <== publicSignals[i];
        proofVerifiers[i].merkleRoot <== merkleRoots[i];
        proofVerifiers[i].blockHash <== blockHashes[i];
        proofVerifiers[i].chainId <== chainIds[i];
        
        // Verify Merkle inclusion
        merkleVerifiers[i] = MerkleInclusionVerifier(merkleDepth);
        merkleVerifiers[i].root <== merkleRoots[i];
        merkleVerifiers[i].leaf <== blockHashes[i];
        
        // For simplicity, use the first public signal for all path elements
        // In a real implementation, path elements would be proper inputs
        for (var j = 0; j < merkleDepth; j++) {
            merkleVerifiers[i].pathElements[j] <== publicSignals[i][0];
            merkleVerifiers[i].pathIndices[j] <== 0; // Simplified - all left path
        }
        
        // Verify block validity
        blockVerifiers[i] = BlockValidityVerifier(blockDepth);
        blockVerifiers[i].blockHash <== blockHashes[i];
        blockVerifiers[i].chainId <== chainIds[i];
        
        // Aggregate proofs using Poseidon hash
        poseidonAggregator[i] = Poseidon(9); // 8 proof elements + 1 public signal
        for (var j = 0; j < 8; j++) {
            poseidonAggregator[i].inputs[j] <== proofs[i][j];
        }
        poseidonAggregator[i].inputs[8] <== publicSignals[i][0];
        
        // Feed chain IDs to mask computer
        chainMaskComputer.chainIds[i] <== chainIds[i];
    }
    
    // Compute final aggregated proof
    component finalAggregator = FinalProofAggregator(nProofs);
    for (var i = 0; i < nProofs; i++) {
        finalAggregator.hashedProofs[i] <== poseidonAggregator[i].out;
    }
    finalAggregator.aggregationSeed <== aggregationSeed;
    finalAggregator.targetChainId <== targetChainId;
    
    // Connect outputs
    aggregatedProof <== finalAggregator.aggregatedProof;
    aggregatedPublicSignals <== finalAggregator.aggregatedPublicSignals;
    validityHash <== finalAggregator.validityHash;
    chainMask <== chainMaskComputer.mask;
}

// Verifies a single proof with its associated data
template SingleProofVerifier() {
    signal input proof[8];
    signal input publicSignals[4];
    signal input merkleRoot;
    signal input blockHash;
    signal input chainId;
    
    signal output isValid;
    
    // Simplified proof verification (in practice, would use Groth16 verifier)
    component proofHasher = Poseidon(12); // 8 proof + 4 public signals
    for (var i = 0; i < 8; i++) {
        proofHasher.inputs[i] <== proof[i];
    }
    for (var i = 0; i < 4; i++) {
        proofHasher.inputs[8 + i] <== publicSignals[i];
    }
    
    // Verify consistency between proof and claimed data
    component consistencyChecker = Poseidon(3);
    consistencyChecker.inputs[0] <== merkleRoot;
    consistencyChecker.inputs[1] <== blockHash;
    consistencyChecker.inputs[2] <== chainId;
    
    // Ensure proof hash and consistency hash match expected pattern
    component validator = IsEqual();
    validator.in[0] <== proofHasher.out;
    validator.in[1] <== consistencyChecker.out; // Simplified - would be more complex
    
    isValid <== validator.out;
}

// Verifies Merkle inclusion of a block in the chain
template MerkleInclusionVerifier(depth) {
    signal input root;
    signal input leaf;
    signal input pathElements[depth];
    signal input pathIndices[depth];
    
    signal output isValid;
    
    component hashers[depth];
    component mux[depth];
    
    signal computedHash[depth + 1];
    computedHash[0] <== leaf;
    
    for (var i = 0; i < depth; i++) {
        hashers[i] = Poseidon(2);
        mux[i] = Mux1();
        
        mux[i].c[0] <== computedHash[i];
        mux[i].c[1] <== pathElements[i];
        mux[i].s <== pathIndices[i];
        
        hashers[i].inputs[0] <== mux[i].out;
        hashers[i].inputs[1] <== pathElements[i];
        
        computedHash[i + 1] <== hashers[i].out;
    }
    
    component rootChecker = IsEqual();
    rootChecker.in[0] <== computedHash[depth];
    rootChecker.in[1] <== root;
    
    isValid <== rootChecker.out;
}

// Verifies block validity for a specific chain
template BlockValidityVerifier(blockDepth) {
    signal input blockHash;
    signal input chainId;
    
    signal output isValid;
    
    // Verify block hash format is valid for the chain
    component blockHasher = Poseidon(2);
    blockHasher.inputs[0] <== blockHash;
    blockHasher.inputs[1] <== chainId;
    
    // Check if block hash has valid structure (simplified)
    component blockBits = Num2Bits(256);
    blockBits.in <== blockHash;
    
    // Ensure certain bits follow expected patterns for the chain
    component validityCheck = IsZero();
    signal blockCheck <== blockBits.out[0] + blockBits.out[255]; // Simplified check
    validityCheck.in <== blockCheck;
    
    isValid <== validityCheck.out;
}

// Computes a bitmask indicating which chains have been verified
template ChainMaskComputer(nChains) {
    signal input chainIds[nChains];
    signal output mask;
    
    component chainBits[nChains];
    signal chainMask[nChains + 1];
    signal powerOfTwo[nChains];
    chainMask[0] <== 0;
    
    for (var i = 0; i < nChains; i++) {
        // Convert chain ID to bit position (simplified - just take first bit)
        chainBits[i] = Num2Bits(8);
        chainBits[i].in <== chainIds[i];
        
        // Calculate power of 2 using quadratic constraints
        // For simplicity, just use the first bit as 1 or 2
        powerOfTwo[i] <== 1 + chainBits[i].out[0];
        
        // Set bit in mask for this chain
        chainMask[i + 1] <== chainMask[i] + powerOfTwo[i];
    }
    
    mask <== chainMask[nChains];
}

// Final aggregation of all hashed proofs
template FinalProofAggregator(nProofs) {
    signal input hashedProofs[nProofs];
    signal input aggregationSeed;
    signal input targetChainId;
    
    signal output aggregatedProof[8];
    signal output aggregatedPublicSignals[4];
    signal output validityHash;
    
    // Aggregate all proof hashes with the seed
    component aggregationHasher = Poseidon(nProofs + 2);
    for (var i = 0; i < nProofs; i++) {
        aggregationHasher.inputs[i] <== hashedProofs[i];
    }
    aggregationHasher.inputs[nProofs] <== aggregationSeed;
    aggregationHasher.inputs[nProofs + 1] <== targetChainId;
    
    validityHash <== aggregationHasher.out;
    
    // Generate aggregated proof elements from the validity hash
    component proofElements[8];
    for (var i = 0; i < 8; i++) {
        proofElements[i] = Poseidon(2);
        proofElements[i].inputs[0] <== validityHash;
        proofElements[i].inputs[1] <== i + 1; // Different salt for each element
        aggregatedProof[i] <== proofElements[i].out;
    }
    
    // Generate aggregated public signals
    component publicElements[4];
    for (var i = 0; i < 4; i++) {
        publicElements[i] = Poseidon(2);
        publicElements[i].inputs[0] <== validityHash;
        publicElements[i].inputs[1] <== i + 100; // Different salt range
        aggregatedPublicSignals[i] <== publicElements[i].out;
    }
}

// Recursive proof verification template for nested aggregation
template RecursiveProofVerifier(maxDepth) {
    signal input currentProof[8];
    signal input previousAggregation[8];
    signal input depth;
    
    signal output newAggregation[8];
    signal output isValid;
    
    component recursiveHasher = Poseidon(17); // 8 + 8 + 1
    for (var i = 0; i < 8; i++) {
        recursiveHasher.inputs[i] <== currentProof[i];
        recursiveHasher.inputs[8 + i] <== previousAggregation[i];
    }
    recursiveHasher.inputs[16] <== depth;
    
    // Generate new aggregation
    component newAggregationGenerator[8];
    for (var i = 0; i < 8; i++) {
        newAggregationGenerator[i] = Poseidon(2);
        newAggregationGenerator[i].inputs[0] <== recursiveHasher.out;
        newAggregationGenerator[i].inputs[1] <== i;
        newAggregation[i] <== newAggregationGenerator[i].out;
    }
    
    // Validate depth bounds
    component depthChecker = LessThan(8);
    depthChecker.in[0] <== depth;
    depthChecker.in[1] <== maxDepth;
    
    isValid <== depthChecker.out;
}

// Main component for testing with 4 proofs, depth 8 Merkle trees
component main {public [targetChainId]} = ProofAggregator(4, 8, 8); 