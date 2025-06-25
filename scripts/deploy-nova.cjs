const { ethers, run, network } = require("hardhat");
const fs = require("fs");
const path = require("path");

// Network configurations for Chainlink services
const NETWORK_CONFIGS = {
  fuji: {
    vrfCoordinator: "0x2eD832Ba664535e5886b75D64C46EB9a228C2610",
    keyHash: "0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61",
    linkToken: "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846",
    functionsRouter: "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0",
    automationRegistry: "0x819B58A646CDd8289275A87653a2aA4902b14fe6",
    subscriptionId: 1,
    chainSelector: "14767482510784806043"
  }
};

const DEPLOYED_CONTRACTS_FILE = path.join(__dirname, "../deployments/deployed-contracts.json");

function loadDeployedContracts() {
  if (fs.existsSync(DEPLOYED_CONTRACTS_FILE)) {
    return JSON.parse(fs.readFileSync(DEPLOYED_CONTRACTS_FILE, "utf8"));
  }
  return {};
}

function saveDeployedContracts(contracts) {
  const dir = path.dirname(DEPLOYED_CONTRACTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(DEPLOYED_CONTRACTS_FILE, JSON.stringify(contracts, null, 2));
}

async function deployWithRetry(contractFactory, args, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Deployment attempt ${attempt}/${maxRetries}`);
      const contract = await contractFactory.deploy(...args);
      await contract.waitForDeployment();
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

async function deployGroth16Verifier() {
  console.log("📦 Deploying Groth16 Verifier...");
  
  const Groth16Verifier = await ethers.getContractFactory("contracts/Groth16Verifier.sol:Groth16Verifier");
  const verifier = await deployWithRetry(Groth16Verifier, []);
  console.log(`✅ Groth16Verifier deployed: ${await verifier.getAddress()}`);
  
  return verifier;
}

async function deployZKProofAggregator(config, verifierAddress) {
  console.log("📦 Deploying ZKProofAggregator...");
  
  const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
  const zkProofAggregator = await deployWithRetry(ZKProofAggregator, [
    config.vrfCoordinator,
    config.functionsRouter,
    config.subscriptionId,
    config.keyHash,
    config.subscriptionId,
    ethers.keccak256(ethers.toUtf8Bytes("functions-don-id")), // placeholder DON ID
    verifierAddress
  ]);
  
  console.log(`✅ ZKProofAggregator deployed: ${await zkProofAggregator.getAddress()}`);
  
  return zkProofAggregator;
}

async function deployNovaProofAggregator(config, verifierAddress, novaVerifierAddress) {
  console.log("📦 Deploying NovaProofAggregator...");
  
  const NovaProofAggregator = await ethers.getContractFactory("NovaProofAggregator");
  const novaProofAggregator = await deployWithRetry(NovaProofAggregator, [
    config.vrfCoordinator,
    config.functionsRouter,
    config.subscriptionId,
    config.keyHash,
    config.subscriptionId,
    ethers.keccak256(ethers.toUtf8Bytes("functions-don-id")), // placeholder DON ID
    verifierAddress,
    novaVerifierAddress || ethers.ZeroAddress // placeholder Nova verifier
  ]);
  
  console.log(`✅ NovaProofAggregator deployed: ${await novaProofAggregator.getAddress()}`);
  
  return novaProofAggregator;
}

async function deployCrossChainVerifier(config, zkAggregatorAddress) {
  console.log("📦 Deploying CrossChainVerifier...");
  
  const CrossChainVerifier = await ethers.getContractFactory("CrossChainVerifier");
  const crossChainVerifier = await deployWithRetry(CrossChainVerifier, [
    config.vrfCoordinator, // Using VRF coordinator as router placeholder
    config.linkToken,
    zkAggregatorAddress
  ]);
  
  console.log(`✅ CrossChainVerifier deployed: ${await crossChainVerifier.getAddress()}`);
  
  return crossChainVerifier;
}

async function main() {
  console.log("🚀 Starting Nova ZK Proof Aggregator deployment...");
  console.log(`Network: ${network.name}`);
  
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);
  
  const networkName = network.name === "avalancheFuji" ? "fuji" : network.name;
  const config = NETWORK_CONFIGS[networkName];
  
  if (!config) {
    throw new Error(`Network ${networkName} not supported`);
  }
  
  console.log(`Using network config: ${networkName}`);
  
  const contracts = {};
  
  try {
    // Deploy Groth16 Verifier
    const groth16Verifier = await deployGroth16Verifier();
    contracts.groth16Verifier = await groth16Verifier.getAddress();
    
    // Deploy ZK Proof Aggregator
    const zkProofAggregator = await deployZKProofAggregator(config, contracts.groth16Verifier);
    contracts.zkProofAggregator = await zkProofAggregator.getAddress();
    
    // Deploy Nova Proof Aggregator
    const novaProofAggregator = await deployNovaProofAggregator(config, contracts.groth16Verifier, ethers.ZeroAddress);
    contracts.novaProofAggregator = await novaProofAggregator.getAddress();
    
    // Deploy Cross Chain Verifier
    const crossChainVerifier = await deployCrossChainVerifier(config, contracts.zkProofAggregator);
    contracts.crossChainVerifier = await crossChainVerifier.getAddress();
    
    // Save deployment info
    const deploymentInfo = loadDeployedContracts();
    deploymentInfo[networkName] = {
      groth16Verifier: contracts.groth16Verifier,
      zkProofAggregator: contracts.zkProofAggregator,
      novaProofAggregator: contracts.novaProofAggregator,
      crossChainVerifier: contracts.crossChainVerifier,
      deployedAt: new Date().toISOString(),
      deployer: deployer.address,
      network: networkName,
      chainId: network.config.chainId
    };
    
    saveDeployedContracts(deploymentInfo);
    
    console.log("\n✅ Deployment completed successfully!");
    console.log("\n📋 Contract Addresses:");
    console.log(`Groth16Verifier: ${contracts.groth16Verifier}`);
    console.log(`ZKProofAggregator: ${contracts.zkProofAggregator}`);
    console.log(`NovaProofAggregator: ${contracts.novaProofAggregator}`);
    console.log(`CrossChainVerifier: ${contracts.crossChainVerifier}`);
    
    // Contract verification
    if (network.name !== "hardhat" && network.name !== "localhost") {
      console.log("\n🔍 Starting contract verification...");
      
      await verifyContract(contracts.groth16Verifier, []);
      await verifyContract(contracts.zkProofAggregator, [
        config.vrfCoordinator,
        config.functionsRouter,
        config.subscriptionId,
        config.keyHash,
        config.subscriptionId,
        ethers.keccak256(ethers.toUtf8Bytes("functions-don-id")),
        contracts.groth16Verifier
      ]);
      await verifyContract(contracts.novaProofAggregator, [
        config.vrfCoordinator,
        config.functionsRouter,
        config.subscriptionId,
        config.keyHash,
        config.subscriptionId,
        ethers.keccak256(ethers.toUtf8Bytes("functions-don-id")),
        contracts.groth16Verifier,
        ethers.ZeroAddress
      ]);
      await verifyContract(contracts.crossChainVerifier, [
        config.vrfCoordinator,
        config.linkToken,
        contracts.zkProofAggregator
      ]);
    }
    
    console.log("\n🎉 All contracts deployed and verified successfully!");
    
  } catch (error) {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 