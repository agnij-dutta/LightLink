'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Tabs } from './ui/vercel-tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { StatsCards } from './StatsCards';
import { ProofsList } from './ProofsList';
import { BatchesList } from './BatchesList';
import { ActivityFeed } from './ActivityFeed';
import { 
  AlertCircle, 
  TrendingUp, 
  Shield, 
  Database,
  Clock,
  CheckCircle,
  ArrowRight,
  Zap,
  GitBranch,
  Network,
  Plus,
  ExternalLink
} from 'lucide-react';

export function Dashboard() {
  const { isConnected, address } = useAccount();
  const [activeTab, setActiveTab] = useState('overview');

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'proofs', label: 'Recent Proofs' },
    { id: 'activity', label: 'Activity' },
  ];

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="glass rounded-2xl shadow-2xl p-8 max-w-lg text-center border border-border/50">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Connect Your Wallet
          </h2>
          <p className="text-muted-foreground mb-6 leading-relaxed">
            Connect your wallet to interact with the LightLink ZK Oracle and experience Nova recursive proof aggregation on Avalanche Fuji testnet.
          </p>
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-primary">
              <strong>Network:</strong> Avalanche Fuji Testnet
            </p>
          </div>
        </div>
      </div>
    );
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-8">
            {/* Quick Actions */}
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <span>Quick Actions</span>
                </CardTitle>
                <CardDescription>
                  Start generating proofs and exploring Nova recursive aggregation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button 
                    className="h-20 flex-col space-y-2 bg-primary/10 hover:bg-primary/20 border border-primary/20"
                    variant="outline"
                  >
                    <Network className="w-6 h-6 text-primary" />
                    <span>Request ZK Proof</span>
                  </Button>
                  <Button 
                    className="h-20 flex-col space-y-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20"
                    variant="outline"
                  >
                    <GitBranch className="w-6 h-6 text-purple-500" />
                    <span>Nova Folding</span>
                  </Button>
                  <Button 
                    className="h-20 flex-col space-y-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20"
                    variant="outline"
                  >
                    <Shield className="w-6 h-6 text-green-500" />
                    <span>View Proofs</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-green-500" />
                  <span>System Status</span>
                  <Badge className="bg-green-500/10 text-green-500">All Systems Operational</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">ZK Oracle</p>
                      <p className="text-xs text-muted-foreground">Online</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Chainlink Functions</p>
                      <p className="text-xs text-muted-foreground">Active</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Nova Aggregator</p>
                      <p className="text-xs text-muted-foreground">Ready</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Fuji Network</p>
                      <p className="text-xs text-muted-foreground">Connected</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity & Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Activity Summary */}
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5 text-primary" />
                      <span>Recent Activity</span>
                    </div>
                    <Button variant="outline" size="sm">
                      View All <ArrowRight className="w-3 h-3 ml-1" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                    <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Proof Request Completed</p>
                      <p className="text-xs text-muted-foreground">Ethereum block #18500000 verified</p>
                    </div>
                    <span className="text-xs text-muted-foreground">5m ago</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                    <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <GitBranch className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Nova Folding Started</p>
                      <p className="text-xs text-muted-foreground">Aggregating 3 proofs recursively</p>
                    </div>
                    <span className="text-xs text-muted-foreground">12m ago</span>
                  </div>
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/30">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Network className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">New Proof Request</p>
                      <p className="text-xs text-muted-foreground">Polygon block verification pending</p>
                    </div>
                    <span className="text-xs text-muted-foreground">25m ago</span>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Metrics */}
              <Card className="glass border-border/50">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <span>Performance Metrics</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Proof Generation Success Rate</span>
                      <span className="text-sm font-medium">98.5%</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: '98.5%' }}></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Average Recursion Depth</span>
                      <span className="text-sm font-medium">4.2x</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: '70%' }}></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Gas Efficiency</span>
                      <span className="text-sm font-medium">85% Reduction</span>
                    </div>
                    <div className="w-full bg-muted/30 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: '85%' }}></div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Getting Started Guide */}
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <span>Getting Started with Nova</span>
                </CardTitle>
                <CardDescription>
                  Follow these steps to start using recursive proof aggregation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">1</div>
                    <h4 className="font-semibold">Generate Base Proofs</h4>
                    <p className="text-sm text-muted-foreground">Request ZK proofs for different blockchain states using our Chainlink-powered oracle system.</p>
                    <Button variant="outline" size="sm" className="w-full">
                      <Plus className="w-3 h-3 mr-1" />
                      Request Proof
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500 text-white flex items-center justify-center font-bold">2</div>
                    <h4 className="font-semibold">Start Nova Folding</h4>
                    <p className="text-sm text-muted-foreground">Aggregate multiple proofs recursively using Nova's folding scheme for exponential efficiency gains.</p>
                    <Button variant="outline" size="sm" className="w-full">
                      <GitBranch className="w-3 h-3 mr-1" />
                      Start Folding
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-full bg-green-500 text-white flex items-center justify-center font-bold">3</div>
                    <h4 className="font-semibold">Verify & Scale</h4>
                    <p className="text-sm text-muted-foreground">Continue recursive composition to achieve constant-time verification with minimal on-chain costs.</p>
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Learn More
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 'analytics':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-6">
              <TrendingUp className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">System Analytics</h2>
            </div>
            <StatsCards />
          </div>
        );

      case 'proofs':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-6">
              <Database className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">Recent Proofs</h2>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ProofsList />
              <BatchesList />
            </div>
          </div>
        );

      case 'activity':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2 mb-6">
              <Shield className="w-6 h-6 text-primary" />
              <h2 className="text-2xl font-bold">System Activity</h2>
            </div>
            <ActivityFeed />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      <StatsCards />
      
      <div className="space-y-6">
        <Tabs 
          tabs={tabs} 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          className="w-full"
        />
        
        <div className="min-h-[500px]">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
} 