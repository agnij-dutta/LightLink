# Decentralized Light-Client via ZK Proof Aggregation

**Chromion Hackathon 2025 Submission**

A proof-aggregating oracle that enables trustless cross-chain state verification through ZK proof aggregation, using recursive zk-SNARKs to compress multiple validity checks into single succinct proofs.

## 🌟 Project Overview

This project solves the critical problem of cross-chain state validation by building a decentralized, scalable system that:

- **Aggregates ZK Proofs**: Combines multiple validity proofs into a single succinct proof using recursive zk-SNARKs
- **Enables Cross-Chain Verification**: Trustless verification of remote blockchain state without heavy clients
- **Leverages Chainlink Infrastructure**: Uses VRF, Functions, Automation, and CCIP for decentralized oracle operations
- **Optimizes Gas Costs**: Reduces on-chain verification to a single proof check regardless of data volume

## 🏗️ Architecture

### Core Components

1. **ZK Circuits** (`circuits/`)
   - `multiplier.circom` - Basic arithmetic proof circuit
   - `merkle_proof.circom` - Merkle tree inclusion proofs
   - `proof_aggregator.circom` - Advanced proof aggregation with recursive SNARKs

2. **Smart Contracts** (`contracts/`)
   - `ZKProofAggregator.sol` - Main aggregator with Chainlink integrations
   - `CrossChainVerifier.sol` - CCIP-based cross-chain proof delivery
   - `MockChainlinkContracts.sol` - Testing infrastructure

3. **Off-Chain Infrastructure** (`scripts/`)
   - `functions/zkProofGeneration.js` - Chainlink Functions for ZK computation
   - `circuit-tools.js` - Circuit compilation and proof generation
   - `deploy.js` - Multi-network deployment automation

### Chainlink Integrations

- **🎲 VRF**: Unbiased random block sampling for security
- **⚡ Functions**: Decentralized off-chain ZK computation
- **🤖 Automation**: Periodic proof requests and system maintenance
- **🌉 CCIP**: Cross-chain proof delivery and verification

## 🚀 Quick Start

### Prerequisites

```bash
node >= 16.0.0
npm >= 8.0.0
circom >= 2.1.6
```

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd LightLink

# Install dependencies
npm install

# Install Circom (if not already installed)
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
source ~/.cargo/env
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
cd ..
```

### Environment Setup

```bash
# Copy environment template
cp env.example .env

# Edit .env with your keys
PRIVATE_KEY=your_private_key_here
INFURA_API_KEY=your_infura_key
ALCHEMY_API_KEY=your_alchemy_key
ETHERSCAN_API_KEY=your_etherscan_key
```

### Build ZK Circuits

```bash
# Download Powers of Tau files and build all circuits
npm run circuits:build

# Or build individual circuits
node scripts/circuit-tools.js build multiplier
node scripts/circuit-tools.js build merkleProof
node scripts/circuit-tools.js build proofAggregator
```

### Deploy Contracts

```bash
# Deploy to local hardhat network
npm run deploy:local

# Deploy to testnets
npm run deploy:sepolia
npm run deploy:arbitrum-sepolia
npm run deploy:optimism-sepolia
```

### Run Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run with coverage
npm run test:coverage
```

## 📚 Usage Examples

### Basic Proof Request

```javascript
const zkProofAggregator = await ethers.getContractAt("ZKProofAggregator", address);

// Request proof generation for Arbitrum blocks
const tx = await zkProofAggregator.requestProofGeneration(
  42161, // Arbitrum chain ID
  100    // Block range
);

await tx.wait();
console.log("Proof request submitted");
```

### Batch Operations

```javascript
const batchRequests = [
  { chainId: 42161, blockRange: 100 }, // Arbitrum
  { chainId: 10, blockRange: 150 },    // Optimism
  { chainId: 8453, blockRange: 200 }   // Base
];

await zkProofAggregator.batchRequestProofGeneration(batchRequests);
```

### Cross-Chain Verification

```javascript
// Prepare cross-chain delivery
await zkProofAggregator.prepareCrossChainDelivery(
  requestId,
  destinationChainSelector,
  verifierAddress
);
```

### Circuit Testing

```bash
# Test individual circuits
node scripts/circuit-tools.js test multiplier
node scripts/circuit-tools.js test merkleProof
node scripts/circuit-tools.js test proofAggregator

# Generate and verify proofs
node scripts/circuit-tools.js compile proofAggregator
node scripts/circuit-tools.js setup proofAggregator
node scripts/circuit-tools.js verifier proofAggregator
```

## 🧪 Testing Infrastructure

### Test Structure

```
test/
├── unit/                  # Unit tests for individual contracts
│   ├── ZKProofAggregator.test.js
│   └── CrossChainVerifier.test.js
├── integration/           # Integration tests
│   └── e2e.test.js
└── mocks/                 # Mock contracts for testing
    └── MockChainlinkContracts.sol
```

