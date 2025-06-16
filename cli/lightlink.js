#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs';
import path from 'path';
import { ethers } from 'ethers';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Get directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const program = new Command();

// Contract ABIs (simplified - in production these would be imported from artifacts)
const ZK_PROOF_AGGREGATOR_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/ZKProofAggregator.sol/ZKProofAggregator.json'), 'utf8')).abi;
const GROTH16_VERIFIER_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/Groth16Verifier.sol/Groth16Verifier.json'), 'utf8')).abi;
const CROSS_CHAIN_VERIFIER_ABI = JSON.parse(fs.readFileSync(path.join(__dirname, '../artifacts/contracts/CrossChainVerifier.sol/CrossChainVerifier.json'), 'utf8')).abi;

// Network configurations
const NETWORKS = {
  hardhat: {
    name: 'Hardhat Local Network',
    rpcUrl: 'http://127.0.0.1:8545',
    chainId: 31337,
    blockExplorer: 'http://localhost:8545',
  },
  fuji: {
    name: 'Avalanche Fuji Testnet',
    rpcUrl: 'https://api.avax-test.network/ext/bc/C/rpc',
    chainId: 43113,
    blockExplorer: 'https://testnet.snowtrace.io',
    linkToken: '0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846',
    vrfCoordinator: '0x2eD832Ba664535e5886b75D64C46EB9a228C2610',
    functionsRouter: '0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0',
    ccipRouter: '0xF694E193200268f9a4868e4Aa017A0118C9a8177'
  },
  mumbai: {
    name: 'Polygon Mumbai Testnet',
    rpcUrl: 'https://rpc-mumbai.maticvigil.com',
    chainId: 80001,
    blockExplorer: 'https://mumbai.polygonscan.com',
    linkToken: '0x326C977E6efc84E512bB9C30f76E30c160eD06FB',
    vrfCoordinator: '0x7a1BaC17Ccc5b313516C5E16fb24f7659aA5ebed',
    functionsRouter: '0x6E2dc0F9DB014aE19888F539E59285D2Ea04244C',
    ccipRouter: '0x1035CabC275068e0F4b745A29CEDf38E13aF41b1'
  }
};

// Global variables
let provider;
let signer;
let deployedContracts = {};

// Load deployed contract addresses
function loadDeployedContracts() {
  const contractsPath = path.join(__dirname, '../deployments/deployed-contracts.json');
  if (fs.existsSync(contractsPath)) {
    try {
      deployedContracts = JSON.parse(fs.readFileSync(contractsPath, 'utf8'));
    } catch (error) {
      console.warn(chalk.yellow('Warning: Could not load deployed contracts'));
    }
  }
}

// Save deployed contract addresses
function saveDeployedContracts() {
  const deploymentsDir = path.join(__dirname, '../deployments');
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, 'deployed-contracts.json'),
    JSON.stringify(deployedContracts, null, 2)
  );
}

// Initialize provider and signer
async function initializeWallet(networkName) {
  const network = NETWORKS[networkName];
  if (!network) {
    throw new Error(`Network ${networkName} not supported. Available: ${Object.keys(NETWORKS).join(', ')}`);
  }

  provider = new ethers.JsonRpcProvider(network.rpcUrl);
  
  // For hardhat local network, use the first default account
  if (networkName === 'hardhat') {
    // Use hardhat default private key
    const defaultPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
    signer = new ethers.Wallet(defaultPrivateKey, provider);
  } else {
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable not set');
    }
    signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  }
  
  console.log(chalk.green(`Connected to ${network.name}`));
  console.log(chalk.blue(`Wallet address: ${signer.address}`));
  
  const balance = await provider.getBalance(signer.address);
  console.log(chalk.blue(`Balance: ${ethers.formatEther(balance)} ETH`));
}

