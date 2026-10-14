import type {ChampionListEntry} from './ddragon';

export type DraftRole='TOP'|'JUNGLE'|'MID'|'ADC'|'SUPPORT';
type Pick={name:string;role?:string|null};
export type DraftSuggestion={champion:string;score:number;reasons:string[];familiar:boolean;role:DraftRole};
export interface DraftAdviser{
  status:'READY'|'FORMING'|'UNAVAILABLE';
  role:DraftRole|null;patch:string;top:DraftSuggestion[];
  currentChampion:string|null;
  draftEdge:{ours:number;theirs:number;knownAllies:number;knownEnemies:number;confidence:'LOW'|'MEDIUM'|'HIGH';label:string;method:'HEURISTIC_DRAFT_FIT_NOT_WIN_PROBABILITY'}|null;
  caveat:string;
}

// Conservative recognised-role shortlist. Data Dragon tags alone are not lane
// data. Never suggest a tank/support solely because their tag looks useful.
// The model deliberately does NOT claim exhaustive or statistically optimal
// picks; role win/pick rates require verified patch/rank/role datasets.
const ROLE_POOLS:Record<DraftRole,string[]>={
 TOP:['Aatrox','Ambessa','Camille','ChoGath','Darius','DrMundo','Fiora','Garen','Gnar','Gragas','Gwen','Illaoi','Irelia','Jax','Jayce','Kennen','KSante','Malphite','Mordekaiser','Nasus','Olaf','Ornn','Renekton','Riven','Rumble','Sett','Shen','Sion','Teemo','Trundle','Tryndamere','Urgot','Vladimir','Volibear','Wukong','Yone','Yorick'],
 JUNGLE:['Amumu','Belveth','Briar','Diana','Ekko','Elise','Evelynn','Fiddlesticks','Gragas','Graves','Hecarim','Ivern','JarvanIV','Jax','Karthus','Kayn','Khazix','Kindred','LeeSin','Lillia','Maokai','MasterYi','Nidalee','Nocturne','Nunu','Poppy','Rammus','RekSai','Rengar','Sejuani','Shaco','Shyvana','Skarner','Taliyah','Trundle','Udyr','Vi','Viego','Volibear','Warwick','Wukong','XinZhao','Zac'],
 MID:['Ahri','Akali','Anivia','Annie','AurelionSol','Azir','Brand','Cassiopeia','Corki','Diana','Ekko','Fizz','Galio','Hwei','Irelia','Kassadin','Katarina','LeBlanc','Lissandra','Lux','Malzahar','Naafiri','Neeko','Orianna','Qiyana','Ryze','Sylas','Syndra','Taliyah','Talon','TwistedFate','Veigar','Vex','Viktor','Vladimir','Xerath','Yasuo','Yone','Zed','Ziggs','Zoe'],
 ADC:['Aphelios','Ashe','Caitlyn','Corki','Draven','Ezreal','Jhin','Jinx','Kaisa','Kalista','KogMaw','Lucian','MissFortune','Nilah','Samira','Senna','Sivir','Smolder','Tristana','Twitch','Varus','Vayne','Xayah','Zeri'],
 SUPPORT:['Alistar','Bard','Blitzcrank','Brand','Braum','Janna','Karma','Leona','Lulu','Lux','Maokai','Milio','Morgana','Nami','Nautilus','Neeko','Poppy','Pyke','Rakan','Rell','Renata','Senna','Seraphine','Sona','Soraka','Swain','TahmKench','Taric','Thresh','Velkoz','Xerath','Yuumi','Zilean','Zyra'],
};
const clean=(x:string)=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function draftRole(value:string|null|undefined):DraftRole|null{
 const role=String(value||'').trim().toUpperCase();
 if(role==='BOTTOM'||role==='BOT')return'ADC';
 if(role==='UTILITY')return'SUPPORT';
 if(role==='MIDDLE')return'MID';
 return ['TOP','JUNGLE','MID','ADC','SUPPORT'].includes(role)?role as DraftRole:null;
}
function profile(c:ChampionListEntry){
 const tags=c.tags||[];
 const attack=Number(c.info?.attack)||0,magic=Number(c.info?.magic)||0,defense=Number(c.info?.defense)||0;
 return{
  tank:tags.includes('Tank')||defense>=8,
  marksman:tags.includes('Marksman'),
  mage:tags.includes('Mage')||magic>=8,
  assassin:tags.includes('Assassin'),
  fighter:tags.includes('Fighter'),
  support:tags.includes('Support'),
  physical:attack>=magic,
  magic:magic>attack,
 };
}
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
function abilities(roster:Record<string,ChampionListEntry>,items:Pick[]){
 return items.map(p=>Object.values(roster).find(c=>clean(c.name)===clean(p.name)||clean(c.id)===clean(p.name))).filter((c):c is ChampionListEntry=>Boolean(c)).map(profile);
}
function chemistry(candidate:ChampionListEntry,allies:ReturnType<typeof profile>[],enemies:ReturnType<typeof profile>[],role:DraftRole){
 const self=profile(candidate);
 const allyTanks=allies.filter(p=>p.tank).length;
 const allyMarksmen=allies.filter(p=>p.marksman).length;
 const allyMagic=allies.filter(p=>p.magic).length;
 const allyPhysical=allies.filter(p=>p.physical).length;
 const enemyTanks=enemies.filter(p=>p.tank).length;
 const enemyAssassins=enemies.filter(p=>p.assassin).length;
 const enemyMarksmen=enemies.filter(p=>p.marksman).length;
 let score=50;const reasons:string[]=[];
 if(allyTanks===0&&self.tank){score+=13;reasons.push('Adds frontline your team lacks')}
 if(allyTanks>=2&&self.marksman){score+=7;reasons.push('Can deal damage behind strong frontline')}
 if(allyPhysical>=2&&allyMagic===0&&self.magic){score+=13;reasons.push('Adds magic damage to a physical-heavy team')}
 if(allyMagic>=2&&allyPhysical===0&&self.physical){score+=11;reasons.push('Adds physical damage to a magic-heavy team')}
 if(enemyTanks>=2&&(self.marksman||self.fighter)){score+=8;reasons.push('Offers sustained damage into multiple tanks')}
 if(enemyAssassins>=2&&(self.tank||self.support)){score+=9;reasons.push('More defensive tools versus divers')}
 if(enemyAssassins>=2&&self.marksman){score-=7;reasons.push('Caution: multiple enemy divers threaten your carry')}
 if(enemyMarksmen>=2&&self.assassin){score+=7;reasons.push('Threatens vulnerable enemy carries')}
 if(role==='SUPPORT'&&allyMarksmen>=1&&self.support){score+=4;reasons.push('Supports the allied carry')}
 if(enemies.length===0)reasons.push('Enemy picks are not revealed yet');
 if(!reasons.length)reasons.push('Balanced fit from currently revealed champions');
 return{score:clamp(score,0,100),reasons:reasons.slice(0,3)};
}
export function adviseChampionDraft(input:{
 roster:Record<string,ChampionListEntry>;role:string|null|undefined;
 allies:Pick[];enemies:Pick[];banned:string[];hover?:string|null;
 familiar?:string[];patch:string;
}):DraftAdviser{
 const role=draftRole(input.role);
 const fallback:DraftAdviser={status:'UNAVAILABLE',role,patch:input.patch,top:[],currentChampion:input.hover||null,draftEdge:null,caveat:'No reliable win-probability model is available. Draft-fit scores are not match win odds.'};
 if(!role)return{...fallback,caveat:'Awaiting your role before showing a role-appropriate recommendation.'};
 const rosterList=Object.values(input.roster),byId=new Map(rosterList.map(c=>[clean(c.id),c]));
 const banned=new Set(input.banned.map(clean)),taken=new Set([...input.allies,...input.enemies].map(x=>clean(x.name)));
 const familiar=new Set((input.familiar||[]).map(clean));
 const allies=abilities(input.roster,input.allies.filter(p=>clean(p.name)!==clean(input.hover||'')));
 const enemies=abilities(input.roster,input.enemies);
 const results:DraftSuggestion[]=[];
 for(const id of ROLE_POOLS[role]){
  const c=byId.get(clean(id));if(!c)continue;
  if(banned.has(clean(c.name))||banned.has(clean(c.id)))continue;
  if(taken.has(clean(c.name))&&clean(c.name)!==clean(input.hover||''))continue;
  const fit=chemistry(c,allies,enemies,role);
  const known=familiar.has(clean(c.name))||familiar.has(clean(c.id));
  results.push({champion:c.name,score:clamp(fit.score+(known?12:0),0,100),familiar:known,role,
    reasons:[...(known?['In your saved champion pool']:[]),...fit.reasons].slice(0,3)});
 }
 results.sort((a,b)=>b.score-a.score||a.champion.localeCompare(b.champion));
 // Draft edge is a *relative composition-fit indicator*, not statistical odds.
 // Require information from BOTH sides; unknown slots must not be treated as weak champions.
 const knownAllies=input.allies.filter(p=>p.name&&clean(p.name)!==clean(input.hover||'')).length;
 const knownEnemies=input.enemies.filter(p=>p.name).length;
 const top=results.slice(0,3);
 let draftEdge:DraftAdviser['draftEdge']=null;
 if(knownAllies>=2&&knownEnemies>=2&&top.length){
  const allyProfile=[...allies,profile(byId.get(clean(top[0].champion))!)];
  const enemyProfile=enemies;
  const t=(p:ReturnType<typeof profile>[])=>({
   tanks:p.filter(x=>x.tank).length,physical:p.filter(x=>x.physical).length,
   magic:p.filter(x=>x.magic).length,assassins:p.filter(x=>x.assassin).length,
  });
  const our=t(allyProfile),their=t(enemyProfile);
  const score=(x:ReturnType<typeof t>)=>(x.tanks?5:0)+(x.physical&&x.magic?7:0)+(x.tanks>=2?3:0)+(x.assassins>=1?2:0);
  const ours=clamp(Math.round(50+(score(our)-score(their))*1.5),35,65);
  const confidence=knownAllies>=4&&knownEnemies>=5?'HIGH':knownAllies>=3&&knownEnemies>=3?'MEDIUM':'LOW';
  draftEdge={ours,theirs:100-ours,knownAllies,knownEnemies,confidence,
   label:ours>53?'OUR DRAFT HAS A FIT EDGE':ours<47?'ENEMY DRAFT HAS A FIT EDGE':'DRAFT FIT IS CLOSE',
   method:'HEURISTIC_DRAFT_FIT_NOT_WIN_PROBABILITY'};
 }
 return{
  status:knownEnemies>=2?'READY':'FORMING',role,patch:input.patch,top,currentChampion:input.hover||null,draftEdge,
  caveat:'Provisional composition-fit ranking, not calibrated win odds. Does not include player mastery, matchup win rates, patch win rates or unseen picks. Familiar picks receive a modest preference.',
 };
}
