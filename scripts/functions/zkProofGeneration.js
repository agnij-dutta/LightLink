// Chainlink Functions JavaScript for ZK Proof Data Preparation
// This code runs on the Chainlink Functions DON to fetch blockchain data
// and prepare inputs for real ZK proof generation via external service

// Input parameters from the smart contract
const chainId = parseInt(args[0]);
const blockNumbers = JSON.parse(args[1]); // Array of block numbers to verify
const merkleDepth = parseInt(args[2]) || 8;
const targetChainId = parseInt(args[3]);
const proofServiceUrl = args[4] || "https://light-link.vercel.app/api/prove"; // External proof generation service URL

// Configuration for different chains with reliable API endpoints
const CHAIN_CONFIGS = {
  1: { // Ethereum Mainnet
    rpcUrl: "https://ethereum-rpc.publicnode.com",
    alternatives: [
      "https://eth.drpc.org",
      "https://rpc.ankr.com/eth"
    ],
    blockTime: 12,
    confirmations: 6
  },
  42161: { // Arbitrum One
    rpcUrl: "https://arbitrum-one-rpc.publicnode.com", 
    alternatives: [
      "https://arb1.arbitrum.io/rpc",
      "https://rpc.ankr.com/arbitrum"
    ],
    blockTime: 1,
    confirmations: 1
  },
  10: { // Optimism
    rpcUrl: "https://optimism-rpc.publicnode.com", 
    alternatives: [
      "https://mainnet.optimism.io",
      "https://rpc.ankr.com/optimism"
    ],
    blockTime: 2,
    confirmations: 1
  },
  8453: { // Base
    rpcUrl: "https://base-rpc.publicnode.com",
    alternatives: [
      "https://mainnet.base.org",
      "https://rpc.ankr.com/base"
    ],
    blockTime: 2,
    confirmations: 1
  },
  137: { // Polygon
    rpcUrl: "https://polygon-bor-rpc.publicnode.com",
    alternatives: [
      "https://rpc.ankr.com/polygon",
      "https://polygon-rpc.com",
      "https://rpc-mainnet.matic.quiknode.pro"
    ],
    blockTime: 2,
    confirmations: 20
  },
  43114: { // Avalanche C-Chain
    rpcUrl: "https://avalanche-c-chain-rpc.publicnode.com",
    alternatives: [
      "https://api.avax.network/ext/bc/C/rpc",
      "https://rpc.ankr.com/avalanche"
    ],
    blockTime: 2,
    confirmations: 1
  },
  43113: { // Avalanche Fuji Testnet
    rpcUrl: "https://avalanche-fuji-c-chain-rpc.publicnode.com",
    alternatives: [
      "https://api.avax-test.network/ext/bc/C/rpc"
    ],
    blockTime: 2,
    confirmations: 1
  }
};

// Helper function to create hash using Web3 crypto (available in Chainlink Functions)
function createHash(data) {
  // Convert data to hex string if it's not already
  const hexData = typeof data === 'string' ? data : JSON.stringify(data);
  // Use Functions.keccak256 which is available in Chainlink Functions runtime
  return Functions.keccak256(hexData);
}

// Helper function to fetch block data with retry logic
async function fetchBlockData(chainId, blockNumber) {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  console.log(`Fetching block ${blockNumber} from chain ${chainId}`);

  const requestData = {
    jsonrpc: "2.0",
    method: "eth_getBlockByNumber", 
    params: [`0x${blockNumber.toString(16)}`, true],
    id: 1
  };

  // List of RPC URLs to try
  const rpcUrls = [config.rpcUrl, ...config.alternatives];
  let lastError = null;

  for (let i = 0; i < rpcUrls.length; i++) {
    const rpcUrl = rpcUrls[i];
    console.log(`Attempting RPC ${i + 1}/${rpcUrls.length}: ${rpcUrl}`);

    try {
      const response = await Functions.makeHttpRequest({
        url: rpcUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "User-Agent": "Chainlink-Functions/1.0"
        },
        data: requestData,
        timeout: 30000, // 30 second timeout
      });

      console.log(`RPC response status for block ${blockNumber}:`, response.status);
      
      if (response.error) {
        console.error(`RPC request failed for ${rpcUrl}:`, response.error);
        lastError = new Error(`RPC Request Error: ${JSON.stringify(response.error)}`);
        continue;
      }

      if (!response.data) {
        console.error(`No response data from ${rpcUrl}`);
        lastError = new Error(`No response data from RPC endpoint: ${rpcUrl}`);
        continue;
      }

      // Handle RPC error responses
      if (response.data.error) {
        console.error(`RPC error from ${rpcUrl}:`, response.data.error);
        lastError = new Error(`RPC Error from ${rpcUrl}: ${response.data.error.message || JSON.stringify(response.data.error)}`);
        continue;
      }

      if (!response.data.result) {
        console.error(`No result from ${rpcUrl}:`, JSON.stringify(response.data));
        lastError = new Error(`Invalid RPC response from ${rpcUrl}: no result field`);
        continue;
      }

      // Additional validation for block data
      const blockData = response.data.result;
      if (!blockData.hash || !blockData.number || !blockData.timestamp) {
        console.error(`Incomplete block data from ${rpcUrl}:`, blockData);
        lastError = new Error(`Incomplete block data from ${rpcUrl}: missing required fields`);
        continue;
      }

      console.log(`Successfully fetched block ${blockNumber} from ${rpcUrl}`);
      console.log(`Block hash: ${blockData.hash}, timestamp: ${blockData.timestamp}`);
      return blockData;

    } catch (error) {
      console.error(`Exception when calling ${rpcUrl}:`, error.message);
      lastError = error;
      continue;
    }
  }

  // If we get here, all RPC endpoints failed
  throw new Error(`Failed to fetch block ${blockNumber} from chain ${chainId} after trying ${rpcUrls.length} RPC endpoints. Last error: ${lastError ? lastError.message : 'Unknown error'}`);
}

