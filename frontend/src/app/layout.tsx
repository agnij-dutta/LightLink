import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import { cookieToInitialState } from 'wagmi';

import { config } from '@/lib/wagmi';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'LightLink ZK Oracle - Nova Recursive Proof Aggregation',
  description: 'Decentralized ZK proof aggregation with Nova recursive composition on Avalanche Fuji',
  keywords: ['ZK', 'Zero Knowledge', 'Nova', 'Recursive Proofs', 'Avalanche', 'Chainlink'],
  authors: [{ name: 'LightLink Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#0ea5e9',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initialState = cookieToInitialState(
    config,
    (await headers()).get('cookie')
  );

  return (
    <html lang="en" className="dark h-full">
      <body className={`${inter.className} h-full bg-background text-foreground antialiased`}>
        <Providers initialState={initialState}>
          <div className="min-h-screen bg-gradient-to-br from-background via-background to-slate-950">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
} 