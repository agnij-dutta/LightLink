const { ethers, run, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Network configurations for Chainlink services
const NETWORK_CONFIGS = {
  sepolia: {
    vrfCoordinator: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
    keyHash: "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c",
    linkToken: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    functionsRouter: "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0",
    automationRegistry: "0x86EFBD0b6735210631126570bB6B87EdF58e8AA8",
    ccipRouter: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
    subscriptionId: 0,
    chainSelector: "16015286601757825753"
  },
  arbitrumSepolia: {
    vrfCoordinator: "0x50d47e4142598E3411aA864e08a44284e471AC6f",
    keyHash: "0x027f94ff1465b3525f9fc03e9ff7d6d2c0953482246dd6ae07570c45d6631414",
    linkToken: "0xb1D4538B4571d411F07960EF2838Ce337FE1E80E",
    functionsRouter: "0x234a5fb5Bd614a7AA2FfAB244D603abFA0Ac5C5C",
    automationRegistry: "0x2A8905e108EAbBe2ccb3a8afB4B4dD3d11B8F932",
    ccipRouter: "0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165",
    subscriptionId: 0,
    chainSelector: "3478487238524512106"
  },
  optimismSepolia: {
    vrfCoordinator: "0xD5D517abE5cF79B7e95bC6CA44c1fF6fDC040BE4",
    keyHash: "0x1770bdc7eec7771f7ba4ffd640f34260d7f095b79c92d34a5b2551d6f6cfd2be",
    linkToken: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    functionsRouter: "0xC17094E3A1348E5C7544D4fF8A36c28f2C6AAE28",
    automationRegistry: "0x7d81fF1F6b7c5C1663d9d5e7c8FE8E3a0dE6d5b2",
    subscriptionId: 0,
    chainSelector: "5224473277236331295"
  },
  baseSepolia: {
    vrfCoordinator: "0x4B09e658ed251bcafeE92b51d0d64efD6b8Db5c9",
    keyHash: "0x145ec7b0ae0b8b621a5e8c3bf3f71b6d8e43b7d9c6d5e7f8a9b0c1d2e3f4a5b6",
    linkToken: "0xE4aB69C077896252FAFBD49EFD26B5D171A32410",
    functionsRouter: "0xf9B8fc078197181C841c296C876945aaa425B278",
    automationRegistry: "0xE16Df59B887e3Caa439E0b29B42bA2e7976FD8b2",
    subscriptionId: 0,
    chainSelector: "10344971235874465080"
  },
  fuji: {
    vrfCoordinator: "0x2eD832Ba664535e5886b75D64C46EB9a228C2610",
    keyHash: "0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61",
    linkToken: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",
    functionsRouter: "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0",
    automationRegistry: "0x819B58A646CDd8289275A87653a2aA4902b14fe6",
    subscriptionId: 0,
    chainSelector: "14767482510784806043"
  },
  amoy: {
    vrfCoordinator: "0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed",
    keyHash: "0x816bedba8a50b294e5cbd47842baf240c2385f2eaf719edbd4f250a137a8c899",
    linkToken: "0x326C977E6efc84E512bB9C30f76E30c160eD06FB",
    functionsRouter: "0xC22a79eBA640940ABB6dF0f7982cc119578E11De",
    automationRegistry: "0x9C9e3d6c3b6F1c8D9e2e8d5e4f6a7b8c9d0e1f2g",
    subscriptionId: 0,
    chainSelector: "16281711391670634445"
  }
};

// Create deployment directory
const DEPLOYMENT_STATE_FILE = path.join(__dirname, "../deployments/deployment-state.json");

function loadDeploymentState() {
  if (fs.existsSync(DEPLOYMENT_STATE_FILE)) {
    return JSON.parse(fs.readFileSync(DEPLOYMENT_STATE_FILE, "utf8"));
  }
  return {};
}

function saveDeploymentState(state) {
  const dir = path.dirname(DEPLOYMENT_STATE_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DEPLOYMENT_STATE_FILE, JSON.stringify(state, null, 2));
}

async function deployWithRetry(contractFactory, args, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Deployment attempt ${attempt}/${maxRetries}`);
      const contract = await contractFactory.deploy(...args);
      await contract.deployed();
      return contract;
    } catch (error) {
      console.error(`Deployment attempt ${attempt} failed:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  }
}

