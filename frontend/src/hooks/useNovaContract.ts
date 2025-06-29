import { useState, useEffect } from 'react';
import { useAccount, useContractRead, useContractReads, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESSES, ZK_PROOF_AGGREGATOR_ABI } from '@/constants/contracts';

export interface NovaFoldingBatch {
  id: number;
  proofIds: bigint[];
  requester: string;
  timestamp: number;
  recursionDepth: number;
  aggregatedHash: string;
  isCompleted: boolean;
  foldedInstance?: {
    stepIn: bigint;
    stepOut: bigint;
    programCounter: bigint;
    stateRootIn: string;
    stateRootOut: string;
    nullifierHash: string;
    isValid: boolean;
  };
}

export interface ChainlinkResponse {
  requestId: string;
  response: string;
  timestamp: number;
  batchId?: number;
}

export function useNovaContract() {
  const { address } = useAccount();
  const [batches, setBatches] = useState<NovaFoldingBatch[]>([]);
  const [chainlinkResponses, setChainlinkResponses] = useState<ChainlinkResponse[]>([]);

  // Get batch counter
  const { data: batchCounter, refetch: refetchBatchCounter } = useContractRead({
    address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
    abi: ZK_PROOF_AGGREGATOR_ABI,
    functionName: 'batchCounter',
  });

  // Generate array of batch IDs to fetch
  const batchIds = batchCounter ? Array.from({ length: Number(batchCounter) }, (_, i) => BigInt(i + 1)) : [];

  // Fetch all batches
  const { data: batchData, refetch: refetchBatches } = useContractReads({
    contracts: batchIds.map((id) => ({
      address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
      abi: ZK_PROOF_AGGREGATOR_ABI,
      functionName: 'getRecursiveProofBatch',
      args: [id],
    })),
  });

  // Fetch folded instances for completed batches
  const { data: foldedInstanceData } = useContractReads({
    contracts: batchIds.map((id) => ({
      address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
      abi: ZK_PROOF_AGGREGATOR_ABI,
      functionName: 'getFoldedInstance',
      args: [id],
    })),
  });

  // Process batch data when it changes
  useEffect(() => {
    if (!batchData || !address) return;

    const processedBatches: NovaFoldingBatch[] = [];
    const mockChainlinkResponses: ChainlinkResponse[] = [];

    batchData.forEach((result, idx) => {
      if (!result || !result.result) return;

      const data = result.result as any;
      const foldedInstance = foldedInstanceData?.[idx]?.result as any;

      // Extract batch data - handle both array and object formats
      const proofIds = data.proofIds || data[0] || [];
      const requester = data.requester || data[1] || '';
      const timestamp = Number(data.timestamp || data[2] || 0);
      const recursionDepth = Number(data.recursionDepth || data[3] || 0);
      const aggregatedHash = data.aggregatedHash || data[4] || '0x';
      const isCompleted = data.isCompleted || data[5] || false;

      // Filter to show only user's batches
      if (requester.toLowerCase() !== address.toLowerCase()) return;

      const batch: NovaFoldingBatch = {
        id: idx + 1,
        proofIds: Array.isArray(proofIds) ? proofIds.map(id => BigInt(id)) : [],
        requester,
        timestamp,
        recursionDepth,
        aggregatedHash,
        isCompleted,
      };

      // Add folded instance if available
      if (foldedInstance && isCompleted) {
        batch.foldedInstance = {
          stepIn: BigInt(foldedInstance.stepIn || foldedInstance[0] || 0),
          stepOut: BigInt(foldedInstance.stepOut || foldedInstance[1] || 0),
          programCounter: BigInt(foldedInstance.programCounter || foldedInstance[2] || 0),
          stateRootIn: foldedInstance.stateRootIn || foldedInstance[3] || '0x',
          stateRootOut: foldedInstance.stateRootOut || foldedInstance[4] || '0x',
          nullifierHash: foldedInstance.nullifierHash || foldedInstance[5] || '0x',
          isValid: foldedInstance.isValid || foldedInstance[6] || false,
        };
      }

      processedBatches.push(batch);

      // Create mock Chainlink response for demonstration
      // In reality, this would come from event logs or a separate API
      if (aggregatedHash && aggregatedHash !== '0x') {
        mockChainlinkResponses.push({
          requestId: `req_${idx + 1}`,
          response: aggregatedHash,
          timestamp: timestamp + 60, // Response comes after request
          batchId: idx + 1,
        });
      }
    });

    setBatches(processedBatches.reverse()); // Most recent first
    setChainlinkResponses(mockChainlinkResponses.reverse());
  }, [batchData, foldedInstanceData, address]);

  // Contract writing functions
  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, error: receiptError } = 
    useWaitForTransactionReceipt({ hash });

  const startNovaFolding = async (proofIds: number[]) => {
    if (!CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR) {
      throw new Error('Nova contract address not configured');
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'startNovaFolding',
        args: [proofIds.map(id => BigInt(id))],
      });
    } catch (err) {
      console.error('Error starting Nova folding:', err);
      throw err;
    }
  };

  const continueRecursiveFolding = async (batchId: number) => {
    if (!CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR) {
      throw new Error('Nova contract address not configured');
    }

    try {
      await writeContract({
        address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'continueRecursiveFolding',
        args: [BigInt(batchId)],
      });
    } catch (err) {
      console.error('Error continuing recursive folding:', err);
      throw err;
    }
  };

  const refresh = () => {
    refetchBatchCounter();
    refetchBatches();
  };

  return {
    batches,
    chainlinkResponses,
    batchCounter: batchCounter ? Number(batchCounter) : 0,
    startNovaFolding,
    continueRecursiveFolding,
    isLoading: isPending || isConfirming,
    isSuccess: isConfirmed,
    error: error || receiptError,
    hash,
    refresh,
  };
} 