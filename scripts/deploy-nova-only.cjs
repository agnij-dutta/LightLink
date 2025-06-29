const hre = require("hardhat");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    
    console.log("🚀 Deploying NovaProofAggregator with account:", deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH");

    // Load existing deployments
    const deploymentsPath = path.join(__dirname, '..', 'deployments', 'deployed-contracts.json');
    
    if (!fs.existsSync(deploymentsPath)) {
        throw new Error("No existing deployments found. Please deploy base contracts first.");
    }

    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
    const networkName = hre.network.name;
    
    console.log("Network:", networkName);

    // Get existing deployment data
    const existingDeployment = deployments[networkName] || deployments['avalancheFuji'];
    if (!existingDeployment || !existingDeployment.zkProofAggregator || !existingDeployment.groth16Verifier) {
        throw new Error(`Missing required contracts in ${networkName}. Need zkProofAggregator and groth16Verifier.`);
    }

    const zkProofAggregatorAddress = existingDeployment.zkProofAggregator;
    const groth16VerifierAddress = existingDeployment.groth16Verifier;
    
    console.log("Using existing ZK Proof Aggregator:", zkProofAggregatorAddress);
    console.log("Using existing Groth16 Verifier:", groth16VerifierAddress);

    // ------------------------------------------------------------------
    // Chainlink configuration – values are taken from environment vars
    // Add them to your .env file (see .env.example for the keys)
    // ------------------------------------------------------------------

    const VRF_COORDINATOR           = process.env.VRF_COORDINATOR;
    const FUNCTIONS_ROUTER          = process.env.FUNCTIONS_ROUTER;
    const VRF_SUBSCRIPTION_ID       = process.env.VRF_SUBSCRIPTION_ID;       // string / uint256
    const VRF_KEY_HASH              = process.env.VRF_KEY_HASH;              // bytes32
    const FUNCTIONS_SUBSCRIPTION_ID = process.env.FUNCTIONS_SUBSCRIPTION_ID; // uint64
    const FUNCTIONS_DON_ID          = process.env.FUNCTIONS_DON_ID;          // bytes32

    // Basic validation so we fail fast if something is missing
    if (!VRF_COORDINATOR || !FUNCTIONS_ROUTER || !VRF_SUBSCRIPTION_ID || !VRF_KEY_HASH || !FUNCTIONS_SUBSCRIPTION_ID || !FUNCTIONS_DON_ID) {
        throw new Error("❌ Missing Chainlink configuration env vars. Please set VRF_COORDINATOR, FUNCTIONS_ROUTER, VRF_SUBSCRIPTION_ID, VRF_KEY_HASH, FUNCTIONS_SUBSCRIPTION_ID and FUNCTIONS_DON_ID in .env");
    }

    // Deploy NovaProofAggregator
    const NovaProofAggregator = await hre.ethers.getContractFactory("NovaProofAggregator");
    
    console.log("📦 Deploying NovaProofAggregator...");
    
    const novaProofAggregator = await NovaProofAggregator.deploy(
        VRF_COORDINATOR,
        FUNCTIONS_ROUTER,
        VRF_SUBSCRIPTION_ID,
        VRF_KEY_HASH,
        FUNCTIONS_SUBSCRIPTION_ID,
        FUNCTIONS_DON_ID,
        groth16VerifierAddress,
        groth16VerifierAddress, // Use groth16Verifier as placeholder novaVerifier
        zkProofAggregatorAddress // Base ZK contract reference
    );

    await novaProofAggregator.waitForDeployment();
    const novaAddress = await novaProofAggregator.getAddress();

    console.log("✅ NovaProofAggregator deployed to:", novaAddress);

    // Update deployments file
    deployments[networkName] = {
        ...existingDeployment,
        novaProofAggregator: novaAddress,
        deployedAt: new Date().toISOString(),
        deployer: deployer.address,
        network: networkName,
        chainId: hre.network.config.chainId
    };

    fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
    console.log("📝 Deployment info saved to:", deploymentsPath);

    // Verify contract if on a live network
    if (networkName !== "hardhat" && networkName !== "localhost") {
        console.log("⏳ Waiting for block confirmations...");
        await novaProofAggregator.deploymentTransaction().wait(5);
        
        try {
            console.log("🔍 Verifying contract...");
            await hre.run("verify:verify", {
                address: novaAddress,
                constructorArguments: [
                    VRF_COORDINATOR,
                    FUNCTIONS_ROUTER,
                    VRF_SUBSCRIPTION_ID,
                    VRF_KEY_HASH,
                    FUNCTIONS_SUBSCRIPTION_ID,
                    FUNCTIONS_DON_ID,
                    groth16VerifierAddress,
                    groth16VerifierAddress,
                    zkProofAggregatorAddress
                ],
            });
            console.log("✅ Contract verified successfully");
        } catch (error) {
            console.log("❌ Contract verification failed:", error.message);
        }
    }

    console.log("\n=== NOVA DEPLOYMENT SUMMARY ===");
    console.log("NovaProofAggregator:", novaAddress);
    console.log("Base ZK Contract:", zkProofAggregatorAddress);
    console.log("Groth16 Verifier:", groth16VerifierAddress);
    console.log("Network:", networkName);
    console.log("Deployer:", deployer.address);
    
    console.log("\n🎯 Next steps:");
    console.log("1. Update NEXT_PUBLIC_NOVA_PROOF_AGGREGATOR_ADDRESS in your .env file");
    console.log("2. Test the Nova folding functionality");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    }); 