// Helper function to compute proper Merkle tree using the same logic as circuits
function computeMerkleTree(leaves, depth) {
  if (!leaves || leaves.length === 0) {
    return "0x0000000000000000000000000000000000000000000000000000000000000000";
  }

  // Pad leaves to power of 2 for proper Merkle tree construction
  const targetLength = Math.pow(2, depth);
  const paddedLeaves = [...leaves];
  
  while (paddedLeaves.length < targetLength) {
    paddedLeaves.push(paddedLeaves[paddedLeaves.length - 1] || "0x0000000000000000000000000000000000000000000000000000000000000000");
  }

  let currentLevel = paddedLeaves.map(leaf => createHash(leaf));

  // Build Merkle tree bottom-up
  while (currentLevel.length > 1) {
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      
      // Create parent hash using consistent ordering (left || right)
      const parentHash = createHash(left + right.replace('0x', ''));
      nextLevel.push(parentHash);
    }
    currentLevel = nextLevel;
  }

  return currentLevel[0];
}

// Helper function to generate Merkle path for a given leaf
function generateMerklePath(leaves, leafIndex, depth) {
  if (leafIndex >= leaves.length) {
    throw new Error("Leaf index out of bounds");
  }

  const pathElements = [];
  const pathIndices = [];
  
  // Pad leaves to power of 2
  const targetLength = Math.pow(2, depth);
  const paddedLeaves = [...leaves];
  while (paddedLeaves.length < targetLength) {
    paddedLeaves.push(paddedLeaves[paddedLeaves.length - 1] || "0x0000000000000000000000000000000000000000000000000000000000000000");
  }

  let currentLevel = paddedLeaves.map(leaf => createHash(leaf));
  let currentIndex = leafIndex;

  // Generate path from leaf to root
  for (let level = 0; level < depth; level++) {
    const siblingIndex = currentIndex % 2 === 0 ? currentIndex + 1 : currentIndex - 1;
    const sibling = siblingIndex < currentLevel.length ? currentLevel[siblingIndex] : currentLevel[currentIndex];
    
    pathElements.push(sibling);
    pathIndices.push(currentIndex % 2); // 0 if current is left, 1 if right
    
    // Move to parent level
    const nextLevel = [];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : left;
      nextLevel.push(createHash(left + right.replace('0x', '')));
    }
    
    currentLevel = nextLevel;
    currentIndex = Math.floor(currentIndex / 2);
  }

  return { pathElements, pathIndices };
}

// Helper function to validate block data
function validateBlockData(blockData, chainId) {
  if (!blockData) {
    throw new Error("Block data is null");
  }

  if (!blockData.hash || !blockData.number || !blockData.timestamp) {
    throw new Error("Invalid block data structure - missing required fields");
  }

  // Validate block hash format
  if (!/^0x[a-fA-F0-9]{64}$/.test(blockData.hash)) {
    throw new Error(`Invalid block hash format: ${blockData.hash}`);
  }

  // Validate timestamp is reasonable (within last 4 years for wider compatibility)
  const blockTime = parseInt(blockData.timestamp, 16);
  const now = Math.floor(Date.now() / 1000);
  const fourYearsAgo = now - (4 * 365 * 24 * 60 * 60);

  if (blockTime < fourYearsAgo || blockTime > now + 300) { // 5 min future buffer
    throw new Error(`Block timestamp out of reasonable range: ${blockTime}, current: ${now}`);
  }

  console.log(`Block validation passed for block ${parseInt(blockData.number, 16)}`);
  return true;
}

