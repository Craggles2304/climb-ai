import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode:true,
  experimental:{optimizePackageImports:['recharts']},
  images:{remotePatterns:[{protocol:'https',hostname:'ddragon.leagueoflegends.com',pathname:'/cdn/**'}]},
  // The interactive client demo is a standalone static page in public/client.
  async rewrites(){return [{source:'/client',destination:'/client/index.html'}]},
  // One public demo: the interactive client tour replaces the old /demo page.
  async redirects(){return [{source:'/demo',destination:'/client',permanent:false}]},
};
export default nextConfig;