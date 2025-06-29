'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { GitBranch, Play, Loader2, Check, Clock, Hash, ChevronRight, CheckSquare, Square, AlertTriangle } from 'lucide-react';
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
      // Backend returns 'ready' when service is healthy, map it to user-friendly status
      const healthStatus = status?.status;
      setServiceStatus(
        healthStatus === 'ready' ? 'online' : 
        healthStatus === 'error' ? 'error' :
        healthStatus ? healthStatus : 'offline'
      );
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
        
        // Only show completed AND valid proofs for Nova folding
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

  const selectAll = () => {
    setSelectedProofIds(completedProofs.map(proof => proof.id));
  };

  const clearSelection = () => {
    setSelectedProofIds([]);
  };

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  const formatTimestamp = (timestamp: number) => {
    // Handle both seconds and milliseconds timestamps
    const date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getChainIcon = (chain: string) => {
    const chainLower = chain.toLowerCase();
    if (chainLower.includes('polygon')) return '🔷';
    if (chainLower.includes('ethereum')) return '⟠';
    if (chainLower.includes('sepolia')) return '🔹';
    if (chainLower.includes('arbitrum')) return '🔵';
    if (chainLower.includes('optimism')) return '🔴';
    return '⚡';
  };

  const startNovaFolding = async () => {
    if (selectedProofIds.length < 2) {
      return;
    }
    
    setIsSubmitting(true);
    try {
      console.log('DEBUG Nova: Starting Nova folding with IDs:', selectedProofIds);
      console.log('DEBUG Nova: Contract Address:', CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR);
      
      const proofIdsBigInt = selectedProofIds.map(id => BigInt(id));
      console.log('DEBUG Nova: Proof IDs as BigInt:', proofIdsBigInt);
      
      await writeContract({
        address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'startNovaFolding',
        args: [proofIdsBigInt],
        // Add explicit gas limit to prevent out of gas errors
        gas: BigInt(500000),
      });
      
      console.log('DEBUG Nova: Transaction submitted successfully');
    } catch (error) {
      console.error('Error starting Nova folding:', error);
      console.error('Error details:', error.message || error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Reset selection after successful confirmation
  useEffect(() => {
    if (isConfirmed) {
      console.log('DEBUG Nova: Transaction confirmed, resetting selection');
      setSelectedProofIds([]);
      refetchProofs();
    }
  }, [isConfirmed, refetchProofs]);

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <GitBranch className="w-5 h-5 text-purple-500" />
          <span>Nova Recursive Proof Folding</span>
        </CardTitle>
          <div className="text-xs font-mono">
            Service: 
            <span className={
              serviceStatus === 'online' ? 'text-green-500' : 
              serviceStatus === 'offline' ? 'text-red-500' : 
              serviceStatus === 'error' ? 'text-red-500' : 'text-yellow-500'
            }> {serviceStatus}</span>
          </div>
        </div>
        <CardDescription>
          Aggregate multiple ZK proofs using Nova's folding scheme for exponential scalability.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="bg-purple-500/10 border border-purple-400/30 rounded-xl p-5 backdrop-blur-sm shadow-lg shadow-purple-500/10">
            <h4 className="font-semibold text-purple-200 mb-3 flex items-center">
              <GitBranch className="w-4 h-4 mr-2" />
              Nova Folding Process:
            </h4>
            <ul className="text-sm text-purple-100/90 space-y-2">
              <li className="flex items-start">
                <span className="text-purple-300 mr-2">•</span>
                <span>Selected proofs are combined using Nova's folding scheme</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-300 mr-2">•</span>
                <span>Recursive instance is created with aggregated state</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-300 mr-2">•</span>
                <span>Verification time becomes constant regardless of proof count</span>
              </li>
              <li className="flex items-start">
                <span className="text-purple-300 mr-2">•</span>
                <span>Continue folding to increase recursion depth</span>
              </li>
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
              {/* Selection Controls */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="font-medium text-lg">Select proofs to fold:</h3>
                  <Badge variant="outline" className="text-xs">
                    {selectedProofIds.length} of {completedProofs.length} selected
                  </Badge>
                  <span className="text-xs text-gray-500 italic">(minimum 2 required)</span>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAll}
                    disabled={selectedProofIds.length === completedProofs.length}
                    className="text-xs"
                  >
                    <CheckSquare className="w-3 h-3 mr-1" />
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                    disabled={selectedProofIds.length === 0}
                    className="text-xs"
                  >
                    <Square className="w-3 h-3 mr-1" />
                    Clear
                  </Button>
                </div>
              </div>

              {/* Proof Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedProofs.map((proof) => {
                  const isSelected = selectedProofIds.includes(proof.id);
                  return (
                    <div
                      key={proof.id}
                      onClick={() => handleSelect(proof.id)}
                      className={`
                        relative p-5 rounded-xl border cursor-pointer transition-all duration-200 backdrop-blur-sm
                        ${isSelected 
                          ? 'border-purple-400/60 bg-purple-500/10 shadow-lg shadow-purple-500/20 ring-1 ring-purple-400/30' 
                          : 'border-gray-500/30 bg-gray-900/40 hover:border-purple-400/40 hover:bg-purple-500/5 hover:shadow-md hover:shadow-purple-500/10'
                        }
                      `}
                    >
                      {/* Selection Indicator */}
                      <div className="absolute top-4 right-4">
                        {isSelected ? (
                          <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-purple-500/30">
                            <Check className="w-4 h-4 text-white" />
                          </div>
                        ) : (
                          <div className="w-6 h-6 border border-gray-400/50 rounded-full bg-gray-800/30 backdrop-blur-sm" />
                        )}
                      </div>

                      {/* Proof Header */}
                      <div className="mb-4 pr-8">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="outline" className="text-xs font-mono font-semibold">
                            Proof #{proof.id}
                          </Badge>
                          <Badge className="bg-green-500/20 text-green-300 text-xs border-green-400/30 backdrop-blur-sm">
                            <Check className="w-3 h-3 mr-1" />
                            Verified
                          </Badge>
                        </div>
                      </div>

                      {/* Proof Details */}
                      <div className="space-y-4 text-sm">
                        {/* Chain and Block */}
                                                  <div className="flex items-center space-x-3">
                            <div className="text-2xl">{getChainIcon(proof.sourceChain)}</div>
                            <div className="flex-1">
                              <p className="font-semibold capitalize text-gray-100">
                                {proof.sourceChain}
                              </p>
                              <p className="text-xs text-gray-400 font-mono">
                                Block: {proof.blockNumber.toString()}
                              </p>
                            </div>
                          </div>

                                                  {/* State Root */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-1">
                              <Hash className="w-4 h-4 text-purple-400" />
                              <span className="text-xs font-medium text-gray-300">State Root</span>
                            </div>
                            <div className="bg-gray-800/60 border border-gray-600/40 rounded-lg p-3 backdrop-blur-sm">
                              <p className="font-mono text-xs text-gray-200 break-all leading-relaxed">
                                {truncateHash(proof.stateRoot)}
                              </p>
                            </div>
                          </div>

                                                  {/* Timestamp */}
                          <div className="flex items-center space-x-2 pt-2 border-t border-gray-600/30">
                            <Clock className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-400">
                              {formatTimestamp(proof.timestamp)}
                            </span>
                          </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Folding Button */}
              <div className="pt-4">
                {selectedProofIds.length > 0 && selectedProofIds.length < 2 && (
                  <div className="mb-3 p-3 bg-yellow-500/10 border border-yellow-400/30 rounded-lg backdrop-blur-sm">
                    <p className="text-yellow-300 text-sm flex items-center">
                      <AlertTriangle className="w-4 h-4 mr-2" />
                      Please select at least 2 proofs to start Nova folding
                    </p>
                  </div>
                )}
                
                <Button 
                  disabled={selectedProofIds.length < 2 || isSubmitting || isPending || isConfirming} 
                  className="w-full h-12 text-base"
                  onClick={startNovaFolding}
                >
                  {isSubmitting || isPending || isConfirming ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      {isPending || isSubmitting ? 'Processing Transaction...' : 'Confirming...'}
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 mr-2" />
                      {selectedProofIds.length < 2 
                        ? `Select ${2 - selectedProofIds.length} more proof${2 - selectedProofIds.length === 1 ? '' : 's'} to start`
                        : `Start Nova Folding (${selectedProofIds.length} proof${selectedProofIds.length !== 1 ? 's' : ''})`
                      }
                      {selectedProofIds.length >= 2 && <ChevronRight className="w-4 h-4 ml-2" />}
                    </>
                  )}
                </Button>
              </div>
              
              {/* Status Messages */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <div className="text-red-600 dark:text-red-400 text-sm">
                    <strong>Error:</strong> {error.message || 'Failed to start Nova folding'}
                  </div>
                </div>
              )}
              
              {isConfirmed && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                  <div className="text-green-600 dark:text-green-400 text-sm">
                    <strong>Success:</strong> Nova folding started successfully!
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
} 