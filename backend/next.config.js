/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable client-side features since this is API-only
  reactStrictMode: true,
  
  // Optimize for API routes only
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PUT, DELETE, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },

  // External packages for server-side
  serverExternalPackages: ['snarkjs'],

  // Webpack configuration for node modules
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('snarkjs');
    }
    return config;
  },
};

export default nextConfig; 