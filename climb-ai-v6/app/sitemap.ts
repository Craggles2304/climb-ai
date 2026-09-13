import type {MetadataRoute} from 'next';

const site='https://opclimb.com';
export default function sitemap():MetadataRoute.Sitemap{
  const now=new Date();
  return [
    {url:`${site}/`,lastModified:now,changeFrequency:'weekly',priority:1},
    {url:`${site}/demo`,lastModified:now,changeFrequency:'weekly',priority:.9},
    {url:`${site}/pricing`,lastModified:now,changeFrequency:'monthly',priority:.8},
    {url:`${site}/champions`,lastModified:now,changeFrequency:'weekly',priority:.7},
    {url:`${site}/matchups`,lastModified:now,changeFrequency:'weekly',priority:.7},
    {url:`${site}/privacy`,lastModified:now,changeFrequency:'monthly',priority:.4},
    {url:`${site}/terms`,lastModified:now,changeFrequency:'monthly',priority:.4},
    {url:`${site}/support`,lastModified:now,changeFrequency:'monthly',priority:.4},
  ];
}
