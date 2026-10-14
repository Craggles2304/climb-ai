import type {ChampionListEntry} from './ddragon';

export type DraftPick={name:string;role?:string|null;lockedIn?:boolean};
export type DraftAdvisorInput={
  roster:Record<string,ChampionListEntry>;
  role:string|null|undefined;
  localChampion?:string|null;
  localLocked?:boolean;
  allies:DraftPick[];
  enemies:DraftPick[];
  bans:string[];
  patch:string;
};
export type DraftRecommendation={
  champion:string;
  score:number;
  reason:string[];
};
export type DraftAdvice={
  available:boolean;
  patch:string;
  role:string|null;
  locked:boolean;
  recommended:DraftRecommendation[];
  considered:number;
  known:{allies:number;enemies:number};
  edge:{ours:number;theirs:number;confidence:'FORMING'|'PARTIAL'|'FULL';label:string;basis:string};
  caveat:string;
};

// Riot Data Dragon does not supply a champion's played positions. Keep a
// curated, flexible shortlist by role; never pass a top laner as a support
// purely because their static 'Tank' tag resembles one.
const ROLE_POOLS:Record<string,string[]>={
 TOP:['Aatrox','Akali','Ambessa','Camille','ChoGath','Darius','DrMundo','Fiora','Gangplank','Garen','Gnar','Gwen','Illaoi','Irelia','Jax','Jayce','Kayle','Kennen','Kled','KSante','Malphite','Mordekaiser','Nasus','Olaf','Ornn','Pantheon','Poppy','Quinn','Renekton','Riven','Rumble','Sett','Shen','Singed','Sion','Smolder','TahmKench','Teemo','Trundle','Tryndamere','Urgot','Vayne','Vladimir','Volibear','Warwick','Wukong','Yasuo','Yone','Yorick','Zac'],
 JUNGLE:['Amumu','Belveth','Briar','Diana','DrMundo','Ekko','Elise','Evelynn','Fiddlesticks','Gragas','Graves','Hecarim','Ivern','JarvanIV','Jax','Karthus','Kayn','Khazix','Kindred','LeeSin','Lillia','Maokai','MasterYi','Nidalee','Nocturne','Nunu','Olaf','Poppy','Rammus','RekSai','Rengar','Sejuani','Shaco','Shyvana','Skarner','Sylas','Taliyah','Trundle','Udyr','Vi','Viego','Volibear','Warwick','Wukong','XinZhao','Zac','Zed'],
 MID:['Ahri','Akali','Anivia','Annie','AurelionSol','Azir','Brand','Cassiopeia','Corki','Diana','Ekko','Fizz','Galio','Hwei','Irelia','Kassadin','Katarina','Leblanc','Lissandra','Lux','Malzahar','Naafiri','Neeko','Orianna','Pantheon','Qiyana','Ryze','Smolder','Swain','Sylas','Syndra','Taliyah','Talon','Tristana','TwistedFate','Veigar','Velkoz','Vex','Viktor','Vladimir','Xerath','Yasuo','Yone','Zed','Ziggs','Zoe'],
 ADC:['Aphelios','Ashe','Caitlyn','Corki','Draven','Ezreal','Jhin','Jinx','Kaisa','Kalista','KogMaw','Lucian','MissFortune','Nilah','Samira','Senna','Sivir','Smolder','Tristana','Twitch','Varus','Vayne','Xayah','Zeri','Ziggs','Seraphine','Swain','Brand','Yasuo'],
 SUPPORT:['Alistar','Amumu','Annie','Bard','Blitzcrank','Brand','Braum','Galio','Janna','Karma','Leona','Lulu','Lux','Maokai','Milio','Morgana','Nami','Nautilus','Neeko','Pantheon','Poppy','Pyke','Rakan','Rell','Renata','Senna','Seraphine','Shaco','Sona','Soraka','Swain','TahmKench','Taric','Thresh','Velkoz','Xerath','Yuumi','Zilean','Zyra'],
};
const norm=(value:string|undefined|null)=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function draftRole(role:string|null|undefined){
  const value=String(role||'').trim().toUpperCase();
  return ({BOTTOM:'ADC',BOT:'ADC',UTILITY:'SUPPORT',MIDDLE:'MID'} as Record<string,string>)[value]||value;
}
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
type Traits={front:number;engage:number;peel:number;magic:number;physical:number;sustained:number;poke:number;dive:number};
const empty=():Traits=>({front:0,engage:0,peel:0,magic:0,physical:0,sustained:0,poke:0,dive:0});
function traits(item:ChampionListEntry):Traits{
  const tags=item.tags||[],info=item.info||{attack:0,magic:0,defense:0,difficulty:0};
  const has=(tag:string)=>tags.includes(tag);
  const magic=info.magic>info.attack+2?1:info.attack>info.magic+2?0:0.5;
  const physical=info.attack>info.magic+2?1:info.magic>info.attack+2?0:0.5;
  return{
    front:has('Tank')?1:has('Fighter')?.55:0,
    engage:has('Tank')?.8:has('Fighter')?.45:0,
    peel:has('Support')?.85:has('Tank')?.6:has('Mage')?.2:0,
    magic,physical,
    sustained:has('Marksman')?1:has('Fighter')?.65:has('Mage')?.35:0,
    poke:has('Mage')?.65:has('Marksman')?.4:0,
    dive:has('Assassin')?1:has('Fighter')?.55:0,
  };
}
function aggregate(picks:DraftPick[],byName:Map<string,ChampionListEntry>){
  const sum=empty();
  for(const pick of picks){
    const entry=byName.get(norm(pick.name));if(!entry)continue;
    const t=traits(entry);for(const name of Object.keys(sum) as Array<keyof Traits>)sum[name]+=t[name];
  }
  return sum;
}
function evaluate(pick:ChampionListEntry,ours:Traits,theirs:Traits,allyCount:number,enemyCount:number){
  const t=traits(pick);
  let score=50;
  const reasons:string[]=[];
  const add=(points:number,reason:string)=>{score+=points;reasons.push(reason)};
  if(allyCount&&ours.front<.7&&t.front>.5)add(12,'Provides frontline for your revealed allies');
  if(allyCount&&ours.magic<.7&&t.magic>.65)add(10,'Adds magic damage to your physical-heavy team');
  if(allyCount&&ours.physical<.7&&t.physical>.65)add(9,'Adds physical damage to your magic-heavy team');
  if(allyCount&&ours.engage<.5&&t.engage>.6)add(6,'Gives your team a way to start fights');
  if(allyCount&&ours.peel<.5&&t.peel>.7&&ours.sustained>.7)add(8,'Protects your existing damage dealers');
  if(enemyCount&&theirs.dive>.9&&t.peel>.65)add(9,'Helps protect teammates against their dive threats');
  if(enemyCount&&theirs.front>1.2&&t.sustained>.7)add(9,'Offers sustained damage into their frontline');
  if(enemyCount&&theirs.poke>1.2&&t.engage>.6)add(7,'Can help your team engage against their poke');
  if(enemyCount&&theirs.engage>1.2&&t.peel>.7)add(6,'Adds defensive tools against their engage');
  if(enemyCount&&theirs.sustained>1.1&&t.dive>.8)add(5,'Provides access to their sustained-damage carries');
  if(allyCount&&ours.front>=1.4&&t.sustained>.7)add(7,'Fits a frontline that can create space for damage');
  const difficulty=Number(pick.info?.difficulty)||5;
  score+=clamp((6-difficulty)*.55,-3,3);
  if(!reasons.length)reasons.push(enemyCount||allyCount?'Maintains a balanced option for the revealed draft':'Solid role option while other picks are hidden');
  return{score:Math.round(score*10)/10,reason:reasons.slice(0,3)};
}
export function buildDraftPickAdvice(input:DraftAdvisorInput):DraftAdvice{
  const role=draftRole(input.role);
  const byName=new Map<string,ChampionListEntry>();
  for(const entry of Object.values(input.roster))byName.set(norm(entry.name),entry);
  const local=norm(input.localChampion);
  const allies=input.allies.filter(p=>p.name&&norm(p.name)!==local);
  const enemies=input.enemies.filter(p=>p.name);
  const allyTraits=aggregate(allies,byName),enemyTraits=aggregate(enemies,byName);
  const known={allies:allies.length+(local?1:0),enemies:enemies.length};
  const taken=new Set([...allies,...enemies].map(p=>norm(p.name)));
  for(const banned of input.bans)taken.add(norm(banned));
  const pool=ROLE_POOLS[role]||[];
  const candidates=pool.map(name=>byName.get(norm(name))).filter((entry):entry is ChampionListEntry=>Boolean(entry))
    .filter(entry=>!taken.has(norm(entry.name)));
  // In champion-select a hover is not an ownership lock; re-evaluate the
  // hovered champion alongside alternatives. After lock it remains in the list
  // as a comparison but the app never tells a player to change a locked pick.
  const ranked=candidates.map(entry=>({
    champion:entry.name,...evaluate(entry,allyTraits,enemyTraits,allies.length,enemies.length),
  })).sort((a,b)=>b.score-a.score||a.champion.localeCompare(b.champion));
  const recommended=ranked.slice(0,3);
  const actual=local?byName.get(local):null;
  const evaluated=actual
    ?evaluate(actual,allyTraits,enemyTraits,allies.length,enemies.length)
    :ranked[0]??null;

  // Percentages describe a *heuristic composition-index share*, not observed
  // win probabilities. With too few enemy picks, we refuse to fabricate an
  // advantage: an even bar signals insufficient information.
  const forming=enemies.length<3||allies.length<2;
  const confidence:DraftAdvice['edge']['confidence']=forming?'FORMING':(enemies.length>=5&&known.allies>=5?'FULL':'PARTIAL');
  const meanOwn=allies.length?((allyTraits.front+allyTraits.peel+allyTraits.sustained)/allies.length):1;
  const meanTheir=enemies.length?((enemyTraits.front+enemyTraits.peel+enemyTraits.sustained)/enemies.length):1;
  const ownScore=evaluated?.score??50;
  const difference=(ownScore-50)*.28+(meanOwn-meanTheir)*2;
  const edgeOurs=forming?50:Math.round(clamp(50+difference,40,60));
  const edge={ours:edgeOurs,theirs:100-edgeOurs,confidence,
    label:'DRAFT ADVANTAGE INDEX · NOT VERIFIED WIN ODDS',
    basis:forming
      ?'More allied and enemy picks are needed for a meaningful draft read.'
      :'A relative composition heuristic using only currently revealed champions; not a calibrated match win probability.'};
  return{
    available:Boolean(pool.length&&candidates.length),
    patch:input.patch,role:pool.length?role:null,locked:Boolean(input.localLocked),
    recommended,considered:candidates.length,known,edge,
    caveat:'Model-based role shortlist using Riot champion tags, draft balance and revealed threats. No personal mastery, live ranked win-rate calibration or hidden enemy picks are assumed. Consider comfort and champion proficiency before locking in.',
  };
}
