'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { GitBranch, Play, Loader2 } from 'lucide-react';
import { useAccount, useContractRead, useContractReads, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CONTRACT_ADDRESSES, ZK_PROOF_AGGREGATOR_ABI } from '@/constants/contracts';
import { useZKProofService } from '@/hooks/useZKProofService';

export function NovaFoldingForm() {
  const { address } = useAccount();
  const [selectedProofIds, setSelectedProofIds] = useState<number[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<string>('unknown');

  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({
      hash,
    });

  const { checkServiceHealth } = useZKProofService();

  // Check ZK proof service status on component mount
  useEffect(() => {
    const checkStatus = async () => {
      const status = await checkServiceHealth();
      setServiceStatus(status?.status || 'offline');
      console.log('DEBUG: ZK Service Status:', status);
    };
    checkStatus();
  }, [checkServiceHealth]);

  // Fetch the total number of proof requests
  const { data: requestCounter } = useContractRead({
    address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
    abi: ZK_PROOF_AGGREGATOR_ABI,
    functionName: 'requestCounter',
  });

  console.log('DEBUG Nova: Contract Address:', CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR);
  console.log('DEBUG Nova: Request Counter:', requestCounter);

  // Fetch all proof requests for the user
  const proofRequestIds = requestCounter ? Array.from({ length: Number(requestCounter) }, (_, i) => BigInt(i + 1)) : [];
  
  
  const { data: proofRequests, refetch: refetchProofs } = useContractReads({
    contracts: proofRequestIds.map((id) => ({
      address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
      abi: ZK_PROOF_AGGREGATOR_ABI,
      functionName: 'getProofRequest',
      args: [id],
    })),
  });

  console.log('DEBUG Nova: Proof Requests Raw:', proofRequests);

  // Filter completed proofs for the user
  let completedProofs: Array<{ id: number; sourceChain: string; blockNumber: bigint; stateRoot: string; timestamp: number }> = [];
  if (Array.isArray(proofRequests) && address) {
    console.log('DEBUG Nova: Processing proof requests for address:', address);
    
    completedProofs = proofRequests
      .map((result, idx) => {
        if (!result || !result.result) {
          console.log(`DEBUG Nova: No result for index ${idx}`, result);
          return null;
        }
        
        // Fix: Ensure result.result is properly handled as an object with properties
        const proofData = result.result as any;
        console.log(`DEBUG Nova: Proof data for index ${idx}:`, proofData);
        
        if (!proofData || typeof proofData !== 'object') {
          console.log(`DEBUG Nova: Invalid proof data for index ${idx}`);
          return null;
        }
        
        // Access properties directly from the object instead of destructuring as array
        const requester = typeof proofData.requester === 'string' ? proofData.requester : 
                         (proofData[0] && typeof proofData[0] === 'string' ? proofData[0] : null);
        const timestamp = typeof proofData.timestamp === 'bigint' ? proofData.timestamp : 
                         (proofData[1] ? proofData[1] : Number(0));
        const sourceChain = typeof proofData.sourceChain === 'string' ? proofData.sourceChain : 
                           (proofData[2] && typeof proofData[2] === 'string' ? proofData[2] : '');
        const blockNumber = typeof proofData.blockNumber === 'bigint' ? proofData.blockNumber : 
                           (proofData[3] ? proofData[3] : Number(0));
        const stateRoot = typeof proofData.stateRoot === 'string' ? proofData.stateRoot : 
                         (proofData[4] && typeof proofData[4] === 'string' ? proofData[4] : '0x');
        const isCompleted = typeof proofData.isCompleted === 'boolean' ? proofData.isCompleted : 
                           (typeof proofData[5] === 'boolean' ? proofData[5] : false);
        const isValid = typeof proofData.isValid === 'boolean' ? proofData.isValid : 
                       (typeof proofData[6] === 'boolean' ? proofData[6] : false);
        
        console.log(`DEBUG Nova: Extracted data for proof ${idx}:`, {
          requester,
          timestamp,
          sourceChain,
          blockNumber,
          stateRoot,
          isCompleted,
          isValid
        });
        
        if (!requester) {
          console.log(`DEBUG Nova: Requester is null or undefined for proof ${idx}`);
          return null;
        }
        
        console.log(`DEBUG Nova: Proof ${idx} - Requester: ${requester}, User address: ${address}`);
        console.log(`DEBUG Nova: Addresses match?`, requester.toLowerCase() === address.toLowerCase());
        console.log(`DEBUG Nova: Completed: ${isCompleted}, Valid: ${isValid}`);
        
        // Filter proofs by requester (show only user's proofs)
        if (requester.toLowerCase() !== address.toLowerCase()) return null;
        
        if (!isCompleted || !isValid) {
          return null;
        }
        
        return {
          id: idx + 1, // Use correct 1-based request ID
          sourceChain: String(sourceChain),
          blockNumber: BigInt(blockNumber),
          stateRoot: String(stateRoot),
          timestamp: Number(timestamp),
        };
      })
      .filter((x): x is { id: number; sourceChain: string; blockNumber: bigint; stateRoot: string; timestamp: number } => x !== null);
  }

  console.log('DEBUG Nova: Filtered completed proofs:', completedProofs);

  const handleSelect = (id: number) => {
    setSelectedProofIds((prev) =>
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const startNovaFolding = async () => {
    if (selectedProofIds.length === 0) return;
    
    setIsSubmitting(true);
    try {
      console.log('DEBUG Nova: Starting Nova folding with IDs:', selectedProofIds);
      await writeContract({
        address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'startNovaFolding',
        args: [selectedProofIds.map(id => BigInt(id))],
      });
      
      // Reset selection after successful submission
      if (isConfirmed) {
        setSelectedProofIds([]);
        refetchProofs();
      }
    } catch (error) {
      console.error('Error starting Nova folding:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <GitBranch className="w-5 h-5 text-purple-500" />
          <span>Nova Recursive Proof Folding</span>
        </CardTitle>
          <div className="text-xs font-mono">
            Service: 
            <span className={
              serviceStatus === 'running' ? 'text-green-500' : 
              serviceStatus === 'offline' ? 'text-red-500' : 'text-yellow-500'
            }> {serviceStatus}</span>
          </div>
        </div>
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
              <Button 
                disabled={selectedProofIds.length === 0 || isSubmitting || isPending || isConfirming} 
                className="w-full"
                onClick={startNovaFolding}
              >
                {isSubmitting || isPending || isConfirming ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {isPending || isSubmitting ? 'Processing...' : 'Confirming...'}
                  </>
                ) : (
                  <>
                <Play className="w-4 h-4 mr-2" />
                Start Nova Folding
                  </>
                )}
              </Button>
              
              {error && (
                <div className="text-red-500 text-sm mt-2">
                  Error: {error.message || 'Failed to start Nova folding'}
                </div>
              )}
              
              {isConfirmed && (
                <div className="text-green-500 text-sm mt-2">
                  Nova folding started successfully!
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 