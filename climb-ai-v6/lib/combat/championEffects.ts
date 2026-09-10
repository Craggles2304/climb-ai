import type {OnHitEffect,TargetDebuffEffect} from './effects';
import type {AbilitySlot} from './combos';

export interface ChampionEffectOption{
  id:string;
  label:string;
  detail:string;
  /** Only one state in a group may be active at once. */
  group?:string;
  /** EXACT affects the deterministic result; PARTIAL deliberately leaves a gap visible. */
  support?:'EXACT'|'PARTIAL';
}

export interface ChampionCombatProfile{
  /** Bonus-AS ratio added before champion-specific scaling. */
  permanentAttackSpeedRatio:number;
  /** Multiplier applied to all bonus attack speed, e.g. Jinx Fishbones 0.9. */
  bonusAttackSpeedScalar:number;
  /** Multiplier applied after base + bonus attack speed, e.g. Get Excited. */
  totalAttackSpeedMultiplier:number;
  /** Optional champion-state cap override. */
  attackSpeedCap:number|null;
  attackRangeBonus:number;
  /** Multiplier on the ordinary basic-attack AD component. */
  basicAttackDamageMultiplier:number;
  /** Resource spent by each basic attack in this state. */
  basicAttackResourceCost:number;
  onHits:OnHitEffect[];
  abilityDebuffs:Partial<Record<AbilitySlot,TargetDebuffEffect>>;
  modelledEffects:string[];
  unmodelledEffects:string[];
  notes:string[];
}

type Ranks=Partial<Record<AbilitySlot,number>>;
type Context={abilityPower:number};
type RegistryEntry={
  aliases:string[];
  options:ChampionEffectOption[];
  apply:(profile:ChampionCombatProfile,active:Set<string>,ranks:Ranks,opts:Context)=>void;
};

const emptyProfile=():ChampionCombatProfile=>({
  permanentAttackSpeedRatio:0,
  bonusAttackSpeedScalar:1,
  totalAttackSpeedMultiplier:1,
  attackSpeedCap:null,
  attackRangeBonus:0,
  basicAttackDamageMultiplier:1,
  basicAttackResourceCost:0,
  onHits:[],
  abilityDebuffs:{},
  modelledEffects:[],
  unmodelledEffects:[],
  notes:[],
});

/**
 * Champion mechanics registry.
 *
 * Generic spell formulas stay in abilities.ts. This registry is only for state
 * the player must tell us about: a weapon being active, stacks already held,
 * an empowered form, a mark, etc. A state is either deterministic or explicitly
 * PARTIAL; unsupported mechanics are never translated into a plausible-looking
 * fake number.
 */
const REGISTRY:RegistryEntry[]=[
  {
    aliases:['kogmaw'],
    options:[{
      id:'KOG_W',label:'W ACTIVE',group:'kog-stance',support:'EXACT',
      detail:'Bio-Arcane Barrage: max-health magic on-hit + bonus range',
    }],
    apply:applyKogMaw,
  },
  {
    aliases:['jinx'],
    options:[
      {id:'JINX_POWPOW_1',label:'POW-POW · 1 STACK',group:'jinx-weapon',support:'EXACT',detail:'Minigun with one Rev’d Up stack already active'},
      {id:'JINX_POWPOW_2',label:'POW-POW · 2 STACKS',group:'jinx-weapon',support:'EXACT',detail:'Minigun with two Rev’d Up stacks already active'},
      {id:'JINX_POWPOW_3',label:'POW-POW · 3 STACKS',group:'jinx-weapon',support:'EXACT',detail:'Minigun at full Rev’d Up attack speed'},
      {id:'JINX_FISHBONES',label:'FISHBONES',group:'jinx-weapon',support:'EXACT',detail:'110% AD rockets, +range, 20 mana/shot, 10% less bonus-AS scaling'},
      {id:'JINX_EXCITED_1',label:'GET EXCITED · 1',group:'jinx-excited',support:'PARTIAL',detail:'One passive stack: attack speed exact; decaying movement speed not simulated'},
      {id:'JINX_EXCITED_2',label:'GET EXCITED · 2',group:'jinx-excited',support:'PARTIAL',detail:'Two passive stacks: attack speed exact; movement not simulated'},
      {id:'JINX_EXCITED_3',label:'GET EXCITED · 3',group:'jinx-excited',support:'PARTIAL',detail:'Three passive stacks: attack speed exact; movement not simulated'},
      {id:'JINX_EXCITED_4',label:'GET EXCITED · 4',group:'jinx-excited',support:'PARTIAL',detail:'Four passive stacks: attack speed exact; movement not simulated'},
      {id:'JINX_EXCITED_5',label:'GET EXCITED · 5',group:'jinx-excited',support:'PARTIAL',detail:'Five-stack cap: attack speed exact; movement not simulated'},
    ],
    apply:applyJinx,
  },
  {
    aliases:['aphelios'],
    options:[
      {id:'APH_CALIBRUM',label:'CALIBRUM',group:'aphelios-main',support:'EXACT',detail:'Main-hand sniper: +100 basic-attack range'},
      {id:'APH_SEVERUM',label:'SEVERUM',group:'aphelios-main',support:'PARTIAL',detail:'Main-hand pistol: healing/overheal shield not yet in damage-race model'},
      {id:'APH_GRAVITUM',label:'GRAVITUM',group:'aphelios-main',support:'PARTIAL',detail:'Main-hand cannon: 30% slow affects spacing, not stationary damage'},
      {id:'APH_INFERNUM',label:'INFERNUM',group:'aphelios-main',support:'EXACT',detail:'Main-hand flamethrower: primary-target basic attack deals 110% AD'},
      {id:'APH_CRESCENDUM',label:'CRESCENDUM',group:'aphelios-main',support:'PARTIAL',detail:'Main-hand chakram: return distance and mirror-chakram count are stateful'},
    ],
    apply:applyAphelios,
  },
];

