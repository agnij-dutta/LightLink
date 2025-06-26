const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Network configurations for testnet deployment
const NETWORK_CONFIG = {
  avalancheFuji: {
    name: "Avalanche Fuji Testnet",
    chainId: 43113,
    explorer: "https://testnet.snowtrace.io",
    linkToken: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",
    vrfCoordinator: "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE",
    vrfKeyHash: "0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61",
    functionsRouter: "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0",
    functionsDonId: "0x66756e2d6176616c616e6368652d66756a692d31000000000000000000000000",
    ccipRouter: "0xF694E193200268f9a4868e4Aa017A0118C9a8177",
    feeTokens: {
      link: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846"
    }
  },
  sepolia: {
    name: "Ethereum Sepolia",
    chainId: 11155111,
    explorer: "https://sepolia.etherscan.io",
    linkToken: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    vrfCoordinator: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    vrfKeyHash: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    functionsRouter: "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0",
    functionsDonId: "0x66756e2d657468657265756d2d7365706f6c69612d3100000000000000000000",
    ccipRouter: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
    feeTokens: {
      link: "0x779877A7B0D9E8603169DdbD7836e478b4624789"
    }
  }
};

async function main() {
  console.log("🚀 Starting LightLink ZK Oracle deployment...\n");
  
  // Get deployment parameters
  const hre = require("hardhat");
  const networkName = hre.network.name;
  const config = NETWORK_CONFIG[networkName];
  
  if (!config) {
    throw new Error(`Network ${networkName} not supported. Supported networks: ${Object.keys(NETWORK_CONFIG).join(", ")}`);
  }
  
  console.log(`📡 Deploying to ${config.name} (Chain ID: ${config.chainId})`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`👤 Deployer address: ${deployer.address}`);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Deployer balance: ${ethers.formatEther(balance)} ETH\n`);
  
  if (balance === 0n) {
    throw new Error("Deployer balance is 0. Please fund the deployer account.");
  }
  
  // Deployment parameters
  const deploymentParams = {
    vrfSubscriptionId: process.env.VRF_SUBSCRIPTION_ID || "1",
    functionsSubscriptionId: process.env.FUNCTIONS_SUBSCRIPTION_ID || "1",
    vrfCoordinator: "0x5C210eF41CD1a72de73bF76eC39637bB0d3d7BEE",
    vrfKeyHash: config.vrfKeyHash,
    functionsRouter: "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0",
    functionsDonId: config.functionsDonId,
    linkToken: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",
    ccipRouter: config.ccipRouter
  };
  
  console.log("🔧 Deployment Parameters:");
  console.log(`  VRF Coordinator: ${deploymentParams.vrfCoordinator}`);
  console.log(`  Functions Router: ${deploymentParams.functionsRouter}`);
  console.log(`  CCIP Router: ${deploymentParams.ccipRouter}`);
  console.log(`  LINK Token: ${deploymentParams.linkToken}`);
  console.log(`  VRF Subscription ID: ${deploymentParams.vrfSubscriptionId}`);
  console.log(`  Functions Subscription ID: ${deploymentParams.functionsSubscriptionId}\n`);
  
  const deployedContracts = {};
  
  try {
    // Step 1: Deploy Groth16 Verifier
    console.log("📝 Step 1: Deploying Groth16 Verifier...");
      const Groth16Verifier = await ethers.getContractFactory("contracts/Groth16Verifier.sol:Groth16Verifier");
  const groth16Verifier = await Groth16Verifier.deploy();
  await groth16Verifier.waitForDeployment();
    const groth16Address = await groth16Verifier.getAddress();
    
    deployedContracts.groth16Verifier = {
      address: groth16Address,
      contract: "contracts/Groth16Verifier.sol:Groth16Verifier"
    };
    
    console.log(`✅ Groth16 Verifier deployed: ${groth16Address}\n`);
    
    // Step 2: Deploy ZK Proof Aggregator
    console.log("📝 Step 2: Deploying ZK Proof Aggregator...");
    const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
    const zkProofAggregator = await ZKProofAggregator.deploy(
      deploymentParams.vrfCoordinator,
      deploymentParams.functionsRouter,
      deploymentParams.vrfSubscriptionId,
      deploymentParams.vrfKeyHash,
      deploymentParams.functionsSubscriptionId,
      deploymentParams.functionsDonId,
      groth16Address
    );
    await zkProofAggregator.waitForDeployment();
    const zkAggregatorAddress = await zkProofAggregator.getAddress();
    
    deployedContracts.zkProofAggregator = {
      address: zkAggregatorAddress,
      contract: "ZKProofAggregator",
      args: [
        deploymentParams.vrfCoordinator,
        deploymentParams.functionsRouter,
        deploymentParams.vrfSubscriptionId,
        deploymentParams.vrfKeyHash,
        deploymentParams.functionsSubscriptionId,
        deploymentParams.functionsDonId,
        groth16Address
      ]
    };
    
    console.log(`✅ ZK Proof Aggregator deployed: ${zkAggregatorAddress}\n`);
    
    // Step 2.5: Load and configure Chainlink Functions source
    console.log("📝 Step 2.5: Configuring Chainlink Functions source...");
    try {
      const functionsSourcePath = path.join(__dirname, "functions/zkProofGeneration.js");
      const functionsSource = fs.readFileSync(functionsSourcePath, "utf8");
      
      // Set the Functions source in the contract
      const setSourceTx = await zkProofAggregator.setFunctionsSource(functionsSource);
      await setSourceTx.wait();
      console.log("✅ Chainlink Functions source configured");
      
        // Configure ZK Proof Service URL (default to Render.com service for production)
  const proofServiceUrl = process.env.ZK_PROOF_SERVICE_URL || "https://ed16-103-175-168-222.ngrok-free.app/prove";
  const setUrlTx = await zkProofAggregator.setProofServiceUrl(proofServiceUrl);
  await setUrlTx.wait();
  console.log(`✅ ZK Proof Service URL configured: ${proofServiceUrl}\n`);
    } catch (error) {
      console.warn("⚠️  Warning: Could not load Functions source:", error.message);
      console.log("You may need to set the Functions source manually later\n");
    }
    
    // Step 3: Deploy Cross Chain Verifier
    console.log("📝 Step 3: Deploying Cross Chain Verifier...");
    const CrossChainVerifier = await ethers.getContractFactory("CrossChainVerifier");
    const crossChainVerifier = await CrossChainVerifier.deploy(
      deploymentParams.ccipRouter,
      deploymentParams.linkToken,
      zkAggregatorAddress
    );
    await crossChainVerifier.waitForDeployment();
    const crossChainAddress = await crossChainVerifier.getAddress();
    
    deployedContracts.crossChainVerifier = {
      address: crossChainAddress,
      contract: "CrossChainVerifier",
      args: [
        deploymentParams.ccipRouter,
        deploymentParams.linkToken,
        zkAggregatorAddress
      ]
    };
    
    console.log(`✅ Cross Chain Verifier deployed: ${crossChainAddress}\n`);
    
    // Step 4: Configure contracts (set up permissions, etc.)
    console.log("⚙️  Step 4: Configuring contracts...");
    
    // Authorize cross-chain verifier in the main aggregator
    const authorizeTx = await zkProofAggregator.setAuthorizedCaller(crossChainAddress, true);
    await authorizeTx.wait();
    console.log("✅ Cross Chain Verifier authorized in ZK Proof Aggregator");
    
    // Set up cross-chain allowlists (for demo purposes)
    const allowSepolia = config.chainId === 43113; // Allow Sepolia if on Fuji
    const allowFuji = config.chainId === 11155111; // Allow Fuji if on Sepolia
    
    if (allowSepolia) {
      const allowSepoliaTx = await crossChainVerifier.allowlistDestinationChain(11155111, true);
      await allowSepoliaTx.wait();
      console.log("✅ Sepolia destination chain allowlisted");
    }
    
    if (allowFuji) {
      const allowFujiTx = await crossChainVerifier.allowlistDestinationChain(43113, true);
      await allowFujiTx.wait();
      console.log("✅ Fuji destination chain allowlisted");
    }
    
    console.log();
    
    // Step 5: Save deployment information
    console.log("💾 Step 5: Saving deployment information...");
    
    const deploymentInfo = {
      network: {
        name: config.name,
        chainId: config.chainId,
        explorer: config.explorer
      },
      deployer: deployer.address,
      deployedAt: new Date().toISOString(),
      blockNumber: await ethers.provider.getBlockNumber(),
      contracts: deployedContracts,
      configuration: deploymentParams
    };
    
    // Create deployments directory if it doesn't exist
    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }
    
    // Save deployment info
    const deploymentFile = path.join(deploymentsDir, `${networkName}-deployment.json`);
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    
    // Also update the CLI-compatible format
    const cliDeploymentFile = path.join(deploymentsDir, "deployed-contracts.json");
    let cliDeployments = {};
    if (fs.existsSync(cliDeploymentFile)) {
      cliDeployments = JSON.parse(fs.readFileSync(cliDeploymentFile, "utf8"));
    }
    
    cliDeployments[networkName] = {
      groth16Verifier: groth16Address,
      zkProofAggregator: zkAggregatorAddress,
      crossChainVerifier: crossChainAddress,
      deployedAt: deploymentInfo.deployedAt,
      deployer: deployer.address
    };
    
    fs.writeFileSync(cliDeploymentFile, JSON.stringify(cliDeployments, null, 2));
    
    console.log(`✅ Deployment info saved to ${deploymentFile}\n`);
    
    // Step 6: Display deployment summary
    console.log("🎉 DEPLOYMENT SUCCESSFUL!\n");
    console.log("📋 Contract Addresses:");
    console.log(`  🔐 Groth16 Verifier:    ${groth16Address}`);
    console.log(`  🔗 ZK Proof Aggregator: ${zkAggregatorAddress}`);
    console.log(`  🌉 Cross Chain Verifier: ${crossChainAddress}\n`);
    
    console.log("🔗 Block Explorer Links:");
    console.log(`  Groth16 Verifier:    ${config.explorer}/address/${groth16Address}`);
    console.log(`  ZK Proof Aggregator: ${config.explorer}/address/${zkAggregatorAddress}`);
    console.log(`  Cross Chain Verifier: ${config.explorer}/address/${crossChainAddress}\n`);
    
    console.log("🛠️  Next Steps:");
    console.log("1. Verify contracts on block explorer:");
    console.log(`   npx hardhat verify --network ${networkName} ${groth16Address}`);
    console.log(`   npx hardhat verify --network ${networkName} ${zkAggregatorAddress} "${deploymentParams.vrfCoordinator}" "${deploymentParams.functionsRouter}" "${deploymentParams.vrfSubscriptionId}" "${deploymentParams.vrfKeyHash}" "${deploymentParams.functionsSubscriptionId}" "${deploymentParams.functionsDonId}" "${groth16Address}"`);
    console.log(`   npx hardhat verify --network ${networkName} ${crossChainAddress} "${deploymentParams.ccipRouter}" "${deploymentParams.linkToken}" "${zkAggregatorAddress}"`);
    console.log();
    console.log("2. Set up Chainlink subscriptions:");
    console.log(`   - Add ${zkAggregatorAddress} as consumer to VRF subscription ${deploymentParams.vrfSubscriptionId}`);
    console.log(`   - Add ${zkAggregatorAddress} as consumer to Functions subscription ${deploymentParams.functionsSubscriptionId}`);
    console.log();
    console.log("3. Fund contracts with LINK tokens for Chainlink services");
    console.log();
    console.log("4. Test the deployment:");
    console.log(`   npm run cli request-proof --network ${networkName} --source-chain ethereum --block-number 0`);
    console.log();
    console.log("🚀 LightLink ZK Oracle is ready for testnet testing!");
    
  } catch (error) {
    console.error("❌ Deployment failed:", error.message);
    console.error(error);
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

module.exports = { main, NETWORK_CONFIG }; 