import type { NextConfig } from 'next';

const CORE_ENGINE_URL =
  process.env.NEXT_PUBLIC_CORE_ENGINE_URL ?? 'http://localhost:3001';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@agenthub/contracts', '@agenthub/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${CORE_ENGINE_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
