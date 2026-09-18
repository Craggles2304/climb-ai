export type DraftRole='TOP'|'JUNGLE'|'MID'|'ADC'|'SUPPORT';
export type RoleSource='REQUEST'|'LIVE'|'PROFILE'|'CHAMPION_PRIOR'|'MISSING_ROLE'|'UNKNOWN';

export interface DraftRolePlayer{
  champion:string;
  role?:string|null;
  items?:Array<{itemId?:number|null;displayName?:string|null}>|null;
  summonerSpells?:string[]|null;
}

export interface RoleResolution{
  role:DraftRole|null;
  source:RoleSource;
  confidence:'HIGH'|'MEDIUM'|'LOW';
}

const ROLES:DraftRole[]=['TOP','JUNGLE','MID','ADC','SUPPORT'];
const SUPPORT_ITEM_IDS=new Set([3850,3851,3853,3854,3855,3857,3858,3859,3865,3866,3867,3869,3870,3871]);
const PURE_ADC=new Set([
  'Aphelios','Caitlyn','Draven','Ezreal','Jhin','Jinx',"Kai'Sa",'Kalista',"Kog'Maw",'Nilah',
  'Samira','Sivir','Smolder','Tristana','Twitch','Vayne','Xayah','Zeri','Yunara'
]);
const PURE_SUPPORT=new Set([
  'Alistar','Bard','Braum','Janna','Leona','Lulu','Milio','Nami','Nautilus','Pyke','Rakan',
  'Rell','Renata Glasc','Sona','Soraka','Tahm Kench','Taric','Thresh','Yuumi'
]);

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
export function canonicalRole(value:unknown):DraftRole|null{
  const raw=clean(value).toUpperCase();
  if(!raw||raw==='NONE'||raw==='UNKNOWN'||raw==='UNSELECTED'||raw==='INVALID')return null;
  const mapped=raw==='BOTTOM'?'ADC':raw==='UTILITY'?'SUPPORT':raw==='MIDDLE'?'MID':raw;
  return ROLES.includes(mapped as DraftRole)?mapped as DraftRole:null;
}
function sameChampion(a:unknown,b:unknown){return clean(a).toLowerCase()===clean(b).toLowerCase()}
function hasSupportItem(player?:DraftRolePlayer|null){
  return Boolean(player?.items?.some(item=>SUPPORT_ITEM_IDS.has(Number(item?.itemId))||/world atlas|runic compass|bounty of worlds|dream maker|celestial opposition|solstice sleigh|bloodsong|zaz'zak/i.test(clean(item?.displayName))));
}
function hasSmite(player?:DraftRolePlayer|null){
  return Boolean(player?.summonerSpells?.some(spell=>/smite/i.test(clean(spell))));
}
function championPrior(champion:string):DraftRole|null{
  if(PURE_ADC.has(champion))return'ADC';
  if(PURE_SUPPORT.has(champion))return'SUPPORT';
  return null;
}

export function resolvePlayerRole(input:{
  champion:string;
  requestRole?:string|null;
  ours:DraftRolePlayer[];
  profileRole?:string|null;
  gameMode?:string|null;
}):RoleResolution{
  const champion=clean(input.champion);
  const me=input.ours.find(player=>sameChampion(player.champion,champion))??null;

  const request=canonicalRole(input.requestRole);
  if(request)return{role:request,source:'REQUEST',confidence:'HIGH'};

  if(hasSmite(me))return{role:'JUNGLE',source:'LIVE',confidence:'HIGH'};
  if(hasSupportItem(me))return{role:'SUPPORT',source:'LIVE',confidence:'HIGH'};

  const live=canonicalRole(me?.role);
  if(live)return{role:live,source:'LIVE',confidence:'HIGH'};

  const profile=canonicalRole(input.profileRole);
  const prior=championPrior(champion);
  if(profile&&prior===profile)return{role:profile,source:'PROFILE',confidence:'HIGH'};
  if(prior)return{role:prior,source:'CHAMPION_PRIOR',confidence:'MEDIUM'};
  if(profile)return{role:profile,source:'PROFILE',confidence:'MEDIUM'};

  const gameMode=clean(input.gameMode).toUpperCase();
  if(gameMode==='PRACTICETOOL'||gameMode==='TUTORIAL')return{role:null,source:'UNKNOWN',confidence:'LOW'};

  const used=new Set(input.ours.map(player=>canonicalRole(player.role)).filter(Boolean) as DraftRole[]);
  const unresolved=input.ours.filter(player=>!canonicalRole(player.role));
  const remaining=ROLES.filter(candidate=>!used.has(candidate));
  if(unresolved.length===1&&remaining.length===1&&sameChampion(unresolved[0].champion,champion)){
    return{role:remaining[0],source:'MISSING_ROLE',confidence:'LOW'};
  }
  return{role:null,source:'UNKNOWN',confidence:'LOW'};
}

export function forcePlayerRole(players:DraftRolePlayer[],champion:string,resolved:DraftRole|null){
  if(!resolved)return players.map(player=>({...player,role:canonicalRole(player.role)}));
  return players.map(player=>sameChampion(player.champion,champion)?{...player,role:resolved}:{...player,role:canonicalRole(player.role)});
}

export function laneOpponentsFor(role:DraftRole|null,enemies:DraftRolePlayer[]){
  if(!role)return[];
  const by=(wanted:DraftRole)=>enemies.find(player=>canonicalRole(player.role)===wanted)?.champion??null;
  if(role==='ADC'||role==='SUPPORT'){
    return [by('ADC'),by('SUPPORT')].filter((name):name is string=>Boolean(name));
  }
  const same=by(role);
  return same?[same]:[];
}

export function lanePartnerFor(role:DraftRole|null,ours:DraftRolePlayer[],champion:string){
  if(role!=='ADC'&&role!=='SUPPORT')return null;
  const wanted=role==='ADC'?'SUPPORT':'ADC';
  return ours.find(player=>!sameChampion(player.champion,champion)&&canonicalRole(player.role)===wanted)?.champion??null;
}

export function resolveEnemyRoles(enemies:DraftRolePlayer[]){
  const normalized=enemies.map(player=>({...player,role:canonicalRole(player.role)}));
  const used=new Set(normalized.map(player=>player.role).filter(Boolean) as DraftRole[]);
  const unresolved=normalized.filter(player=>!player.role);
  const remaining=ROLES.filter(candidate=>!used.has(candidate));
  if(unresolved.length===1&&remaining.length===1)unresolved[0].role=remaining[0];
  return normalized;
}


export function normalizeTeamAroundPlayer(players:DraftRolePlayer[],champion:string,resolution:RoleResolution){
  const resolved=resolution.role;
  let next=forcePlayerRole(players,champion,resolved);
  if(!resolved)return next;
  next=next.map(player=>{
    if(sameChampion(player.champion,champion))return player;
    return canonicalRole(player.role)===resolved?{...player,role:null}:player;
  });
  const used=new Set(next.map(player=>canonicalRole(player.role)).filter(Boolean) as DraftRole[]);
  const unresolved=next.filter(player=>!canonicalRole(player.role));
  const remaining=ROLES.filter(candidate=>!used.has(candidate));
  if(unresolved.length===1&&remaining.length===1)unresolved[0].role=remaining[0];
  return next;
}
