import type { NextConfig } from 'next';
const nextConfig: NextConfig = {reactStrictMode:true, experimental:{optimizePackageImports:['recharts']}};
export default nextConfig;