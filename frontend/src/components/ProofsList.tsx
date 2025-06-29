'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWatchContractEvent, useContractRead, useContractReads } from 'wagmi';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { 
  Network, 
  ExternalLink, 
  Clock, 
  CheckCircle, 
  XCircle,
  Hash,
  Calendar
} from 'lucide-react';
import { CONTRACT_ADDRESSES, ZK_PROOF_AGGREGATOR_ABI } from '@/constants/contracts';
import type { ProofStatus } from '@/types';

interface ProofRequestDisplay {
  id: string;
  requestId: string;
  requester: string;
  targetChain: string;
  blockHash: string;
  status: ProofStatus;
  timestamp: number;
  transactionHash?: string;
}

export function ProofsList() {
  const { address } = useAccount();
  const [proofs, setProofs] = useState<ProofRequestDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch the total number of proof requests
  const { data: requestCounter } = useContractRead({
    address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
    abi: ZK_PROOF_AGGREGATOR_ABI,
    functionName: 'requestCounter',
    query: {
      enabled: true
    }
  });

  // Fetch all proof requests for the user (contract uses 1-based indexing)
  const proofRequestIds = requestCounter ? Array.from({ length: Number(requestCounter) }, (_, i) => i + 1) : [];
  const {
    data: proofRequests,
    isLoading: isProofsLoading,
    refetch: refetchProofs,
  } = useContractReads({
    contracts: proofRequestIds.map((id) => ({
      address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
      abi: ZK_PROOF_AGGREGATOR_ABI,
      functionName: 'getProofRequest',
      args: [BigInt(id)],
    })),
    query: {
      enabled: proofRequestIds.length > 0
    }
  });

  // Update proofs state when contract data changes
  useEffect(() => {
    if (!proofRequests || !address) {
      return;
    }
    
    const userProofs: ProofRequestDisplay[] = proofRequests
      .map((result, idx) => {
        if (!result?.result) {
          return null;
        }
        
        const proofData = result.result as any;
        if (!proofData || typeof proofData !== 'object') {
          return null;
        }
        
        // Access properties directly from the object instead of destructuring as array
        // Check if proofData is an array-like object with numeric indices
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
        
        if (!requester) {
          return null;
        }
        
        // Filter proofs by requester (show only user's proofs)
        if (requester.toLowerCase() !== address.toLowerCase()) return null;
        
        return {
          id: (idx + 1).toString(), // Use correct 1-based request ID
          requestId: (idx + 1).toString(), // Use correct 1-based request ID  
          requester,
          targetChain: sourceChain,
          blockHash: stateRoot,
          status: isCompleted ? (isValid ? 'completed' : 'failed') : 'pending',
          timestamp: Number(timestamp),
        };
      })
      .filter(Boolean) as ProofRequestDisplay[];
    setProofs(userProofs.reverse()); // Most recent first
    setIsLoading(false);
  }, [proofRequests, address]);

  // Watch for new proof requests
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
    abi: ZK_PROOF_AGGREGATOR_ABI,
    eventName: 'ProofRequested',
    onLogs() {
      refetchProofs();
    },
  });

  // Watch for proof completion
  useWatchContractEvent({
    address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
    abi: ZK_PROOF_AGGREGATOR_ABI,
    eventName: 'ProofVerified',
    onLogs() {
      refetchProofs();
    },
  });

  const getStatusColor = (status: ProofStatus) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-500 bg-yellow-500/10';
      case 'completed':
        return 'text-green-500 bg-green-500/10';
      case 'failed':
        return 'text-red-500 bg-red-500/10';
      case 'verifying':
        return 'text-blue-500 bg-blue-500/10';
      default:
        return 'text-gray-500 bg-gray-500/10';
    }
  };

  const getStatusIcon = (status: ProofStatus) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
      case 'verifying':
        return <Hash className="w-4 h-4" />;
      default:
        return <Hash className="w-4 h-4" />;
    }
  };

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
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

  const openTransaction = (txHash: string) => {
    const explorerUrl = 'https://testnet.snowtrace.io';
    window.open(`${explorerUrl}/tx/${txHash}`, '_blank');
  };

  if (isLoading) {
    return (
      <Card className="glass border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Network className="w-5 h-5 text-primary" />
            <span>ZK Proof Requests</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="loading-shimmer h-16 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Network className="w-5 h-5 text-primary" />
            <span>ZK Proof Requests</span>
          </CardTitle>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetchProofs()}
              className="text-xs"
            >
              Refresh
            </Button>
            <Badge variant="outline" className="text-xs">
              {proofs.length} Total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {proofs.length === 0 ? (
          <div className="text-center py-12">
            <Network className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No proof requests found.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Submit a proof request to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {proofs.map((proof) => (
              <div 
                key={proof.id}
                className="glass border border-border/30 rounded-lg p-4 hover:border-primary/30 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    {/* Header */}
                    <div className="flex items-center space-x-3">
                      <Badge className={`${getStatusColor(proof.status)} flex items-center space-x-1`}>
                        {getStatusIcon(proof.status)}
                        <span className="capitalize">{proof.status}</span>
                      </Badge>
                      <span className="text-sm text-muted-foreground font-mono">
                        Request #{proof.requestId}
                      </span>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Target Chain:</span>
                        <div className="font-mono">{proof.targetChain}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Block Hash:</span>
                        <div className="font-mono">{truncateHash(proof.blockHash)}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground">Requester:</span>
                        <div className="font-mono">{truncateHash(proof.requester)}</div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-muted-foreground flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>Timestamp:</span>
                        </span>
                        <div className="text-xs">{formatTimestamp(proof.timestamp)}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-2">
                    {proof.transactionHash && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTransaction(proof.transactionHash!)}
                        className="text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Tx
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 