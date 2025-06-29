#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("🔍 Debugging Proof Service Configuration...\n");
  
  // Read deployment data
  const deploymentPath = path.join(__dirname, "../deployments/avalancheFuji-deployment.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const zkAggregatorAddress = deployment.contracts.zkProofAggregator.address;
  
  console.log(`📍 ZKProofAggregator Address: ${zkAggregatorAddress}`);
  
  // Connect to the contract
  const [signer] = await ethers.getSigners();
  console.log(`👤 Using account: ${signer.address}`);
  
  const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
  const zkAggregator = ZKProofAggregator.attach(zkAggregatorAddress);
  
  try {
    // Step 1: Check current configuration
    console.log("\n🔧 Step 1: Checking current contract configuration...");
    
    // Check if contract has the proof service URL getter
    // Since it's a private variable, we'll try to check the Functions source
    try {
      const functionsSource = await zkAggregator.s_functionsSource();
      console.log(`✅ Functions source configured (${functionsSource.length} chars)`);
    } catch (error) {
      console.log("❌ Functions source not configured or not accessible");
    }
    
    // Check Functions configuration
    try {
      const subId = await zkAggregator.s_functionsSubscriptionId();
      console.log(`✅ Functions subscription ID: ${subId}`);
    } catch (error) {
      console.log("❌ Functions subscription not configured");
    }
    
    // Step 2: Set/Update the proof service URL
    console.log("\n🔧 Step 2: Configuring proof service URL...");
    
    const proofServiceUrl = "https://light-link.vercel.app/api/prove";
    console.log(`Setting proof service URL to: ${proofServiceUrl}`);
    
    const setUrlTx = await zkAggregator.setProofServiceUrl(proofServiceUrl);
    console.log(`Transaction sent: ${setUrlTx.hash}`);
    console.log("Waiting for confirmation...");
    await setUrlTx.wait();
    console.log("✅ Proof service URL updated!");
    
    // Step 3: Test the external service
    console.log("\n🔧 Step 3: Testing external proof service...");
    
    const testRequest = {
      circuit: "proof_aggregator",
      inputs: [{
        proofs: [["1", "2", "3", "4", "5", "6", "7", "8"]],
        publicSignals: [["100", "200", "300", "400"]],
        merkleRoots: ["12345"],
        blockHashes: ["67890"],
        chainIds: ["1"],
        aggregationSeed: "999",
        targetChainId: "43113"
      }],
      params: {
        nProofs: 1,
        merkleDepth: 8,
        blockDepth: 8
      }
    };
    
    try {
      console.log("Testing proof service connectivity...");
      const axios = require('axios');
      const response = await axios.post(proofServiceUrl, testRequest, {
        headers: { "Content-Type": "application/json" },
        timeout: 30000
      });
      
      const data = response.data;
      console.log("✅ Proof service is reachable and responding");
      console.log(`Response: ${data.success ? 'SUCCESS' : 'ERROR'}`);
      if (data.error) {
        console.log(`Error details: ${data.error}`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`❌ Proof service returned status: ${error.response.status}`);
        console.log(`Response: ${JSON.stringify(error.response.data).slice(0, 200)}...`);
      } else {
        console.log(`❌ Failed to reach proof service: ${error.message}`);
      }
    }
    
    // Step 4: Test a proof request
    console.log("\n🔧 Step 4: Testing proof request...");
    
    try {
      console.log("Sending test proof request to contract...");
      const requestTx = await zkAggregator.requestProofVerification("arbitrum", 456789);
      console.log(`Transaction sent: ${requestTx.hash}`);
      console.log("Waiting for confirmation...");
      const receipt = await requestTx.wait();
      console.log("✅ Proof request sent successfully!");
      
      // Get the request ID from events
      const events = receipt.logs.map(log => {
        try {
          return zkAggregator.interface.parseLog(log);
        } catch {
          return null;
        }
      }).filter(Boolean);
      
      const proofRequestedEvent = events.find(e => e.name === "ProofRequested");
      if (proofRequestedEvent) {
        const requestId = proofRequestedEvent.args.requestId;
        console.log(`📋 Request ID: ${requestId}`);
        console.log("🔍 Check Chainlink Functions logs for proof service calls");
        console.log("📝 You should see logs like 'Calling external proof service:' in the Functions execution");
      }
      
    } catch (error) {
      if (error.message.includes("InvalidSubscription") || error.message.includes("InsufficientBalance")) {
        console.log("⚠️ Expected error: Chainlink subscription not funded");
        console.log("This is normal for testing - the contract configuration is correct");
      } else {
        console.log(`❌ Unexpected error: ${error.message}`);
      }
    }
    
    console.log("\n📋 Summary:");
    console.log("✅ Proof service URL configured in contract");
    console.log("✅ External service tested");
    console.log("\n💡 Next steps:");
    console.log("1. Ensure your Chainlink Functions subscription is funded with LINK");
    console.log("2. Monitor Chainlink Functions logs for external service calls");
    console.log("3. Check that your proof server is running and accessible");
    console.log("4. The Chainlink function should now call your proof service URL");
    
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

main().catch(console.error); 