import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode:true,
  experimental:{optimizePackageImports:['recharts']},
  images:{remotePatterns:[{protocol:'https',hostname:'ddragon.leagueoflegends.com',pathname:'/cdn/**'}]},
};
export default nextConfig;