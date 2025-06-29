'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { GitBranch, Hash, Clock, CheckCircle, Loader2, ExternalLink, Database, X } from 'lucide-react';
import { useNovaContract, NovaFoldingBatch } from '@/hooks/useNovaContract';

export function BatchesList() {
  const { 
    batches, 
    batchCounter, 
    continueRecursiveFolding, 
    isLoading, 
    refresh 
  } = useNovaContract();

  const [selectedBatch, setSelectedBatch] = useState<NovaFoldingBatch | null>(null);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refresh, 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const truncateHash = (hash: string) => {
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp > 1000000000000 ? timestamp : timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (isCompleted: boolean) => {
    return isCompleted ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
  };

  const getStatusText = (isCompleted: boolean) => {
    return isCompleted ? 'Completed' : 'Processing';
  };

  const openBatchDetails = (batch: NovaFoldingBatch) => {
    setSelectedBatch(batch);
  };

  const closeBatchDetails = () => {
    setSelectedBatch(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <h2 className="text-2xl font-bold">Nova Folding Batches</h2>
          <Badge variant="outline" className="text-primary border-primary/20">
            {batchCounter} Total
          </Badge>
        </div>
        <Button 
          onClick={refresh} 
          variant="outline" 
          size="sm"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
        </Button>
      </div>

      {/* Batches Section */}
      {batches.length === 0 ? (
        <Card className="glass border-border/50">
          <CardContent className="text-center py-12">
            <GitBranch className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Nova Folding Batches</h3>
            <p className="text-muted-foreground mb-4">
              Create your first Nova recursive proof batch to get started.
            </p>
            <Badge variant="outline" className="text-xs">
              Connect wallet and start Nova folding
            </Badge>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {batches.map((batch) => (
            <Card key={batch.id} className="glass border-border/50 hover:border-primary/20 transition-colors">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <GitBranch className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <span>Batch #{batch.id}</span>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge className={getStatusColor(batch.isCompleted)}>
                          {getStatusText(batch.isCompleted)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {batch.proofIds.length} Proofs
                        </Badge>
                      </div>
                    </div>
                  </CardTitle>
                  <div className="text-right text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{formatTimestamp(batch.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Batch Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Batch Information</h4>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recursion Depth:</span>
                        <span>{batch.recursionDepth}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Proof IDs:</span>
                        <span>{batch.proofIds.map(id => id.toString()).join(', ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Requester:</span>
                        <span className="font-mono">{truncateHash(batch.requester)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Aggregated Hash */}
                {batch.aggregatedHash && batch.aggregatedHash !== '0x' && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center space-x-1">
                      <Hash className="w-3 h-3" />
                      <span>Aggregated Hash</span>
                    </h4>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                      <p className="text-xs font-mono break-all overflow-hidden">
                        {batch.aggregatedHash}
                      </p>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end space-x-2 pt-2">
                  {!batch.isCompleted && (
                    <Button
                      size="sm"
                      onClick={() => continueRecursiveFolding(batch.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Continue Folding
                    </Button>
                  )}
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openBatchDetails(batch)}
                  >
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View Details
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Batch Details Modal */}
      {selectedBatch && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold">Batch #{selectedBatch.id} Details</h2>
              <Button variant="ghost" size="sm" onClick={closeBatchDetails}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* General Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">General Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge className={getStatusColor(selectedBatch.isCompleted)}>
                        {getStatusText(selectedBatch.isCompleted)}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Batch ID:</span>
                      <span>#{selectedBatch.id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Proof Count:</span>
                      <span>{selectedBatch.proofIds.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Recursion Depth:</span>
                      <span>{selectedBatch.recursionDepth}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Created:</span>
                      <span>{formatTimestamp(selectedBatch.timestamp)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Proof IDs</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      {selectedBatch.proofIds.map((id, idx) => (
                        <div key={idx} className="p-2 bg-muted/30 rounded text-center font-mono text-sm">
                          #{id.toString()}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Requester */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Requester Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-mono text-sm break-all p-3 bg-muted/30 rounded">
                    {selectedBatch.requester}
                  </p>
                </CardContent>
              </Card>

              {/* Aggregated Hash */}
              {selectedBatch.aggregatedHash && selectedBatch.aggregatedHash !== '0x' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Hash className="w-5 h-5" />
                      <span>Aggregated Hash</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-mono text-sm break-all p-3 bg-muted/30 rounded">
                      {selectedBatch.aggregatedHash}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Folded Instance */}
              {selectedBatch.foldedInstance && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center space-x-2">
                      <Database className="w-5 h-5" />
                      <span>Folded Instance</span>
                      {selectedBatch.foldedInstance.isValid && (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-muted-foreground">Step In</label>
                          <p className="font-mono text-sm p-2 bg-muted/30 rounded">
                            {selectedBatch.foldedInstance.stepIn.toString()}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Step Out</label>
                          <p className="font-mono text-sm p-2 bg-muted/30 rounded">
                            {selectedBatch.foldedInstance.stepOut.toString()}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Program Counter</label>
                          <p className="font-mono text-sm p-2 bg-muted/30 rounded">
                            {selectedBatch.foldedInstance.programCounter.toString()}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm text-muted-foreground">State Root In</label>
                          <p className="font-mono text-sm p-2 bg-muted/30 rounded break-all">
                            {selectedBatch.foldedInstance.stateRootIn}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">State Root Out</label>
                          <p className="font-mono text-sm p-2 bg-muted/30 rounded break-all">
                            {selectedBatch.foldedInstance.stateRootOut}
                          </p>
                        </div>
                        <div>
                          <label className="text-sm text-muted-foreground">Nullifier Hash</label>
                          <p className="font-mono text-sm p-2 bg-muted/30 rounded break-all">
                            {selectedBatch.foldedInstance.nullifierHash}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 