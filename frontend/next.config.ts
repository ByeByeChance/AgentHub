import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

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

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
export default withNextIntl(nextConfig);
