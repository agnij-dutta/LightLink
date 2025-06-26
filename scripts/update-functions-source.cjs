#!/usr/bin/env node

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const CONTRACT_ADDRESS = "0xfF532DC0d5611fAC2B857CE353f6606685Bc2ABF";
  const FUNCTIONS_SOURCE_PATH = path.join(__dirname, "functions/zkProofGeneration.min.js");

  // Read the latest JS source
  let functionsSource;
  try {
    functionsSource = fs.readFileSync(FUNCTIONS_SOURCE_PATH, "utf8");
  } catch (err) {
    console.error(`❌ Failed to read JS source at ${FUNCTIONS_SOURCE_PATH}:`, err.message);
    process.exit(1);
  }

  // Connect to the contract
  const [deployer] = await ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);
  const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
  const zkProofAggregator = ZKProofAggregator.attach(CONTRACT_ADDRESS);

  // Update the source
  try {
    console.log(`Updating Chainlink Functions source on contract: ${CONTRACT_ADDRESS}`);
    const tx = await zkProofAggregator.setFunctionsSource(functionsSource);
    console.log(`Transaction sent: ${tx.hash}`);
    console.log("Waiting for confirmation...");
    await tx.wait();
    console.log("✅ Chainlink Functions source updated successfully!");
  } catch (err) {
    console.error("❌ Failed to update Functions source:", err.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Script error:", err);
  process.exit(1);
}); 