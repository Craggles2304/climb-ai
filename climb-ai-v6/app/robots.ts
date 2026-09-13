import type {MetadataRoute} from 'next';

export default function robots():MetadataRoute.Robots{
  return {
    rules:{
      userAgent:'*',
      allow:['/','/demo','/pricing','/champions','/matchups','/privacy','/terms','/support'],
      disallow:['/api/','/admin','/account','/dashboard','/ilp','/analyse','/missions','/progress','/coach','/uploads','/billing','/settings'],
    },
    sitemap:'https://opclimb.com/sitemap.xml',
    host:'https://opclimb.com',
  };
}
