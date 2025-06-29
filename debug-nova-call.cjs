const { ethers } = require("hardhat");

async function main() {
    // Load deployment addresses
    const deployments = JSON.parse(require('fs').readFileSync('deployments/deployed-contracts.json', 'utf8'));
    
    const novaAddress = "0xB09Cd03EBD45cF532F1F24F7dfeF570b6C93dAB5";
    const zkAddress = "0xb8924280E730AC650191203BefdC867034f07b51";
    
    // Get contracts
    const NovaProofAggregator = await ethers.getContractFactory("NovaProofAggregator");
    const nova = NovaProofAggregator.attach(novaAddress);
    
    const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
    const zk = ZKProofAggregator.attach(zkAddress);
    
    // Test call with proof IDs [2, 4] (the valid ones according to logs)
    const proofIds = [2, 4]; // Using 1-based indexing from the logs
    
    console.log("=== Testing individual components ===");
    
    try {
        // First check the Nova contract parameters
        const minProofs = await nova.minProofsPerBatch();
        const maxProofs = await nova.maxProofsPerBatch();
        console.log("Min proofs per batch:", minProofs.toString());
        console.log("Max proofs per batch:", maxProofs.toString());
        console.log("Proof IDs count:", proofIds.length);
        
        // Check if proof count is valid
        if (proofIds.length < minProofs || proofIds.length > maxProofs) {
            console.log("❌ Invalid proof count");
            return;
        } else {
            console.log("✅ Proof count is valid");
        }
        
        // Check individual proofs
        for (let i = 0; i < proofIds.length; i++) {
            const proofId = proofIds[i];
            console.log(`\n--- Checking proof ${proofId} ---`);
            
            try {
                const proof = await zk.getProofRequest(proofId);
                console.log("Proof data:", {
                    requester: proof.requester,
                    isCompleted: proof.isCompleted,
                    isValid: proof.isValid,
                    sourceChain: proof.sourceChain,
                    blockNumber: proof.blockNumber.toString(),
                    stateRoot: proof.stateRoot
                });
                
                if (!proof.isCompleted) {
                    console.log("❌ Proof not completed");
                } else {
                    console.log("✅ Proof is completed");
                }
                
                if (!proof.isValid) {
                    console.log("❌ Proof not valid");
                } else {
                    console.log("✅ Proof is valid");
                }
                
                // Check if proof is already in a batch
                const batchId = await nova.proofToBatch(proofId);
                if (batchId > 0) {
                    console.log("❌ Proof already in batch:", batchId.toString());
                } else {
                    console.log("✅ Proof not in any batch");
                }
                
            } catch (error) {
                console.log("❌ Error getting proof data:", error.message);
            }
        }
        
        console.log("\n=== Testing the actual call ===");
        
        // Try to call the function to see if it would revert
        await nova.startNovaFolding.staticCall(proofIds);
        console.log("✅ Static call succeeded - transaction should work");
        
        // If static call succeeds, try actual transaction
        const tx = await nova.startNovaFolding(proofIds);
        console.log("Transaction sent:", tx.hash);
        
        const receipt = await tx.wait();
        console.log("Transaction confirmed:", receipt.hash);
        
    } catch (error) {
        console.error("\n❌ Transaction failed with error:");
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        if (error.data) {
            console.error("Error data:", error.data);
        }
        
        if (error.reason) {
            console.error("Revert reason:", error.reason);
        }
        
        // Try to decode specific error
        if (error.data === '0x71e83137') {
            console.error("This appears to be a custom error signature 0x71e83137");
            console.error("This might be related to Chainlink Functions or VRF setup");
        }
    }
}

main().catch(console.error); 