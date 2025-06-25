export interface ProofRequest {
  requester: string;
  timestamp: bigint;
  sourceChain: string;
  blockNumber: bigint;
  stateRoot: `0x${string}`;
  isCompleted: boolean;
  isValid: boolean;
}

export interface NovaInstance {
  stepIn: bigint;
  stepOut: bigint;
  programCounter: bigint;
  stateRootIn: `0x${string}`;
  stateRootOut: `0x${string}`;
  nullifierHash: `0x${string}`;
  isValid: boolean;
}

export interface RecursiveProofBatch {
  proofIds: bigint[];
  requester: string;
  timestamp: bigint;
  recursionDepth: bigint;
  aggregatedHash: `0x${string}`;
  isCompleted: boolean;
}

export interface ContractStats {
  requestCounter: bigint;
  batchCounter: bigint;
  maxRecursionDepth: bigint;
  minProofsPerBatch: bigint;
  maxProofsPerBatch: bigint;
}

export interface ProofRequestFormData {
  sourceChain: string;
  blockNumber: string;
}

export interface NovaFoldingFormData {
  selectedProofIds: number[];
}

export type ProofStatus = 'pending' | 'completed' | 'failed' | 'verifying';
export type BatchStatus = 'folding' | 'completed' | 'failed' | 'recursive';

export interface ActivityItem {
  id: string;
  type: 'proof_request' | 'nova_folding' | 'recursive_proof';
  timestamp: Date;
  status: ProofStatus | BatchStatus;
  details: {
    requestId?: number;
    batchId?: number;
    sourceChain?: string;
    blockNumber?: number;
    proofIds?: number[];
    recursionDepth?: number;
  };
}

export interface DashboardData {
  totalProofs: number;
  completedProofs: number;
  totalBatches: number;
  completedBatches: number;
  averageRecursionDepth: number;
  recentActivity: ActivityItem[];
} 