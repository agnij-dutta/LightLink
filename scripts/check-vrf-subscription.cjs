const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
  // Load deployment info
  const deploymentsPath = path.join(__dirname, '../deployments/deployed-contracts.json');
  let deployments;
  try {
    deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf8'));
  } catch (e) {
    console.error('Could not read deployments/deployed-contracts.json');
    process.exit(1);
  }

  // Try both 'fuji' and 'avalancheFuji' as possible keys
  const networkKey = deployments['avalancheFuji'] ? 'avalancheFuji' : (deployments['fuji'] ? 'fuji' : null);
  if (!networkKey) {
    console.error('No deployment found for avalancheFuji or fuji in deployed-contracts.json');
    process.exit(1);
  }

  // Get contract address
  let contractAddress = deployments[networkKey].zkProofAggregator;
  // Allow override from CLI
  const argAddress = process.argv.find(arg => arg.startsWith('--address='));
  if (argAddress) {
    contractAddress = argAddress.split('=')[1];
  }

  if (!contractAddress) {
    console.error('No zkProofAggregator address found in deployment.');
    process.exit(1);
  }

  // Load ABI
  let abi;
  try {
    abi = require('../artifacts/contracts/ZKProofAggregator.sol/ZKProofAggregator.json').abi;
  } catch (e) {
    console.error('Could not load ABI for ZKProofAggregator.');
    process.exit(1);
  }

  // Connect to contract
  const [signer] = await hre.ethers.getSigners();
  const contract = new hre.ethers.Contract(contractAddress, abi, signer);

  // Read s_subscriptionId
  const subId = await contract.s_subscriptionId();
  console.log('ZKProofAggregator address:', contractAddress);
  console.log('Current VRF subscription ID (s_subscriptionId):', subId.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
}); 