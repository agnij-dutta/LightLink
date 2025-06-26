import fs from 'fs';
import path from 'path';
import * as snarkjs from 'snarkjs';

// Get project root directory (parent of backend)
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const CIRCUITS_DIR = path.join(PROJECT_ROOT, 'artifacts/circuits');

// Circuit configurations (matching circuit-tools.cjs)
export const CIRCUITS = {
  proof_aggregator: {
    name: 'proof_aggregator',
    wasmPath: path.resolve(PROJECT_ROOT, 'artifacts/circuits/proof_aggregator_js/proof_aggregator.wasm'),
    zkeyPath: path.resolve(PROJECT_ROOT, 'artifacts/circuits/proof_aggregator/proof_aggregator_final.zkey'),
    vkeyPath: path.resolve(PROJECT_ROOT, 'artifacts/circuits/proof_aggregator/verification_key.json'),
    params: [3, 6, 8] // nProofs, merkleDepth, blockDepth
  }
};

// Helper function to check if circuit is ready
export function isCircuitReady(circuitName) {
  const circuit = CIRCUITS[circuitName];
  if (!circuit) return false;
  
  // Only check for wasm and zkey files
  const exists = fs.existsSync(circuit.wasmPath) && fs.existsSync(circuit.zkeyPath);
  console.log(`Checking circuit ${circuitName}:`, {
    wasmPath: circuit.wasmPath,
    wasmExists: fs.existsSync(circuit.wasmPath),
    zkeyPath: circuit.zkeyPath,
    zkeyExists: fs.existsSync(circuit.zkeyPath),
    cwd: process.cwd(),
    projectRoot: PROJECT_ROOT
  });
  return exists;
}

// Helper function to convert hex string to BigInt for circuits
export function hexToBigInt(hex) {
  // Remove 0x prefix if present
  const cleanHex = hex.replace(/^0x/, '');
  return BigInt('0x' + cleanHex);
}

// Helper function to convert string to field element
export function stringToField(str) {
  // Use a simpler hash function for browser compatibility
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return BigInt(hash) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
}

// Helper function to ensure value fits in specified bit range
export function constrainToBits(value, maxBits) {
  const maxValue = (BigInt(1) << BigInt(maxBits)) - BigInt(1);
  return BigInt(value) % maxValue;
}

// Convert circuit inputs from Chainlink Functions format to circuit format
export function formatInputsForCircuit(circuitInputs, circuitName, params) {
  if (circuitName === 'proof_aggregator') {
    const { nProofs, merkleDepth, blockDepth } = params;
    
    // Pad inputs to match circuit requirements
    const paddedInputs = [...circuitInputs];
    while (paddedInputs.length < nProofs) {
      // Duplicate last input if we have fewer proofs than circuit expects
      paddedInputs.push(paddedInputs[paddedInputs.length - 1]);
    }
    
    // Extract and format inputs for the circuit
    const proofs = [];
    const publicSignals = [];
    const merkleRoots = [];
    const blockHashes = [];
    const chainIds = [];
    
    for (let i = 0; i < nProofs; i++) {
      const input = paddedInputs[i % paddedInputs.length];
      
      // Constrain values to fit circuit bit requirements
      // BlockValidityVerifier uses blockDepth * 8 bits, so constrain blockHash
      const constrainedBlockHash = constrainToBits(hexToBigInt(input.blockHash || '0x1234'), blockDepth * 8);
      const constrainedMerkleRoot = constrainToBits(hexToBigInt(input.merkleRoot || '0x5678'), 252); // Field element size
      const constrainedChainId = constrainToBits(BigInt(input.chainId || 1), 4); // ChainMaskComputer uses 4 bits
      
      // Generate proof components using circuit-compatible format
      const proof = [
        constrainedBlockHash,
        constrainedChainId,
        constrainedMerkleRoot,
        constrainedChainId, // targetChainId
        stringToField(input.blockNumber?.toString() || '1'),
        stringToField(input.timestamp?.toString() || Date.now().toString()),
        stringToField(`proof_${i}_a`),
        stringToField(`proof_${i}_b`)
      ];
      
      const publicSignal = [
        constrainedMerkleRoot,
        constrainedBlockHash,
        constrainedChainId,
        stringToField(input.blockNumber?.toString() || '1')
      ];
      
      proofs.push(proof);
      publicSignals.push(publicSignal);
      merkleRoots.push(constrainedMerkleRoot);
      blockHashes.push(constrainedBlockHash);
      chainIds.push(constrainedChainId);
    }
    
    // Format final circuit inputs
    return {
      proofs: proofs,
      publicSignals: publicSignals,
      merkleRoots: merkleRoots,
      blockHashes: blockHashes,
      chainIds: chainIds,
      aggregationSeed: stringToField(Date.now().toString()),
      targetChainId: constrainToBits(BigInt(circuitInputs[0].targetChainId || 1), 4)
    };
  }
  
  if (circuitName === 'merkle_proof') {
    const input = circuitInputs[0]; // Use first input for single proof
    
    return {
      leaf: hexToBigInt(input.leaf),
      pathElements: input.pathElements.map(el => hexToBigInt(el)),
      pathIndices: input.pathIndices.map(idx => BigInt(idx)),
      root: hexToBigInt(input.merkleRoot)
    };
  }
  
  throw new Error(`Unsupported circuit: ${circuitName}`);
}

// Generate ZK proof using real circuits
export async function generateProof(circuitName, circuitInputs, params) {
  console.log(`Generating proof for circuit: ${circuitName}`);
  
  const circuit = CIRCUITS[circuitName];
  if (!circuit) {
    throw new Error(`Circuit not found: ${circuitName}`);
  }

  if (!isCircuitReady(circuitName)) {
    throw new Error(`Circuit not ready: ${circuitName}. Please run setup-groth16 first.`);
  }

  try {
    // Use circuit default params if none provided
    const circuitParams = params || {
      nProofs: circuit.params[0],
      merkleDepth: circuit.params[1], 
      blockDepth: circuit.params[2]
    };
    
    // Format inputs for the circuit
    const formattedInputs = formatInputsForCircuit(circuitInputs, circuitName, circuitParams);
    console.log(`Formatted inputs for ${circuitName}`);
    
    // Generate the proof
    console.log('Generating Groth16 proof...');
    const startTime = Date.now();
    
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      formattedInputs,
      circuit.wasmPath,
      circuit.zkeyPath
    );
    
    const proofTime = Date.now() - startTime;
    console.log(`Proof generated in ${proofTime}ms`);
    
    // Verify the proof locally
    console.log('Verifying proof locally...');
    const vKey = JSON.parse(fs.readFileSync(circuit.vkeyPath, 'utf8'));
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    
    if (!isValid) {
      throw new Error('Generated proof is invalid');
    }
    
    console.log('✅ Proof verified successfully');
    
    return {
      proof,
      publicSignals,
      isValid,
      metadata: {
        circuit: circuitName,
        generationTime: proofTime,
        verifiedLocally: true
      }
    };
    
  } catch (error) {
    console.error(`Proof generation failed: ${error.message}`);
    throw error;
  }
} 