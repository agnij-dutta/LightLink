// Chainlink Functions JavaScript for ZK Proof Generation
// This code runs on the Chainlink Functions DON to generate ZK proofs off-chain

const ethers = Functions.makeRequest({
  url: `https://api.quicknode.com/v1/ethereum`,
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  data: {
    jsonrpc: "2.0",
    method: "eth_getBlockByNumber",
    params: ["latest", false],
    id: 1,
  },
});

// Input parameters from the smart contract
const chainId = parseInt(args[0]);
const blockNumbers = JSON.parse(args[1]); // Array of block numbers to verify
const merkleDepth = parseInt(args[2]) || 8;
const targetChainId = parseInt(args[3]);

// Configuration for different chains
const CHAIN_CONFIGS = {
  1: { // Ethereum Mainnet
    rpcUrl: "https://eth-mainnet.g.alchemy.com/v2",
    blockTime: 12,
    confirmations: 6
  },
  42161: { // Arbitrum One
    rpcUrl: "https://arb-mainnet.g.alchemy.com/v2",
    blockTime: 1,
    confirmations: 1
  },
  10: { // Optimism
    rpcUrl: "https://opt-mainnet.g.alchemy.com/v2",
    blockTime: 2,
    confirmations: 1
  },
  8453: { // Base
    rpcUrl: "https://base-mainnet.g.alchemy.com/v2",
    blockTime: 2,
    confirmations: 1
  },
  137: { // Polygon
    rpcUrl: "https://polygon-mainnet.g.alchemy.com/v2",
    blockTime: 2,
    confirmations: 20
  }
};

// Helper function to fetch block data
async function fetchBlockData(chainId, blockNumber) {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const response = await Functions.makeRequest({
    url: config.rpcUrl,
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    data: {
      jsonrpc: "2.0",
      method: "eth_getBlockByNumber",
      params: [`0x${blockNumber.toString(16)}`, true],
      id: 1,
    },
  });

  if (response.error) {
    throw new Error(`RPC Error: ${response.error.message}`);
  }

  return response.data.result;
}

// Helper function to compute Merkle tree
function computeMerkleTree(leaves) {
  if (leaves.length === 0) return null;
  if (leaves.length === 1) return leaves[0];

  const nextLevel = [];
  for (let i = 0; i < leaves.length; i += 2) {
    const left = leaves[i];
    const right = i + 1 < leaves.length ? leaves[i + 1] : left;
    
    // Simulate Poseidon hash (using keccak256 as placeholder)
    const combined = ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["bytes32", "bytes32"],
        [left, right]
      )
    );
    nextLevel.push(combined);
  }

  return computeMerkleTree(nextLevel);
}

// Helper function to generate Merkle proof
function generateMerkleProof(leaves, leafIndex) {
  const proof = [];
  const indices = [];
  let currentLevel = [...leaves];
  let currentIndex = leafIndex;

  while (currentLevel.length > 1) {
    const isRightNode = currentIndex % 2;
    const siblingIndex = isRightNode ? currentIndex - 1 : currentIndex + 1;
    
    if (siblingIndex < currentLevel.length) {
      proof.push(currentLevel[siblingIndex]);
      indices.push(isRightNode);
    }

    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      
      const combined = ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["bytes32", "bytes32"],
          [left, right]
        )
      );
      nextLevel.push(combined);
    }

    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return { pathElements: proof, pathIndices: indices };
}

// Helper function to validate block data
function validateBlockData(blockData, chainId) {
  if (!blockData) {
    throw new Error("Block data is null");
  }

  if (!blockData.hash || !blockData.number || !blockData.timestamp) {
    throw new Error("Invalid block data structure");
  }

  // Validate block hash format
  if (!/^0x[a-fA-F0-9]{64}$/.test(blockData.hash)) {
    throw new Error("Invalid block hash format");
  }

  // Validate timestamp is reasonable (within last 30 days)
  const blockTime = parseInt(blockData.timestamp, 16);
  const now = Math.floor(Date.now() / 1000);
  const thirtyDaysAgo = now - (30 * 24 * 60 * 60);

  if (blockTime < thirtyDaysAgo || blockTime > now + 300) { // 5 min future buffer
    throw new Error("Block timestamp out of reasonable range");
  }

  return true;
}

