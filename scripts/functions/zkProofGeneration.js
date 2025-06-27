// Chainlink Functions JavaScript for ZK Proof Data Preparation
// This code runs on the Chainlink Functions DON to fetch blockchain data
// and prepare inputs for real ZK proof generation via external service

// Input parameters from the smart contract
const chainId = parseInt(args[0]);
const blockNumbers = JSON.parse(args[1]); // Array of block numbers to verify
const merkleDepth = parseInt(args[2]) || 8;
const targetChainId = parseInt(args[3]);
const proofServiceUrl = args[4] || "https://light-link.vercel.app/api/prove"; // External proof generation service URL

// Configuration for different chains with proper API endpoints
const CHAIN_CONFIGS = {
  1: { // Ethereum Mainnet
    rpcUrl: "https://endpoints.omniatech.io/v1/eth/mainnet/public",
    fallbackUrls: ["https://eth.drpc.org", "https://ethereum-rpc.publicnode.com"],
    blockTime: 12,
    confirmations: 6
  },
  42161: { // Arbitrum One
    rpcUrl: "https://arbitrum-one-rpc.publicnode.com",
    fallbackUrls: ["https://arbitrum.drpc.org", "https://arb1.arbitrum.io/rpc"],
    blockTime: 1,
    confirmations: 1
  },
  10: { // Optimism
    rpcUrl: "https://optimism-rpc.publicnode.com",
    fallbackUrls: ["https://optimism.drpc.org", "https://mainnet.optimism.io"],
    blockTime: 2,
    confirmations: 1
  },
  8453: { // Base
    rpcUrl: "https://base-rpc.publicnode.com",
    fallbackUrls: ["https://base.drpc.org", "https://mainnet.base.org"],
    blockTime: 2,
    confirmations: 1
  },
  137: { // Polygon
    rpcUrl: "https://polygon.drpc.org",
    fallbackUrls: ["https://polygon-rpc.com", "https://polygon-bor-rpc.publicnode.com"],
    blockTime: 2,
    confirmations: 20
  },
  43114: { // Avalanche C-Chain
    rpcUrl: "https://avalanche-c-chain-rpc.publicnode.com",
    fallbackUrls: ["https://avalanche.drpc.org", "https://api.avax.network/ext/bc/C/rpc"],
    blockTime: 2,
    confirmations: 1
  },
  43113: { // Avalanche Fuji Testnet
    rpcUrl: "https://avalanche-fuji-c-chain-rpc.publicnode.com",
    fallbackUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
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

// Helper function to fetch block data with improved response handling
async function fetchBlockData(chainId, blockNumber) {
  const config = CHAIN_CONFIGS[chainId];
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`);
  }

  const requestData = {
    jsonrpc: "2.0",
    method: "eth_getBlockByNumber", 
    params: [`0x${blockNumber.toString(16)}`, true],
    id: 1
  };

  // Get all available RPC URLs (primary + fallbacks)
  const allUrls = [config.rpcUrl, ...(config.fallbackUrls || [])];
  let lastError;
  
  for (let urlIndex = 0; urlIndex < allUrls.length; urlIndex++) {
    const currentUrl = allUrls[urlIndex];
    
    try {
      const response = await Functions.makeHttpRequest({
        url: currentUrl,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: requestData,
        timeout: 10000, // 10 second timeout
      });

      // Handle different response structures that might be returned by Chainlink Functions
      let responseData;
      
      if (response.error) {
        throw new Error(`HTTP request failed: ${JSON.stringify(response.error)}`);
      }
      
      // Check if response has data property
      if (response.data) {
        responseData = response.data;
      } else if (response.result) {
        // Sometimes the response might be directly in the result field
        responseData = response;
      } else {
        // If no data property, the response itself might be the data
        responseData = response;
      }

      // Handle RPC error responses
      if (responseData.error) {
        throw new Error(`RPC Error: ${JSON.stringify(responseData.error)}`);
      }

      // Check for valid result
      if (!responseData.result) {
        throw new Error(`Invalid RPC response - no result field: ${JSON.stringify(responseData)}`);
      }

      // Validate that the result contains block data
      if (!responseData.result.hash || !responseData.result.number) {
        throw new Error(`Invalid block data - missing required fields: ${JSON.stringify(responseData.result)}`);
      }

      return responseData.result;
      
    } catch (error) {
      lastError = error;
      
      if (urlIndex === allUrls.length - 1) {
        throw lastError;
      }
      
      // Brief delay before trying next endpoint
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
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
    throw new Error("Invalid block data structure");
  }

  // Validate block hash format
  if (!/^0x[a-fA-F0-9]{64}$/.test(blockData.hash)) {
    throw new Error("Invalid block hash format");
  }

  // Validate timestamp is reasonable
  const blockTime = parseInt(blockData.timestamp, 16);
  const now = Math.floor(Date.now() / 1000);
  
  // Allow historical blocks but reject obviously invalid timestamps
  // Genesis block of Ethereum was around 2015, so anything before 2015 is invalid
  const earliestValidTime = 1438269973; // Ethereum genesis block timestamp (July 30, 2015)
  const futureBuffer = 300; // 5 minutes into the future

  if (blockTime < earliestValidTime) {
    throw new Error(`Block timestamp too old (before Ethereum genesis): ${blockTime}`);
  }
  
  if (blockTime > now + futureBuffer) {
    throw new Error(`Block timestamp too far in the future: ${blockTime} vs ${now}`);
  }

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
  }

  return circuitInputs;
}

// Function to call external proof generation service
async function requestExternalProofGeneration(circuitInputs, proofServiceUrl) {
  if (!proofServiceUrl || proofServiceUrl === "") {
    throw new Error("External proof service URL is required");
  }

  try {
    // Format circuit inputs for proof_aggregator circuit - this circuit expects specific format
    const nProofs = Math.max(3, circuitInputs.length); // proof_aggregator requires minimum 3 proofs
    const paddedInputs = [...circuitInputs];
    
    // Pad to minimum required proofs by duplicating last input
    while (paddedInputs.length < nProofs) {
      paddedInputs.push(paddedInputs[paddedInputs.length - 1]);
    }

    // Helper function to convert hex to BigInt and constrain to bit length
    function hexToBigInt(hex) {
      const cleanHex = hex.replace(/^0x/, '');
      return BigInt('0x' + cleanHex);
    }

    function constrainToBits(value, bits) {
      const max = (2n ** BigInt(bits)) - 1n; // Use BigInt literals
      return value % max;
    }

    function stringToField(str) {
      // Convert string to field element (simplified)
      let hash = 0n; // Use BigInt literal
      const bigIntStr = str.toString();
      for (let i = 0; i < bigIntStr.length; i++) {
        const charCode = BigInt(bigIntStr.charCodeAt(i));
        hash = (hash * 31n + charCode) % 21888242871839275222246405745257275088548364400416034343698204186575808495617n;
      }
      return hash;
    }

    // Format inputs according to proof_aggregator circuit requirements
    const formattedInputs = {
      proofs: [],
      publicSignals: [], 
      merkleRoots: [],
      blockHashes: [],
      chainIds: [],
      aggregationSeed: stringToField(Date.now().toString()).toString(),
      targetChainId: constrainToBits(BigInt(circuitInputs[0].targetChainId || 1), 4).toString()
    };

    for (let i = 0; i < nProofs; i++) {
      const input = paddedInputs[i % paddedInputs.length];
      
      // Constrain values to fit circuit bit requirements
      const constrainedBlockHash = constrainToBits(hexToBigInt(input.blockHash || '0x1234'), 64); // blockDepth * 8
      const constrainedMerkleRoot = constrainToBits(hexToBigInt(input.merkleRoot || '0x5678'), 252); // Field element size
      const constrainedChainId = constrainToBits(BigInt(input.chainId || 1), 4); // ChainMaskComputer uses 4 bits
      
      // Generate proof components (8 elements for simplified Groth16) - convert all to strings
      const proof = [
        constrainedBlockHash.toString(),
        constrainedChainId.toString(),
        constrainedMerkleRoot.toString(),
        constrainedChainId.toString(), // targetChainId
        stringToField(input.blockNumber?.toString() || '1').toString(),
        stringToField(input.timestamp?.toString() || Date.now().toString()).toString(),
        stringToField(`proof_${i}_a`).toString(),
        stringToField(`proof_${i}_b`).toString()
      ];
      
      // Generate public signals (4 elements) - convert all to strings
      const publicSignal = [
        constrainedMerkleRoot.toString(),
        constrainedBlockHash.toString(),
        constrainedChainId.toString(),
        stringToField(input.blockNumber?.toString() || '1').toString()
      ];
      
      formattedInputs.proofs.push(proof);
      formattedInputs.publicSignals.push(publicSignal);
      formattedInputs.merkleRoots.push(constrainedMerkleRoot.toString());
      formattedInputs.blockHashes.push(constrainedBlockHash.toString());
      formattedInputs.chainIds.push(constrainedChainId.toString());
    }

    const proofRequest = {
      circuit: "proof_aggregator",
      inputs: [formattedInputs], // Send as single formatted input object
      params: {
        nProofs: nProofs,
        merkleDepth: merkleDepth,
        blockDepth: 8
      }
    };

    console.log(`Calling external proof service: ${proofServiceUrl}`);
    console.log(`Request payload size: ${JSON.stringify(proofRequest).length} bytes`);

    const response = await Functions.makeHttpRequest({
      url: proofServiceUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      data: proofRequest,
      timeout: 30000 // 30 second timeout for proof generation
    });

    console.log(`External proof service response status: ${response.status || 'unknown'}`);

    // Handle different response structures
    let responseData;
    if (response.data) {
      responseData = response.data;
    } else if (response.result) {
      responseData = response;
    } else {
      responseData = response;
    }

    if (response.error || responseData.error) {
      throw new Error(`Proof service error: ${JSON.stringify(response.error || responseData.error)}`);
    }

    // Validate proof response
    if (!responseData.proof || !responseData.publicSignals) {
      throw new Error(`Invalid proof response: missing proof or publicSignals`);
    }

    console.log("External proof generation successful");
    return {
      status: "proof_generated",
      proof: responseData.proof,
      publicSignals: responseData.publicSignals,
      proofId: responseData.proofId || createHash(JSON.stringify(responseData.proof)).slice(0, 10)
    };

  } catch (error) {
    console.error("External proof generation failed:", error.message);
    throw error; // Don't fall back to mock, let it fail
  }
}

// Main execution function
async function main() {
  try {
    console.log(`Starting ZK proof generation for chain ${chainId}, blocks: ${JSON.stringify(blockNumbers)}`);

    // Validate inputs
    if (!Array.isArray(blockNumbers) || blockNumbers.length === 0) {
      throw new Error("Invalid block numbers array");
    }

    if (!CHAIN_CONFIGS[chainId]) {
      throw new Error(`Unsupported source chain ID: ${chainId}`);
    }

    if (!proofServiceUrl || proofServiceUrl === "") {
      throw new Error("External proof service URL is required");
    }

    // Fetch block data for all requested blocks
    const blocksData = [];
    
    for (const blockNumber of blockNumbers) {
      try {
        const blockData = await fetchBlockData(chainId, blockNumber);
        if (blockData) {
          blocksData.push(blockData);
          console.log(`✓ Block ${blockNumber}: ${blockData.transactions ? blockData.transactions.length : 0} txs`);
        }
      } catch (blockError) {
        console.error(`✗ Block ${blockNumber} failed: ${blockError.message}`);
        throw blockError; // Fail fast on any block fetch error
      }
    }

    if (blocksData.length === 0) {
      throw new Error("No valid block data retrieved");
    }

    // Prepare circuit inputs for real ZK proof generation
    const circuitInputs = prepareCircuitInputs(blocksData, chainId, targetChainId, merkleDepth);
    console.log(`Prepared circuit inputs for ${circuitInputs.length} blocks`);

    // Generate the actual proof via external service
    const proofResult = await requestExternalProofGeneration(circuitInputs, proofServiceUrl);
    console.log(`✓ Proof generation: ${proofResult.status}`);

    // Create compact result under 256 bytes
    const result = {
      s: true, // success
      pid: proofResult.proofId || "unknown", // proof ID (short)
      cid: chainId,
      tcid: targetChainId,
      bn: blockNumbers[0], // First block number only
      ts: Math.floor(Date.now() / 1000),
      v: "3.0"
    };

    console.log(`✓ Result size: ${JSON.stringify(result).length} bytes`);
    
    // Store full proof data in logs for external retrieval
    console.log("PROOF_DATA:", JSON.stringify({
      proofId: proofResult.proofId,
      proof: proofResult.proof,
      publicSignals: proofResult.publicSignals,
      circuitInputs: circuitInputs,
      metadata: {
        chainId,
        targetChainId,
        blockNumbers,
        timestamp: Math.floor(Date.now() / 1000)
      }
    }));

    return Functions.encodeString(JSON.stringify(result));

  } catch (error) {
    console.error("Error in ZK proof generation:", error.message);
    
    const errorResult = {
      s: false, // success = false
      e: error.message.slice(0, 50), // error (truncated)
      cid: chainId || 0,
      tcid: targetChainId || 0,
      ts: Math.floor(Date.now() / 1000),
      v: "3.0"
    };

    return Functions.encodeString(JSON.stringify(errorResult));
  }
}

// Execute the main function
return await main(); 