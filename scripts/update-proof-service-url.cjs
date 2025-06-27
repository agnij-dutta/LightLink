#!/usr/bin/env node

const { ethers } = require("hardhat");

async function main() {
  const CONTRACT_ADDRESS = "0xfF532DC0d5611fAC2B857CE353f6606685Bc2ABF";
  const NEW_PROOF_SERVICE_URL = "https://light-link.vercel.app/api/prove";

  // Connect to the contract
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);
  
  const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
  const zkProofAggregator = ZKProofAggregator.attach(CONTRACT_ADDRESS);

  // Update the proof service URL
  try {
    console.log(`Updating proof service URL to: ${NEW_PROOF_SERVICE_URL}`);
    const tx = await zkProofAggregator.setProofServiceUrl(NEW_PROOF_SERVICE_URL);
    console.log(`Transaction sent: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    await tx.wait();
    console.log("✅ Proof service URL updated successfully!");
    console.log("✅ The contract now uses the new Vercel deployment for ZK proof generation");
    
  } catch (err) {
    console.error("❌ Failed to update proof service URL:", err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
}); 