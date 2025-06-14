const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");
const snarkjs = require("snarkjs");

// Circuit configuration
const CIRCUIT_CONFIG = {
  multiplier: {
    name: "multiplier",
    inputPath: "circuits/multiplier.circom",
    outputDir: "circuits/build/multiplier",
    ptauFile: "circuits/ptau/powersOfTau28_hez_final_10.ptau"
  },
  merkleProof: {
    name: "merkle_proof",
    inputPath: "circuits/merkle_proof.circom",
    outputDir: "circuits/build/merkle_proof",
    ptauFile: "circuits/ptau/powersOfTau28_hez_final_12.ptau"
  },
  proofAggregator: {
    name: "proof_aggregator",
    inputPath: "circuits/proof_aggregator.circom",
    outputDir: "circuits/build/proof_aggregator",
    ptauFile: "circuits/ptau/powersOfTau28_hez_final_16.ptau"
  }
};

// Ensure directories exist
function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Download powers of tau files if they don't exist
async function downloadPtauFiles() {
  console.log("📥 Checking for Powers of Tau files...");
  
  const ptauDir = "circuits/ptau";
  ensureDirectoryExists(ptauDir);
  
  const ptauFiles = [
    {
      name: "powersOfTau28_hez_final_10.ptau",
      url: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_10.ptau"
    },
    {
      name: "powersOfTau28_hez_final_12.ptau",
      url: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau"
    },
    {
      name: "powersOfTau28_hez_final_16.ptau",
      url: "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_16.ptau"
    }
  ];
  
  for (const ptauFile of ptauFiles) {
    const filePath = path.join(ptauDir, ptauFile.name);
    if (!fs.existsSync(filePath)) {
      console.log(`📥 Downloading ${ptauFile.name}...`);
      try {
        execSync(`curl -o ${filePath} ${ptauFile.url}`, { stdio: 'inherit' });
        console.log(`✅ Downloaded ${ptauFile.name}`);
      } catch (error) {
        console.error(`❌ Failed to download ${ptauFile.name}:`, error.message);
        console.log(`⚠️  Creating dummy file for development...`);
        // Create dummy file for development
        fs.writeFileSync(filePath, Buffer.alloc(1024, 0));
      }
    } else {
      console.log(`✅ ${ptauFile.name} already exists`);
    }
  }
}

// Compile a circuit
async function compileCircuit(circuitName) {
  const config = CIRCUIT_CONFIG[circuitName];
  if (!config) {
    throw new Error(`Unknown circuit: ${circuitName}`);
  }
  
  console.log(`🔧 Compiling circuit: ${circuitName}`);
  
  // Ensure output directory exists
  ensureDirectoryExists(config.outputDir);
  
  const inputPath = config.inputPath;
  const outputPath = path.join(config.outputDir, `${config.name}.r1cs`);
  const wasmPath = path.join(config.outputDir, `${config.name}.wasm`);
  const symPath = path.join(config.outputDir, `${config.name}.sym`);
  
  try {
    // Compile circuit with circom
    const circomCmd = `circom ${inputPath} --r1cs --wasm --sym -o ${config.outputDir}`;
    console.log(`Running: ${circomCmd}`);
    execSync(circomCmd, { stdio: 'inherit' });
    
    console.log(`✅ Circuit ${circuitName} compiled successfully`);
    
    return {
      r1csPath: outputPath,
      wasmPath: path.join(config.outputDir, `${config.name}_js`, `${config.name}.wasm`),
      symPath: symPath
    };
  } catch (error) {
    console.error(`❌ Failed to compile circuit ${circuitName}:`, error.message);
    throw error;
  }
}