export function buildChampionCombatProfile(
  championId:string,
  activeEffects:string[],
  ranks:Ranks,
  opts:Context,
):ChampionCombatProfile{
  const profile=emptyProfile();
  const entry=findEntry(championId);
  const active=new Set(activeEffects);

  if(entry)entry.apply(profile,active,ranks,opts);

  // Anything explicitly requested but not recognised remains visible. This also
  // catches stale state if a player changes champion without clearing a toggle.
  const known=new Set([...profile.modelledEffects,...profile.unmodelledEffects]);
  for(const effect of activeEffects)
    if(!known.has(effect))profile.unmodelledEffects.push(effect);

  return profile;
}

export function championEffectOptions(championName:string):ChampionEffectOption[]{
  return findEntry(championName)?.options??[];
}

export function supportedChampionMechanics():{
  champion:string;exact:number;partial:number;options:ChampionEffectOption[];
}[]{
  return REGISTRY.map(entry=>({
    champion:entry.aliases[0],
    exact:entry.options.filter(o=>o.support==='EXACT').length,
    partial:entry.options.filter(o=>o.support==='PARTIAL').length,
    options:entry.options,
  }));
}

function applyKogMaw(profile:ChampionCombatProfile,active:Set<string>,ranks:Ranks,opts:Context){
  const qRank=clampRank(ranks.Q,5);
  const wRank=clampRank(ranks.W,5);

  if(qRank>0){
    profile.permanentAttackSpeedRatio=[.10,.15,.20,.25,.30][qRank-1]??0;
    profile.modelledEffects.push('KOG_Q_PASSIVE_AS','KOG_Q_SHRED');
    const shred=[.16,.20,.24,.28,.32][qRank-1]??0;
    profile.abilityDebuffs.Q={
      label:`Kog'Maw Q rank ${qRank} resistance shred`,durationSeconds:4,
      percentArmorReduction:shred,percentMagicResistReduction:shred,
    };
    profile.notes.push(`Kog'Maw Q rank ${qRank}: ${round(profile.permanentAttackSpeedRatio*100)}% permanent bonus attack speed.`);
    profile.notes.push(`Caustic Spittle hit: ${round(shred*100)}% armour/MR reduction on subsequent damage for 4 seconds.`);
  }

  if(active.has('KOG_W')){
    if(wRank<=0){
      markPartial(profile,'KOG_W',"Bio-Arcane Barrage cannot be active because W is unlearned.");
      return;
    }
    const base=[.03,.0375,.045,.0525,.06][wRank-1]??0;
    const apRatio=Math.max(0,opts.abilityPower)*.0001;
    profile.onHits.push({label:`Kog'Maw W rank ${wRank}`,type:'MAGIC',targetMaxHealthRatio:base+apRatio});
    profile.attackRangeBonus=[130,150,170,190,210][wRank-1]??0;
    profile.modelledEffects.push('KOG_W');
    profile.notes.push(`Bio-Arcane Barrage active: +${round((base+apRatio)*100)}% target max-HP magic damage per auto and +${profile.attackRangeBonus} range.`);
  }
}

