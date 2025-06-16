#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const snarkjs = require('snarkjs');

const execAsync = util.promisify(exec);

// Configuration
const CIRCUITS_DIR = path.join(__dirname, '../circuits');
const ARTIFACTS_DIR = path.join(__dirname, '../artifacts/circuits');
const CONTRACTS_DIR = path.join(__dirname, '../contracts');
const PTAU_FILE = path.join(ARTIFACTS_DIR, 'powersOfTau28_hez_final_15.ptau');

// Circuit configurations
const CIRCUITS = {
  proof_aggregator: {
    name: 'proof_aggregator',
    file: 'proof_aggregator.circom',
    template: 'ProofAggregator',
    params: [4, 8, 32], // nProofs, merkleDepth, blockDepth
    ptauPower: 15
  },
  merkle_proof: {
    name: 'merkle_proof', 
    file: 'merkle_proof.circom',
    template: 'MerkleTreeInclusionProof',
    params: [8], // depth
    ptauPower: 12
  },
  multiplier: {
    name: 'multiplier',
    file: 'multiplier.circom', 
    template: 'Multiplier',
    params: [],
    ptauPower: 10
  }
};

// Ensure directories exist
function ensureDirectories() {
  [ARTIFACTS_DIR, path.join(ARTIFACTS_DIR, 'ptau')].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

// Download Powers of Tau file if not exists
async function downloadPtau(power = 15) {
  const ptauPath = path.join(ARTIFACTS_DIR, 'ptau', `powersOfTau28_hez_final_${power}.ptau`);
  
  if (fs.existsSync(ptauPath)) {
    console.log(`✅ Powers of Tau file already exists: ${ptauPath}`);
    return ptauPath;
  }

  console.log(`📥 Downloading Powers of Tau file (2^${power})...`);
  
  try {
    const url = `https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_${power}.ptau`;
    await execAsync(`wget -O ${ptauPath} ${url}`);
    console.log(`✅ Downloaded: ${ptauPath}`);
    return ptauPath;
  } catch (error) {
    console.error(`❌ Failed to download ptau file: ${error.message}`);
    throw error;
  }
}

// Compile circuit
async function compileCircuit(circuitName) {
  const config = CIRCUITS[circuitName];
  if (!config) {
    throw new Error(`Circuit ${circuitName} not found in configuration`);
  }

  const circuitPath = path.join(CIRCUITS_DIR, config.file);
  const outputDir = path.join(ARTIFACTS_DIR, config.name);

  if (!fs.existsSync(circuitPath)) {
    throw new Error(`Circuit file not found: ${circuitPath}`);
  }

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log(`🔨 Compiling circuit: ${circuitName}`);
  
  const cmd = `circom ${circuitPath} --r1cs --wasm --sym -o ${outputDir}`;
  
  try {
    const { stdout, stderr } = await execAsync(cmd);
    console.log(`✅ Circuit compiled successfully`);
    if (stdout) console.log(stdout);
    if (stderr) console.warn(stderr);
    
    return {
      r1cs: path.join(outputDir, `${config.name}.r1cs`),
      wasm: path.join(outputDir, `${config.name}_js`, `${config.name}.wasm`),
      sym: path.join(outputDir, `${config.name}.sym`)
    };
  } catch (error) {
    console.error(`❌ Circuit compilation failed: ${error.message}`);
    throw error;
  }
}

// Setup Groth16 proving system
async function setupGroth16(circuitName) {
  const config = CIRCUITS[circuitName];
  if (!config) {
    throw new Error(`Circuit ${circuitName} not found`);
  }

  const outputDir = path.join(ARTIFACTS_DIR, config.name);
  const r1csPath = path.join(outputDir, `${config.name}.r1cs`);
  const ptauPath = await downloadPtau(config.ptauPower);
  
  if (!fs.existsSync(r1csPath)) {
    console.log(`Circuit not compiled yet, compiling ${circuitName}...`);
    await compileCircuit(circuitName);
  }

  console.log(`🔑 Setting up Groth16 proving system for: ${circuitName}`);

  // Phase 1 - Powers of Tau contribution
  const zkeyPath0 = path.join(outputDir, `${config.name}_0000.zkey`);
  const zkeyPath1 = path.join(outputDir, `${config.name}_0001.zkey`);
  const zkeyFinal = path.join(outputDir, `${config.name}_final.zkey`);
  const vkeyPath = path.join(outputDir, `verification_key.json`);

  try {
    // Phase 1: Start ceremony
    console.log(`📝 Phase 1: Starting ceremony...`);
    await snarkjs.zKey.newZKey(r1csPath, ptauPath, zkeyPath0);

    // Phase 2: Contribute to ceremony
    console.log(`📝 Phase 2: Contributing to ceremony...`);
    await snarkjs.zKey.contribute(zkeyPath0, zkeyPath1, "LightLink contribution", "random entropy");

    // Finalize ceremony
    console.log(`📝 Finalizing ceremony...`);
    await snarkjs.zKey.beacon(zkeyPath1, zkeyFinal, "0102030405060708090a0b0c0d0e0f", 10);

    // Export verification key
    console.log(`🔑 Exporting verification key...`);
    const vKey = await snarkjs.zKey.exportVerificationKey(zkeyFinal);
    fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));

    // Clean up intermediate files
    if (fs.existsSync(zkeyPath0)) fs.unlinkSync(zkeyPath0);
    if (fs.existsSync(zkeyPath1)) fs.unlinkSync(zkeyPath1);

    console.log(`✅ Groth16 setup completed for ${circuitName}`);
    console.log(`   Final zkey: ${zkeyFinal}`);
    console.log(`   Verification key: ${vkeyPath}`);

    return {
      zkeyPath: zkeyFinal,
      vkeyPath: vkeyPath,
      vkey: vKey
    };

  } catch (error) {
    console.error(`❌ Groth16 setup failed: ${error.message}`);
    throw error;
  }
}

