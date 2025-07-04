'use client';

import { useContractReads } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { CONTRACT_ADDRESSES, ZK_PROOF_AGGREGATOR_ABI } from '@/constants/contracts';
import { BarChart3, GitBranch, Layers, Zap, ListChecks } from 'lucide-react';

export function StatsCards() {
  // Fetch data from both ZK and Nova contracts
  const { data: contractStats, isLoading } = useContractReads({
    contracts: [
      // ZK Proof Aggregator stats
      {
        address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'requestCounter',
      },
      // Nova Proof Aggregator stats
      {
        address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'batchCounter',
      },
      {
        address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'maxRecursionDepth',
      },
      {
        address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'minProofsPerBatch',
      },
      {
        address: CONTRACT_ADDRESSES.NOVA_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'maxProofsPerBatch',
      },
    ],
  });

  const rawValues = {
    totalProofs: contractStats?.[0]?.result ? Number(contractStats[0].result) : 0,
    novaBatches: contractStats?.[1]?.result ? Number(contractStats[1].result) : 0,
    maxRecursion: contractStats?.[2]?.result ? Number(contractStats[2].result) : 16,
    minProofs: contractStats?.[3]?.result ? Number(contractStats[3].result) : 2,
    maxProofs: contractStats?.[4]?.result ? Number(contractStats[4].result) : 8,
  };

  const stats = [
    {
      title: 'Total Proofs',
      value: rawValues.totalProofs,
      description: 'ZK proofs generated',
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
      showValue: true,
    },
    {
      title: 'Nova Batches',
      value: rawValues.novaBatches,
      description: 'Recursive folding batches',
      icon: GitBranch,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
      showValue: true,
    },
    {
      title: 'Max Recursion',
      value: rawValues.maxRecursion,
      description: 'Default recursion depth',
      icon: Layers,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      showValue: true,
    },
    {
      title: 'Min Proofs / Batch',
      value: rawValues.minProofs,
      description: 'Default minimum proofs',
      icon: ListChecks,
      color: 'text-cyan-600',
      bgColor: 'bg-cyan-50 dark:bg-cyan-900/20',
      showValue: true,
    },
    {
      title: 'Max Proofs / Batch',
      value: rawValues.maxProofs,
      description: 'Default maximum proofs',
      icon: BarChart3,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      showValue: true,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="relative overflow-hidden hover:shadow-md transition-shadow duration-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2.5 rounded-xl ${stat.bgColor} shadow-sm`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline space-x-2">
                <div className="text-2xl font-bold">
                  {isLoading ? (
                    <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-8 w-16 rounded"></div>
                  ) : (
                    <span>{stat.value.toLocaleString()}</span>
                  )}
                </div>
                {/* Show "default" label for configuration values */}
                {(index >= 2) && !isLoading && (
                  <span className="text-xs text-gray-400 font-normal">default</span>
                )}
              </div>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                {stat.description}
              </CardDescription>
            </CardContent>
            <div className={`absolute bottom-0 left-0 right-0 h-1.5 ${stat.bgColor} opacity-60`}></div>
          </Card>
        );
      })}
    </div>
  );
} 