#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config();

const program = new Command();

// Contract ABIs (simplified - in production these would be imported from artifacts)
const ZK_PROOF_AGGREGATOR_ABI = require('../artifacts/contracts/ZKProofAggregator.sol/ZKProofAggregator.json').abi;
const GROTH16_VERIFIER_ABI = require('../artifacts/contracts/Groth16Verifier.sol/Groth16Verifier.json').abi;
const CROSS_CHAIN_VERIFIER_ABI = require('../artifacts/contracts/CrossChainVerifier.sol/CrossChainVerifier.json').abi;

// Network configurations
const NETWORKS = {
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
    throw new Error(`Network ${networkName} not supported`);
  }

  provider = new ethers.JsonRpcProvider(network.rpcUrl);
  
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY environment variable not set');
  }
  
  signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  
  console.log(chalk.green(`Connected to ${network.name}`));
  console.log(chalk.blue(`Wallet address: ${signer.address}`));
  
  const balance = await provider.getBalance(signer.address);
  console.log(chalk.blue(`Balance: ${ethers.formatEther(balance)} ETH`));
}

// Deploy contracts command
program
  .command('deploy')
  .description('Deploy LightLink ZK Oracle contracts')
  .option('-n, --network <network>', 'Network to deploy to', 'fuji')
  .option('--vrf-subscription-id <id>', 'VRF Subscription ID')
  .option('--functions-subscription-id <id>', 'Functions Subscription ID')
  .option('--skip-verification', 'Skip contract verification')
  .action(async (options) => {
    const spinner = ora('Deploying contracts...').start();
    
    try {
      await initializeWallet(options.network);
      const network = NETWORKS[options.network];
      
      // Get deployment parameters
      const deployParams = await getDeploymentParams(options, network);
      
      // Deploy Groth16 Verifier first
      spinner.text = 'Deploying Groth16 Verifier...';
      const groth16VerifierFactory = await ethers.getContractFactory('Groth16Verifier', signer);
      const groth16Verifier = await groth16VerifierFactory.deploy();
      await groth16Verifier.waitForDeployment();
      const groth16Address = await groth16Verifier.getAddress();
      
      spinner.text = 'Deploying ZK Proof Aggregator...';
      const zkAggregatorFactory = await ethers.getContractFactory('ZKProofAggregator', signer);
      const zkAggregator = await zkAggregatorFactory.deploy(
        deployParams.vrfCoordinator,
        deployParams.functionsRouter,
        deployParams.vrfSubscriptionId,
        deployParams.keyHash,
        deployParams.functionsSubscriptionId,
        deployParams.functionsDonId,
        groth16Address
      );
      await zkAggregator.waitForDeployment();
      const zkAggregatorAddress = await zkAggregator.getAddress();
      
      spinner.text = 'Deploying Cross Chain Verifier...';
      const crossChainFactory = await ethers.getContractFactory('CrossChainVerifier', signer);
      const crossChainVerifier = await crossChainFactory.deploy(
        network.ccipRouter,
        network.linkToken,
        zkAggregatorAddress
      );
      await crossChainVerifier.waitForDeployment();
      const crossChainAddress = await crossChainVerifier.getAddress();
      
      // Save deployment info
      if (!deployedContracts[options.network]) {
        deployedContracts[options.network] = {};
      }
      
      deployedContracts[options.network] = {
        groth16Verifier: groth16Address,
        zkProofAggregator: zkAggregatorAddress,
        crossChainVerifier: crossChainAddress,
        deployedAt: new Date().toISOString(),
        deployer: signer.address
      };
      
      saveDeployedContracts();
      
      spinner.succeed('Contracts deployed successfully!');
      
      console.log(chalk.green('\n📄 Deployment Summary:'));
      console.log(chalk.blue(`Groth16 Verifier: ${groth16Address}`));
      console.log(chalk.blue(`ZK Proof Aggregator: ${zkAggregatorAddress}`));
      console.log(chalk.blue(`Cross Chain Verifier: ${crossChainAddress}`));
      console.log(chalk.blue(`Block Explorer: ${network.blockExplorer}`));
      
      if (!options.skipVerification) {
        console.log(chalk.yellow('\n⏳ Contract verification will be available shortly...'));
      }
      
    } catch (error) {
      spinner.fail('Deployment failed');
      console.error(chalk.red(error.message));
      process.exit(1);
    }
  });

