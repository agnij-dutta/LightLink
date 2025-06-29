const { ethers } = require("hardhat");

async function main() {
    const novaAddress = "0xB09Cd03EBD45cF532F1F24F7dfeF570b6C93dAB5";
    const zkAddress = "0xb8924280E730AC650191203BefdC867034f07b51";
    
    // Get contracts
    const NovaProofAggregator = await ethers.getContractFactory("NovaProofAggregator");
    const nova = NovaProofAggregator.attach(novaAddress);
    
    const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
    const zk = ZKProofAggregator.attach(zkAddress);
    
    console.log("=== Nova Contract Configuration ===");
    
    try {
        // Check Nova-specific parameters
        const minProofs = await nova.minProofsPerBatch();
        const maxProofs = await nova.maxProofsPerBatch();
        const maxRecursion = await nova.maxRecursionDepth();
        const batchCounter = await nova.batchCounter();
        
        console.log("Nova Parameters:");
        console.log("- Min proofs per batch:", minProofs.toString());
        console.log("- Max proofs per batch:", maxProofs.toString());
        console.log("- Max recursion depth:", maxRecursion.toString());
        console.log("- Batch counter:", batchCounter.toString());
        
        // Check base ZK contract reference
        const baseContract = await nova.baseZKContract();
        console.log("- Base ZK contract:", baseContract);
        console.log("- Expected ZK contract:", zkAddress);
        console.log("- Base contract matches:", baseContract.toLowerCase() === zkAddress.toLowerCase());
        
    } catch (error) {
        console.error("Error reading Nova config:", error.message);
    }
    
    console.log("\n=== ZK Contract Configuration ===");
    
    try {
        // Check ZK contract parameters
        const zkRequestCounter = await zk.requestCounter();
        const proofServiceUrl = await zk.s_proofServiceUrl();
        
        console.log("ZK Parameters:");
        console.log("- Request counter:", zkRequestCounter.toString());
        console.log("- Proof service URL:", proofServiceUrl);
        
        // Check Chainlink configuration
        const functionsSubId = await zk.s_functionsSubscriptionId();
        const vrfSubId = await zk.s_vrfSubscriptionId();
        
        console.log("Chainlink Configuration:");
        console.log("- Functions subscription ID:", functionsSubId.toString());
        console.log("- VRF subscription ID:", vrfSubId.toString());
        
    } catch (error) {
        console.error("Error reading ZK config:", error.message);
    }
    
    console.log("\n=== Testing Proof Access ===");
    
    // Test reading a specific proof
    try {
        const proof2 = await nova.baseZKContract.getProofRequest ?
            await nova.baseZKContract.getProofRequest(2) :
            await zk.getProofRequest(2);
        console.log("Proof 2 accessible via Nova contract:", !!proof2);
    } catch (error) {
        console.error("Error accessing proof via Nova:", error.message);
    }
    
    try {
        const proof2 = await zk.getProofRequest(2);
        console.log("Proof 2 accessible via ZK contract:", !!proof2);
    } catch (error) {
        console.error("Error accessing proof via ZK:", error.message);
    }
}

main().catch(console.error); 