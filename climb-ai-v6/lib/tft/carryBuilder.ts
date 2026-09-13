export type TftCarryTier='S'|'A'|'B';
export type TftCarryStyle='BACKLINE_CARRY'|'MELEE_CARRY'|'BRUISER_ANCHOR'|'TANK_ANCHOR';
export type TftBuildKind='META'|'ALTERNATIVE'|'FUN';

export interface TftCarryItemBuild{
  id:string;
  label:string;
  kind:TftBuildKind;
  items:string[];
  note:string;
  avgPlace?:number;
  top4?:number;
  win?:number;
}

export interface TftCarryProfile{
  champion:string;
  tier:TftCarryTier;
  style:TftCarryStyle;
  headline:string;
  whyBuildAround:string;
  patch:string;
  sampleLabel:string;
  avgPlace:number;
  top4:number;
  win:number;
  sourceLabel:string;
  sourceUrl:string;
  builds:TftCarryItemBuild[];
}

export interface TftStaticChampion{
  id:string;
  name:string;
  tier:number|string|null;
  image:string|null;
  traits?:string[];
  stats?:{hp?:number;armor?:number;magicResist?:number;attackDamage?:number;attackSpeed?:number;range?:number}|null;
}

export interface TftCarryShellUnit{
  champion:TftStaticChampion;
  role:'CARRY'|'FRONTLINE'|'SECONDARY DAMAGE'|'UTILITY';
  reason:string;
  score:number;
}

export interface TftCarryShell{
  carry:TftStaticChampion|null;
  units:TftCarryShellUnit[];
  activeTraitCounts:Array<{name:string;count:number}>;
  notes:string[];
}

export const TFT_META_PATCH='17.9';
export const TFT_META_AS_OF='2026-09-13';

