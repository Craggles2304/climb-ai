import type { NextConfig } from 'next';
const nextConfig: NextConfig = {
  reactStrictMode:true,
  experimental:{optimizePackageImports:['recharts']},
  images:{remotePatterns:[{protocol:'https',hostname:'ddragon.leagueoflegends.com',pathname:'/cdn/**'}]},
  // The interactive client demo is a standalone static page in public/client.
  // /demo was an older second demo; send everyone to the interactive client.
  async redirects(){return [{source:'/demo',destination:'/client',permanent:true}]},
  async rewrites(){return [{source:'/client',destination:'/client/index.html'}]},
};
export default nextConfig;