function applyJinx(profile:ChampionCombatProfile,active:Set<string>,ranks:Ranks,_opts:Context){
  const qRank=clampRank(ranks.Q,5);
  const weapon=firstActive(active,['JINX_POWPOW_1','JINX_POWPOW_2','JINX_POWPOW_3','JINX_FISHBONES']);

  if(weapon&&qRank<=0){
    markPartial(profile,weapon,'Switcheroo state cannot be active because Q is unlearned.');
  }else if(weapon==='JINX_FISHBONES'){
    profile.basicAttackDamageMultiplier=1.10;
    profile.attackRangeBonus=[100,125,150,175,200][qRank-1]??0;
    profile.basicAttackResourceCost=20;
    profile.bonusAttackSpeedScalar=.90;
    profile.modelledEffects.push(weapon);
    profile.notes.push(`Fishbones active: basic attacks deal 110% AD, cost 20 mana, gain ${profile.attackRangeBonus} range and receive 90% of bonus attack speed.`);
  }else if(weapon){
    const stacks=Number(weapon.slice(-1));
    const full=[.30,.55,.80,1.05,1.30][qRank-1]??0;
    // Rev'd Up's first stack grants half the listed maximum and each additional
    // stack adds a quarter; three stacks reach the published maximum.
    const fraction=stacks===1?.5:stacks===2?.75:1;
    profile.permanentAttackSpeedRatio+=full*fraction;
    profile.modelledEffects.push(weapon);
    profile.notes.push(`Pow-Pow starts with ${stacks} Rev’d Up stack${stacks===1?'':'s'}: +${round(full*fraction*100)}% bonus attack speed at Q rank ${qRank}.`);
  }

  const excited=firstActive(active,[
    'JINX_EXCITED_1','JINX_EXCITED_2','JINX_EXCITED_3','JINX_EXCITED_4','JINX_EXCITED_5',
  ]);
  if(excited){
    const stacks=Math.max(1,Math.min(5,Number(excited.slice(-1))||1));
    profile.totalAttackSpeedMultiplier*=1+.25*stacks;
    // Get Excited is allowed to break the normal attack-speed cap. 90 is an
    // engine ceiling, not a claim that Jinx reaches 90 attacks/sec.
    profile.attackSpeedCap=90;
    profile.modelledEffects.push(excited);
    profile.unmodelledEffects.push(`${excited}_MOVESPEED`);
    profile.notes.push(`Get Excited x${stacks}: +${25*stacks}% total attack speed is included. Its 175% decaying movement-speed component is not yet used by the stationary fight model.`);
  }
}

function applyAphelios(profile:ChampionCombatProfile,active:Set<string>,_ranks:Ranks,_opts:Context){
  const weapon=firstActive(active,['APH_CALIBRUM','APH_SEVERUM','APH_GRAVITUM','APH_INFERNUM','APH_CRESCENDUM']);
  if(!weapon)return;

  if(weapon==='APH_CALIBRUM'){
    profile.attackRangeBonus=100;
    profile.modelledEffects.push(weapon);
    profile.notes.push('Calibrum main hand: +100 basic-attack range is included. Mark/off-hand follow-up damage remains a separate future state.');
    return;
  }
  if(weapon==='APH_INFERNUM'){
    profile.basicAttackDamageMultiplier=1.10;
    profile.modelledEffects.push(weapon);
    profile.notes.push('Infernum main hand: the primary-target basic attack deals 110% AD. Cone splash is not added to a 1v1 target.');
    return;
  }
  if(weapon==='APH_SEVERUM'){
    markPartial(profile,weapon,'Severum selected: its lifesteal and overheal shield need a healing/shield timeline, so they are not guessed into damage.');
    return;
  }
  if(weapon==='APH_GRAVITUM'){
    markPartial(profile,weapon,'Gravitum selected: its 30% decaying slow changes spacing, which the stationary damage race does not yet simulate.');
    return;
  }
  markPartial(profile,weapon,'Crescendum selected: return time depends on distance and mirror-chakram count, so a fixed attack-speed/damage bonus would be misleading.');
}

function findEntry(name:string):RegistryEntry|undefined{
  const normal=normalise(name);
  return REGISTRY.find(entry=>entry.aliases.includes(normal));
}

function firstActive(active:Set<string>,ids:string[]):string|undefined{
  return ids.find(id=>active.has(id));
}

function markPartial(profile:ChampionCombatProfile,id:string,note:string){
  profile.unmodelledEffects.push(id);
  profile.notes.push(note);
}

function clampRank(value:number|undefined,max:number){
  const n=Number.isFinite(value)?Math.round(value as number):0;
  return Math.max(0,Math.min(max,n));
}

const normalise=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const round=(n:number)=>Math.round(n*100)/100;
