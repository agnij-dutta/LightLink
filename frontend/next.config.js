/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.fallback = {
      fs: false,
      net: false,
      tls: false,
    };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },
  env: {
    NEXT_PUBLIC_AVALANCHE_FUJI_RPC: 'https://api.avax-test.network/ext/bc/C/rpc',
    NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: 'your_project_id_here',
  },
};

module.exports = nextConfig; 