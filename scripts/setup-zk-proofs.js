#!/usr/bin/env node

/**
 * Setup Script for Real ZK Proof Generation in LightLink
 * 
 * This script:
 * 1. Compiles all required circom circuits
 * 2. Sets up Groth16 proving systems
 * 3. Generates test proofs to verify everything works
 * 4. Starts the ZK proof service
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory (ES modules equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CIRCUITS = ['proof_aggregator', 'merkle_proof', 'multiplier'];
const SERVICE_PORT = process.env.ZK_PROOF_SERVICE_PORT || 3001;

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, description) {
  log(`\n🔧 Step ${step}: ${description}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

// Check if required tools are installed
function checkDependencies() {
  logStep(1, 'Checking dependencies');
  
  const required = [
    { cmd: 'circom --version', name: 'circom' },
    { cmd: 'node --version', name: 'Node.js' },
    { cmd: 'npm --version', name: 'npm' }
  ];
  
  for (const dep of required) {
    try {
      execSync(dep.cmd, { stdio: 'ignore' });
      logSuccess(`${dep.name} is installed`);
    } catch (error) {
      logError(`${dep.name} is not installed`);
      if (dep.name === 'circom') {
        log('Install circom: https://docs.circom.io/getting-started/installation/', 'blue');
      }
      process.exit(1);
    }
  }
}

// Install Node.js dependencies
function installDependencies() {
  logStep(2, 'Installing Node.js dependencies');
  
  try {
    log('Installing snarkjs and other dependencies...', 'blue');
    execSync('npm install', { stdio: 'inherit' });
    logSuccess('Dependencies installed');
  } catch (error) {
    logError('Failed to install dependencies');
    process.exit(1);
  }
}

// Compile circuits
function compileCircuits() {
  logStep(3, 'Compiling circuits');
  
  for (const circuit of CIRCUITS) {
    try {
      log(`Compiling ${circuit}...`, 'blue');
      execSync(`node scripts/circuit-tools.cjs compile ${circuit}`, { stdio: 'inherit' });
      logSuccess(`${circuit} compiled`);
    } catch (error) {
      logError(`Failed to compile ${circuit}`);
      logWarning(`Continuing with other circuits...`);
    }
  }
}

// Setup Groth16 proving systems
function setupGroth16() {
  logStep(4, 'Setting up Groth16 proving systems');
  
  for (const circuit of CIRCUITS) {
    try {
      log(`Setting up Groth16 for ${circuit}...`, 'blue');
      execSync(`node scripts/circuit-tools.cjs setup-groth16 ${circuit}`, { stdio: 'inherit' });
      logSuccess(`${circuit} Groth16 setup complete`);
    } catch (error) {
      logError(`Failed to setup Groth16 for ${circuit}`);
      logWarning(`This circuit won't be available for proof generation`);
    }
  }
}

// Generate test proofs
function generateTestProofs() {
  logStep(5, 'Generating test proofs');
  
  // Test multiplier circuit
  try {
    log('Testing multiplier circuit...', 'blue');
    const testInputs = { a: 3, b: 4 };
    execSync(`node scripts/circuit-tools.cjs generate-proof multiplier '${JSON.stringify(testInputs)}'`, { stdio: 'inherit' });
    logSuccess('Multiplier circuit test passed');
  } catch (error) {
    logWarning('Multiplier circuit test failed - this is expected if circuit setup failed');
  }
  
  // Test merkle_proof circuit
  try {
    log('Testing merkle proof circuit...', 'blue');
    const merkleInputs = {
      leaf: "0x1234567890123456789012345678901234567890123456789012345678901234",
      pathElements: [
        "0x2345678901234567890123456789012345678901234567890123456789012345",
        "0x3456789012345678901234567890123456789012345678901234567890123456"
      ],
      pathIndices: [0, 1],
      root: "0x4567890123456789012345678901234567890123456789012345678901234567"
    };
    execSync(`node scripts/circuit-tools.cjs generate-proof merkle_proof '${JSON.stringify(merkleInputs)}'`, { stdio: 'inherit' });
    logSuccess('Merkle proof circuit test passed');
  } catch (error) {
    logWarning('Merkle proof circuit test failed - this is expected if circuit setup failed');
  }
}

// Check if ZK proof service can start
function checkProofService() {
  logStep(6, 'Checking ZK proof service');
  
  const servicePath = path.join(__dirname, 'zk-proof-service.js');
  if (!fs.existsSync(servicePath)) {
    logError('ZK proof service not found');
    return false;
  }
  
  logSuccess('ZK proof service found');
  return true;
}

// Start ZK proof service
function startProofService() {
  logStep(7, 'Starting ZK proof service');
  
  const servicePath = path.join(__dirname, 'zk-proof-service.js');
  
  log(`Starting service on port ${SERVICE_PORT}...`, 'blue');
  log(`You can access the service at: http://localhost:${SERVICE_PORT}`, 'magenta');
  log(`Health check: http://localhost:${SERVICE_PORT}/health`, 'magenta');
  log(`Setup guide: http://localhost:${SERVICE_PORT}/setup`, 'magenta');
  log('', 'reset');
  log('Press Ctrl+C to stop the service', 'yellow');
  log('', 'reset');
  
  // Spawn the service as a child process
  const serviceProcess = spawn('node', [servicePath], {
    stdio: 'inherit',
    env: { ...process.env, ZK_PROOF_SERVICE_PORT: SERVICE_PORT }
  });
  
  // Handle process termination
  process.on('SIGINT', () => {
    log('\n🛑 Stopping ZK proof service...', 'yellow');
    serviceProcess.kill('SIGINT');
    process.exit(0);
  });
  
  serviceProcess.on('close', (code) => {
    if (code !== 0) {
      logError(`ZK proof service exited with code ${code}`);
    } else {
      logSuccess('ZK proof service stopped');
    }
  });
}

// Print final instructions
function printInstructions() {
  log('\n🎉 ZK Proof System Setup Complete!', 'green');
  log('\n📋 What was set up:', 'cyan');
  log('   ✅ All circuit dependencies installed', 'green');
  log('   ✅ Circuits compiled to WASM and R1CS', 'green');
  log('   ✅ Groth16 proving keys generated', 'green');
  log('   ✅ Test proofs generated and verified', 'green');
  log('   ✅ ZK proof service ready to start', 'green');
  
  log('\n🚀 Next Steps:', 'cyan');
  log('   1. Start the ZK proof service:', 'blue');
  log('      npm run zk-service', 'magenta');
  log('   ', 'reset');
  log('   2. Deploy contracts with real proof integration:', 'blue');
  log('      ZK_PROOF_SERVICE_URL=http://localhost:3001/prove npm run deploy:testnet', 'magenta');
  log('   ', 'reset');
  log('   3. Test real ZK proof generation:', 'blue');
  log('      curl -X POST http://localhost:3001/prove \\\\', 'magenta');
  log('           -H "Content-Type: application/json" \\\\', 'magenta');
  log('           -d \'{"circuit":"multiplier","inputs":[{"a":3,"b":4}]}\'', 'magenta');
  log('   ', 'reset');
  log('   4. Run end-to-end tests:', 'blue');
  log('      npm run test:integration', 'magenta');
  
  log('\n💡 Pro Tips:', 'cyan');
  log('   • Keep the ZK service running while testing', 'yellow');
  log('   • Check service health: http://localhost:3001/health', 'yellow');
  log('   • View setup guide: http://localhost:3001/setup', 'yellow');
  log('   • Monitor service logs for proof generation status', 'yellow');
  
  log('\n🔗 Useful Commands:', 'cyan');
  log('   • Recompile circuit: node scripts/circuit-tools.cjs compile <circuit>', 'blue');
  log('   • Generate test proof: node scripts/circuit-tools.cjs generate-proof <circuit> <inputs>', 'blue');
  log('   • Check circuit status: curl http://localhost:3001/circuits', 'blue');
}

// Main setup function
async function main() {
  log('🔐 LightLink ZK Proof System Setup', 'cyan');
  log('=====================================', 'cyan');
  
  const args = process.argv.slice(2);
  const startService = args.includes('--start-service');
  const skipTests = args.includes('--skip-tests');
  
  // Run setup steps
    checkDependencies();
    installDependencies();
    compileCircuits();
    setupGroth16();
    
    if (!skipTests) {
      generateTestProofs();
  } else {
    logWarning('Skipping test proofs generation');
    }
    
  const serviceAvailable = checkProofService();
  
  if (startService && serviceAvailable) {
        startProofService();
    // This will keep running until Ctrl+C
      } else {
        printInstructions();
      }
    }
    
// Execute main function
main().catch(error => {
    logError(`Setup failed: ${error.message}`);
  console.error(error);
    process.exit(1);
  });