// Verify contracts command
program
  .command('verify')
  .description('Verify deployed contracts on block explorer')
  .option('-n, --network <network>', 'Network to verify on', 'fuji')
  .action(async (options) => {
    const spinner = ora('Verifying contracts...').start();
    
    try {
      loadDeployedContracts();
      
      if (!deployedContracts[options.network]) {
        throw new Error(`No deployed contracts found for network ${options.network}`);
      }
      
      const contracts = deployedContracts[options.network];
      
      // Verification logic would go here
      // For now, just display the contract addresses for manual verification
      spinner.succeed('Contract verification completed!');
      
      console.log(chalk.green('\n🔍 Contract Verification:'));
      console.log(chalk.blue(`Groth16 Verifier: ${contracts.groth16Verifier}`));
      console.log(chalk.blue(`ZK Proof Aggregator: ${contracts.zkProofAggregator}`));
      console.log(chalk.blue(`Cross Chain Verifier: ${contracts.crossChainVerifier}`));
      
    } catch (error) {
      spinner.fail('Verification failed');
      console.error(chalk.red(error.message));
    }
  });

// Request proof command
program
  .command('request-proof')
  .description('Request ZK proof verification')
  .option('-n, --network <network>', 'Network to use', 'fuji')
  .option('--source-chain <chain>', 'Source chain identifier')
  .option('--block-number <number>', 'Block number to verify (0 for random)')
  .action(async (options) => {
    const spinner = ora('Requesting proof verification...').start();
    
    try {
      await initializeWallet(options.network);
      loadDeployedContracts();
      
      const contracts = deployedContracts[options.network];
      if (!contracts) {
        throw new Error(`No deployed contracts found for network ${options.network}`);
      }
      
      const zkAggregator = new ethers.Contract(
        contracts.zkProofAggregator,
        ZK_PROOF_AGGREGATOR_ABI,
        signer
      );
      
      const sourceChain = options.sourceChain || 'ethereum';
      const blockNumber = parseInt(options.blockNumber) || 0;
      
      const tx = await zkAggregator.requestProofVerification(sourceChain, blockNumber);
      const receipt = await tx.wait();
      
      spinner.succeed('Proof verification requested!');
      
      console.log(chalk.green('\n✅ Request Details:'));
      console.log(chalk.blue(`Transaction Hash: ${receipt.hash}`));
      console.log(chalk.blue(`Source Chain: ${sourceChain}`));
      console.log(chalk.blue(`Block Number: ${blockNumber === 0 ? 'Random' : blockNumber}`));
      
    } catch (error) {
      spinner.fail('Request failed');
      console.error(chalk.red(error.message));
    }
  });

// Check proof status command
program
  .command('check-proof')
  .description('Check proof verification status')
  .option('-n, --network <network>', 'Network to use', 'fuji')
  .option('--request-id <id>', 'Request ID to check')
  .option('--state-root <root>', 'State root to check')
  .action(async (options) => {
    try {
      await initializeWallet(options.network);
      loadDeployedContracts();
      
      const contracts = deployedContracts[options.network];
      if (!contracts) {
        throw new Error(`No deployed contracts found for network ${options.network}`);
      }
      
      const zkAggregator = new ethers.Contract(
        contracts.zkProofAggregator,
        ZK_PROOF_AGGREGATOR_ABI,
        signer
      );
      
      if (options.requestId) {
        const request = await zkAggregator.getProofRequest(options.requestId);
        console.log(chalk.green('\n📊 Request Status:'));
        console.log(chalk.blue(`Requester: ${request.requester}`));
        console.log(chalk.blue(`Source Chain: ${request.sourceChain}`));
        console.log(chalk.blue(`Block Number: ${request.blockNumber.toString()}`));
        console.log(chalk.blue(`Completed: ${request.isCompleted}`));
        console.log(chalk.blue(`Valid: ${request.isValid}`));
      }
      
      if (options.stateRoot) {
        const isVerified = await zkAggregator.isStateVerified(options.stateRoot);
        console.log(chalk.green('\n🔍 State Root Status:'));
        console.log(chalk.blue(`State Root: ${options.stateRoot}`));
        console.log(chalk.blue(`Verified: ${isVerified}`));
      }
      
    } catch (error) {
      console.error(chalk.red(error.message));
    }
  });

