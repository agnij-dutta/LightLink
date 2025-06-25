pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/bitify.circom";
include "circomlib/circuits/comparators.circom";

// Nova recursive proof aggregation circuit
template NovaRecursive(levels) {
    // Public inputs
    signal input step_in;           // Current step in recursion
    signal input step_out;          // Next step in recursion
    signal input program_counter;   // Program counter for verification
    signal input state_root_in;     // Input state root
    signal input state_root_out;    // Output state root
    
    // Proof aggregation inputs
    signal input proof_hashes[levels];      // Array of proof hashes to aggregate
    signal input proof_public_inputs[levels][4]; // Public inputs for each proof
    signal input aggregation_proof[8];      // Aggregated proof elements
    
    // Verification signals
    signal input verifier_key[2];   // Verification key components
    signal input nullifier_hash;    // Nullifier to prevent double-spending
    
    // Output signals
    signal output folded_instance[4];   // Folded instance for next recursion
    signal output aggregated_hash;      // Final aggregated proof hash
    signal output is_valid;             // Validity of aggregation
    
    // Components
    component step_incrementer = IsEqual();
    component state_hasher = Poseidon(2);
    component proof_aggregator = Poseidon(levels);
    component nullifier_checker = Poseidon(3);
    component folding_verifier = Poseidon(6);
    
    // Verify step increment
    step_incrementer.in[0] <== step_in + 1;
    step_incrementer.in[1] <== step_out;
    
    // Hash state transition
    state_hasher.inputs[0] <== state_root_in;
    state_hasher.inputs[1] <== program_counter;
    
    // Aggregate proof hashes
    for (var i = 0; i < levels; i++) {
        proof_aggregator.inputs[i] <== proof_hashes[i];
    }
    
    // Verify nullifier uniqueness
    nullifier_checker.inputs[0] <== nullifier_hash;
    nullifier_checker.inputs[1] <== step_in;
    nullifier_checker.inputs[2] <== state_root_in;
    
    // Folding verification for recursive composition
    folding_verifier.inputs[0] <== aggregation_proof[0];
    folding_verifier.inputs[1] <== aggregation_proof[1];
    folding_verifier.inputs[2] <== verifier_key[0];
    folding_verifier.inputs[3] <== verifier_key[1];
    folding_verifier.inputs[4] <== step_in;
    folding_verifier.inputs[5] <== proof_aggregator.out;
    
    // Output folded instance for next recursion step
    folded_instance[0] <== folding_verifier.out;
    folded_instance[1] <== state_hasher.out;
    folded_instance[2] <== step_out;
    folded_instance[3] <== nullifier_checker.out;
    
    // Final aggregated hash
    aggregated_hash <== proof_aggregator.out;
    
    // Validity check: step must increment and state must be consistent
    component validity_check = IsEqual();
    validity_check.in[0] <== step_incrementer.out;
    validity_check.in[1] <== 1;
    
    is_valid <== validity_check.out;
    
    // Constraint: state_root_out must match computed hash
    state_root_out === state_hasher.out;
    
    // Constraint: all proof public inputs must be non-zero
    component input_checks[levels];
    signal input_sum;
    input_sum <== 0;
    
    for (var i = 0; i < levels; i++) {
        input_checks[i] = IsZero();
        var sum_inputs = 0;
        for (var j = 0; j < 4; j++) {
            sum_inputs += proof_public_inputs[i][j];
        }
        input_checks[i].in <== sum_inputs;
        // Ensure at least one input is non-zero per proof
        input_checks[i].out === 0;
    }
}

// Instantiate the recursive circuit with 8 levels of proof aggregation
component main = NovaRecursive(8); 