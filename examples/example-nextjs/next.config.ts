import type { NextConfig } from 'next';
import { headersPresets } from 'sqlite-promiser/headers';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    const h = headersPresets().requireCorp;
    return [
      {
        source: '/:path*',
        headers: Object.entries(h).map(([key, value]) => ({ key, value }))
      }
    ];
  }
};

export default nextConfig;

