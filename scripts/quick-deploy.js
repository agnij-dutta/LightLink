#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const util = require("util");

const execAsync = util.promisify(exec);

// Quick deployment script for testing
async function main() {
  console.log("🚀 LightLink ZK Oracle Quick Deploy\n");
  
  const networkName = hre.network.name;
  console.log(`📡 Deploying to: ${networkName}`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} ETH\n`);
  
  if (balance === 0n) {
    throw new Error("❌ Deployer has no balance. Please fund the account.");
  }
  
  try {
    // Step 1: Quick circuit setup (using simplified params)
    console.log("🔧 Step 1: Setting up circuits...");
    
    // Check if we need to build circuits
    const circuitDir = path.join(__dirname, "../artifacts/circuits");
    if (!fs.existsSync(circuitDir)) {
      console.log("   Building circuits (this may take a few minutes)...");
      await execAsync("npm run build:multiplier");
      console.log("   ✅ Basic circuit compiled");
    } else {
      console.log("   ✅ Circuits already built");
    }
    
    // Step 2: Deploy contracts
    console.log("\n🔧 Step 2: Deploying contracts...");
    
    // Deploy Groth16 Verifier first
    console.log("   Deploying Groth16 Verifier...");
    const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
    const groth16Verifier = await Groth16Verifier.deploy();
    await groth16Verifier.waitForDeployment();
    const groth16Address = await groth16Verifier.getAddress();
    console.log(`   ✅ Groth16 Verifier: ${groth16Address}`);
    
    // Deploy ZK Proof Aggregator
    console.log("   Deploying ZK Proof Aggregator...");
    
    // Use appropriate network configs
    let vrfCoordinator, functionsRouter, linkToken, ccipRouter, vrfKeyHash, functionsDonId;
    
    if (networkName === "avalancheFuji") {
      vrfCoordinator = "0x2eD832Ba664535e5886b75D64C46EB9a228C2610";
      functionsRouter = "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0";
      linkToken = "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846";
      ccipRouter = "0xF694E193200268f9a4868e4Aa017A0118C9a8177";
      vrfKeyHash = "0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61";
      functionsDonId = "0x66756e2d6176616c616e6368652d66756a692d31000000000000000000000000";
    } else {
      // Default testnet values - adjust as needed
      vrfCoordinator = "0x0000000000000000000000000000000000000000";
      functionsRouter = "0x0000000000000000000000000000000000000000";
      linkToken = "0x0000000000000000000000000000000000000000";
      ccipRouter = "0x0000000000000000000000000000000000000000";
      vrfKeyHash = "0x0000000000000000000000000000000000000000000000000000000000000000";
      functionsDonId = "0x0000000000000000000000000000000000000000000000000000000000000000";
    }
    
    const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
    const zkAggregator = await ZKProofAggregator.deploy(
      vrfCoordinator,
      functionsRouter,
      1, // VRF subscription ID
      vrfKeyHash,
      1, // Functions subscription ID  
      functionsDonId,
      groth16Address
    );
    await zkAggregator.waitForDeployment();
    const zkAggregatorAddress = await zkAggregator.getAddress();
    console.log(`   ✅ ZK Proof Aggregator: ${zkAggregatorAddress}`);
    
    // Deploy Cross Chain Verifier
    console.log("   Deploying Cross Chain Verifier...");
    const CrossChainVerifier = await ethers.getContractFactory("CrossChainVerifier");
    const crossChainVerifier = await CrossChainVerifier.deploy(
      ccipRouter,
      linkToken,
      zkAggregatorAddress
    );
    await crossChainVerifier.waitForDeployment();
    const crossChainAddress = await crossChainVerifier.getAddress();
    console.log(`   ✅ Cross Chain Verifier: ${crossChainAddress}`);
    
    // Step 3: Basic configuration
    console.log("\n🔧 Step 3: Basic configuration...");
    
    // Authorize cross-chain verifier
    const authTx = await zkAggregator.setAuthorizedCaller(crossChainAddress, true);
    await authTx.wait();
    console.log("   ✅ Cross Chain Verifier authorized");
    
    // Step 4: Save deployment info
    console.log("\n💾 Step 4: Saving deployment info...");
    
    const deploymentInfo = {
      network: networkName,
      chainId: (await ethers.provider.getNetwork()).chainId,
      deployer: deployer.address,
      deployedAt: new Date().toISOString(),
      contracts: {
        groth16Verifier: { address: groth16Address },
        zkProofAggregator: { address: zkAggregatorAddress },
        crossChainVerifier: { address: crossChainAddress }
      }
    };
    
    // Create deployments directory
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    // Save deployment
    const deploymentFile = path.join(deploymentsDir, `${networkName}-deployment.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    // Save CLI-compatible format
    const cliFile = path.join(deploymentsDir, "deployed-contracts.json");
    let cliDeployments = {};
    if (fs.existsSync(cliFile)) {
      cliDeployments = JSON.parse(fs.readFileSync(cliFile, "utf8"));
    }
    
    cliDeployments[networkName] = {
      groth16Verifier: groth16Address,
      zkProofAggregator: zkAggregatorAddress,
      crossChainVerifier: crossChainAddress,
      deployedAt: deploymentInfo.deployedAt,
      deployer: deployer.address
    };
    
    fs.writeFileSync(cliFile, JSON.stringify(cliDeployments, null, 2));
    
    console.log("   ✅ Deployment info saved");
    
    // Final summary
    console.log("\n🎉 QUICK DEPLOYMENT SUCCESSFUL!\n");
    console.log("📋 Contract Addresses:");
    console.log(`   Groth16 Verifier:    ${groth16Address}`);
    console.log(`   ZK Proof Aggregator: ${zkAggregatorAddress}`);
    console.log(`   Cross Chain Verifier: ${crossChainAddress}\n`);
    
    console.log("🧪 Quick Test Commands:");
    console.log(`   npx hardhat console --network ${networkName}`);
    console.log(`   HARDHAT_NETWORK=${networkName} node scripts/test-deployment.js\n`);
    
    if (networkName === "avalancheFuji") {
      console.log("🔗 View on Snowtrace:");
      console.log(`   https://testnet.snowtrace.io/address/${zkAggregatorAddress}\n`);
      
      console.log("⚠️  Next Steps for Full Functionality:");
      console.log("   1. Create Chainlink VRF subscription at vrf.chain.link");
      console.log("   2. Create Chainlink Functions subscription at functions.chain.link");
      console.log("   3. Add contract addresses as consumers");
      console.log("   4. Fund subscriptions with LINK tokens");
      console.log("   5. Update subscription IDs in deployment params");
    }
    
    console.log("\n🚀 Ready for testing!");
    
  } catch (error) {
    console.error("❌ Quick deployment failed:", error.message);
    process.exit(1);
  }
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = { main }; 