'use client';

import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { Button } from './ui/Button';
import { Badge } from './ui/Badge';
import { Card } from './ui/Card';
import { 
  Wallet, 
  ChevronDown, 
  Copy, 
  ExternalLink, 
  LogOut,
  Network,
  Zap
} from 'lucide-react';
import { useState } from 'react';

export function Header() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyAddress = () => {
    if (address) {
      navigator.clipboard.writeText(address);
    }
  };

  const openEtherscan = () => {
    if (address && chain) {
      const explorerUrl = chain.blockExplorers?.default?.url;
      if (explorerUrl) {
        window.open(`${explorerUrl}/address/${address}`, '_blank');
      }
    }
  };

  return (
    <header className="border-b border-border/50 glass backdrop-blur-md sticky top-0 z-50">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left side - Network status */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">
                {chain?.name || 'Avalanche Fuji'}
              </span>
              <Badge variant="outline" className="text-xs">
                Testnet
              </Badge>
            </div>
          </div>

          {/* Right side - Wallet connection */}
          <div className="flex items-center space-x-4">
            {/* Network indicator */}
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-muted/50">
              <Network className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">
                {chain?.id === 43113 ? 'Fuji' : 'Unknown'}
              </span>
            </div>

            {/* Wallet connection */}
            {!isConnected ? (
              <div className="flex items-center space-x-2">
                {connectors.map((connector) => (
                  <Button
                    key={connector.uid}
                    onClick={() => connect({ connector })}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Connect Wallet
                  </Button>
                ))}
              </div>
            ) : (
              <div className="relative">
                <Button
                  variant="outline"
                  onClick={() => setShowAccountMenu(!showAccountMenu)}
                  className="glass border-border/50 hover:border-primary/50 transition-all duration-200"
                >
                  <div className="flex items-center space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-primary to-purple-500 flex items-center justify-center">
                      <Zap className="w-3 h-3 text-white" />
                    </div>
                    <span className="font-mono text-sm">
                      {address ? truncateAddress(address) : 'Connected'}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </Button>

                {/* Account dropdown menu */}
                {showAccountMenu && (
                  <Card className="absolute right-0 top-full mt-2 w-80 p-4 z-50 glass border-border/50 shadow-xl">
                    <div className="space-y-4">
                      {/* Account info */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">Account</span>
                          <Badge variant="outline" className="text-xs">
                            Connected
                          </Badge>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50 font-mono text-sm break-all">
                          {address}
                        </div>
                      </div>

                      {/* Network info */}
                      <div className="space-y-2">
                        <span className="text-sm font-medium">Network</span>
                        <div className="flex items-center space-x-2 p-3 rounded-lg bg-muted/50">
                          <Network className="w-4 h-4 text-primary" />
                          <span className="text-sm">{chain?.name}</span>
                          <Badge variant="outline" className="text-xs ml-auto">
                            Chain ID: {chain?.id}
                          </Badge>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col space-y-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyAddress}
                          className="justify-start"
                        >
                          <Copy className="w-4 h-4 mr-2" />
                          Copy Address
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={openEtherscan}
                          className="justify-start"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View on Explorer
                        </Button>
                        <div className="border-t border-border/50 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              disconnect();
                              setShowAccountMenu(false);
                            }}
                            className="justify-start w-full text-destructive hover:text-destructive"
                          >
                            <LogOut className="w-4 h-4 mr-2" />
                            Disconnect
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
} 