// Generate trusted setup for a circuit
async function generateTrustedSetup(circuitName) {
  const config = CIRCUIT_CONFIG[circuitName];
  if (!config) {
    throw new Error(`Unknown circuit: ${circuitName}`);
  }
  
  console.log(`🔐 Generating trusted setup for: ${circuitName}`);
  
  const r1csPath = path.join(config.outputDir, `${config.name}.r1cs`);
  const zkeyPath = path.join(config.outputDir, `${config.name}.zkey`);
  const vkeyPath = path.join(config.outputDir, `${config.name}_vkey.json`);
  
  try {
    // Phase 1: Setup
    console.log("Phase 1: Powers of Tau setup");
    await snarkjs.zKey.newZKey(r1csPath, config.ptauFile, zkeyPath);
    
    // Phase 2: Circuit-specific setup (simplified for demo)
    console.log("Phase 2: Circuit-specific setup");
    const finalZkeyPath = path.join(config.outputDir, `${config.name}_final.zkey`);
    await snarkjs.zKey.beacon(zkeyPath, finalZkeyPath, "beacon", "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f");
    
    // Export verification key
    console.log("Exporting verification key");
    const vKey = await snarkjs.zKey.exportVerificationKey(finalZkeyPath);
    fs.writeFileSync(vkeyPath, JSON.stringify(vKey, null, 2));
    
    console.log(`✅ Trusted setup generated for ${circuitName}`);
    
    return {
      zkeyPath: finalZkeyPath,
      vkeyPath: vkeyPath
    };
  } catch (error) {
    console.error(`❌ Failed to generate trusted setup for ${circuitName}:`, error.message);
    throw error;
  }
}

// Generate Solidity verifier contract
async function generateSolidityVerifier(circuitName) {
  const config = CIRCUIT_CONFIG[circuitName];
  if (!config) {
    throw new Error(`Unknown circuit: ${circuitName}`);
  }
  
  console.log(`📜 Generating Solidity verifier for: ${circuitName}`);
  
  const zkeyPath = path.join(config.outputDir, `${config.name}_final.zkey`);
  const solidityPath = path.join("contracts", `${config.name.charAt(0).toUpperCase() + config.name.slice(1)}Verifier.sol`);
  
  try {
    const solidityCode = await snarkjs.zKey.exportSolidityVerifier(zkeyPath);
    
    // Customize the contract name
    const customizedCode = solidityCode.replace(
      "contract Verifier",
      `contract ${config.name.charAt(0).toUpperCase() + config.name.slice(1)}Verifier`
    );
    
    fs.writeFileSync(solidityPath, customizedCode);
    
    console.log(`✅ Solidity verifier generated: ${solidityPath}`);
    
    return solidityPath;
  } catch (error) {
    console.error(`❌ Failed to generate Solidity verifier for ${circuitName}:`, error.message);
    throw error;
  }
}

// Generate a proof for given inputs
async function generateProof(circuitName, inputs) {
  const config = CIRCUIT_CONFIG[circuitName];
  if (!config) {
    throw new Error(`Unknown circuit: ${circuitName}`);
  }
  
  console.log(`🔮 Generating proof for: ${circuitName}`);
  
  const wasmPath = path.join(config.outputDir, `${config.name}_js`, `${config.name}.wasm`);
  const zkeyPath = path.join(config.outputDir, `${config.name}_final.zkey`);
  
  try {
    // Calculate witness
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      inputs,
      wasmPath,
      zkeyPath
    );
    
    console.log(`✅ Proof generated for ${circuitName}`);
    
    return {
      proof: proof,
      publicSignals: publicSignals
    };
  } catch (error) {
    console.error(`❌ Failed to generate proof for ${circuitName}:`, error.message);
    throw error;
  }
}

// Verify a proof
async function verifyProof(circuitName, proof, publicSignals) {
  const config = CIRCUIT_CONFIG[circuitName];
  if (!config) {
    throw new Error(`Unknown circuit: ${circuitName}`);
  }
  
  console.log(`🔍 Verifying proof for: ${circuitName}`);
  
  const vkeyPath = path.join(config.outputDir, `${config.name}_vkey.json`);
  
  try {
    const vKey = JSON.parse(fs.readFileSync(vkeyPath, "utf8"));
    const isValid = await snarkjs.groth16.verify(vKey, publicSignals, proof);
    
    console.log(`✅ Proof verification result for ${circuitName}: ${isValid}`);
    
    return isValid;
  } catch (error) {
    console.error(`❌ Failed to verify proof for ${circuitName}:`, error.message);
    throw error;
  }
}

// Format proof for Solidity
function formatProofForSolidity(proof) {
  return {
    a: [proof.pi_a[0], proof.pi_a[1]],
    b: [[proof.pi_b[0][1], proof.pi_b[0][0]], [proof.pi_b[1][1], proof.pi_b[1][0]]],
    c: [proof.pi_c[0], proof.pi_c[1]]
  };
}

