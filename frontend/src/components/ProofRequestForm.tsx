'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { Badge } from './ui/Badge';
import { 
  Network, 
  Loader2, 
  CheckCircle, 
  AlertTriangle,
  ExternalLink,
  Hash,
  Eye,
  RefreshCw
} from 'lucide-react';
import { CONTRACT_ADDRESSES, ZK_PROOF_AGGREGATOR_ABI } from '@/constants/contracts';
import { useZKProofService } from '@/hooks/useZKProofService';
import type { ProofRequestFormData } from '@/types';

export function ProofRequestForm() {
  const { address, isConnected } = useAccount();
  const [formData, setFormData] = useState<ProofRequestFormData>({
    sourceChain: '',
    blockNumber: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string>('');
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [previewProof, setPreviewProof] = useState<any>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const { writeContract, data: hash, error, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = 
    useWaitForTransactionReceipt({
      hash,
    });
  
  const { 
    generateMockProof, 
    isLoading: isProofServiceLoading,
    error: proofServiceError,
    checkServiceHealth,
    serviceStatus
  } = useZKProofService();

  // Check ZK proof service status on component mount
  useEffect(() => {
    checkServiceHealth();
  }, [checkServiceHealth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !formData.sourceChain || !formData.blockNumber || requestSubmitted) {
      return;
    }
    setIsSubmitting(true);
    try {
      const blockNum = BigInt(formData.blockNumber);
      await writeContract({
        address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'requestProofVerification',
        args: [formData.sourceChain, blockNum],
      });
      if (hash) {
        setLastTxHash(hash);
      }
      setRequestSubmitted(true);
    } catch (error) {
      console.error('Error submitting proof request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof ProofRequestFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    // Clear preview when inputs change
    setPreviewProof(null);
  };

  const resetForm = () => {
    setFormData({ sourceChain: '', blockNumber: '' });
    setLastTxHash('');
    setRequestSubmitted(false);
    setPreviewProof(null);
  };

  const openTransaction = (txHash: string) => {
    const explorerUrl = 'https://testnet.snowtrace.io';
    window.open(`${explorerUrl}/tx/${txHash}`, '_blank');
  };

  // Generate a preview of the ZK proof
  const generateProofPreview = async () => {
    if (!formData.sourceChain || !formData.blockNumber) return;
    
    setIsPreviewLoading(true);
    try {
      // Map chain name to chain ID
      const chainIdMap: Record<string, number> = {
        'ethereum': 1,
        'polygon': 137,
        'arbitrum': 42161,
        'optimism': 10,
        'base': 8453,
        'sepolia': 11155111,
        'avalanche': 43114
      };
      
      const chainId = chainIdMap[formData.sourceChain] || 1;
      const blockNumber = parseInt(formData.blockNumber);
      const targetChainId = 43113; // Avalanche Fuji
      
      const result = await generateMockProof(blockNumber, chainId, targetChainId);
      setPreviewProof(result);
    } catch (error) {
      console.error('Error generating proof preview:', error);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const isFormValid = formData.sourceChain && formData.blockNumber && parseInt(formData.blockNumber) > 0;

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <Network className="w-5 h-5 text-primary" />
          <span>Request ZK Proof</span>
        </CardTitle>
          {serviceStatus && (
            <Badge 
              variant={serviceStatus.status === 'ready' ? 'outline' : 'destructive'} 
              className="text-xs"
            >
              {serviceStatus.status === 'ready' ? 'Service Online' : 'Service Offline'}
            </Badge>
          )}
        </div>
        <CardDescription>
          Submit a request for zero-knowledge proof generation using Chainlink oracles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Source Chain Selection */}
          <div className="space-y-2">
            <Label htmlFor="sourceChain" className="text-sm font-medium">
              Source Chain
            </Label>
            <Select 
              value={formData.sourceChain} 
              onValueChange={(value) => handleInputChange('sourceChain', value)}
            >
              <SelectTrigger className="glass border-border/50">
                <SelectValue placeholder="Select source blockchain..." />
              </SelectTrigger>
              <SelectContent className="glass border-border/50">
                <SelectItem value="ethereum">Ethereum Mainnet</SelectItem>
                <SelectItem value="polygon">Polygon</SelectItem>
                <SelectItem value="arbitrum">Arbitrum</SelectItem>
                <SelectItem value="optimism">Optimism</SelectItem>
                <SelectItem value="base">Base</SelectItem>
                <SelectItem value="avalanche">Avalanche</SelectItem>
                <SelectItem value="sepolia">Sepolia Testnet</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose the blockchain network to verify
            </p>
          </div>

          {/* Block Number Input */}
          <div className="space-y-2">
            <Label htmlFor="blockNumber" className="text-sm font-medium">
              Target Block Number
            </Label>
            <Input
              id="blockNumber"
              type="number"
              placeholder="e.g., 18500000"
              value={formData.blockNumber}
              onChange={(e) => handleInputChange('blockNumber', e.target.value)}
              className="glass border-border/50 font-mono"
              min="1"
            />
            <p className="text-xs text-muted-foreground">
              Specify the block number to generate proof for
            </p>
          </div>

          {/* Preview Button */}
          {isFormValid && !previewProof && !requestSubmitted && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={generateProofPreview}
                disabled={isPreviewLoading || isProofServiceLoading}
                className="text-xs"
              >
                {isPreviewLoading ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                ) : (
                  <Eye className="w-3 h-3 mr-1" />
                )}
                Preview Proof
              </Button>
            </div>
          )}

          {/* Proof Preview */}
          {previewProof && (
            <div className="space-y-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-primary">Proof Preview</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generateProofPreview}
                  className="h-6 w-6 p-0"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Proof Type:</span>
                  <span className="font-mono">{previewProof.metadata?.circuit || 'Groth16'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Valid:</span>
                  <span className={`font-mono ${previewProof.isValid ? 'text-green-500' : 'text-red-500'}`}>
                    {previewProof.isValid ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Generation Time:</span>
                  <span className="font-mono">{previewProof.metadata?.generationTime || 0} ms</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Mock:</span>
                  <span className="font-mono">{previewProof.metadata?.isMock ? 'Yes' : 'No'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Status Display */}
          {(isSubmitting || isPending || isConfirming || isConfirmed || error) && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/30 border border-border/30">
              <h4 className="text-sm font-medium">Transaction Status</h4>
              
              {(isSubmitting || isPending) && (
                <div className="flex items-center space-x-2 text-blue-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Submitting proof request...</span>
                </div>
              )}
              
              {isConfirming && (
                <div className="flex items-center space-x-2 text-yellow-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Waiting for confirmation...</span>
                </div>
              )}
              
              {isConfirmed && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2 text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm">Proof request submitted successfully!</span>
                  </div>
                  {hash && (
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openTransaction(hash)}
                        className="text-xs"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Transaction
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetForm}
                        className="text-xs"
                      >
                        Submit Another
                      </Button>
                    </div>
                  )}
                </div>
              )}
              
              {error && (
                <div className="flex items-center space-x-2 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="text-sm">
                    Error: {error.message || 'Failed to submit proof request'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex items-center justify-between pt-4 border-t border-border/30">
            <div className="flex items-center space-x-2">
              <Badge variant="outline" className="text-xs">
                Gas Required: ~50,000
              </Badge>
              <Badge variant="outline" className="text-xs">
                Network: Fuji
              </Badge>
            </div>
            
            <Button
              type="submit"
              disabled={!isConnected || !isFormValid || isSubmitting || isPending || isConfirming || requestSubmitted}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {isSubmitting || isPending || isConfirming ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isPending || isSubmitting ? 'Submitting...' : 'Confirming...'}
                </>
              ) : (
                <>
                  <Hash className="w-4 h-4 mr-2" />
                  Request Proof
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Information Panel */}
        <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <h4 className="text-sm font-medium text-primary mb-2">How it works:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Zero-knowledge proofs are generated using Chainlink Functions</li>
            <li>• Proofs verify blockchain state without revealing sensitive data</li>
            <li>• Generated proofs can be used for Nova recursive aggregation</li>
            <li>• Verification happens off-chain with on-chain validation</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
} 