/**
 * Riot uses two different hostnames per call: a *platform* host for summoner and
 * league data, and a wider *regional* host for account and match data. Getting
 * these the wrong way round is the most common Riot integration bug, so the
 * mapping lives in one place.
 */

export type AppRegion='EUW'|'EUNE'|'NA'|'OCE'|'KR'|'BR'|'LAN'|'LAS'|'JP'|'TR'|'RU';

interface RegionRouting{platform:string;regional:string;label:string}

const ROUTING:Record<AppRegion,RegionRouting>={
  EUW:{platform:'euw1',regional:'europe',label:'Europe West'},
  EUNE:{platform:'eun1',regional:'europe',label:'Europe Nordic & East'},
  TR:{platform:'tr1',regional:'europe',label:'Turkey'},
  RU:{platform:'ru',regional:'europe',label:'Russia'},
  NA:{platform:'na1',regional:'americas',label:'North America'},
  BR:{platform:'br1',regional:'americas',label:'Brazil'},
  LAN:{platform:'la1',regional:'americas',label:'Latin America North'},
  LAS:{platform:'la2',regional:'americas',label:'Latin America South'},
  KR:{platform:'kr',regional:'asia',label:'Korea'},
  JP:{platform:'jp1',regional:'asia',label:'Japan'},
  OCE:{platform:'oc1',regional:'sea',label:'Oceania'},
};

export const SUPPORTED_REGIONS=Object.keys(ROUTING) as AppRegion[];

export function isSupportedRegion(region:string):region is AppRegion{
  return region.toUpperCase() in ROUTING;
}

export function routingFor(region:string):RegionRouting{
  const key=region.toUpperCase();
  const found=ROUTING[key as AppRegion];
  if(!found)throw new Error(`Unsupported region "${region}". Supported: ${SUPPORTED_REGIONS.join(', ')}.`);
  return found;
}

export const platformHost=(region:string)=>`https://${routingFor(region).platform}.api.riotgames.com`;
export const regionalHost=(region:string)=>`https://${routingFor(region).regional}.api.riotgames.com`;
export const regionLabel=(region:string)=>routingFor(region).label;
