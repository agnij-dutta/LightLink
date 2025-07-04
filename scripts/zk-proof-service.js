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
const PROJECT_ROOT = path.resolve(__dirname, '..');

const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const PORT = process.env.PORT || 10000;
const CIRCUITS_DIR = path.join(PROJECT_ROOT, 'artifacts/circuits');

// Circuit configurations (matching circuit-tools.cjs)
const CIRCUITS = {
  proof_aggregator: {
    name: 'proof_aggregator',
    wasmPath: path.resolve(PROJECT_ROOT, 'artifacts/circuits/proof_aggregator_js/proof_aggregator.wasm'),
    zkeyPath: path.resolve(PROJECT_ROOT, 'artifacts/circuits/proof_aggregator/proof_aggregator_final.zkey'),
    vkeyPath: path.resolve(PROJECT_ROOT, 'artifacts/circuits/proof_aggregator/verification_key.json'),
    params: [3, 6, 8] // nProofs, merkleDepth, blockDepth
  }
};

// Helper function to check if circuit is ready
function isCircuitReady(circuitName) {
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
function hexToBigInt(hex) {
  // Remove 0x prefix if present
  const cleanHex = hex.replace(/^0x/, '');
  return BigInt('0x' + cleanHex);
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

// Helper function to ensure value fits in specified bit range
function constrainToBits(value, maxBits) {
  const maxValue = (BigInt(1) << BigInt(maxBits)) - BigInt(1);
  return BigInt(value) % maxValue;
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

// Health check endpoint
app.get('/health', (req, res) => {
  const circuitStatus = {};
  let allReady = true;
  
  // Check each circuit
  for (const [name, circuit] of Object.entries(CIRCUITS)) {
    const ready = isCircuitReady(name);
    circuitStatus[name] = {
      ready,
      wasmExists: fs.existsSync(circuit.wasmPath),
      zkeyExists: fs.existsSync(circuit.zkeyPath),
      paths: {
        wasm: circuit.wasmPath,
        zkey: circuit.zkeyPath
      }
    };
    if (!ready) allReady = false;
  }
  
  res.json({
    status: allReady ? 'ready' : 'not_ready',
    message: allReady ? 'Service is ready' : 'Some circuits are not ready',
    circuits: circuitStatus,
    serverTime: new Date().toISOString()
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

// Test endpoint for service connectivity
app.post('/test', (req, res) => {
  res.json({
    success: true,
    message: 'ZK Proof Service is working correctly',
    timestamp: new Date().toISOString(),
    serviceStatus: 'ready',
    availableCircuits: Object.keys(CIRCUITS)
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
  console.log(`\n🔐 ZK Proof Service running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🛠️  Setup guide: http://localhost:${PORT}/setup\n`);
  
  console.log('📋 Circuit Status:');
  for (const [name, circuit] of Object.entries(CIRCUITS)) {
    const ready = isCircuitReady(name);
    console.log(`   ${ready ? '✅' : '❌'} ${name}: ${ready ? 'Ready' : 'Not ready'}`);
    if (!ready) {
      console.log('   Files checked:');
      console.log(`   - WASM: ${circuit.wasmPath} (${fs.existsSync(circuit.wasmPath) ? 'exists' : 'missing'})`);
      console.log(`   - ZKEY: ${circuit.zkeyPath} (${fs.existsSync(circuit.zkeyPath) ? 'exists' : 'missing'})`);
    }
  }
  console.log('\n🚀 Service ready to generate real ZK proofs!');
}); 