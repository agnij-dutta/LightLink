'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { GitBranch, Play } from 'lucide-react';
import { useAccount, useContractRead, useContractReads } from 'wagmi';
import { CONTRACT_ADDRESSES, ZK_PROOF_AGGREGATOR_ABI } from '@/constants/contracts';

export function NovaFoldingForm() {
  const { address } = useAccount();
  const [selectedProofIds, setSelectedProofIds] = useState<number[]>([]);

  // Fetch the total number of proof requests
  const { data: requestCounter } = useContractRead({
    address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
    abi: ZK_PROOF_AGGREGATOR_ABI,
    functionName: 'requestCounter',
  });

  // Fetch all proof requests for the user
  const proofRequestIds = requestCounter ? Array.from({ length: Number(requestCounter) }, (_, i) => BigInt(i)) : [];
  const { data: proofRequests } = useContractReads({
    contracts: proofRequestIds.map((id) => ({
      address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
      abi: ZK_PROOF_AGGREGATOR_ABI,
      functionName: 'getProofRequest',
      args: [id],
    })),
  });

  // Filter completed proofs for the user
  let completedProofs: Array<{ id: number; sourceChain: string; blockNumber: bigint; stateRoot: string; timestamp: number }> = [];
  if (Array.isArray(proofRequests) && address) {
    completedProofs = proofRequests
      .map((result, idx) => {
        if (!result || !result.result) return null;
        const result_array = result.result as unknown as [string, bigint, string, bigint, string, boolean, boolean];
        const [requester, timestamp, sourceChain, blockNumber, stateRoot, isCompleted, isValid] = result_array;
        if (typeof requester !== 'string' || requester.toLowerCase() !== address.toLowerCase()) return null;
        if (!isCompleted || !isValid) return null;
        return {
          id: idx,
          sourceChain: String(sourceChain),
          blockNumber: BigInt(blockNumber),
          stateRoot: String(stateRoot),
          timestamp: Number(timestamp),
        };
      })
      .filter((x): x is { id: number; sourceChain: string; blockNumber: bigint; stateRoot: string; timestamp: number } => x !== null);
  }

  const handleSelect = (id: number) => {
    setSelectedProofIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <GitBranch className="w-5 h-5 text-purple-500" />
          <span>Nova Recursive Proof Folding</span>
        </CardTitle>
        <CardDescription>
          Aggregate multiple ZK proofs using Nova's folding scheme for exponential scalability.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
            <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
              Nova Folding Process:
            </h4>
            <ul className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
              <li>• Selected proofs are combined using Nova's folding scheme</li>
              <li>• Recursive instance is created with aggregated state</li>
              <li>• Verification time becomes constant regardless of proof count</li>
              <li>• Continue folding to increase recursion depth</li>
            </ul>
          </div>

          {completedProofs.length === 0 ? (
            <div className="text-center py-8">
              <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No completed proofs available for folding.</p>
              <p className="text-sm text-gray-400 mt-1">
                Submit and complete proof requests first.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-4">
                <p className="font-medium mb-2">Select proofs to fold:</p>
                <ul className="space-y-2">
                  {completedProofs.map((proof: any) => (
                    <li key={proof.id} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={selectedProofIds.includes(proof.id)}
                        onChange={() => handleSelect(proof.id)}
                        className="form-checkbox h-4 w-4 text-purple-600"
                      />
                      <span className="font-mono text-xs">Proof #{proof.id} | Block: {typeof proof.blockNumber === 'bigint' ? proof.blockNumber.toString() : String(proof.blockNumber)} | Chain: {proof.sourceChain}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Button disabled={selectedProofIds.length === 0} className="w-full">
                <Play className="w-4 h-4 mr-2" />
                Start Nova Folding
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 