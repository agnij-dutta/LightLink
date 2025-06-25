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

  const stats = [
    {
      title: 'Total Proofs',
      value: contractStats?.[0]?.result ? Number(contractStats[0].result) : 0,
      description: 'ZK proofs generated',
      icon: Zap,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      title: 'Nova Batches',
      value: contractStats?.[1]?.result ? Number(contractStats[1].result) : 0,
      description: 'Recursive folding batches',
      icon: GitBranch,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
    {
      title: 'Max Recursion',
      value: contractStats?.[2]?.result ? Number(contractStats[2].result) : 0,
      description: 'Maximum recursion depth',
      icon: Layers,
      color: 'text-green-600',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      title: 'Batch Capacity',
      value: contractStats?.[3]?.result ? Number(contractStats[3].result) : 0,
      description: 'Max proofs per batch',
      icon: BarChart3,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {isLoading ? (
                  <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-8 w-16 rounded"></div>
                ) : (
                  stat.value.toLocaleString()
                )}
              </div>
              <CardDescription className="text-xs text-muted-foreground">
                {stat.description}
              </CardDescription>
            </CardContent>
            <div className={`absolute bottom-0 left-0 right-0 h-1 ${stat.bgColor} opacity-50`}></div>
          </Card>
        );
      })}
    </div>
  );
} 