// Request proof command
program
  .command('request-proof')
  .description('Request a ZK proof for a specific chain and block')
  .option('-n, --network <network>', 'Network to connect to', 'hardhat')
  .option('-c, --chain <chain>', 'Source chain to verify', 'ethereum')
  .option('-b, --block <block>', 'Block number to verify', 'latest')
  .option('-a, --address <address>', 'ZKProofAggregator contract address')
  .action(async (options) => {
    const spinner = ora('Requesting ZK proof...').start();
    
    try {
      await initializeWallet(options.network);
      loadDeployedContracts();
      
      let contractAddress = options.address;
      if (!contractAddress && deployedContracts[options.network]) {
        contractAddress = deployedContracts[options.network].zkProofAggregator;
      }
      
      if (!contractAddress) {
        throw new Error('No ZKProofAggregator contract address found. Use --address option or deploy first.');
      }
      
      const zkProofAggregator = new ethers.Contract(contractAddress, ZK_PROOF_AGGREGATOR_ABI, signer);
      
      // Convert block number
      let blockNumber = 0;
      if (options.block === 'latest') {
        const latestBlock = await provider.getBlockNumber();
        blockNumber = latestBlock;
      } else {
        blockNumber = parseInt(options.block);
      }
      
      spinner.text = `Requesting proof for ${options.chain} block ${blockNumber}...`;
      
      const tx = await zkProofAggregator.requestProofVerification(options.chain, blockNumber);
      const receipt = await tx.wait();
      
      spinner.succeed('Proof request submitted successfully!');
      
      console.log(chalk.green('\n📄 Transaction Details:'));
      console.log(chalk.blue(`Transaction Hash: ${receipt.hash}`));
      console.log(chalk.blue(`Gas Used: ${receipt.gasUsed.toString()}`));
      console.log(chalk.blue(`Block Number: ${receipt.blockNumber}`));
      
      // Get request ID from logs
      const requestEvent = receipt.logs.find(log => {
        try {
          const parsedLog = zkProofAggregator.interface.parseLog(log);
          return parsedLog.name === 'ProofRequested';
        } catch {
          return false;
        }
      });
      
      if (requestEvent) {
        const parsedLog = zkProofAggregator.interface.parseLog(requestEvent);
        console.log(chalk.blue(`Request ID: ${parsedLog.args.requestId}`));
      }
      
    } catch (error) {
      spinner.fail('Proof request failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Check proof status command
program
  .command('check-status')
  .description('Check the status of a proof request')
  .option('-n, --network <network>', 'Network to connect to', 'hardhat')
  .option('-r, --request-id <id>', 'Request ID to check')
  .option('-a, --address <address>', 'ZKProofAggregator contract address')
  .action(async (options) => {
    const spinner = ora('Checking proof status...').start();
    
    try {
      await initializeWallet(options.network);
      loadDeployedContracts();
      
      if (!options.requestId) {
        throw new Error('Request ID is required. Use --request-id option.');
      }
      
      let contractAddress = options.address;
      if (!contractAddress && deployedContracts[options.network]) {
        contractAddress = deployedContracts[options.network].zkProofAggregator;
      }
      
      if (!contractAddress) {
        throw new Error('No ZKProofAggregator contract address found. Use --address option or deploy first.');
      }
      
      const zkProofAggregator = new ethers.Contract(contractAddress, ZK_PROOF_AGGREGATOR_ABI, signer);
      
      const request = await zkProofAggregator.getProofRequest(options.requestId);
      const isVerified = await zkProofAggregator.isStateVerified(request.sourceChain, request.blockNumber);
      
      spinner.succeed('Status check completed!');
      
      console.log(chalk.green('\n📄 Proof Request Status:'));
      console.log(chalk.blue(`Request ID: ${options.requestId}`));
      console.log(chalk.blue(`Source Chain: ${request.sourceChain}`));
      console.log(chalk.blue(`Block Number: ${request.blockNumber.toString()}`));
      console.log(chalk.blue(`Requester: ${request.requester}`));
      console.log(chalk.blue(`Timestamp: ${new Date(Number(request.timestamp) * 1000).toISOString()}`));
      console.log(chalk.blue(`Verified: ${isVerified ? 'Yes' : 'No'}`));
      
    } catch (error) {
      spinner.fail('Status check failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// List contracts command
program
  .command('list-contracts')
  .description('List deployed contract addresses')
  .option('-n, --network <network>', 'Network to list contracts for', 'hardhat')
  .action(async (options) => {
    loadDeployedContracts();
    
    console.log(chalk.green(`\n📄 Deployed Contracts on ${options.network}:`));
    
    if (!deployedContracts[options.network]) {
      console.log(chalk.yellow('No contracts deployed on this network.'));
      return;
    }
    
    const contracts = deployedContracts[options.network];
    
    if (contracts.groth16Verifier) {
      console.log(chalk.blue(`Groth16 Verifier: ${contracts.groth16Verifier}`));
    }
    if (contracts.zkProofAggregator) {
      console.log(chalk.blue(`ZK Proof Aggregator: ${contracts.zkProofAggregator}`));
    }
    if (contracts.crossChainVerifier) {
      console.log(chalk.blue(`Cross Chain Verifier: ${contracts.crossChainVerifier}`));
    }
    
    if (contracts.deployedAt) {
      console.log(chalk.blue(`Deployed At: ${contracts.deployedAt}`));
    }
    if (contracts.deployer) {
      console.log(chalk.blue(`Deployer: ${contracts.deployer}`));
    }
  });

// Get deployment configuration
async function getDeploymentParams(options, network) {
  return {
    vrfCoordinator: network.vrfCoordinator || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    functionsRouter: network.functionsRouter || '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    vrfSubscriptionId: options.vrfSubscriptionId || 1,
    keyHash: '0x474e34a077df58807dbe9c96d3c009b23b3c6d0cce433e59bbf5b34f823bc56c',
    functionsSubscriptionId: options.functionsSubscriptionId || 1,
    functionsDonId: '0x66756e2d657468657265756d2d73657075616e2d310000000000000000000000'
  };
}

// Configure program
program
  .name('lightlink')
  .description('LightLink ZK Oracle CLI')
  .version('1.0.0');

program.parse(); 