// Helper function to prepare circuit inputs for real ZK proof generation
function prepareCircuitInputs(blocksData, chainId, targetChainId, merkleDepth) {
  const circuitInputs = [];
  
  for (let i = 0; i < blocksData.length; i++) {
    const block = blocksData[i];
    
    // Validate block data
    validateBlockData(block, chainId);

    // Extract transaction hashes
    const txHashes = block.transactions.map(tx => 
      typeof tx === 'string' ? tx : tx.hash
    );

    // Ensure we have at least one transaction hash
    if (txHashes.length === 0) {
      txHashes.push(block.hash); // Use block hash if no transactions
    }

    console.log(`Processing block ${parseInt(block.number, 16)} with ${txHashes.length} transactions`);

    // Compute Merkle root and path for first transaction (as proof sample)
    const merkleRoot = computeMerkleTree(txHashes, merkleDepth);
    const merklePathData = generateMerklePath(txHashes, 0, merkleDepth);

    // Prepare inputs for proof_aggregator.circom circuit
    const proofInput = {
      // Block validation inputs
      blockHash: block.hash,
      chainId: chainId,
      
      // Merkle proof inputs
      merkleRoot: merkleRoot,
      leaf: txHashes[0], // First transaction as sample
      pathElements: merklePathData.pathElements,
      pathIndices: merklePathData.pathIndices,
      
      // Cross-chain verification
      targetChainId: targetChainId,
      blockNumber: parseInt(block.number, 16),
      timestamp: parseInt(block.timestamp, 16)
    };

    circuitInputs.push(proofInput);
    console.log(`Prepared circuit input for block ${proofInput.blockNumber}`);
  }

  return circuitInputs;
}

// Function to call external proof generation service
async function requestExternalProofGeneration(circuitInputs, proofServiceUrl) {
  if (!proofServiceUrl || proofServiceUrl === "") {
    console.log("No proof service URL provided - returning prepared inputs only");
    return {
      status: "inputs_prepared",
      message: "Circuit inputs prepared - no external service configured",
      circuitInputs: circuitInputs
    };
  }

  try {
    console.log(`Requesting proof generation from: ${proofServiceUrl}`);
    console.log(`Number of circuit inputs: ${circuitInputs.length}`);
    
    const proofRequest = {
      circuit: "proof_aggregator",
      inputs: circuitInputs,
      params: {
        nProofs: circuitInputs.length,
        merkleDepth: merkleDepth,
        blockDepth: 8 // As configured in circuit
      }
    };

    const response = await Functions.makeHttpRequest({
      url: proofServiceUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "User-Agent": "Chainlink-Functions/1.0"
      },
      data: proofRequest,
      timeout: 180000, // 3 minute timeout for proof generation
    });

    console.log(`Proof service response status: ${response.status}`);

    if (response.error) {
      console.error(`Proof service error:`, response.error);
      throw new Error(`Proof service error: ${JSON.stringify(response.error)}`);
    }

    if (!response.data) {
      throw new Error(`No response data from proof service`);
    }

    console.log(`Proof generation completed successfully`);
    return response.data;

  } catch (error) {
    console.error("External proof generation failed:", error.message);
    throw error; // Don't fall back to mock data, let the error propagate
  }
}