async function verifyContract(address, constructorArguments, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Verification attempt ${attempt}/${maxRetries} for ${address}`);
      await run("verify:verify", {
        address,
        constructorArguments,
      });
      console.log(`✅ Contract verified: ${address}`);
      return true;
    } catch (error) {
      console.error(`Verification attempt ${attempt} failed:`, error.message);
      if (error.message.includes("Already Verified")) {
        console.log(`✅ Contract already verified: ${address}`);
        return true;
      }
      if (attempt === maxRetries) {
        console.error(`❌ Failed to verify contract: ${address}`);
        return false;
      }
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 15000));
    }
  }
}

async function deployMockContracts() {
  console.log("📦 Deploying mock contracts for testing...");
  
  const contracts = {};
  
  // Deploy mock Chainlink contracts
  const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinatorV2");
  contracts.mockVRFCoordinator = await deployWithRetry(MockVRFCoordinator, []);
  console.log(`✅ MockVRFCoordinatorV2 deployed: ${contracts.mockVRFCoordinator.address}`);
  
  const MockLinkToken = await ethers.getContractFactory("MockLinkToken");
  contracts.mockLinkToken = await deployWithRetry(MockLinkToken, []);
  console.log(`✅ MockLinkToken deployed: ${contracts.mockLinkToken.address}`);
  
  const MockFunctionsRouter = await ethers.getContractFactory("MockFunctionsRouter");
  contracts.mockFunctionsRouter = await deployWithRetry(MockFunctionsRouter, []);
  console.log(`✅ MockFunctionsRouter deployed: ${contracts.mockFunctionsRouter.address}`);
  
  const MockAutomationRegistry = await ethers.getContractFactory("MockAutomationRegistry");
  contracts.mockAutomationRegistry = await deployWithRetry(MockAutomationRegistry, []);
  console.log(`✅ MockAutomationRegistry deployed: ${contracts.mockAutomationRegistry.address}`);
  
  const MockCCIPRouter = await ethers.getContractFactory("MockCCIPRouter");
  contracts.mockCCIPRouter = await deployWithRetry(MockCCIPRouter, []);
  console.log(`✅ MockCCIPRouter deployed: ${contracts.mockCCIPRouter.address}`);
  
  return contracts;
}

async function deployGroth16Verifier() {
  console.log("📦 Deploying Groth16 Verifier...");
  
  const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await deployWithRetry(Groth16Verifier, []);
  console.log(`✅ Groth16Verifier deployed: ${verifier.address}`);
  
  return verifier;
}

async function deployZKProofAggregator(config, verifierAddress, mockContracts = null) {
  console.log("📦 Deploying ZKProofAggregator...");
  
  const vrfCoordinator = mockContracts ? mockContracts.mockVRFCoordinator.address : config.vrfCoordinator;
  const functionsRouter = mockContracts ? mockContracts.mockFunctionsRouter.address : config.functionsRouter;
  const automationRegistry = mockContracts ? mockContracts.mockAutomationRegistry.address : config.automationRegistry;
  const linkToken = mockContracts ? mockContracts.mockLinkToken.address : config.linkToken;
  
  const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
  const zkProofAggregator = await deployWithRetry(ZKProofAggregator, [
    vrfCoordinator,
    functionsRouter,
    automationRegistry,
    verifierAddress,
    config.subscriptionId || 1,
    config.keyHash,
    linkToken
  ]);
  
  console.log(`✅ ZKProofAggregator deployed: ${zkProofAggregator.address}`);
  
  return zkProofAggregator;
}

async function deployCrossChainVerifier(config, mockContracts = null) {
  console.log("📦 Deploying CrossChainVerifier...");
  
  const ccipRouter = mockContracts ? mockContracts.mockCCIPRouter.address : config.ccipRouter;
  const linkToken = mockContracts ? mockContracts.mockLinkToken.address : config.linkToken;
  
  const CrossChainVerifier = await ethers.getContractFactory("CrossChainVerifier");
  const crossChainVerifier = await deployWithRetry(CrossChainVerifier, [
    ccipRouter,
    linkToken
  ]);
  
  console.log(`✅ CrossChainVerifier deployed: ${crossChainVerifier.address}`);
  
  return crossChainVerifier;
}

async function setupChainlinkSubscriptions(contracts, config) {
  console.log("🔧 Setting up Chainlink subscriptions...");
  
  try {
    // Setup VRF subscription (mock implementation)
    if (contracts.mockVRFCoordinator) {
      console.log("Setting up mock VRF subscription...");
      // In a real deployment, you would create a subscription and fund it
    }
    
    // Setup Functions subscription
    if (contracts.mockFunctionsRouter) {
      console.log("Setting up mock Functions subscription...");
      // In a real deployment, you would create a subscription and fund it
    }
    
    // Setup Automation upkeep
    if (contracts.mockAutomationRegistry) {
      console.log("Setting up mock Automation upkeep...");
      // In a real deployment, you would register an upkeep
    }
    
    console.log("✅ Chainlink subscriptions setup completed");
  } catch (error) {
    console.error("❌ Error setting up subscriptions:", error.message);
  }
}

async function configureContracts(contracts, config) {
  console.log("🔧 Configuring contracts...");
  
  try {
    // Configure allowlisted chains for cross-chain verifier
    const chainSelectors = [
      config.chainSelector,
      "16015286601757825753", // Sepolia
      "3478487238524512106",  // Arbitrum Sepolia
      "5224473277236331295",  // Optimism Sepolia
      "10344971235874465080", // Base Sepolia
    ];
    
    for (const chainSelector of chainSelectors) {
      try {
        await contracts.crossChainVerifier.allowlistDestinationChain(chainSelector, true);
        console.log(`✅ Allowlisted destination chain: ${chainSelector}`);
      } catch (error) {
        console.log(`⚠️  Chain ${chainSelector} already allowlisted or error:`, error.message);
      }
    }
    
    // Set cross-chain verifier address in ZK aggregator
    await contracts.zkProofAggregator.setCrossChainVerifier(await contracts.crossChainVerifier.getAddress());
    console.log("✅ Cross-chain verifier configured in ZK aggregator");
    
    console.log("✅ Contract configuration completed");
  } catch (error) {
    console.error("❌ Error configuring contracts:", error.message);
  }
}

async function deployContracts() {
  console.log("🚀 Starting deployment process...");
  console.log(`Network: ${network.name}`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);
  
  const config = NETWORK_CONFIGS[network.name];
  const isTestNetwork = network.name === "hardhat" || network.name === "localhost";
  
  let contracts = {};
  
  // Deploy mock contracts for testing
  if (isTestNetwork || !config) {
    console.log("🧪 Deploying mock contracts...");
    
    const MockVRFCoordinator = await ethers.getContractFactory("MockVRFCoordinatorV2");
    contracts.mockVRFCoordinator = await MockVRFCoordinator.deploy();
    await contracts.mockVRFCoordinator.waitForDeployment();
    console.log(`✅ MockVRFCoordinator deployed: ${await contracts.mockVRFCoordinator.getAddress()}`);
    
    const MockLinkToken = await ethers.getContractFactory("MockLinkToken");
    contracts.mockLinkToken = await MockLinkToken.deploy();
    await contracts.mockLinkToken.waitForDeployment();
    console.log(`✅ MockLinkToken deployed: ${await contracts.mockLinkToken.getAddress()}`);
    
    const MockFunctionsRouter = await ethers.getContractFactory("MockFunctionsRouter");
    contracts.mockFunctionsRouter = await MockFunctionsRouter.deploy();
    await contracts.mockFunctionsRouter.waitForDeployment();
    console.log(`✅ MockFunctionsRouter deployed: ${await contracts.mockFunctionsRouter.getAddress()}`);
    
    const MockAutomationRegistry = await ethers.getContractFactory("MockAutomationRegistry");
    contracts.mockAutomationRegistry = await MockAutomationRegistry.deploy();
    await contracts.mockAutomationRegistry.waitForDeployment();
    console.log(`✅ MockAutomationRegistry deployed: ${await contracts.mockAutomationRegistry.getAddress()}`);
    
    const MockCCIPRouter = await ethers.getContractFactory("MockCCIPRouter");
    contracts.mockCCIPRouter = await MockCCIPRouter.deploy();
    await contracts.mockCCIPRouter.waitForDeployment();
    console.log(`✅ MockCCIPRouter deployed: ${await contracts.mockCCIPRouter.getAddress()}`);
  }
  
  // Deploy Groth16 Verifier
  const Groth16Verifier = await ethers.getContractFactory("Groth16Verifier");
  contracts.groth16Verifier = await Groth16Verifier.deploy();
  await contracts.groth16Verifier.waitForDeployment();
  console.log(`✅ Groth16Verifier deployed: ${await contracts.groth16Verifier.getAddress()}`);
  
  // Deploy ZKProofAggregator
  const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
  contracts.zkProofAggregator = await ZKProofAggregator.deploy(
    (await contracts.mockVRFCoordinator?.getAddress()) || config?.vrfCoordinator, // vrfCoordinator
    (await contracts.mockFunctionsRouter?.getAddress()) || config?.functionsRouter, // functionsRouter
    config?.subscriptionId || 1, // vrfSubscriptionId
    config?.keyHash || "0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c", // vrfKeyHash
    config?.functionsSubscriptionId || 1, // functionsSubscriptionId
    config?.functionsDonId || "0x66756e2d657468657265756d2d73657075616e2d310000000000000000000000" // functionsDonId
  );
  await contracts.zkProofAggregator.waitForDeployment();
  console.log(`✅ ZKProofAggregator deployed: ${await contracts.zkProofAggregator.getAddress()}`);
  
  // Deploy CrossChainVerifier
  const CrossChainVerifier = await ethers.getContractFactory("CrossChainVerifier");
  contracts.crossChainVerifier = await CrossChainVerifier.deploy(
    (await contracts.mockCCIPRouter?.getAddress()) || config?.ccipRouter,
    (await contracts.mockLinkToken?.getAddress()) || config?.linkToken,
    await contracts.zkProofAggregator.getAddress()
  );
  await contracts.crossChainVerifier.waitForDeployment();
  console.log(`✅ CrossChainVerifier deployed: ${await contracts.crossChainVerifier.getAddress()}`);
  
  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(50));
  for (const [name, contract] of Object.entries(contracts)) {
    const address = await contract.getAddress();
    console.log(`${name}: ${address}`);
  }
  
  return contracts;
}

// Main deployment function
if (require.main === module) {
  deployContracts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("❌ Deployment failed:", error);
      process.exit(1);
    });
}

module.exports = { deployContracts }; 