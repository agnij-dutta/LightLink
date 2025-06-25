'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Badge } from './ui/Badge';
import { GitBranch } from 'lucide-react';

export function BatchesList() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Nova Folding Batches</h2>
        <Badge variant="outline">0 Total</Badge>
      </div>

      <Card>
        <CardContent className="text-center py-8">
          <GitBranch className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No Nova folding batches found.</p>
          <p className="text-sm text-gray-400 mt-1">
            Start Nova folding to create recursive proof batches.
          </p>
        </CardContent>
      </Card>
    </div>
  );
} 