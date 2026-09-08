import type { NextConfig } from 'next';

const nextConfig: NextConfig = { output: 'export', images: { unoptimized: true },
  assetPrefix: process.env.DASHBOARD_BASE_PATH || '',
};

export default nextConfig;