// Build all circuits
async function buildAllCircuits() {
  console.log("🏗️  Building all circuits...");
  
  try {
    // Download ptau files first
    await downloadPtauFiles();
    
    // Build each circuit
    for (const circuitName of Object.keys(CIRCUIT_CONFIG)) {
      console.log(`\n📦 Building circuit: ${circuitName}`);
      
      // Compile circuit
      await compileCircuit(circuitName);
      
      // Generate trusted setup
      await generateTrustedSetup(circuitName);
      
      // Generate Solidity verifier
      await generateSolidityVerifier(circuitName);
      
      console.log(`✅ Circuit ${circuitName} built successfully`);
    }
    
    console.log("\n🎉 All circuits built successfully!");
    
  } catch (error) {
    console.error("❌ Failed to build circuits:", error);
    throw error;
  }
}

// Test circuit with sample inputs
async function testCircuit(circuitName, inputs) {
  console.log(`🧪 Testing circuit: ${circuitName}`);
  
  try {
    // Generate proof
    const result = await generateProof(circuitName, inputs);
    
    // Verify proof
    const isValid = await verifyProof(circuitName, result.proof, result.publicSignals);
    
    if (isValid) {
      console.log(`✅ Circuit ${circuitName} test passed`);
      return {
        proof: formatProofForSolidity(result.proof),
        publicSignals: result.publicSignals
      };
    } else {
      throw new Error(`Circuit ${circuitName} test failed: proof verification failed`);
    }
  } catch (error) {
    console.error(`❌ Circuit ${circuitName} test failed:`, error.message);
    throw error;
  }
}

// CLI interface
async function main() {
  const command = process.argv[2];
  const circuitName = process.argv[3];
  
  try {
    switch (command) {
      case "build":
        if (circuitName) {
          await compileCircuit(circuitName);
          await generateTrustedSetup(circuitName);
          await generateSolidityVerifier(circuitName);
        } else {
          await buildAllCircuits();
        }
        break;
        
      case "compile":
        if (!circuitName) throw new Error("Circuit name required");
        await compileCircuit(circuitName);
        break;
        
      case "setup":
        if (!circuitName) throw new Error("Circuit name required");
        await generateTrustedSetup(circuitName);
        break;
        
      case "verifier":
        if (!circuitName) throw new Error("Circuit name required");
        await generateSolidityVerifier(circuitName);
        break;
        
      case "test":
        if (!circuitName) throw new Error("Circuit name required");
        
        // Sample inputs for testing
        const sampleInputs = {
          multiplier: { a: "3", b: "4" },
          merkleProof: {
            root: "123456789",
            leaf: "987654321",
            pathElements: ["111", "222", "333"],
            pathIndices: ["0", "1", "0"]
          },
          proofAggregator: {
            proofs: [
              ["1", "2", "3", "4", "5", "6", "7", "8"],
              ["9", "10", "11", "12", "13", "14", "15", "16"],
              ["17", "18", "19", "20", "21", "22", "23", "24"],
              ["25", "26", "27", "28", "29", "30", "31", "32"]
            ],
            publicSignals: [
              ["100", "200", "300", "400"],
              ["500", "600", "700", "800"],
              ["900", "1000", "1100", "1200"],
              ["1300", "1400", "1500", "1600"]
            ],
            merkleRoots: ["1000", "2000", "3000", "4000"],
            blockHashes: ["5000", "6000", "7000", "8000"],
            chainIds: ["1", "42161", "10", "8453"],
            aggregationSeed: "999999",
            targetChainId: "1"
          }
        };
        
        await testCircuit(circuitName, sampleInputs[circuitName]);
        break;
        
      case "download-ptau":
        await downloadPtauFiles();
        break;
        
      default:
        console.log(`
Usage: node scripts/circuit-tools.js <command> [circuit_name]

Commands:
  build [circuit_name]  - Build circuit(s) (compile + setup + verifier)
  compile <circuit_name> - Compile circuit
  setup <circuit_name>   - Generate trusted setup
  verifier <circuit_name> - Generate Solidity verifier
  test <circuit_name>    - Test circuit with sample inputs
  download-ptau          - Download Powers of Tau files

Available circuits: ${Object.keys(CIRCUIT_CONFIG).join(", ")}
        `);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Export functions for use in other scripts
module.exports = {
  compileCircuit,
  generateTrustedSetup,
  generateSolidityVerifier,
  generateProof,
  verifyProof,
  formatProofForSolidity,
  buildAllCircuits,
  testCircuit,
  downloadPtauFiles
};

// Run CLI if this script is executed directly
if (require.main === module) {
  main();
} 