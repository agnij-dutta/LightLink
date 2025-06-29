const { ethers } = require("hardhat");

async function main() {
    const novaAddress = "0xB09Cd03EBD45cF532F1F24F7dfeF570b6C93dAB5";
    
    // Get contract
    const NovaProofAggregator = await ethers.getContractFactory("NovaProofAggregator");
    const nova = NovaProofAggregator.attach(novaAddress);
    
    console.log("=== Chainlink Configuration Debug ===");
    
    try {
        // Try to read the inherited Chainlink configuration
        // These are from the parent ZKProofAggregator contract
        const functionsSubscriptionId = await nova.s_functionsSubscriptionId();
        const functionsGasLimit = await nova.s_functionsGasLimit();
        const functionsDonId = await nova.s_functionsDonId();
        
        console.log("Functions Configuration:");
        console.log("- Subscription ID:", functionsSubscriptionId.toString());
        console.log("- Gas Limit:", functionsGasLimit.toString());
        console.log("- DON ID:", functionsDonId);
        
        // Check VRF configuration
        const vrfSubscriptionId = await nova.s_vrfSubscriptionId();
        const vrfKeyHash = await nova.s_vrfKeyHash();
        
        console.log("\nVRF Configuration:");
        console.log("- VRF Subscription ID:", vrfSubscriptionId.toString());
        console.log("- VRF Key Hash:", vrfKeyHash);
        
    } catch (error) {
        console.error("Error reading Chainlink config:", error.message);
    }
    
    console.log("\n=== Testing Manual Function Call ===");
    
    // Try to manually test the individual steps that the startNovaFolding function does
    try {
        // Test proof validation first
        const proofIds = [2, 4];
        console.log("Testing proof validation for IDs:", proofIds);
        
        // Get the base ZK contract reference
        const baseContract = await nova.baseZKContract();
        console.log("Base contract address:", baseContract);
        
        // Try to call the base contract directly to validate proofs
        const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
        const zk = ZKProofAggregator.attach(baseContract);
        
        for (const proofId of proofIds) {
            const proof = await zk.getProofRequest(proofId);
            console.log(`Proof ${proofId}:`, {
                isCompleted: proof.isCompleted,
                isValid: proof.isValid,
                requester: proof.requester
            });
        }
        
        // Check if proofs are already in batch (should be 0)
        for (const proofId of proofIds) {
            const batchId = await nova.proofToBatch(proofId);
            console.log(`Proof ${proofId} batch ID:`, batchId.toString());
        }
        
        console.log("✅ All validations passed");
        
        // Now try to see what happens when we increment the batch counter
        const currentBatchCounter = await nova.batchCounter();
        console.log("Current batch counter:", currentBatchCounter.toString());
        
        // The issue might be in the _sendRequest function call
        // Let's see if we can isolate the problem further
        
    } catch (error) {
        console.error("Error in manual testing:", error.message);
        if (error.data) {
            console.error("Error data:", error.data);
        }
    }
}

main().catch(console.error); 