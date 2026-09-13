import {NextResponse} from 'next/server';

type DDragonEntry={id?:string;name?:string;tier?:number|string;image?:{full?:string};desc?:string;description?:string};
type DDragonFile={data?:Record<string,DDragonEntry>};

const BASE='https://ddragon.leagueoflegends.com';

export async function GET(){
  try{
    const versionsRes=await fetch(`${BASE}/api/versions.json`,{next:{revalidate:60*60}});
    if(!versionsRes.ok)throw new Error('Could not read Data Dragon versions.');
    const versions=await versionsRes.json() as string[];
    const version=versions[0];
    if(!version)throw new Error('No TFT static-data version is available.');

    const defs=[
      ['champions','tft-champion','tft-champion'],
      ['items','tft-item','tft-item'],
      ['augments','tft-augments','tft-augment'],
      ['traits','tft-trait','tft-trait'],
    ] as const;
    const loaded=await Promise.all(defs.map(async([key,file,imageGroup])=>{
      const res=await fetch(`${BASE}/cdn/${version}/data/en_US/${file}.json`,{next:{revalidate:60*60}});
      if(!res.ok)return[key,[]] as const;
      const body=await res.json() as DDragonFile;
      const entries=Object.values(body.data||{}).filter(x=>x.name).map(x=>({
        id:x.id||x.name||'',
        name:x.name||x.id||'Unknown',
        tier:x.tier??null,
        description:String(x.description||x.desc||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(),
        image:x.image?.full?`${BASE}/cdn/${version}/img/${imageGroup}/${encodeURIComponent(x.image.full)}`:null,
      }));
      return[key,entries] as const;
    }));
    const payload=Object.fromEntries(loaded);
    return NextResponse.json({version,source:'Riot Data Dragon',...payload},{headers:{'Cache-Control':'public, s-maxage=3600, stale-while-revalidate=86400'}});
  }catch(err){
    return NextResponse.json({error:err instanceof Error?err.message:'TFT static data is unavailable.'},{status:502});
  }
}