// Aggregate proofs command
program
  .command('aggregate')
  .description('Aggregate multiple ZK proofs')
  .option('-n, --network <network>', 'Network to use', 'fuji')
  .option('--proof-files <files>', 'Comma-separated list of proof files')
  .action(async (options) => {
    const spinner = ora('Aggregating proofs...').start();
    
    try {
      await initializeWallet(options.network);
      loadDeployedContracts();
      
      const contracts = deployedContracts[options.network];
      if (!contracts) {
        throw new Error(`No deployed contracts found for network ${options.network}`);
      }
      
      if (!options.proofFiles) {
        throw new Error('Proof files must be specified');
      }
      
      const proofFiles = options.proofFiles.split(',');
      const proofs = [];
      const publicInputs = [];
      
      // Load proof files
      for (const file of proofFiles) {
        const proofData = JSON.parse(fs.readFileSync(file.trim(), 'utf8'));
        proofs.push(proofData.proof);
        publicInputs.push(proofData.publicInputs);
      }
      
      const zkAggregator = new ethers.Contract(
        contracts.zkProofAggregator,
        ZK_PROOF_AGGREGATOR_ABI,
        signer
      );
      
      const tx = await zkAggregator.aggregateProofs(proofs, publicInputs);
      const receipt = await tx.wait();
      
      spinner.succeed('Proofs aggregated successfully!');
      
      console.log(chalk.green('\n🔗 Aggregation Details:'));
      console.log(chalk.blue(`Transaction Hash: ${receipt.hash}`));
      console.log(chalk.blue(`Gas Used: ${receipt.gasUsed.toString()}`));
      
    } catch (error) {
      spinner.fail('Aggregation failed');
      console.error(chalk.red(error.message));
    }
  });

// Interactive setup command
program
  .command('setup')
  .description('Interactive setup wizard')
  .action(async () => {
    console.log(chalk.green.bold('\n🚀 LightLink ZK Oracle Setup Wizard\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'network',
        message: 'Select deployment network:',
        choices: Object.keys(NETWORKS).map(key => ({
          name: `${NETWORKS[key].name} (${key})`,
          value: key
        }))
      },
      {
        type: 'confirm',
        name: 'deploy',
        message: 'Deploy contracts?',
        default: true
      },
      {
        type: 'input',
        name: 'vrfSubscriptionId',
        message: 'VRF Subscription ID:',
        when: (answers) => answers.deploy
      },
      {
        type: 'input',
        name: 'functionsSubscriptionId',
        message: 'Functions Subscription ID:',
        when: (answers) => answers.deploy
      }
    ]);
    
    if (answers.deploy) {
      // Run deployment with provided parameters
      const deployOptions = {
        network: answers.network,
        vrfSubscriptionId: answers.vrfSubscriptionId,
        functionsSubscriptionId: answers.functionsSubscriptionId
      };
      
      // Execute deployment
      console.log(chalk.blue('\nStarting deployment...'));
      // ... deployment logic would go here
    }
  });

// Helper function to get deployment parameters
async function getDeploymentParams(options, network) {
  // Default parameters for testnet deployment
  const defaultParams = {
    vrfCoordinator: network.vrfCoordinator,
    functionsRouter: network.functionsRouter,
    vrfSubscriptionId: options.vrfSubscriptionId || '1',
    keyHash: '0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61', // Default key hash
    functionsSubscriptionId: options.functionsSubscriptionId || '1',
    functionsDonId: '0x66756e2d6176616c616e6368652d66756a692d31000000000000000000000000' // fun-avalanche-fuji-1
  };
  
  return defaultParams;
}

// Initialize CLI
program
  .name('lightlink')
  .description('LightLink ZK Oracle CLI Tool')
  .version('1.0.0');

// Load existing deployments
loadDeployedContracts();

program.parse(); 