export const TFT_CARRY_PROFILES:TftCarryProfile[]=[
  {
    champion:'Jhin',tier:'S',style:'BACKLINE_CARRY',headline:'Elite late-game backline carry',
    whyBuildAround:'Jhin is one of the strongest current end-board focal points. Protect him, give him cast uptime, and let frontline buy enough time for repeated damage cycles.',
    patch:TFT_META_PATCH,sampleLabel:'~380k games',avgPlace:3.85,top4:61.7,win:20.2,sourceLabel:'tactics.tools',sourceUrl:'https://tactics.tools/units/jhin',
    builds:[
      {id:'jhin-bis',label:'BEST-IN-SLOT',kind:'META',items:['Blue Buff','Quicksilver','Spear of Shojin'],note:'Highest-confidence non-emblem package from current large-sample data. Mana plus safety keeps Jhin casting.',avgPlace:3.66,top4:65.1,win:21.6},
      {id:'jhin-dps',label:'DPS ALTERNATIVE',kind:'ALTERNATIVE',items:['Quicksilver','Blue Buff',"Kraken's Fury"],note:'More sustained physical damage when you already have enough cast frequency.',avgPlace:3.58,top4:67.0,win:22.0},
      {id:'jhin-rage',label:'RAGEBLADE TEMPO',kind:'FUN',items:["Guinsoo's Rageblade",'Red Buff','Spear of Shojin'],note:'A faster-ramping variant. Stronger when fights run long; less universally safe than the core package.'}
    ]
  },
  {
    champion:'Rhaast',tier:'S',style:'TANK_ANCHOR',headline:'Premium frontline anchor',
    whyBuildAround:'Rhaast is currently an extremely high-performing board anchor. Build the rest of the team to exploit the extra time and space he creates rather than forcing him into a pure damage role.',
    patch:TFT_META_PATCH,sampleLabel:'~1.9m games',avgPlace:3.81,top4:63.2,win:18.9,sourceLabel:'tactics.tools',sourceUrl:'https://tactics.tools/units/rhaast/plat',
    builds:[
      {id:'rhaast-tank',label:'BEST ANCHOR',kind:'META',items:['Evenshroud','Bramble Vest',"Warmog's Armor"],note:'Durability plus shred. Best when the rest of your board has enough backline damage.',avgPlace:3.42,top4:71.3,win:19.3},
      {id:'rhaast-magic',label:'MAGIC-SHRED FRONT',kind:'ALTERNATIVE',items:['Ionic Spark','Evenshroud','Crownguard'],note:'Use when your secondary carries benefit heavily from MR shred.',avgPlace:3.49,top4:69.9,win:19.0},
      {id:'rhaast-greed',label:'BRAWLER HIGH-ROLL',kind:'FUN',items:["Titan's Resolve",'Spirit Visage',"Warmog's Armor"],note:'Greedier scaling frontline build for upgraded/high-roll Rhaast boards.'}
    ]
  },
  {
    champion:'Twisted Fate',tier:'A',style:'BACKLINE_CARRY',headline:'Flexible AP / attack-speed carry',
    whyBuildAround:'Twisted Fate can convert attack speed and mana into repeated spell pressure. He is best when the shell protects him and supplies enough frontline to let Rageblade-style scaling matter.',
    patch:TFT_META_PATCH,sampleLabel:'~2.1m games',avgPlace:4.07,top4:58.2,win:16.2,sourceLabel:'tactics.tools',sourceUrl:'https://tactics.tools/units/twistedfate',
    builds:[
      {id:'tf-bis',label:'BEST-IN-SLOT',kind:'META',items:["Guinsoo's Rageblade",'Blue Buff','Void Staff'],note:'The cleanest current standard trio: ramp, cast frequency and penetration.',avgPlace:3.61,top4:67.0,win:19.0},
      {id:'tf-ap',label:'AP BURST',kind:'ALTERNATIVE',items:['Jeweled Gauntlet',"Nashor's Tooth",'Void Staff'],note:'Higher immediate spell pressure when you do not need as much ramp.',avgPlace:3.44,top4:70.4,win:20.7},
      {id:'tf-rage',label:'FULL RAMP',kind:'FUN',items:["Guinsoo's Rageblade",'Jeweled Gauntlet',"Rabadon's Deathcap"],note:'Maximum scaling fantasy. Needs long fights and excellent protection.'}
    ]
  },
  {
    champion:'Graves',tier:'A',style:'MELEE_CARRY',headline:'High-ceiling physical carry',
    whyBuildAround:'Graves can take over fights when he gets enough uptime. He needs defensive access, lifesteal or edge protection more than a pure glass-cannon backliner.',
    patch:TFT_META_PATCH,sampleLabel:'~1.6m games',avgPlace:4.47,top4:49.2,win:17.6,sourceLabel:'tactics.tools',sourceUrl:'https://tactics.tools/units/graves',
    builds:[
      {id:'graves-safe',label:'SAFE CARRY',kind:'META',items:['Edge of Night','Bloodthirster',"Guinsoo's Rageblade"],note:'Protects Graves through the first burst while still giving ramp and sustain.',avgPlace:4.11,top4:55.8,win:21.4},
      {id:'graves-crit',label:'CRIT DAMAGE',kind:'ALTERNATIVE',items:['Infinity Edge',"Guinsoo's Rageblade",'Giant Slayer'],note:'Higher raw damage into durable lobbies; less forgiving if Graves is focused.',avgPlace:4.02,top4:57.3,win:21.3},
      {id:'graves-nuke',label:'FULL DAMAGE',kind:'FUN',items:['Infinity Edge','Deathblade',"Guinsoo's Rageblade"],note:'Explosive high-roll damage. Use only when the board already supplies protection.'}
    ]
  },
  {
    champion:'Jax',tier:'B',style:'BRUISER_ANCHOR',headline:'Bruiser anchor with carry variants',
    whyBuildAround:'Current data says Jax is stronger as a durable bruiser/tank anchor than as a pure Rageblade carry. You can still force a Jax carry line, but OP CLIMB should tell you when that is a fun build rather than the statistical best line.',
    patch:TFT_META_PATCH,sampleLabel:'~682k games',avgPlace:4.29,top4:53.8,win:14.1,sourceLabel:'tactics.tools',sourceUrl:'https://tactics.tools/units/jax',
    builds:[
      {id:'jax-bis',label:'CURRENT META JAX',kind:'META',items:['Adaptive Helm','Sunfire Cape',"Protector's Vow"],note:'The strongest current large-sample Jax pattern is durable frontline, not triple Rageblade.',avgPlace:3.81,top4:63.5,win:15.6},
      {id:'jax-carry',label:'CARRY JAX',kind:'ALTERNATIVE',items:["Guinsoo's Rageblade",'Edge of Night',"Titan's Resolve"],note:'The real carry version: attack-speed ramp plus survival and scaling.',avgPlace:4.69,top4:46.7,win:9.7},
      {id:'jax-triple-rage',label:'TRIPLE RAGEBLADE JAX',kind:'FUN',items:["Guinsoo's Rageblade","Guinsoo's Rageblade","Guinsoo's Rageblade"],note:'Your requested full-ramp Jax. Extremely fun if he is protected and fights last long enough, but this is not current best-in-slot and should be treated as a high-roll/meme line.'}
    ]
  }
];

