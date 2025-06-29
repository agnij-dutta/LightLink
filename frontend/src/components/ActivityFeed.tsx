'use client';

import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Activity, Clock, CheckCircle, AlertTriangle, GitBranch, Network } from 'lucide-react';
import { useActivityFeed, ActivityItem } from '@/hooks/useActivityFeed';

const getIcon = (item: ActivityItem) => {
  switch (true) {
    case item.message.toLowerCase().includes('nova'):
      return <GitBranch className="w-4 h-4" />;
    case item.message.toLowerCase().includes('verified'):
      return <CheckCircle className="w-4 h-4" />;
    case item.message.toLowerCase().includes('failed'):
      return <AlertTriangle className="w-4 h-4" />;
    default:
      return <Network className="w-4 h-4" />;
  }
};

function formatTimestamp(ts: number) {
  const date = new Date(ts > 1000000000000 ? ts : ts * 1000);
  return date.toLocaleString('en-GB', { hour12: false, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function ActivityFeed() {
  const { activities } = useActivityFeed();

  return (
    <Card className="glass border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="w-5 h-5 text-primary" />
          <span>System Activity</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No recent activity</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Activity will appear here as you interact with the system.
            </p>
          </div>
        ) : (
          <ul className="space-y-4">
            {activities.map((item) => (
              <li key={item.id} className="flex items-start space-x-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${item.type === 'success' ? 'bg-green-500/10 text-green-500' : item.type === 'warning' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-primary/10 text-primary' }`}>
                  {getIcon(item)}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.message}</p>
                  <p className="text-xs text-muted-foreground">{formatTimestamp(item.timestamp)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
} 