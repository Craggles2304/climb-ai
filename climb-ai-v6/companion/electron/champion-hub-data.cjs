const ROLES=new Set(['TOP','JUNGLE','MID','ADC','SUPPORT']);
const guideCache=new Map();
const rosterCache=new Map();

function cleanChampion(value){
  const champion=String(value||'').trim();
  return champion.length>0&&champion.length<=32?champion:'';
}

function cleanRole(value){
  const role=String(value||'').trim().toUpperCase();
  return ROLES.has(role)?role:'MID';
}

function apiUrl(origin,path,params={}){
  const base=new URL(origin);
  if(!['https:','http:'].includes(base.protocol))throw new Error('Champion data URL is invalid.');
  const url=new URL(path,base);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,String(value));
  return url.toString();
}

async function requestJson(fetchImpl,url){
  try{
    const response=await fetchImpl(url,{signal:AbortSignal.timeout(12_000)});
    const body=await response.json();
    if(!response.ok||!body?.ok)return{ok:false,error:String(body?.error||'Champion data is unavailable right now.')};
    return body;
  }catch{
    return{ok:false,error:'Could not reach current champion data. Try again shortly.'};
  }
}

async function championRoster(origin,fetchImpl=globalThis.fetch,refresh=false){
  const key=apiUrl(origin,'/api/champions/main');
  const cached=rosterCache.get(key);
  if(!refresh&&cached&&Date.now()-cached.at<6*60*60*1000)return cached.value;
  const result=await requestJson(fetchImpl,key);
  const value=result.ok?{ok:true,patch:result.patch,names:Array.isArray(result.names)?result.names.filter(name=>typeof name==='string'):[]}:{ok:false,error:result.error,names:[]};
  if(value.ok)rosterCache.set(key,{at:Date.now(),value});
  return value;
}

async function championGuide(origin,championInput,roleInput,fetchImpl=globalThis.fetch,refresh=false){
  const champion=cleanChampion(championInput);
  if(!champion)return{ok:false,error:'Choose a champion from the list first.'};
  const role=cleanRole(roleInput);
  const key=`${origin}|${champion.toLowerCase()}|${role}`;
  const cached=guideCache.get(key);
  if(!refresh&&cached&&Date.now()-cached.at<15*60*1000)return cached.value;
  const [profile,meta,build]=await Promise.all([
    requestJson(fetchImpl,apiUrl(origin,'/api/champions',{champion})),
    requestJson(fetchImpl,apiUrl(origin,'/api/champions/main/meta',{champion,role})),
    requestJson(fetchImpl,apiUrl(origin,'/api/champions/main/popular',{champion,role})),
  ]);
  const value={
    ok:Boolean(profile.ok||meta.ok||build.ok),
    champion,role,
    profile:profile.ok?{patch:profile.patch,profile:profile.profile}:null,
    meta:meta.ok?meta:null,
    build:build.ok?build:null,
    errors:{profile:profile.ok?'':profile.error,meta:meta.ok?'':meta.error,build:build.ok?'':build.error},
  };
  if(value.ok)guideCache.set(key,{at:Date.now(),value});
  return value;
}

module.exports={championRoster,championGuide,cleanChampion,cleanRole};