const norm=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'');
const numberCost=(value:number|string|null)=>Math.max(1,Math.min(5,Number(value)||1));

export function findCarryProfile(name:string){return TFT_CARRY_PROFILES.find(x=>norm(x.champion)===norm(name))||null;}

function unitRole(profile:TftCarryProfile,champ:TftStaticChampion):TftCarryShellUnit['role']{
  if(norm(champ.name)===norm(profile.champion))return'CARRY';
  const range=Number(champ.stats?.range||1);
  const durability=Number(champ.stats?.hp||0)+Number(champ.stats?.armor||0)*8+Number(champ.stats?.magicResist||0)*8;
  if(range<=1&&durability>=1000)return'FRONTLINE';
  if(range>=3||Number(champ.stats?.attackDamage||0)>=70)return'SECONDARY DAMAGE';
  return'UTILITY';
}

function candidateScore(profile:TftCarryProfile,carry:TftStaticChampion,c:TftStaticChampion){
  const carryTraits=new Set(carry.traits||[]);
  const shared=(c.traits||[]).filter(t=>carryTraits.has(t)).length;
  const range=Number(c.stats?.range||1);
  const hp=Number(c.stats?.hp||0);
  const armor=Number(c.stats?.armor||0);
  const mr=Number(c.stats?.magicResist||0);
  const ad=Number(c.stats?.attackDamage||0);
  const as=Number(c.stats?.attackSpeed||0);
  const durability=hp+armor*7+mr*7;
  let score=shared*24+numberCost(c.tier)*4;
  if(profile.style==='BACKLINE_CARRY')score+=range<=1?Math.min(24,durability/85):Math.min(10,ad*as/8);
  else if(profile.style==='MELEE_CARRY')score+=range<=1?Math.min(12,durability/120):Math.min(22,ad*as/5);
  else score+=range>=3?Math.min(20,ad*as/5):Math.min(12,durability/120);
  return score;
}

export function buildCarryShell(profile:TftCarryProfile,champions:TftStaticChampion[],teamSize=8):TftCarryShell{
  const carry=champions.find(c=>norm(c.name)===norm(profile.champion))||null;
  if(!carry)return{carry:null,units:[],activeTraitCounts:[],notes:['Carry is not present in the current Riot static dataset. The set may have changed since this meta snapshot.']};
  const eligible=champions.filter(c=>c.name&&norm(c.name)!==norm(carry.name)&&numberCost(c.tier)>=1&&numberCost(c.tier)<=5);
  const ranked=eligible.map(champion=>({champion,score:candidateScore(profile,carry,champion),role:unitRole(profile,champion)})).sort((a,b)=>b.score-a.score);
  const picked:TftCarryShellUnit[]=[{champion:carry,role:'CARRY',score:999,reason:'Primary unit this shell is being built around.'}];
  const carryTraits=new Set(carry.traits||[]);

  const needFrontline=profile.style==='BACKLINE_CARRY'?3:2;
  const frontline=ranked.filter(x=>x.role==='FRONTLINE').slice(0,needFrontline);
  for(const x of frontline)picked.push({...x,reason:(x.champion.traits||[]).some(t=>carryTraits.has(t))?'Frontline that also preserves a carry trait.':'Frontline selected to buy the carry more time.'});

  for(const x of ranked){
    if(picked.length>=teamSize)break;
    if(picked.some(p=>norm(p.champion.name)===norm(x.champion.name)))continue;
    const shared=(x.champion.traits||[]).filter(t=>carryTraits.has(t));
    picked.push({...x,reason:shared.length?`Supports ${shared.join(' + ')} while adding ${x.role.toLowerCase()}.`:`Best remaining structural fit as ${x.role.toLowerCase()}.`});
  }

  const traitCounts=new Map<string,number>();
  for(const unit of picked)for(const trait of unit.champion.traits||[])traitCounts.set(trait,(traitCounts.get(trait)||0)+1);
  const activeTraitCounts=[...traitCounts.entries()].filter(([,count])=>count>=2).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name));
  const notes=[
    'This shell is generated from current Riot static traits/stats plus the selected carry profile; it is a structural starting point, not a claim that one exact eight-unit board is always optimal.',
    'Use Board Compare after changing one unit, item package or level so the trade-off is visible instead of blindly following a comp list.'
  ];
  return{carry,units:picked.slice(0,teamSize),activeTraitCounts,notes};
}

export function metaStrengthScore(profile:TftCarryProfile){
  return Math.round((8-profile.avgPlace)*14+profile.top4*.55+profile.win*.7);
}