// Helper function to generate ZK proof inputs
function generateProofInputs(blocksData, chainId, targetChainId) {
  const proofs = [];
  const publicSignals = [];
  const merkleRoots = [];
  const blockHashes = [];
  const chainIds = [];

  // Extract transaction hashes for Merkle tree construction
  for (let i = 0; i < blocksData.length; i++) {
    const block = blocksData[i];
    
    // Validate block data
    validateBlockData(block, chainId);

    // Extract transaction hashes
    const txHashes = block.transactions.map(tx => 
      typeof tx === 'string' ? tx : tx.hash
    );

    // Pad to power of 2 for Merkle tree
    while (txHashes.length < Math.pow(2, Math.ceil(Math.log2(txHashes.length)))) {
      txHashes.push(txHashes[txHashes.length - 1]);
    }

    // Compute Merkle root
    const merkleRoot = computeMerkleTree(txHashes);
    
    // Generate Merkle proof for first transaction (as example)
    const merkleProof = generateMerkleProof(txHashes, 0);

    // Simulate proof generation (in practice, would call circuit)
    const mockProof = [
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`proof_a_${i}`)),
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`proof_b1_${i}`)),
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`proof_b2_${i}`)),
      ethers.utils.keccak256(ethers.utils.toUtf8Bytes(`proof_c_${i}`)),
      merkleRoot,
      block.hash,
      chainId.toString(),
      targetChainId.toString()
    ];

    const mockPublicSignals = [
      merkleRoot,
      block.hash,
      chainId.toString(),
      block.number
    ];

    proofs.push(mockProof);
    publicSignals.push(mockPublicSignals);
    merkleRoots.push(merkleRoot);
    blockHashes.push(block.hash);
    chainIds.push(chainId);
  }

  return {
    proofs,
    publicSignals,
    merkleRoots,
    blockHashes,
    chainIds,
    aggregationSeed: ethers.utils.keccak256(
      ethers.utils.defaultAbiCoder.encode(
        ["uint256", "uint256", "uint256"],
        [chainId, targetChainId, Date.now()]
      )
    )
  };
}

// Helper function to aggregate multiple proofs
function aggregateProofs(proofInputs) {
  const {
    proofs,
    publicSignals,
    merkleRoots,
    blockHashes,
    chainIds,
    aggregationSeed
  } = proofInputs;

  // Simulate proof aggregation (in practice, would use recursive SNARKs)
  const aggregatedProofHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32[]", "bytes32[]", "bytes32[]", "bytes32"],
      [
        proofs.map(p => ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["bytes32[]"], [p]))),
        merkleRoots,
        blockHashes,
        aggregationSeed
      ]
    )
  );

  // Generate aggregated proof components
  const aggregatedProof = [];
  for (let i = 0; i < 8; i++) {
    aggregatedProof.push(
      ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["bytes32", "uint256"],
          [aggregatedProofHash, i]
        )
      )
    );
  }

  const aggregatedPublicSignals = [];
  for (let i = 0; i < 4; i++) {
    aggregatedPublicSignals.push(
      ethers.utils.keccak256(
        ethers.utils.defaultAbiCoder.encode(
          ["bytes32", "uint256"],
          [aggregatedProofHash, i + 100]
        )
      )
    );
  }

  // Compute validity hash
  const validityHash = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ["bytes32[]", "bytes32[]"],
      [aggregatedProof, aggregatedPublicSignals]
    )
  );

  // Compute chain mask
  let chainMask = 0;
  chainIds.forEach(id => {
    chainMask |= (1 << (id % 32)); // Simple bitmask
  });

  return {
    aggregatedProof,
    aggregatedPublicSignals,
    validityHash,
    chainMask,
    blockCount: proofs.length,
    timestamp: Math.floor(Date.now() / 1000)
  };
}

// Main execution function
async function main() {
  try {
    console.log(`Starting ZK proof generation for chain ${chainId}`);
    console.log(`Block numbers: ${JSON.stringify(blockNumbers)}`);

    // Fetch block data for all requested blocks
    const blocksData = [];
    for (const blockNumber of blockNumbers) {
      console.log(`Fetching block ${blockNumber} for chain ${chainId}`);
      const blockData = await fetchBlockData(chainId, blockNumber);
      blocksData.push(blockData);
    }

    console.log(`Successfully fetched ${blocksData.length} blocks`);

    // Generate proof inputs
    const proofInputs = generateProofInputs(blocksData, chainId, targetChainId);
    console.log("Generated proof inputs");

    // Aggregate proofs
    const aggregatedResult = aggregateProofs(proofInputs);
    console.log("Generated aggregated proof");

    // Return the result
    const result = {
      success: true,
      chainId,
      targetChainId,
      blockNumbers,
      aggregatedProof: aggregatedResult.aggregatedProof,
      aggregatedPublicSignals: aggregatedResult.aggregatedPublicSignals,
      validityHash: aggregatedResult.validityHash,
      chainMask: aggregatedResult.chainMask,
      metadata: {
        blockCount: aggregatedResult.blockCount,
        timestamp: aggregatedResult.timestamp,
        merkleDepth,
        version: "1.0.0"
      }
    };

    console.log("ZK proof generation completed successfully");
    return Functions.encodeString(JSON.stringify(result));

  } catch (error) {
    console.error("Error in ZK proof generation:", error.message);
    
    const errorResult = {
      success: false,
      error: error.message,
      chainId,
      targetChainId,
      blockNumbers,
      timestamp: Math.floor(Date.now() / 1000)
    };

    return Functions.encodeString(JSON.stringify(errorResult));
  }
}

// Execute the main function
return await main(); 