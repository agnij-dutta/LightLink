import { useState, useCallback } from 'react';
import { ZK_PROOF_SERVICE } from '@/constants/contracts';

interface ZKProofServiceStatus {
  status: string;
  environment: string;
  circuits: Record<string, {
    ready: boolean;
    wasmExists: boolean;
    zkeyExists: boolean;
    vkeyExists: boolean;
  }>;
  timestamp: string;
}

interface ZKProofRequest {
  circuit: string;
  inputs: any[];
  params?: {
    nProofs?: number;
    merkleDepth?: number;
    blockDepth?: number;
  };
}

interface ZKProofResult {
  success: boolean;
  proof: any;
  publicSignals: any;
  isValid: boolean;
  metadata: {
    circuit: string;
    generationTime: number;
    verifiedLocally: boolean;
    isMock?: boolean;
  };
}

export function useZKProofService() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<ZKProofServiceStatus | null>(null);

  // Check service health
  const checkServiceHealth = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(ZK_PROOF_SERVICE.HEALTH_ENDPOINT);
      if (!response.ok) {
        throw new Error(`Service health check failed: ${response.status}`);
      }
      
      const data = await response.json();
      setServiceStatus(data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to check service health: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate a ZK proof
  const generateProof = useCallback(async (request: ZKProofRequest): Promise<ZKProofResult | null> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(ZK_PROOF_SERVICE.URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Service returned ${response.status}`);
      }
      
      const data = await response.json();
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to generate proof: ${errorMessage}`);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate a mock proof for testing
  const generateMockProof = useCallback(async (blockNumber: number, chainId: number, targetChainId: number): Promise<ZKProofResult | null> => {
    // Create mock inputs
    const mockInput = {
      blockHash: `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`,
      chainId: chainId,
      merkleRoot: `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`,
      leaf: `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`,
      pathElements: Array(ZK_PROOF_SERVICE.DEFAULT_MERKLE_DEPTH).fill(0).map(() => 
        `0x${Math.random().toString(16).substring(2).padStart(64, '0')}`
      ),
      pathIndices: Array(ZK_PROOF_SERVICE.DEFAULT_MERKLE_DEPTH).fill(0).map(() => 
        Math.round(Math.random())
      ),
      targetChainId: targetChainId,
      blockNumber: blockNumber,
      timestamp: Math.floor(Date.now() / 1000)
    };
    
    const request: ZKProofRequest = {
      circuit: 'proof_aggregator',
      inputs: [mockInput],
      params: {
        nProofs: 1,
        merkleDepth: ZK_PROOF_SERVICE.DEFAULT_MERKLE_DEPTH,
        blockDepth: 8
      }
    };
    
    return generateProof(request);
  }, [generateProof]);

  return {
    isLoading,
    error,
    serviceStatus,
    checkServiceHealth,
    generateProof,
    generateMockProof
  };
} 