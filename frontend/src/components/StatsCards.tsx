'use client';

import { useContractReads } from 'wagmi';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { CONTRACT_ADDRESSES, ZK_PROOF_AGGREGATOR_ABI } from '@/constants/contracts';
import { BarChart3, GitBranch, Layers, Zap } from 'lucide-react';

export function StatsCards() {
  const { data: contractStats, isLoading } = useContractReads({
    contracts: [
      {
        address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'requestCounter',
      },
      {
        address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'batchCounter',
      },
      {
        address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'maxRecursionDepth',
      },
      {
        address: CONTRACT_ADDRESSES.ZK_PROOF_AGGREGATOR,
        abi: ZK_PROOF_AGGREGATOR_ABI,
        functionName: 'maxProofsPerBatch',
      },
    ],
  });

  const rawValues = {
    totalProofs: contractStats?.[0]?.result ? Number(contractStats[0].result) : 0,
    novaBatches: contractStats?.[1]?.result ? Number(contractStats[1].result) : 0,
    maxRecursion: contractStats?.[2]?.result ? Number(contractStats[2].result) : 0,
    batchCapacity: contractStats?.[3]?.result ? Number(contractStats[3].result) : 0,
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
      value: rawValues.maxRecursion || 10, // Default to 10 if not set
      description: rawValues.maxRecursion > 0 ? 'Maximum recursion depth' : 'Default recursion depth',
      icon: Layers,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      showValue: true,
      isDefault: rawValues.maxRecursion === 0,
    },
    {
      title: 'Batch Capacity',
      value: rawValues.batchCapacity || 100, // Default to 100 if not set
      description: rawValues.batchCapacity > 0 ? 'Max proofs per batch' : 'Default batch capacity',
      icon: BarChart3,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
      showValue: true,
      isDefault: rawValues.batchCapacity === 0,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                    <span className={stat.isDefault ? 'text-gray-500 dark:text-gray-400' : ''}>
                      {stat.value.toLocaleString()}
                    </span>
                  )}
                </div>
                {stat.isDefault && !isLoading && (
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