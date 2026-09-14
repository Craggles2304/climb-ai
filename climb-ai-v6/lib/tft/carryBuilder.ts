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

export const TFT_META_SET=18;
export const TFT_META_PATCH='18.2';
export const TFT_META_AS_OF='2026-09-14';

// Dated ranked snapshot. Profile-level numbers come from current Patch 18.2 tactics.tools
// unit pages. Item packages intentionally exclude emblem/artifact/radiant-dependent trios
// from META and ALTERNATIVE so Item Finder only recommends craftable standard lines.
export const TFT_CARRY_PROFILES:TftCarryProfile[]=[
  {
    champion:'Ashe',tier:'S',style:'BACKLINE_CARRY',headline:'Premium 5-cost AD capstone',
    whyBuildAround:'Ashe is one of the cleanest late-game physical damage caps in Enchanted Wilds. Give her cast uptime and penetration, then build enough frontline for the Spirit Rift damage zone to keep working.',
    patch:TFT_META_PATCH,sampleLabel:'~37k games',avgPlace:3.78,top4:63.2,win:19.6,sourceLabel:'tactics.tools · Patch 18.2',sourceUrl:'https://tactics.tools/units/da_18_ashe/all',
    builds:[
      {id:'ashe-cast',label:'CAST + SHRED CORE',kind:'META',items:['Spear of Shojin','Last Whisper','Infinity Edge'],note:'A current standard-item trio with mana generation, armor shred and crit scaling. It avoids emblem-dependent high-roll packages while preserving Ashe’s cast pattern.'},
      {id:'ashe-red',label:'ANTI-HEAL DAMAGE',kind:'ALTERNATIVE',items:['Red Buff','Infinity Edge','Last Whisper'],note:'A strong physical alternative when you need anti-heal and already have enough cast support elsewhere on the board.'},
      {id:'ashe-ramp',label:'RAMPING ASHE',kind:'FUN',items:["Guinsoo's Rageblade",'Spear of Shojin','Red Buff'],note:'A real played line that leans harder into fight length and attack-speed ramp. Treat it as context-dependent rather than universal BIS.'}
    ]
  },
  {
    champion:'Draven',tier:'S',style:'BACKLINE_CARRY',headline:'Explosive 5-cost finisher',
    whyBuildAround:'Draven has one of the highest current first-place rates among normal Set 18 capstones. His best line depends heavily on whether you need safety/cast consistency or can greed for a full physical damage package.',
    patch:TFT_META_PATCH,sampleLabel:'~51k games',avgPlace:4.07,top4:55.4,win:24.1,sourceLabel:'tactics.tools · Patch 18.2',sourceUrl:'https://tactics.tools/units/da_draven18/all',
    builds:[
      {id:'draven-safe',label:'SAFE CAST CORE',kind:'META',items:['Hand of Justice','Quicksilver','Spear of Shojin'],note:'The highest-volume standard trio in the current broad Patch 18.2 sample: sustain, crowd-control protection and faster casts.'},
      {id:'draven-ad',label:'PURE AD CAP',kind:'ALTERNATIVE',items:['Infinity Edge','Last Whisper',"Kraken's Fury"],note:'High-MMR data supports this full physical package when your board already protects Draven and you need maximum damage conversion.'},
      {id:'draven-ramp',label:'FULL RAMP DAMAGE',kind:'FUN',items:["Guinsoo's Rageblade","Kraken's Fury",'Deathblade'],note:'A high-ceiling damage line seen in current data. It gives up the safety of the main package, so use it only when the board can buy time.'}
    ]
  },
  {
    champion:"Kog'Maw",tier:'A',style:'BACKLINE_CARRY',headline:'Flexible 3-cost adaptor carry',
    whyBuildAround:'Kog’Maw is valuable because the current set supports both spell-heavy and physical item directions. That makes him an excellent Item Finder bridge when your component bag has not committed to one damage profile yet.',
    patch:TFT_META_PATCH,sampleLabel:'~56k games',avgPlace:4.22,top4:56.6,win:11.1,sourceLabel:'tactics.tools · Patch 18.2',sourceUrl:'https://tactics.tools/units/da_kogmaw18_ad/all',
    builds:[
      {id:'kog-ap',label:'SPELL ARTILLERY',kind:'META',items:["Rabadon's Deathcap","Archangel's Staff",'Blue Buff'],note:'The strongest clean standard-item trio in the current broad sample. It turns Kog’Maw into a scaling spell-artillery carry.'},
      {id:'kog-ad',label:'PHYSICAL ADAPTOR',kind:'ALTERNATIVE',items:["Guinsoo's Rageblade",'Deathblade','Last Whisper'],note:'A current physical package for Bow/Sword-heavy games: ramping attacks, raw AD and armor shred.'},
      {id:'kog-hybrid',label:'HYBRID RAMP',kind:'FUN',items:["Kraken's Fury",'Red Buff',"Guinsoo's Rageblade"],note:'A played hybrid attack-speed line. It is useful when those components arrive naturally, but it is less reliable than the best clean AP or AD packages.'}
    ]
  },
  {
    champion:'Ahri',tier:'A',style:'BACKLINE_CARRY',headline:'Reliable 4-cost spell carry',
    whyBuildAround:'Ahri gives the roster a conventional AP route between 3-cost reroll and 5-cost cap boards. Her current standard packages strongly value cast frequency plus a scaling AP or attack-speed amplifier.',
    patch:TFT_META_PATCH,sampleLabel:'~37k games',avgPlace:4.42,top4:51.3,win:12.4,sourceLabel:'tactics.tools · Patch 18.2',sourceUrl:'https://tactics.tools/units/da_18_ahri/all',
    builds:[
      {id:'ahri-cast',label:'CAST ENGINE',kind:'META',items:['Spear of Shojin',"Nashor's Tooth",'Blue Buff'],note:'A current clean standard trio with strong sample support: fast casts plus Nashor’s attack-speed window after casting.'},
      {id:'ahri-scale',label:'SCALING AP',kind:'ALTERNATIVE',items:['Spear of Shojin',"Nashor's Tooth","Archangel's Staff"],note:'Trades some immediate mana acceleration for stronger fight-length scaling when your frontline is durable.'},
      {id:'ahri-burst',label:'BURST AP',kind:'FUN',items:['Spear of Shojin','Blue Buff',"Rabadon's Deathcap"],note:'A straightforward high-AP burst line. Playable when the components land naturally, but not the default recommendation over the better-supported cast packages.'}
    ]
  },
  {
    champion:'Master Yi',tier:'B',style:'MELEE_CARRY',headline:'3-star melee reroll threat',
    whyBuildAround:'Master Yi is a reroll commitment rather than a generic plug-in carry. The current data is strongest when he reaches 3★ and combines sustain, crowd-control protection and a defensive damage scaler.',
    patch:TFT_META_PATCH,sampleLabel:'~26k games',avgPlace:4.43,top4:51.4,win:11.7,sourceLabel:'tactics.tools · Patch 18.2',sourceUrl:'https://tactics.tools/units/da_18_masteryi_ad/all',
    builds:[
      {id:'yi-bis',label:'REROLL CORE',kind:'META',items:['Bloodthirster','Quicksilver',"Titan's Resolve"],note:'A strong current standard melee trio: sustain, CC protection and durable damage scaling. Best treated as a 3★ reroll package.'},
      {id:'yi-safe',label:'SURVIVAL DAMAGE',kind:'ALTERNATIVE',items:["Titan's Resolve",'Quicksilver','Edge of Night'],note:'Adds a second survival layer for lobbies where Yi is being focused before he can ramp.'},
      {id:'yi-ramp',label:'RAGEBLADE YI',kind:'FUN',items:["Guinsoo's Rageblade",'Quicksilver','Edge of Night'],note:'Attack-speed fantasy with two safety pieces. It can work in long fights, but the current data does not justify calling it universal BIS.'}
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
