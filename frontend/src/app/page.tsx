'use client';

import { useState } from 'react';
import { 
  LayoutDashboard, 
  Network, 
  GitBranch, 
  FileText, 
  Activity,
  Settings,
  Zap,
  Database
} from 'lucide-react';
import { Sidebar, SidebarBody, SidebarLink } from '@/components/ui/sidebar';
import { Header } from '@/components/Header';
import { Dashboard } from '@/components/Dashboard';
import { ProofRequestForm } from '@/components/ProofRequestForm';
import { NovaFoldingForm } from '@/components/NovaFoldingForm';
import { ProofsList } from '@/components/ProofsList';
import { BatchesList } from '@/components/BatchesList';
import { ActivityFeed } from '@/components/ActivityFeed';
import { Logo, LogoIcon } from '@/components/Logo';
import { cn } from '@/lib/utils';

export default function HomePage() {
  const [activeView, setActiveView] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const links = [
    {
      label: "Dashboard",
      href: "#",
      icon: (
        <LayoutDashboard className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Request Proof",
      href: "#",
      icon: (
        <Network className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Nova Folding",
      href: "#",
      icon: (
        <GitBranch className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Proofs",
      href: "#",
      icon: (
        <FileText className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Batches",
      href: "#",
      icon: (
        <Database className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
    {
      label: "Activity",
      href: "#",
      icon: (
        <Activity className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  const handleNavigation = (label: string) => {
    const viewMap: { [key: string]: string } = {
      'Dashboard': 'dashboard',
      'Request Proof': 'request-proof',
      'Nova Folding': 'nova-folding',
      'Proofs': 'proofs',
      'Batches': 'batches',
      'Activity': 'activity',
    };
    setActiveView(viewMap[label] || 'dashboard');
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <Dashboard />;
      case 'request-proof':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <Network className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-gradient">Request ZK Proof</h1>
            </div>
            <ProofRequestForm />
          </div>
        );
      case 'nova-folding':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <GitBranch className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-gradient">Nova Folding</h1>
            </div>
            <NovaFoldingForm />
          </div>
        );
      case 'proofs':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <FileText className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-gradient">ZK Proofs</h1>
            </div>
            <ProofsList />
          </div>
        );
      case 'batches':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <Database className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-gradient">Proof Batches</h1>
            </div>
            <BatchesList />
          </div>
        );
      case 'activity':
        return (
          <div className="space-y-6">
            <div className="flex items-center space-x-2">
              <Activity className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold text-gradient">Activity Feed</h1>
            </div>
            <ActivityFeed />
          </div>
        );
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-slate-950" />
      
      {/* Sidebar */}
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} animate={true}>
        <SidebarBody className="justify-between gap-10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {sidebarOpen ? <Logo /> : <LogoIcon />}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <div
                  key={idx}
                  onClick={() => handleNavigation(link.label)}
                  className="cursor-pointer"
                >
                  <SidebarLink link={link} />
                </div>
              ))}
            </div>
          </div>
          <div>
            <SidebarLink
              link={{
                label: "Settings",
                href: "#",
                icon: (
                  <Settings className="text-neutral-700 dark:text-neutral-200 h-5 w-5 flex-shrink-0" />
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main content */}
      <div className="flex flex-col min-h-screen md:ml-16 relative z-10">
        <Header />
        
        {/* Page content */}
        <main className="flex-1 p-6 md:p-8 lg:p-10">
          <div className="mx-auto max-w-7xl">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
} 