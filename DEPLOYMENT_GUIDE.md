# 🚀 LightLink ZK Oracle Deployment Guide

## Overview
This guide will walk you through deploying the LightLink ZK proof aggregation oracle system to Avalanche Fuji testnet and setting up all necessary components for testing.

## Prerequisites

### 1. Environment Setup
```bash
# Clone and install dependencies
git clone <repository-url>
cd LightLink
npm install

# Install required tools
npm install -g circom snarkjs hardhat
```

### 2. Environment Variables
Create a `.env` file with the following variables:

```env
# Deployer wallet
PRIVATE_KEY=your_private_key_here

# Network RPC URLs
AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
ETHEREUM_SEPOLIA_RPC_URL=https://rpc.sepolia.org

# Block explorer API keys for verification
SNOWTRACE_API_KEY=your_snowtrace_api_key
ETHERSCAN_API_KEY=your_etherscan_api_key

# Chainlink subscription IDs (will be created)
VRF_SUBSCRIPTION_ID=1
FUNCTIONS_SUBSCRIPTION_ID=1
```

### 3. Testnet AVAX
- Get testnet AVAX from [Avalanche Faucet](https://faucet.avax-test.network/)
- Ensure you have at least 5 AVAX for deployment and testing

### 4. Chainlink Subscriptions
- Create VRF subscription at [vrf.chain.link](https://vrf.chain.link)
- Create Functions subscription at [functions.chain.link](https://functions.chain.link)
- Note the subscription IDs and update your `.env` file

## Deployment Process

### Step 1: Compile Contracts
```bash
# Compile all Solidity contracts
npm run compile

# Verify compilation succeeded
ls artifacts/contracts/
```

### Step 2: Build ZK Circuits
```bash
# Compile circuits (this may take several minutes)
npm run build-circuits

# Setup Groth16 proving system
npm run setup-groth16

# Generate Solidity verifier contracts
npm run generate-verifier

# Test proof generation
npm run test-proof
```

### Step 3: Deploy to Avalanche Fuji
```bash
# Deploy contracts to Fuji testnet
npm run deploy:fuji

# Alternative: Use the comprehensive deployment script
HARDHAT_NETWORK=avalancheFuji node scripts/deploy-testnet.js
```

Expected output:
```
🚀 Starting LightLink ZK Oracle deployment...
📡 Deploying to Avalanche Fuji Testnet (Chain ID: 43113)
👤 Deployer address: 0x...
💰 Deployer balance: 5.0 ETH

📝 Step 1: Deploying Groth16 Verifier...
✅ Groth16 Verifier deployed: 0x...

📝 Step 2: Deploying ZK Proof Aggregator...
✅ ZK Proof Aggregator deployed: 0x...

📝 Step 3: Deploying Cross Chain Verifier...
✅ Cross Chain Verifier deployed: 0x...

⚙️ Step 4: Configuring contracts...
✅ Cross Chain Verifier authorized in ZK Proof Aggregator
✅ Sepolia destination chain allowlisted

💾 Step 5: Saving deployment information...
✅ Deployment info saved to deployments/avalancheFuji-deployment.json

🎉 DEPLOYMENT SUCCESSFUL!
```

### Step 4: Verify Contracts
```bash
# Verify contracts on Snowtrace
npx hardhat verify --network avalancheFuji <GROTH16_VERIFIER_ADDRESS>

npx hardhat verify --network avalancheFuji <ZK_AGGREGATOR_ADDRESS> \
  "0x2eD832Ba664535e5886b75D64C46EB9a228C2610" \
  "0xA9d587a00A31A52Ed70D6026794a8FC5E2F5dCb0" \
  "1" \
  "0x354d2f95da55398f44b7cff77da56283d9c6c829a4bdf1bbcaf2ad6a4d081f61" \
  "1" \
  "0x66756e2d6176616c616e6368652d66756a692d31000000000000000000000000" \
  "<GROTH16_VERIFIER_ADDRESS>"

npx hardhat verify --network avalancheFuji <CROSS_CHAIN_VERIFIER_ADDRESS> \
  "0xF694E193200268f9a4868e4Aa017A0118C9a8177" \
  "0x0b9d5D9136855f6FEc3c0993feE6E9CE8a297846" \
  "<ZK_AGGREGATOR_ADDRESS>"
```

### Step 5: Set Up Chainlink Services

#### VRF Configuration
1. Go to [vrf.chain.link](https://vrf.chain.link)
2. Connect your wallet to Avalanche Fuji
3. Create a new subscription or use existing
4. Add your ZK Proof Aggregator contract as a consumer
5. Fund the subscription with LINK tokens

#### Functions Configuration
1. Go to [functions.chain.link](https://functions.chain.link)
2. Connect to Avalanche Fuji testnet
3. Create a new subscription or use existing
4. Add your ZK Proof Aggregator contract as a consumer
5. Fund the subscription with LINK tokens

#### Get LINK Tokens
- Use [Chainlink Faucet](https://faucets.chain.link/fuji) to get testnet LINK
- Send LINK to your deployed contracts for gas fees

### Step 6: Test Deployment
```bash
# Run comprehensive tests
HARDHAT_NETWORK=avalancheFuji node scripts/test-deployment.js

# Test using CLI tool
npm run cli deploy --network fuji
npm run cli request-proof --network fuji --source-chain ethereum --block-number 0
npm run cli check-proof --network fuji --request-id 1
```

## Usage Examples

### Request ZK Proof Verification
```bash
# Using CLI
npm run cli request-proof --network fuji --source-chain ethereum --block-number 0

# Using hardhat console
npx hardhat console --network avalancheFuji
```

```javascript
// In hardhat console
const ZKProofAggregator = await ethers.getContractFactory("ZKProofAggregator");
const zkAggregator = ZKProofAggregator.attach("YOUR_DEPLOYED_ADDRESS");

// Request proof for random block selection
const tx = await zkAggregator.requestProofVerification("ethereum", 0);
const receipt = await tx.wait();
console.log("Request ID:", receipt.logs[0].args.requestId);

// Request proof for specific block
const tx2 = await zkAggregator.requestProofVerification("ethereum", 18500000);
await tx2.wait();
```

### Monitor Events
```javascript
// Listen for proof requests
zkAggregator.on("ProofRequested", (requestId, requester, blockNumber) => {
  console.log(`Proof requested: ID ${requestId}, Block ${blockNumber}`);
});

// Listen for proof verification
zkAggregator.on("ProofVerified", (requestId, isValid, stateRoot) => {
  console.log(`Proof verified: ID ${requestId}, Valid: ${isValid}`);
});
```

### Cross-Chain Proof Transfer
```bash
# Send proof to another chain
npm run cli send-proof --network fuji --destination sepolia --proof-id 1
```

## Testing on Multiple Networks

### Deploy to Sepolia (for cross-chain testing)
```bash
# Deploy to Sepolia testnet
HARDHAT_NETWORK=sepolia node scripts/deploy-testnet.js

# Test cross-chain communication
npm run cli send-proof --network fuji --destination sepolia --proof-id 1
```

## Troubleshooting

### Common Issues

1. **"InvalidSubscription" Error**
   - Ensure VRF/Functions subscriptions are created and funded
   - Verify contract addresses are added as consumers
   - Check subscription IDs in deployment params

2. **"InsufficientBalance" Error**
   - Fund contracts with LINK tokens
   - Check LINK balance on subscription

3. **Circuit Compilation Errors**
   - Install circom: `npm install -g circom`
   - Check Node.js version (requires >=18)
   - Ensure sufficient system memory (>8GB recommended)

4. **Deployment Gas Issues**
   - Increase gas limits in hardhat.config.js
   - Check AVAX balance for deployment
   - Use faster gas price for testnet

### Verification Links
After deployment, verify your contracts at:
- Avalanche Fuji: https://testnet.snowtrace.io
- Ethereum Sepolia: https://sepolia.etherscan.io

### Support Resources
- [Chainlink VRF Documentation](https://docs.chain.link/vrf)
- [Chainlink Functions Documentation](https://docs.chain.link/chainlink-functions)
- [Avalanche Fuji Testnet](https://docs.avax.network/build/dapp/testnet-workflow)
- [ZK-SNARKs with Circom](https://docs.circom.io/)

## Next Steps

1. **Production Deployment**: Adapt scripts for mainnet deployment
2. **Nova Integration**: Implement recursive proof aggregation
3. **Enhanced Circuits**: Add more sophisticated ZK verification
4. **Monitoring**: Set up automated monitoring and alerting
5. **Documentation**: Create comprehensive API documentation

## Security Considerations

⚠️ **Important Security Notes:**
- Never commit private keys to version control
- Use hardware wallets for mainnet deployments
- Audit contracts before production use
- Test thoroughly on testnet before mainnet
- Monitor for unusual activity and gas usage

---

For questions or issues, please refer to the project documentation or create an issue in the repository. 