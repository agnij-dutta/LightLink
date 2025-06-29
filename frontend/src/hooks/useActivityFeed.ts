import { useState, useEffect, useCallback } from 'react';
import { useAccount, usePublicClient, useWatchContractEvent } from 'wagmi';
import { CONTRACT_ADDRESSES, ZK_PROOF_AGGREGATOR_ABI } from '@/constants/contracts';

export interface ActivityItem {
  id: string;
  timestamp: number;
  message: string;
  type: 'info' | 'success' | 'warning';
}

/**
 * Aggregates on-chain activity (ProofRequested, ProofVerified, NovaFolding* events) and
 * provides a live-updating list scoped to the current user.
 */
export function useActivityFeed() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [activities, setActivities] = useState<ActivityItem[]>([]);

  // Helper to push new activity to state (dedup by id)
  const pushActivity = useCallback((item: ActivityItem) => {
    setActivities(prev => {
      if (prev.find(p => p.id === item.id)) return prev; // dedupe
      return [...prev, item].sort((a, b) => b.timestamp - a.timestamp);
    });
  }, []);

  // Initial fetch – get historical proofs and batches for user and map to activity
  useEffect(() => {
    if (!address) return;

    const fetchHistorical = async () => {
      try {
        // 1. Fetch proof requests count
        const requestCount: bigint = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
          abi: ZK_PROOF_AGGREGATOR_ABI,
          functionName: 'requestCounter',
        }) as bigint;

        const proofIds = Array.from({ length: Number(requestCount) }, (_, i) => BigInt(i + 1));

        // Fetch each proof request (batched via multicall)
        const proofCalls = proofIds.map((id) => ({
          address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
          abi: ZK_PROOF_AGGREGATOR_ABI,
          functionName: 'getProofRequest',
          args: [id],
        }));

        const proofResults: any[] = proofCalls.length
          ? await publicClient.multicall({ contracts: proofCalls })
          : [];

        proofResults.forEach((res, idx) => {
          if (!res || res.status !== 'success' || !res.result) return;

          const data: any = res.result;

          const requester: string | undefined = typeof data.requester === 'string' ? data.requester : data[0];
          const timestampRaw: bigint | number | undefined = typeof data.timestamp === 'bigint' ? data.timestamp : data[1];
          const sourceChain: string = typeof data.sourceChain === 'string' ? data.sourceChain : data[2] ?? 'unknown chain';
          const isCompleted: boolean = typeof data.isCompleted === 'boolean' ? data.isCompleted : data[5] ?? false;
          const isValid: boolean = typeof data.isValid === 'boolean' ? data.isValid : data[6] ?? false;

          if (!requester || requester.toLowerCase() !== address.toLowerCase()) return;

          const timestamp = Number(timestampRaw ?? 0) * 1000; // convert secs -> ms

          // Proof requested
          pushActivity({
            id: `proof-request-${idx + 1}`,
            timestamp,
            message: `Proof requested on ${sourceChain}`,
            type: 'info',
          });

          // Proof verified
          if (isCompleted) {
            pushActivity({
              id: `proof-verified-${idx + 1}`,
              timestamp: timestamp + 1,
              message: `Proof ${isValid ? 'verified' : 'failed'} on ${sourceChain}`,
              type: isValid ? 'success' : 'warning',
            });
          }
        });

        // 2. Fetch Nova batches
        const batchCount: bigint = await publicClient.readContract({
          address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
          abi: ZK_PROOF_AGGREGATOR_ABI,
          functionName: 'batchCounter',
        }) as bigint;

        const batchIds = Array.from({ length: Number(batchCount) }, (_, i) => BigInt(i + 1));
        const batchCalls = batchIds.map((id) => ({
          address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
          abi: ZK_PROOF_AGGREGATOR_ABI,
          functionName: 'getRecursiveProofBatch',
          args: [id],
        }));

        const batchResults: any[] = batchCalls.length
          ? await publicClient.multicall({ contracts: batchCalls })
          : [];

        batchResults.forEach((res, idx) => {
          if (!res || res.status !== 'success' || !res.result) return;

          const data: any = res.result;
          const requester: string | undefined = typeof data.requester === 'string' ? data.requester : data[1];
          const timestampRaw: bigint | number | undefined = typeof data.timestamp === 'bigint' ? data.timestamp : data[2];
          const isCompleted: boolean = typeof data.isCompleted === 'boolean' ? data.isCompleted : data[5] ?? false;

          if (!requester || requester.toLowerCase() !== address.toLowerCase()) return;

          const timestamp = Number(timestampRaw ?? 0) * 1000;

          pushActivity({
            id: `nova-start-${idx + 1}`,
            timestamp,
            message: `Proofs aggregated in NOVA batch #${idx + 1}`,
            type: 'info',
          });

          if (isCompleted) {
            pushActivity({
              id: `nova-complete-${idx + 1}`,
              timestamp: timestamp + 1,
              message: `NOVA batch #${idx + 1} completed`,
              type: 'success',
            });
          }
        });
      } catch (err) {
        console.error('Failed fetching historical activity', err);
      }
    };

    fetchHistorical();
  }, [address, publicClient, pushActivity]);

  // Live watchers – ProofRequested
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
    abi: ZK_PROOF_AGGREGATOR_ABI,
    eventName: 'ProofRequested',
    onLogs: logs => {
      logs.forEach(async (log) => {
        // decode event params directly
        const { args, blockNumber } = log as any;
        if (!args) return;
        const requester = args.requester as string;
        if (requester.toLowerCase() !== (address ?? '').toLowerCase()) return;
        // Fetch block timestamp for nicer UX
        const block = await publicClient.getBlock({ blockNumber });
        pushActivity({
          id: `proof-request-${args.requestId}`,
          timestamp: Number(block.timestamp) * 1000,
          message: `Proof requested on chain (id ${args.blockNumber})`,
          type: 'info',
        });
      });
    },
  });

  // ProofVerified
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
    abi: ZK_PROOF_AGGREGATOR_ABI,
    eventName: 'ProofVerified',
    onLogs: logs => {
      logs.forEach(async (log) => {
        const { args, blockNumber } = log as any;
        if (!args) return;
        const requestId = args.requestId as bigint;
        const isValid = args.isValid as boolean;
        const block = await publicClient.getBlock({ blockNumber });
        pushActivity({
          id: `proof-verified-${requestId.toString()}`,
          timestamp: Number(block.timestamp) * 1000,
          message: `Proof ${isValid ? 'verified' : 'failed'} (request #${requestId})`,
          type: isValid ? 'success' : 'warning',
        });
      });
    },
  });

  // NovaFoldingStarted
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
    abi: ZK_PROOF_AGGREGATOR_ABI,
    eventName: 'NovaFoldingStarted',
    onLogs: logs => {
      logs.forEach(async (log) => {
        const { args, blockNumber } = log as any;
        const requester = args.requester as string;
        if (requester.toLowerCase() !== (address ?? '').toLowerCase()) return;
        const batchId = args.batchId as bigint;
        const block = await publicClient.getBlock({ blockNumber });
        pushActivity({
          id: `nova-start-${batchId.toString()}`,
          timestamp: Number(block.timestamp) * 1000,
          message: `NOVA batch #${batchId} started (proofs aggregated)`,
          type: 'info',
        });
      });
    },
  });

  // NovaFoldingCompleted
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
    abi: ZK_PROOF_AGGREGATOR_ABI,
    eventName: 'NovaFoldingCompleted',
    onLogs: logs => {
      logs.forEach(async (log) => {
        const { args, blockNumber } = log as any;
        const batchId = args.batchId as bigint;
        const block = await publicClient.getBlock({ blockNumber });
        pushActivity({
          id: `nova-complete-${batchId.toString()}`,
          timestamp: Number(block.timestamp) * 1000,
          message: `NOVA batch #${batchId} completed`,
          type: 'success',
        });
      });
    },
  });

  return { activities };
} 