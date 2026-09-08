import type { NextConfig } from 'next';

const nextConfig: NextConfig = { output: 'export', images: { unoptimized: true },
  basePath: process.env.DASHBOARD_BASE_PATH || '',
};

export default nextConfig;