### Running Tests

```bash
# Full test suite
npm test

# Watch mode for development
npm run test:watch

# Gas reporting
npm run test:gas

# Coverage analysis
npm run test:coverage
```

## 🔧 Development

### Circuit Development

```bash
# Compile circuits
npm run circuits:compile

# Generate trusted setup
npm run circuits:setup

# Generate Solidity verifiers
npm run circuits:verifier

# Test circuits
npm run circuits:test
```

### Contract Development

```bash
# Compile contracts
npm run compile

# Run linter
npm run lint

# Format code
npm run format

# Clean build artifacts
npm run clean
```

### Local Development

```bash
# Start local hardhat node
npm run node

# Deploy to local network
npm run deploy:local

# Run local tests
npm run test:local
```

## 🌐 Network Support

### Supported Networks

- **Ethereum Sepolia** - Primary testnet
- **Arbitrum Sepolia** - L2 testing
- **Optimism Sepolia** - L2 testing  
- **Base Sepolia** - L2 testing
- **Avalanche Fuji** - Alternative L1
- **Polygon Amoy** - Alternative L2

### Network Configuration

Each network is pre-configured with Chainlink service addresses:

```javascript
// Example network config
sepolia: {
  vrfCoordinator: "0x8103B0A8A00be2DDC778e6e7eaa21791Cd364625",
  functionsRouter: "0xb83E47C2bC239B3bf370bc41e1459A34b41238D0",
  automationRegistry: "0x86EFBD0b6735210631126570bB6B87EdF58e8AA8",
  ccipRouter: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"
}
```

## 📖 Technical Details

### ZK Proof Aggregation

The system implements a sophisticated proof aggregation mechanism:

1. **Individual Proofs**: Each blockchain state segment generates a validity proof
2. **Merkle Verification**: Block inclusion is verified through Merkle proofs
3. **Recursive Aggregation**: Multiple proofs are combined using recursive SNARKs
4. **Single Verification**: Only one aggregated proof is verified on-chain

### Chainlink Functions Integration

The off-chain computation leverages Chainlink Functions for:

- **Data Fetching**: Retrieving blockchain data from multiple sources
- **Proof Generation**: Running ZK circuits in decentralized compute environment
- **Consensus**: Aggregating results from multiple DON nodes
- **Security**: Trust-minimized computation without running own infrastructure

### Gas Optimization

Key optimization strategies:

- **Batch Operations**: Multiple requests processed together
- **Proof Compression**: Recursive aggregation reduces verification cost
- **Efficient Storage**: Optimized data structures and packing
- **Lazy Evaluation**: Computation only when needed

## 🔒 Security Considerations

### ZK Circuit Security

- **Trusted Setup**: Uses ceremony-generated Powers of Tau
- **Circuit Auditing**: Comprehensive constraint verification
- **Input Validation**: Strict bounds checking on all inputs
- **Randomness**: VRF ensures unbiased block selection

### Smart Contract Security

- **Access Control**: Role-based permissions for critical functions
- **Reentrancy Protection**: Guards on state-changing functions
- **Integer Overflow**: SafeMath usage throughout
- **Input Sanitization**: Validation of all external inputs

### Cross-Chain Security

- **CCIP Integration**: Leverages Chainlink's battle-tested infrastructure
- **Allowlisted Chains**: Only pre-approved chains can receive proofs
- **Message Verification**: Cryptographic proof of message integrity
- **Rate Limiting**: Protection against spam attacks

## 🎯 Roadmap

### Phase 1: Core Infrastructure ✅
- [x] ZK circuit implementation
- [x] Smart contract development
- [x] Chainlink integrations
- [x] Testing infrastructure

### Phase 2: Optimization 🚧
- [ ] Gas optimization improvements
- [ ] Proof compression enhancements
- [ ] Batch processing optimization
- [ ] Frontend integration

### Phase 3: Production 📋
- [ ] Mainnet deployment
- [ ] Security audits
- [ ] Performance benchmarking
- [ ] Documentation completion

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## 📞 Support

- **GitHub Issues**: Report bugs and request features
- **Documentation**: Comprehensive guides in `/docs`
- **Examples**: Sample implementations in `/examples`

## 🏆 Hackathon Submission

This project represents a novel approach to cross-chain verification that:

- **Solves Real Problems**: Enables trustless cross-chain state validation
- **Leverages Cutting-Edge Tech**: Combines ZK proofs with Chainlink's oracle infrastructure
- **Demonstrates Innovation**: First implementation of proof-aggregating cross-chain oracle
- **Shows Production Readiness**: Comprehensive testing, deployment, and documentation

Built for the **Chromion Hackathon 2025** with ❤️ and cutting-edge blockchain technology.

---

**Team**: Independent Developer  
**Submission Date**: January 2025  
**Technologies**: Solidity, Circom, JavaScript, Hardhat, Chainlink  
**Networks**: Multi-chain deployment across 6+ testnets 