// Generate Solidity verifier contract
async function generateVerifierContract(circuitName) {
  const config = CIRCUITS[circuitName];
  if (!config) {
    throw new Error(`Circuit ${circuitName} not found`);
  }

  const outputDir = path.join(ARTIFACTS_DIR, config.name);
  const vkeyPath = path.join(outputDir, 'verification_key.json');
  
  if (!fs.existsSync(vkeyPath)) {
    console.log(`Verification key not found, setting up Groth16 for ${circuitName}...`);
    await setupGroth16(circuitName);
  }

  console.log(`📜 Generating Solidity verifier for: ${circuitName}`);

  try {
    const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    
    // Generate verifier contract
    const verifierContract = await snarkjs.zKey.exportSolidityVerifier(
      path.join(outputDir, `${config.name}_final.zkey`)
    );

    // Write verifier contract
    const contractName = `${config.name.charAt(0).toUpperCase() + config.name.slice(1)}Verifier`;
    const contractPath = path.join(CONTRACTS_DIR, `${contractName}.sol`);
    
    // Customize contract with proper name and license
    const customizedContract = verifierContract
      .replace(/contract Verifier/g, `contract ${contractName}`)
      .replace(/pragma solidity \^[\d.]+;/, 'pragma solidity ^0.8.24;')
      .replace(/\/\/ SPDX-License-Identifier: GPL-3.0\n/, '// SPDX-License-Identifier: MIT\n');

    fs.writeFileSync(contractPath, customizedContract);

    console.log(`✅ Verifier contract generated: ${contractPath}`);
    return contractPath;

  } catch (error) {
    console.error(`❌ Verifier generation failed: ${error.message}`);
    throw error;
  }
}

// Generate proof for testing
async function generateTestProof(circuitName, inputs) {
  const config = CIRCUITS[circuitName];
  if (!config) {
    throw new Error(`Circuit ${circuitName} not found`);
  }

  const outputDir = path.join(ARTIFACTS_DIR, config.name);
  const wasmPath = path.join(outputDir, `${config.name}_js`, `${config.name}.wasm`);
  const zkeyPath = path.join(outputDir, `${config.name}_final.zkey`);

  if (!fs.existsSync(wasmPath) || !fs.existsSync(zkeyPath)) {
    throw new Error(`Circuit ${circuitName} not properly set up. Run setup-groth16 first.`);
  }

  console.log(`🧮 Generating proof for: ${circuitName}`);

  try {
    // Calculate witness
    const { witness } = await snarkjs.wtns.calculate(inputs, wasmPath);

    // Generate proof
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(inputs, wasmPath, zkeyPath);

    // Verify proof locally
    const vkeyPath = path.join(outputDir, 'verification_key.json');
    const vKey = JSON.parse(fs.readFileSync(vkeyPath, 'utf8'));
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);

    console.log(`✅ Proof generated and verified locally: ${isValid}`);

    return {
      proof,
      publicSignals,
      isValid
    };

  } catch (error) {
    console.error(`❌ Proof generation failed: ${error.message}`);
    throw error;
  }
}

// Format proof for Solidity
function formatProofForSolidity(proof, publicSignals) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    c: [proof.pi_c[0], proof.pi_c[1]],
    publicSignals: publicSignals
  };
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  ensureDirectories();

  try {
    switch (command) {
      case 'compile':
        const circuitName = args[1];
        if (!circuitName) {
          console.error('Usage: circuit-tools.js compile <circuit-name>');
          process.exit(1);
        }
        await compileCircuit(circuitName);
        break;

      case 'setup-groth16':
        const setupCircuit = args[1] || 'proof_aggregator';
        await setupGroth16(setupCircuit);
        break;

      case 'generate-verifier':
        const verifierCircuit = args[1] || 'proof_aggregator';
        await generateVerifierContract(verifierCircuit);
        break;

      case 'test-proof':
        const testCircuit = args[1] || 'multiplier';
        const testInputs = testCircuit === 'multiplier' 
          ? { a: 3, b: 11 }
          : { /* Add appropriate test inputs for other circuits */ };
        
        const result = await generateTestProof(testCircuit, testInputs);
        console.log('Formatted for Solidity:', formatProofForSolidity(result.proof, result.publicSignals));
        break;

      case 'compile-all':
        for (const circuit of Object.keys(CIRCUITS)) {
          await compileCircuit(circuit);
        }
        break;

      case 'setup-all':
        for (const circuit of Object.keys(CIRCUITS)) {
          await setupGroth16(circuit);
          await generateVerifierContract(circuit);
        }
        break;

      default:
        console.log(`
🔧 LightLink Circuit Tools

Usage: node circuit-tools.js <command> [options]

Commands:
  compile <circuit>          Compile a specific circuit
  compile-all                Compile all circuits
  setup-groth16 [circuit]    Setup Groth16 proving system (default: proof_aggregator)
  generate-verifier [circuit] Generate Solidity verifier contract
  test-proof [circuit]       Generate a test proof
  setup-all                  Complete setup for all circuits

Available circuits: ${Object.keys(CIRCUITS).join(', ')}
        `);
        break;
    }
  } catch (error) {
    console.error(`❌ Command failed: ${error.message}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  compileCircuit,
  setupGroth16,
  generateVerifierContract,
  generateTestProof,
  formatProofForSolidity,
  CIRCUITS
}; 