// Main execution function
async function main() {
  try {
    console.log(`=== ZK Proof Data Preparation Started ===`);
    console.log(`Source chain: ${chainId}`);
    console.log(`Target chain: ${targetChainId}`);
    console.log(`Block numbers: ${JSON.stringify(blockNumbers)}`);
    console.log(`Merkle depth: ${merkleDepth}`);
    console.log(`Proof service URL: ${proofServiceUrl}`);

    // Validate inputs
    if (!Array.isArray(blockNumbers) || blockNumbers.length === 0) {
      throw new Error("Invalid block numbers array - must be non-empty array");
    }

    if (!CHAIN_CONFIGS[chainId]) {
      throw new Error(`Unsupported source chain ID: ${chainId}. Supported chains: ${Object.keys(CHAIN_CONFIGS).join(', ')}`);
    }

    // Validate block numbers are reasonable
    for (const blockNumber of blockNumbers) {
      if (!Number.isInteger(blockNumber) || blockNumber < 0) {
        throw new Error(`Invalid block number: ${blockNumber} - must be positive integer`);
      }
      if (blockNumber > 50000000) { // Sanity check for very high block numbers
        console.warn(`Warning: Very high block number requested: ${blockNumber}`);
      }
    }

    console.log(`Input validation passed`);

    // Fetch block data for all requested blocks
    const blocksData = [];
    const errors = [];
    
    for (const blockNumber of blockNumbers) {
      console.log(`\n--- Fetching block ${blockNumber} ---`);
      try {
        const blockData = await fetchBlockData(chainId, blockNumber);
        if (blockData) {
          blocksData.push(blockData);
          console.log(`✓ Successfully retrieved block ${blockNumber}`);
        } else {
          const error = `No data returned for block ${blockNumber}`;
          console.warn(error);
          errors.push(error);
        }
      } catch (blockError) {
        const error = `Error fetching block ${blockNumber}: ${blockError.message}`;
        console.error(`✗ ${error}`);
        errors.push(error);
        // Continue with other blocks instead of failing completely
      }
    }

    if (blocksData.length === 0) {
      const errorMessage = `No valid block data retrieved from chain ${chainId}. Attempted blocks: ${blockNumbers.join(', ')}. Errors: ${errors.join('; ')}`;
      console.error(`ERROR: ${errorMessage}`);
      throw new Error(errorMessage);
    }

    console.log(`\n=== Block Retrieval Summary ===`);
    console.log(`✓ Successfully fetched ${blocksData.length} out of ${blockNumbers.length} blocks`);
    if (errors.length > 0) {
      console.warn(`⚠ Encountered ${errors.length} errors: ${errors.join('; ')}`);
    }

    // Prepare circuit inputs for real ZK proof generation
    console.log(`\n--- Preparing Circuit Inputs ---`);
    const circuitInputs = prepareCircuitInputs(blocksData, chainId, targetChainId, merkleDepth);
    console.log(`✓ Prepared ${circuitInputs.length} circuit inputs for real ZK proof generation`);

    // Attempt to call external proof generation service
    console.log(`\n--- Requesting External Proof Generation ---`);
    const proofResult = await requestExternalProofGeneration(circuitInputs, proofServiceUrl);
    console.log(`✓ Proof generation status: ${proofResult.status}`);

    // Create the result object with real circuit inputs
    const result = {
      success: true,
      status: proofResult.status,
      chainId,
      targetChainId,
      blockNumbers: blockNumbers.slice(0, blocksData.length), // Only successful blocks
      
      // Real circuit inputs (can be used for offline proof generation)
      circuitInputs: circuitInputs,
      
      // Proof data (if external service succeeded)
      proof: proofResult.proof || null,
      publicSignals: proofResult.publicSignals || null,
      
      // Validation hash for contract verification
      validityHash: createHash(JSON.stringify(circuitInputs)),
      
      metadata: {
        blockCount: blocksData.length,
        timestamp: Math.floor(Date.now() / 1000),
        merkleDepth,
        version: "2.1.0", // Updated version for improved real circuit integration
        sourceChain: chainId,
        targetChain: targetChainId,
        circuitType: "proof_aggregator",
        hasRealProof: !!(proofResult.proof && proofResult.publicSignals),
        errors: errors.length > 0 ? errors : undefined,
        successfulBlocks: blocksData.map(b => parseInt(b.number, 16)),
        totalRequestedBlocks: blockNumbers.length
      }
    };

    console.log(`\n=== ZK Proof Data Preparation Completed ===`);
    console.log(`Status: ${result.status}`);
    console.log(`Blocks processed: ${result.metadata.blockCount}/${result.metadata.totalRequestedBlocks}`);
    console.log(`Real proof generated: ${result.metadata.hasRealProof}`);
    console.log(`Result size: ${JSON.stringify(result).length} characters`);
    
    // Return as properly encoded bytes for Chainlink Functions
    return Functions.encodeString(JSON.stringify(result));

  } catch (error) {
    console.error(`\n=== ERROR in ZK Proof Data Preparation ===`);
    console.error(`Error message: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    
    const errorResult = {
      success: false,
      error: error.message,
      chainId: chainId || 0,
      targetChainId: targetChainId || 0,
      blockNumbers: blockNumbers || [],
      timestamp: Math.floor(Date.now() / 1000),
      version: "2.1.0",
      metadata: {
        errorType: error.name || "UnknownError",
        supportedChains: Object.keys(CHAIN_CONFIGS).map(id => parseInt(id))
      }
    };

    console.log(`Returning error result: ${JSON.stringify(errorResult)}`);
    return Functions.encodeString(JSON.stringify(errorResult));
  }
}

// Execute the main function
return await main(); 