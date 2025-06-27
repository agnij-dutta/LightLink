#!/usr/bin/env node

/**
 * Initialize ZK Proof Service URL on the deployed contract
 * 
 * This script:
 * 1. Connects to the deployed ZKProofAggregator contract
 * 2. Sets the proof service URL to the Vercel API endpoint
 */

import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current file directory (ES modules equivalent of __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log('Initializing ZK Proof Service URL on the deployed contract...');
  
  // Load deployment data
  const deploymentPath = path.join(__dirname, '../deployments/avalancheFuji-deployment.json');
  let deploymentData;
  
  try {
    deploymentData = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
  } catch (error) {
    console.error('Error loading deployment data:', error);
    process.exit(1);
  }
  
  const zkProofAggregatorAddress = deploymentData.zkProofAggregator;
  if (!zkProofAggregatorAddress) {
    console.error('ZKProofAggregator address not found in deployment data');
    process.exit(1);
  }
  
  console.log(`ZKProofAggregator address: ${zkProofAggregatorAddress}`);
  
  // Connect to the contract
  const [deployer] = await ethers.getSigners();
  console.log(`Using account: ${deployer.address}`);
  
  const ZKProofAggregator = await ethers.getContractFactory('ZKProofAggregator');
  const zkProofAggregator = ZKProofAggregator.attach(zkProofAggregatorAddress);
  
  // Set the proof service URL to the new Render.com service
  const proofServiceUrl = 'https://light-link.vercel.app/api/prove';
  console.log(`Setting proof service URL to: ${proofServiceUrl}`);
  
  try {
    // Initialize the proof service
    const tx = await zkProofAggregator.initializeProofService();
    console.log(`Transaction hash: ${tx.hash}`);
    
    // Wait for the transaction to be mined
    console.log('Waiting for transaction confirmation...');
    await tx.wait();
    
    console.log('✅ ZK Proof Service URL initialized successfully!');
  } catch (error) {
    console.error('Error initializing ZK Proof Service URL:', error);
    process.exit(1);
  }
}

// Execute the script
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 