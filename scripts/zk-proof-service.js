#!/usr/bin/env node

import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import * as snarkjs from 'snarkjs';
import { fileURLToPath } from 'url';

// Get current file directory (ES modules equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 3001;
const CIRCUITS_DIR = path.join(__dirname, '../artifacts/circuits');

// Circuit configurations (matching circuit-tools.cjs)
const CIRCUITS = {
  proof_aggregator: {
    name: 'proof_aggregator',
    wasmPath: path.join(CIRCUITS_DIR, 'proof_aggregator/proof_aggregator_js/proof_aggregator.wasm'),
    zkeyPath: path.join(CIRCUITS_DIR, 'proof_aggregator/proof_aggregator_final.zkey'),
    vkeyPath: path.join(CIRCUITS_DIR, 'proof_aggregator/verification_key.json'),
    params: [3, 6, 8] // nProofs, merkleDepth, blockDepth
  },
  merkle_proof: {
    name: 'merkle_proof',
    wasmPath: path.join(CIRCUITS_DIR, 'merkle_proof/merkle_proof_js/merkle_proof.wasm'),
    zkeyPath: path.join(CIRCUITS_DIR, 'merkle_proof/merkle_proof_final.zkey'),
    vkeyPath: path.join(CIRCUITS_DIR, 'merkle_proof/verification_key.json'),
    params: [8] // depth
  }
};

// Helper function to check if circuit is ready
function isCircuitReady(circuitName) {
  const circuit = CIRCUITS[circuitName];
  if (!circuit) return false;
  
  return fs.existsSync(circuit.wasmPath) && 
         fs.existsSync(circuit.zkeyPath) && 
         fs.existsSync(circuit.vkeyPath);
}

// Helper function to convert hex string to BigInt for circuits
function hexToBigInt(hex) {
  return BigInt(hex);
}

// Helper function to convert string to field element
function stringToField(str) {
  // Use a simpler hash function for browser compatibility
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return BigInt(hash) % BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
}

// Convert circuit inputs from Chainlink Functions format to circuit format
function formatInputsForCircuit(circuitInputs, circuitName, params) {
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
      
      // Generate proof components using circuit-compatible format
      const proof = [
        hexToBigInt(input.blockHash),
        stringToField(input.chainId.toString()),
        hexToBigInt(input.merkleRoot),
        stringToField(input.targetChainId.toString()),
        stringToField(input.blockNumber.toString()),
        stringToField(input.timestamp.toString()),
        stringToField(`proof_${i}_a`),
        stringToField(`proof_${i}_b`)
      ];
      
      const publicSignal = [
        hexToBigInt(input.merkleRoot),
        hexToBigInt(input.blockHash),
        stringToField(input.chainId.toString()),
        stringToField(input.blockNumber.toString())
      ];
      
      proofs.push(proof);
      publicSignals.push(publicSignal);
      merkleRoots.push(hexToBigInt(input.merkleRoot));
      blockHashes.push(hexToBigInt(input.blockHash));
      chainIds.push(BigInt(input.chainId));
    }
    
    // Format final circuit inputs
    return {
      proofs: proofs,
      publicSignals: publicSignals,
      merkleRoots: merkleRoots,
      blockHashes: blockHashes,
      chainIds: chainIds,
      aggregationSeed: stringToField(Date.now().toString()),
      targetChainId: BigInt(circuitInputs[0].targetChainId)
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
async function generateProof(circuitName, circuitInputs, params) {
  console.log(`Generating proof for circuit: ${circuitName}`);
  
  const circuit = CIRCUITS[circuitName];
  if (!circuit) {
    throw new Error(`Circuit not found: ${circuitName}`);
  }
  
  if (!isCircuitReady(circuitName)) {
    throw new Error(`Circuit not ready: ${circuitName}. Please run setup-groth16 first.`);
  }
  
  try {
    // Format inputs for the circuit
    const formattedInputs = formatInputsForCircuit(circuitInputs, circuitName, params);
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

// Health check endpoint
app.get('/health', (req, res) => {
  const circuitStatus = {};
  
  for (const [name, circuit] of Object.entries(CIRCUITS)) {
    const ready = isCircuitReady(name);
    circuitStatus[name] = {
      ready,
      wasmExists: fs.existsSync(circuit.wasmPath),
      zkeyExists: fs.existsSync(circuit.zkeyPath),
      vkeyExists: fs.existsSync(circuit.vkeyPath)
    };
  }
  
  res.json({
    status: 'running',
    environment: 'render',
    circuits: circuitStatus,
    timestamp: new Date().toISOString()
  });
});

// Setup guide endpoint
app.get('/setup', (req, res) => {
  res.json({
    message: 'To set up the ZK proof service:',
    steps: [
      '1. Run npm run setup-groth16 to generate circuit artifacts',
      '2. Ensure all circuit files are present in the artifacts directory',
      '3. Restart the service'
    ],
    circuitStatus: Object.fromEntries(
      Object.entries(CIRCUITS).map(([name, _]) => [
        name,
        isCircuitReady(name)
      ])
    )
  });
});

// Generate proof endpoint
app.post('/prove', async (req, res) => {
  try {
    const { circuit, inputs, params } = req.body;
    
    if (!circuit || !inputs) {
      return res.status(400).json({
        error: 'Missing required fields: circuit, inputs'
      });
    }
    
    if (!CIRCUITS[circuit]) {
      return res.status(400).json({
        error: `Unknown circuit: ${circuit}`,
        availableCircuits: Object.keys(CIRCUITS)
      });
    }
    
    console.log(`Received proof request for ${circuit} with ${inputs.length} inputs`);
    
    const result = await generateProof(circuit, inputs, params);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Proof generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🔐 ZK Proof Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🛠️  Setup guide: http://localhost:${PORT}/setup`);
  console.log();
  
  // Print circuit status
  console.log('📋 Circuit Status:');
  for (const [name, _] of Object.entries(CIRCUITS)) {
    const ready = isCircuitReady(name);
    console.log(`   ${ready ? '✅' : '❌'} ${name}: ${ready ? 'Ready' : 'Not ready'}`);
  }
  console.log();
  
  if (Object.values(CIRCUITS).every(c => isCircuitReady(c.name))) {
    console.log('🚀 Service ready to generate real ZK proofs!');
  } else {
    console.log('⚠️  Some circuits are not ready. Run setup-groth16 to generate missing artifacts.');
  }
}); 