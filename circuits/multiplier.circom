pragma circom 2.0.0;

/*
 * Multiplier Circuit - Basic ZK proof verification
 * This circuit proves that the prover knows two secret values a and b
 * such that a * b = c (where c is public)
 */

template Multiplier() {
    // Private inputs (witnesses)
    signal private input a;
    signal private input b;
    
    // Public output
    signal output c;
    
    // Constraint: c must equal a * b
    c <== a * b;
}

// Instantiate the main component
component main = Multiplier(); 