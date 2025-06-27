export const CONTRACT_ADDRESSES = {
  ZK_PROOF_AGGREGATOR: process.env.NEXT_PUBLIC_ZK_AGGREGATOR_ADDRESS as `0x${string}`,
  GROTH16_VERIFIER: process.env.NEXT_PUBLIC_GROTH16_VERIFIER_ADDRESS as `0x${string}`,
  CROSS_CHAIN_VERIFIER: process.env.NEXT_PUBLIC_CROSS_CHAIN_VERIFIER_ADDRESS as `0x${string}`,
  NOVA_PROOF_AGGREGATOR: process.env.NEXT_PUBLIC_NOVA_PROOF_AGGREGATOR_ADDRESS as `0x${string}`,
} as const;

// ZK Proof Service Configuration
export const ZK_PROOF_SERVICE = {
  URL: process.env.NEXT_PUBLIC_ZK_PROOF_SERVICE_URL || 'https://light-link.vercel.app/api/prove',
  HEALTH_ENDPOINT: 'https://light-link.vercel.app/api/health',
  DEFAULT_MERKLE_DEPTH: 8,
} as const;

export const ZK_PROOF_AGGREGATOR_ABI = [
  // Regular proof functions
  {
    "inputs": [
      {"internalType": "string", "name": "sourceChain", "type": "string"},
      {"internalType": "uint256", "name": "targetBlockNumber", "type": "uint256"}
    ],
    "name": "requestProofVerification",
    "outputs": [{"internalType": "uint256", "name": "requestId", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "requestId", "type": "uint256"}],
    "name": "getProofRequest",
    "outputs": [{
      "components": [
        {"internalType": "address", "name": "requester", "type": "address"},
        {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
        {"internalType": "string", "name": "sourceChain", "type": "string"},
        {"internalType": "uint256", "name": "blockNumber", "type": "uint256"},
        {"internalType": "bytes32", "name": "stateRoot", "type": "bytes32"},
        {"internalType": "bool", "name": "isCompleted", "type": "bool"},
        {"internalType": "bool", "name": "isValid", "type": "bool"}
      ],
      "internalType": "struct ZKProofAggregator.ProofRequest",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  // Nova recursive proof functions
  {
    "inputs": [{"internalType": "uint256[]", "name": "proofIds", "type": "uint256[]"}],
    "name": "startNovaFolding",
    "outputs": [{"internalType": "uint256", "name": "batchId", "type": "uint256"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "batchId", "type": "uint256"}],
    "name": "continueRecursiveFolding",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "batchId", "type": "uint256"}],
    "name": "getRecursiveProofBatch",
    "outputs": [
      {"internalType": "uint256[]", "name": "proofIds", "type": "uint256[]"},
      {"internalType": "address", "name": "requester", "type": "address"},
      {"internalType": "uint256", "name": "timestamp", "type": "uint256"},
      {"internalType": "uint256", "name": "recursionDepth", "type": "uint256"},
      {"internalType": "bytes32", "name": "aggregatedHash", "type": "bytes32"},
      {"internalType": "bool", "name": "isCompleted", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "batchId", "type": "uint256"}],
    "name": "getFoldedInstance",
    "outputs": [{
      "components": [
        {"internalType": "uint256", "name": "stepIn", "type": "uint256"},
        {"internalType": "uint256", "name": "stepOut", "type": "uint256"},
        {"internalType": "uint256", "name": "programCounter", "type": "uint256"},
        {"internalType": "bytes32", "name": "stateRootIn", "type": "bytes32"},
        {"internalType": "bytes32", "name": "stateRootOut", "type": "bytes32"},
        {"internalType": "bytes32", "name": "nullifierHash", "type": "bytes32"},
        {"internalType": "bool", "name": "isValid", "type": "bool"}
      ],
      "internalType": "struct ZKProofAggregator.NovaInstance",
      "name": "",
      "type": "tuple"
    }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "batchId", "type": "uint256"},
      {"internalType": "bytes", "name": "proof", "type": "bytes"}
    ],
    "name": "verifyNovaProof",
    "outputs": [{"internalType": "bool", "name": "isValid", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  // View functions
  {
    "inputs": [],
    "name": "requestCounter",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "batchCounter",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "maxRecursionDepth",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "minProofsPerBatch",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "maxProofsPerBatch",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256"},
      {"indexed": true, "internalType": "address", "name": "requester", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "blockNumber", "type": "uint256"}
    ],
    "name": "ProofRequested",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "requestId", "type": "uint256"},
      {"indexed": false, "internalType": "bool", "name": "isValid", "type": "bool"},
      {"indexed": false, "internalType": "bytes32", "name": "stateRoot", "type": "bytes32"}
    ],
    "name": "ProofVerified",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "batchId", "type": "uint256"},
      {"indexed": false, "internalType": "uint256[]", "name": "proofIds", "type": "uint256[]"},
      {"indexed": true, "internalType": "address", "name": "requester", "type": "address"}
    ],
    "name": "NovaFoldingStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "batchId", "type": "uint256"},
      {"indexed": false, "internalType": "bytes32", "name": "aggregatedHash", "type": "bytes32"},
      {"indexed": false, "internalType": "bool", "name": "isValid", "type": "bool"}
    ],
    "name": "NovaFoldingCompleted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "uint256", "name": "batchId", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "recursionDepth", "type": "uint256"},
      {"indexed": false, "internalType": "bytes", "name": "recursiveProof", "type": "bytes"}
    ],
    "name": "RecursiveProofGenerated",
    "type": "event"
  }
] as const; 