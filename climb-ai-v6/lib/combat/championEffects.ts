import type {AutoProcEffect,OnHitEffect,TargetDebuffEffect} from './effects';
import type {AbilitySlot} from './combos';

export type ChampionMechanicKind=
  |'STEROID'|'MARK'|'STACK'|'EXECUTE'|'MISSING_HEALTH'
  |'CURRENT_HEALTH'|'MAX_HEALTH'|'EMPOWERED_AUTO'|'RESET'
  |'SHIELD'|'TRANSFORMATION'|'MULTI_HIT'|'RANGE'|'RESOURCE'
  |'DEBUFF'|'HEAL';

export interface ChampionEffectOption{
  id:string;
  label:string;
  detail:string;
  mechanics:ChampionMechanicKind[];
  /** Only one state in a group may be active at once. */
  group?:string;
  /** EXACT affects the deterministic result; PARTIAL deliberately leaves a gap visible. */
  support?:'EXACT'|'PARTIAL';
}

export interface AbilityStateModifier{
  /** Multiplies the resolved CommunityDragon damage component. */
  damageMultiplier?:number;
  /** Flat seconds removed from base cooldown before haste. */
  cooldownFlatReduction?:number;
  /** Multiplier after flat reduction. */
  cooldownMultiplier?:number;
  /** Exact resource cost when the state changes the normal spell cost. */
  costOverride?:number;
  /** Target-health dependent damage resolved at the exact cast event. */
  dynamicDamage?:OnHitEffect[];
  note?:string;
}

export interface ChampionCombatProfile{
  permanentAttackSpeedRatio:number;
  bonusAttackSpeedScalar:number;
  totalAttackSpeedMultiplier:number;
  attackSpeedCap:number|null;
  attackRangeBonus:number;
  basicAttackDamageMultiplier:number;
  basicAttackResourceCost:number;
  onHits:OnHitEffect[];
  autoProcs:AutoProcEffect[];
  abilityDebuffs:Partial<Record<AbilitySlot,TargetDebuffEffect>>;
  abilityModifiers:Partial<Record<AbilitySlot,AbilityStateModifier>>;
  modelledEffects:string[];
  unmodelledEffects:string[];
  mechanicKinds:ChampionMechanicKind[];
  notes:string[];
}

type Ranks=Partial<Record<AbilitySlot,number>>;
type Context={abilityPower:number;bonusAttackDamage?:number;level?:number};
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
  autoProcs:[],
  abilityDebuffs:{},
  abilityModifiers:{},
  modelledEffects:[],
  unmodelledEffects:[],
  mechanicKinds:[],
  notes:[],
});

/**
 * Champion mechanics registry.
 *
 * Generic spell formula ingestion stays in abilities.ts. This registry handles
 * fight state that raw spell data cannot infer: an active weapon, stacks already
 * held, a mark already on the target, an empowered form, etc. Every state is
 * either deterministic or visibly PARTIAL. Unsupported mechanics never become
 * a plausible-looking zero or guessed multiplier.
 */
const REGISTRY:RegistryEntry[]=[
  {
    aliases:['kogmaw'],
    options:[{
      id:'KOG_W',label:'W ACTIVE',group:'kog-stance',support:'PARTIAL',
      mechanics:['MAX_HEALTH','EMPOWERED_AUTO','RANGE'],
      detail:'Bio-Arcane Barrage: max-health magic on-hit + bonus range; 8s expiry is a timing caveat',
    }],
    apply:applyKogMaw,
  },
  {
    aliases:['jinx'],
    options:[
      {id:'JINX_POWPOW_1',label:'POW-POW · 1 STACK',group:'jinx-weapon',support:'PARTIAL',mechanics:['STACK','STEROID'],detail:'Starts at one Rev’d Up stack; later attacks should build more stacks'},
      {id:'JINX_POWPOW_2',label:'POW-POW · 2 STACKS',group:'jinx-weapon',support:'PARTIAL',mechanics:['STACK','STEROID'],detail:'Starts at two Rev’d Up stacks; the next attack should reach full stacks'},
      {id:'JINX_POWPOW_3',label:'POW-POW · 3 STACKS',group:'jinx-weapon',support:'EXACT',mechanics:['STACK','STEROID'],detail:'Minigun already at full Rev’d Up attack speed'},
      {id:'JINX_FISHBONES',label:'FISHBONES',group:'jinx-weapon',support:'EXACT',mechanics:['TRANSFORMATION','EMPOWERED_AUTO','RANGE','RESOURCE'],detail:'110% AD rockets, +range, 20 mana/shot, reduced bonus-AS scaling'},
      {id:'JINX_EXCITED_1',label:'GET EXCITED · 1',group:'jinx-excited',support:'PARTIAL',mechanics:['STACK','STEROID','RESET'],detail:'One passive stack: attack speed included; expiry and movement speed are timing gaps'},
      {id:'JINX_EXCITED_2',label:'GET EXCITED · 2',group:'jinx-excited',support:'PARTIAL',mechanics:['STACK','STEROID','RESET'],detail:'Two passive stacks: attack speed included; expiry and movement speed are timing gaps'},
      {id:'JINX_EXCITED_3',label:'GET EXCITED · 3',group:'jinx-excited',support:'PARTIAL',mechanics:['STACK','STEROID','RESET'],detail:'Three passive stacks: attack speed included; expiry and movement speed are timing gaps'},
      {id:'JINX_EXCITED_4',label:'GET EXCITED · 4',group:'jinx-excited',support:'PARTIAL',mechanics:['STACK','STEROID','RESET'],detail:'Four passive stacks: attack speed included; expiry and movement speed are timing gaps'},
      {id:'JINX_EXCITED_5',label:'GET EXCITED · 5',group:'jinx-excited',support:'PARTIAL',mechanics:['STACK','STEROID','RESET'],detail:'Five-stack cap: attack speed included; expiry and movement speed are timing gaps'},
    ],
    apply:applyJinx,
  },
  {
    aliases:['aphelios'],
    options:[
      {id:'APH_CALIBRUM',label:'CALIBRUM',group:'aphelios-main',support:'EXACT',mechanics:['TRANSFORMATION','RANGE','MARK'],detail:'Main-hand sniper: +100 basic-attack range'},
      {id:'APH_SEVERUM',label:'SEVERUM',group:'aphelios-main',support:'PARTIAL',mechanics:['TRANSFORMATION','HEAL','SHIELD'],detail:'Main-hand pistol: healing/overheal shield needs a healing timeline'},
      {id:'APH_GRAVITUM',label:'GRAVITUM',group:'aphelios-main',support:'PARTIAL',mechanics:['TRANSFORMATION','MARK'],detail:'Main-hand cannon: slow changes spacing, not stationary damage'},
      {id:'APH_INFERNUM',label:'INFERNUM',group:'aphelios-main',support:'EXACT',mechanics:['TRANSFORMATION','EMPOWERED_AUTO'],detail:'Main-hand flamethrower: primary-target basic attack deals 110% AD'},
      {id:'APH_CRESCENDUM',label:'CRESCENDUM',group:'aphelios-main',support:'PARTIAL',mechanics:['TRANSFORMATION','STACK','EMPOWERED_AUTO'],detail:'Main-hand chakram: return distance and mirror-chakram count are stateful'},
    ],
    apply:applyAphelios,
  },
  {
    aliases:['ashe'],
    options:[{
      id:'ASHE_Q',label:'Q ACTIVE',group:'ashe-focus',support:'PARTIAL',
      mechanics:['STEROID','EMPOWERED_AUTO','MULTI_HIT'],
      detail:'Ranger’s Focus: rank-scaled attack speed + flurry damage; expiry remains a timing caveat',
    }],
    apply:applyAshe,
  },
  {
    aliases:['ezreal'],
    options:[
      {id:'EZ_PASSIVE_1',label:'PASSIVE · 1 STACK',group:'ezreal-passive',support:'PARTIAL',mechanics:['STACK','STEROID'],detail:'10% bonus AS; further spell hits and expiry are not yet advanced automatically'},
      {id:'EZ_PASSIVE_2',label:'PASSIVE · 2 STACKS',group:'ezreal-passive',support:'PARTIAL',mechanics:['STACK','STEROID'],detail:'20% bonus AS; further spell hits and expiry are not yet advanced automatically'},
      {id:'EZ_PASSIVE_3',label:'PASSIVE · 3 STACKS',group:'ezreal-passive',support:'PARTIAL',mechanics:['STACK','STEROID'],detail:'30% bonus AS; further spell hits and expiry are not yet advanced automatically'},
      {id:'EZ_PASSIVE_4',label:'PASSIVE · 4 STACKS',group:'ezreal-passive',support:'PARTIAL',mechanics:['STACK','STEROID'],detail:'40% bonus AS; further spell hits and expiry are not yet advanced automatically'},
      {id:'EZ_PASSIVE_5',label:'PASSIVE · 5 STACKS',group:'ezreal-passive',support:'PARTIAL',mechanics:['STACK','STEROID'],detail:'50% bonus AS at start; expiry is not yet removed mid-fight'},
    ],
    apply:applyEzreal,
  },
  {
    aliases:['vayne'],
    options:[
      {id:'VAYNE_W_FRESH',label:'SILVER BOLTS · FRESH',group:'vayne-bolts',support:'PARTIAL',mechanics:['STACK','MAX_HEALTH','EMPOWERED_AUTO'],detail:'Every third basic attack gets W max-HP true damage; ability-applied stacks/minimum damage are explicit gaps'},
      {id:'VAYNE_R',label:'FINAL HOUR ACTIVE',group:'vayne-r',support:'PARTIAL',mechanics:['STEROID','RESET'],detail:'Timed bonus AD/Q cooldown/invisibility layer is registered, not guessed'},
    ],
    apply:applyVayne,
  },
  {
    aliases:['shen'],
    options:[
      {id:'SHEN_Q',label:'Q · BLADE ARRIVED',group:'shen-q',support:'EXACT',mechanics:['EMPOWERED_AUTO','MAX_HEALTH','RANGE'],detail:'Next 3 attacks gain 75 range and rank/AP-scaled max-HP magic damage'},
      {id:'SHEN_Q_THROUGH',label:'Q · PULLED THROUGH CHAMPION',group:'shen-q',support:'PARTIAL',mechanics:['EMPOWERED_AUTO','MAX_HEALTH','RANGE','STEROID'],detail:'Enhanced next-3 damage included; temporary attack-speed window is not yet time-limited'},
      {id:'SHEN_KI_BARRIER_READY',label:'KI BARRIER READY',group:'shen-shield',support:'PARTIAL',mechanics:['SHIELD','RESET'],detail:'Shield timing registered; cast-triggered self shields are not yet scheduled'},
    ],
    apply:applyShen,
  },
  {
    aliases:['hecarim'],
    options:[
      {id:'HEC_Q_1',label:'RAMPAGE · 1 STACK',group:'hec-q',support:'EXACT',mechanics:['STACK','STEROID'],detail:'Q damage amplification + 0.75s base cooldown reduction'},
      {id:'HEC_Q_2',label:'RAMPAGE · 2 STACKS',group:'hec-q',support:'EXACT',mechanics:['STACK','STEROID'],detail:'Q damage amplification + 1.5s base cooldown reduction'},
      {id:'HEC_Q_3',label:'RAMPAGE · 3 STACKS',group:'hec-q',support:'EXACT',mechanics:['STACK','STEROID'],detail:'Q damage amplification + 2.25s base cooldown reduction'},
      {id:'HEC_W_ACTIVE',label:'SPIRIT OF DREAD ACTIVE',group:'hec-w',support:'PARTIAL',mechanics:['HEAL','STEROID'],detail:'Timed resistances/healing require defensive and healing events'},
      {id:'HEC_E_MAX',label:'E · MAX CHARGE',group:'hec-e',support:'PARTIAL',mechanics:['EMPOWERED_AUTO','STEROID'],detail:'Distance-scaled E attack requires movement-state resolution'},
    ],
    apply:applyHecarim,
  },
  {
    aliases:['viego'],
    options:[
      {id:'VIEGO_E_ACTIVE',label:'HARROWED PATH ACTIVE',group:'viego-e',support:'PARTIAL',mechanics:['STEROID','TRANSFORMATION'],detail:'Rank-scaled attack speed included; camouflage/movement remain outside stationary combat'},
      {id:'VIEGO_R_PRIMARY',label:'R · PRIMARY TARGET',group:'viego-r',support:'PARTIAL',mechanics:['EXECUTE','MISSING_HEALTH','RESET'],detail:'Execute state registered; primary/area CommunityDragon variants must be reconciled before activation'},
      {id:'VIEGO_POSSESSION',label:'POSSESSION',group:'viego-form',support:'PARTIAL',mechanics:['TRANSFORMATION','RESET','HEAL'],detail:'Possession swaps champion/items/basic abilities and cannot be represented as a flat stat buff'},
    ],
    apply:applyViego,
  },
  {
    aliases:['taliyah'],
    options:[
      {id:'TALIYAH_Q_FULL',label:'Q · ALL 5 ROCKS HIT',group:'taliyah-q',support:'PARTIAL',mechanics:['MULTI_HIT'],detail:'Multi-hit state registered; importer must prove whether its primary formula is one rock or the full volley before multiplying'},
      {id:'TALIYAH_Q_WORKED',label:'Q · WORKED GROUND BOULDER',group:'taliyah-q',support:'PARTIAL',mechanics:['TRANSFORMATION','MULTI_HIT','RESOURCE'],detail:'Worked Ground variant registered; formula-variant selection remains patch/data-source gated'},
    ],
    apply:applyTaliyah,
  },
  {
    aliases:['vex'],
    options:[
      {id:'VEX_GLOOM_MARK',label:'TARGET HAS GLOOM',group:'vex-gloom',support:'PARTIAL',mechanics:['MARK','RESET'],detail:'Opening-auto Gloom detonation is included; ability consumption and Doom refund are not yet event-linked'},
      {id:'VEX_DOOM_READY',label:'DOOM READY',group:'vex-doom',support:'PARTIAL',mechanics:['RESET'],detail:'Fear/anti-dash control state is tracked but stationary damage does not price crowd control'},
    ],
    apply:applyVex,
  },
  {
    aliases:['xinzhao'],
    options:[
      {id:'XIN_Q_ACTIVE',label:'THREE TALON STRIKE ACTIVE',group:'xin-q',support:'PARTIAL',mechanics:['EMPOWERED_AUTO','RESET','MULTI_HIT'],detail:'Three empowered autos/reset mechanic is registered; numerical constants stay patch-gated while the current kit is validated'},
      {id:'XIN_CHALLENGE',label:'TARGET CHALLENGED',group:'xin-mark',support:'PARTIAL',mechanics:['MARK','DEBUFF'],detail:'Challenge state tracked; current-patch debuff mapping remains patch-gated'},
    ],
    apply:applyXin,
  },
  {
    aliases:['galio'],
    options:[
      {id:'GALIO_PASSIVE_READY',label:'COLOSSAL SMASH READY',group:'galio-passive',support:'PARTIAL',mechanics:['EMPOWERED_AUTO','RESET'],detail:'Modified magic basic attack needs a one-attack damage-type override rather than an additive on-hit'},
      {id:'GALIO_W_SHIELD',label:'W MAGIC SHIELD ACTIVE',group:'galio-shield',support:'PARTIAL',mechanics:['SHIELD'],detail:'Magic-only shielding needs typed shields, not generic effective HP'},
    ],
    apply:applyGalio,
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
  if(!entry){
    profile.unmodelledEffects.push(...activeEffects);
    return profile;
  }

  const active=normaliseGroupedSelection(entry,activeEffects,profile);
  entry.apply(profile,active,ranks,opts);

  const known=new Set([...profile.modelledEffects,...profile.unmodelledEffects]);
  for(const effect of activeEffects)
    if(!known.has(effect)&&!entry.options.some(o=>o.id===effect))
      profile.unmodelledEffects.push(effect);

  const selectedKinds=entry.options.filter(o=>active.has(o.id)).flatMap(o=>o.mechanics);
  profile.mechanicKinds=[...new Set([...profile.mechanicKinds,...selectedKinds])];
  return profile;
}

export function championEffectOptions(championName:string):ChampionEffectOption[]{
  return findEntry(championName)?.options??[];
}

export function supportedChampionMechanics():{
  champion:string;exact:number;partial:number;mechanics:ChampionMechanicKind[];options:ChampionEffectOption[];
}[]{
  return REGISTRY.map(entry=>({
    champion:entry.aliases[0],
    exact:entry.options.filter(o=>o.support==='EXACT').length,
    partial:entry.options.filter(o=>o.support==='PARTIAL').length,
    mechanics:[...new Set(entry.options.flatMap(o=>o.mechanics))],
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
    const apRatio=Math.max(0,opts.abilityPower)*.00015;
    profile.onHits.push({label:`Kog'Maw W rank ${wRank}`,type:'MAGIC',targetMaxHealthRatio:base+apRatio});
    profile.attackRangeBonus=[130,150,170,190,210][wRank-1]??0;
    profile.modelledEffects.push('KOG_W');
    profile.unmodelledEffects.push('KOG_W_DURATION_8S');
    profile.notes.push(`Bio-Arcane Barrage active: +${round((base+apRatio)*100)}% target max-HP magic damage per auto and +${profile.attackRangeBonus} range.`);
    profile.notes.push('Bio-Arcane Barrage lasts 8 seconds. The current state layer does not remove W after 8s inside a longer trade, so 10s results are marked partial.');
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
    const fraction=stacks===1?.5:stacks===2?.75:1;
    profile.permanentAttackSpeedRatio+=full*fraction;
    profile.modelledEffects.push(weapon);
    profile.notes.push(`Pow-Pow starts with ${stacks} Rev’d Up stack${stacks===1?'':'s'}: +${round(full*fraction*100)}% bonus attack speed at Q rank ${qRank}.`);
    if(stacks<3){
      profile.unmodelledEffects.push('JINX_POWPOW_DYNAMIC_STACKING');
      profile.notes.push('Further Pow-Pow attacks should build toward three stacks. Dynamic champion-stat stacking is not yet advanced during the fight, so one/two-stack starts are conservative.');
    }
  }

  const excited=firstActive(active,[
    'JINX_EXCITED_1','JINX_EXCITED_2','JINX_EXCITED_3','JINX_EXCITED_4','JINX_EXCITED_5',
  ]);
  if(excited){
    const stacks=Math.max(1,Math.min(5,Number(excited.slice(-1))||1));
    profile.totalAttackSpeedMultiplier*=1+.25*stacks;
    profile.attackSpeedCap=90;
    profile.modelledEffects.push(excited);
    profile.unmodelledEffects.push(`${excited}_MOVESPEED`,'JINX_EXCITED_DURATION_6S');
    profile.notes.push(`Get Excited x${stacks}: +${25*stacks}% total attack speed is included.`);
    profile.notes.push('Get Excited lasts 6 seconds and has decaying movement speed. The current stationary state layer does not expire/use those movement effects mid-trade, so this state stays partial.');
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
    markPartial(profile,weapon,'Gravitum selected: its slow changes spacing, which the stationary damage race does not yet simulate.');
    return;
  }
  markPartial(profile,weapon,'Crescendum selected: return time depends on distance and mirror-chakram count, so a fixed attack-speed/damage bonus would be misleading.');
}

function applyAshe(profile:ChampionCombatProfile,active:Set<string>,ranks:Ranks,_opts:Context){
  if(!active.has('ASHE_Q'))return;
  const qRank=clampRank(ranks.Q,5);
  if(qRank<=0){
    markPartial(profile,'ASHE_Q','Ranger’s Focus cannot be active because Q is unlearned.');
    return;
  }
  const attackSpeed=[.20,.30,.40,.50,.60][qRank-1]??0;
  const attackDamage=[1.10,1.15,1.20,1.25,1.30][qRank-1]??1;
  profile.permanentAttackSpeedRatio+=attackSpeed;
  profile.basicAttackDamageMultiplier*=attackDamage;
  profile.modelledEffects.push('ASHE_Q');
  profile.unmodelledEffects.push('ASHE_Q_DURATION_6S','ASHE_FROST_SHOT_CRIT_SCALING');
  profile.notes.push(`Ranger’s Focus active: +${round(attackSpeed*100)}% attack speed and ${round(attackDamage*100)}% AD total basic-attack damage at Q rank ${qRank}.`);
  profile.notes.push('Ranger’s Focus lasts 6 seconds; the current state layer does not remove it mid-trade. Frost Shot critical-strike scaling is also still separate.');
}

function applyEzreal(profile:ChampionCombatProfile,active:Set<string>,_ranks:Ranks,_opts:Context){
  const state=firstActive(active,['EZ_PASSIVE_1','EZ_PASSIVE_2','EZ_PASSIVE_3','EZ_PASSIVE_4','EZ_PASSIVE_5']);
  if(!state)return;
  const stacks=Math.max(1,Math.min(5,Number(state.slice(-1))||1));
  profile.permanentAttackSpeedRatio+=.10*stacks;
  profile.modelledEffects.push(state);
  profile.unmodelledEffects.push('EZ_PASSIVE_DURATION_6S');
  profile.notes.push(`Rising Spell Force starts at ${stacks}/5 stacks: +${stacks*10}% bonus attack speed.`);
  if(stacks<5){
    profile.unmodelledEffects.push('EZ_PASSIVE_DYNAMIC_STACKING');
    profile.notes.push('Further spell hits during this simulation do not yet advance Rising Spell Force, so a start below five stacks is conservative.');
  }
  profile.notes.push('Rising Spell Force lasts 6 seconds from a hit/refresh; the current state layer does not yet expire it mid-trade.');
}

function applyVayne(profile:ChampionCombatProfile,active:Set<string>,ranks:Ranks,_opts:Context){
  if(active.has('VAYNE_W_FRESH')){
    const wRank=clampRank(ranks.W,5);
    if(wRank<=0){
      markPartial(profile,'VAYNE_W_FRESH','Silver Bolts cannot proc because W is unlearned.');
    }else{
      const ratio=[.04,.055,.07,.085,.10][wRank-1]??0;
      profile.onHits.push({
        label:`Vayne W rank ${wRank} (auto-only stack model)`,
        type:'TRUE',targetMaxHealthRatio:ratio,everyNthAttack:3,
      });
      profile.modelledEffects.push('VAYNE_W_FRESH');
      profile.unmodelledEffects.push('VAYNE_W_ABILITY_STACKS_AND_MINIMUM');
      profile.notes.push(`Silver Bolts: every third basic attack adds ${round(ratio*100)}% target max-HP true damage from a fresh target.`);
      profile.notes.push('Condemn/other ability-applied Silver Bolts stacks and W’s minimum true-damage floor are not yet in this auto-only stack model, so the state remains PARTIAL.');
    }
  }
  if(active.has('VAYNE_R'))
    markPartial(profile,'VAYNE_R','Final Hour is recorded but not yet applied: timed bonus AD and Tumble cooldown/invisibility need a temporary-state timeline.');
}

function applyShen(profile:ChampionCombatProfile,active:Set<string>,ranks:Ranks,opts:Context){
  const state=firstActive(active,['SHEN_Q','SHEN_Q_THROUGH']);
  if(state){
    const qRank=clampRank(ranks.Q,5);
    if(qRank<=0){
      markPartial(profile,state,'Twilight Assault cannot empower attacks because Q is unlearned.');
    }else{
      const enhanced=state==='SHEN_Q_THROUGH';
      const baseRatio=(enhanced?[.04,.045,.05,.055,.06]:[.02,.025,.03,.035,.04])[qRank-1]??0;
      const apRatio=Math.max(0,opts.abilityPower)*(enhanced?.0002:.00015);
      const level=Math.max(1,Math.min(18,Math.round(opts.level??1)));
      const flat=10+2*Math.min(15,level-1);
      profile.onHits.push({
        label:`Shen Q ${enhanced?'enhanced ':''}attack`,type:'MAGIC',
        flatDamage:flat,targetMaxHealthRatio:baseRatio+apRatio,firstNAttacks:3,
      });
      profile.attackRangeBonus=75;
      profile.modelledEffects.push(state);
      profile.notes.push(`Twilight Assault: the next three attacks each add ${flat} + ${round((baseRatio+apRatio)*100)}% target max-HP magic damage and gain 75 range.`);
      if(enhanced){
        profile.unmodelledEffects.push('SHEN_Q_THROUGH_TEMP_AS');
        profile.notes.push('Blade-through damage is included. The temporary attack-speed bonus belongs only to the empowered window, so it is not applied globally.');
      }
    }
  }
  if(active.has('SHEN_KI_BARRIER_READY'))
    markPartial(profile,'SHEN_KI_BARRIER_READY','Ki Barrier should begin after a qualifying cast, not as permanent opening effective HP. The shield event is registered but not guessed.');
}

function applyHecarim(profile:ChampionCombatProfile,active:Set<string>,_ranks:Ranks,opts:Context){
  const state=firstActive(active,['HEC_Q_1','HEC_Q_2','HEC_Q_3']);
  if(state){
    const stacks=Math.max(1,Math.min(3,Number(state.slice(-1))||1));
    const perStack=.03+.04*(Math.max(0,opts.bonusAttackDamage??0)/100);
    profile.abilityModifiers.Q={
      damageMultiplier:1+perStack*stacks,
      cooldownFlatReduction:.75*stacks,
      note:`Rampage starts at ${stacks}/3 stacks.`,
    };
    profile.modelledEffects.push(state);
    profile.notes.push(`Rampage ${stacks}/3: Q damage ×${round(1+perStack*stacks)} and ${round(.75*stacks)}s removed from base Q cooldown before haste.`);
  }
  if(active.has('HEC_W_ACTIVE'))
    markPartial(profile,'HEC_W_ACTIVE','Spirit of Dread is active, but timed resistances and healing-from-damage require defensive/healing events rather than a permanent stat injection.');
  if(active.has('HEC_E_MAX'))
    markPartial(profile,'HEC_E_MAX','Devastating Charge max-distance damage depends on movement time. The state is registered but not converted into a guessed multiplier.');
}

function applyViego(profile:ChampionCombatProfile,active:Set<string>,ranks:Ranks,_opts:Context){
  const qRank=clampRank(ranks.Q,5);
  if(qRank>0){
    const ratio=[.02,.03,.04,.05,.06][qRank-1]??0;
    const floor=[10,15,20,25,30][qRank-1]??0;
    profile.onHits.push({
      label:`Viego Q passive rank ${qRank}`,type:'PHYSICAL',
      targetCurrentHealthRatio:ratio,minimumDamage:floor,
    });
    profile.modelledEffects.push('VIEGO_Q_CURRENT_HP_ON_HIT');
    profile.unmodelledEffects.push('VIEGO_Q_CRIT_SCALING_AND_DOUBLE_STRIKE');
    profile.notes.push(`Blade of the Ruined King passive baseline: ${round(ratio*100)}% current-HP physical on-hit, minimum ${floor}. Crit scaling and the marked-target double strike remain separate.`);
  }

  if(active.has('VIEGO_E_ACTIVE')){
    const eRank=clampRank(ranks.E,5);
    if(eRank<=0)markPartial(profile,'VIEGO_E_ACTIVE','Harrowed Path cannot be active because E is unlearned.');
    else{
      const bonus=[.30,.35,.40,.45,.50][eRank-1]??0;
      profile.permanentAttackSpeedRatio+=bonus;
      profile.modelledEffects.push('VIEGO_E_ACTIVE');
      profile.unmodelledEffects.push('VIEGO_E_CAMOUFLAGE_MOVESPEED');
      profile.notes.push(`Harrowed Path rank ${eRank}: +${round(bonus*100)}% bonus attack speed is included; camouflage and movement speed are not.`);
    }
  }
  if(active.has('VIEGO_R_PRIMARY'))
    markPartial(profile,'VIEGO_R_PRIMARY','Heartbreaker execute stays PARTIAL until the importer identifies primary-target and area-damage variants separately; adding another missing-health component now could double count CommunityDragon output.');
  if(active.has('VIEGO_POSSESSION'))
    markPartial(profile,'VIEGO_POSSESSION','Possession swaps champion stats, items and Q/W/E while retaining Viego R. That requires a full actor transformation, not a flat modifier.');
}

function applyTaliyah(profile:ChampionCombatProfile,active:Set<string>,_ranks:Ranks,_opts:Context){
  if(active.has('TALIYAH_Q_FULL'))
    markPartial(profile,'TALIYAH_Q_FULL','Five-rock Threaded Volley is registered as MULTI_HIT. The importer must identify whether the resolved primary formula represents one rock or the full volley before a multiplier can be applied safely.');
  if(active.has('TALIYAH_Q_WORKED'))
    markPartial(profile,'TALIYAH_Q_WORKED','Worked Ground is registered as a transformed Q state. Damage/cost/cooldown variant selection is held back until the source formula is tagged unambiguously.');
}

function applyVex(profile:ChampionCombatProfile,active:Set<string>,_ranks:Ranks,opts:Context){
  if(active.has('VEX_GLOOM_MARK')){
    const level=Math.max(1,Math.min(18,Math.round(opts.level??1)));
    const base=scaleLevel(40,150,level);
    const damage=base+.25*Math.max(0,opts.abilityPower);
    profile.autoProcs.push({
      label:'Vex Gloom opening auto',procAtAuto:1,
      damage:{label:'Gloom detonation',type:'MAGIC',flatDamage:damage},
    });
    profile.modelledEffects.push('VEX_GLOOM_MARK');
    profile.unmodelledEffects.push('VEX_GLOOM_ABILITY_CONSUMPTION','VEX_GLOOM_DOOM_REFUND');
    profile.notes.push(`Gloom mark: an opening basic attack adds ${round(damage)} magic damage at this level/AP. A basic ability can also consume the mark, and that event ordering is still PARTIAL.`);
  }
  if(active.has('VEX_DOOM_READY'))
    markPartial(profile,'VEX_DOOM_READY','Doom ready is control, not direct bonus damage. Fear/knockdown and cooldown state need the crowd-control timeline.');
}

function applyXin(profile:ChampionCombatProfile,active:Set<string>,_ranks:Ranks,_opts:Context){
  if(active.has('XIN_Q_ACTIVE'))
    markPartial(profile,'XIN_Q_ACTIVE','Three Talon Strike is registered as an empowered-auto/reset mechanic. Numerical constants are patch-gated until the current kit data is validated.');
  if(active.has('XIN_CHALLENGE'))
    markPartial(profile,'XIN_CHALLENGE','Challenge is registered as a mark/debuff state. Its current-patch mapping is patch-gated rather than inferred from an older kit.');
}

function applyGalio(profile:ChampionCombatProfile,active:Set<string>,_ranks:Ranks,_opts:Context){
  if(active.has('GALIO_PASSIVE_READY'))
    markPartial(profile,'GALIO_PASSIVE_READY','Colossal Smash is a modified magic basic attack. A generic additive on-hit would double count the normal attack, so no fake number is applied.');
  if(active.has('GALIO_W_SHIELD'))
    markPartial(profile,'GALIO_W_SHIELD','Shield of Durand is a magic-only shield. The current target shield input is untyped, so treating it as universal effective HP would overstate physical durability.');
}

function normaliseGroupedSelection(
  entry:RegistryEntry,
  selected:string[],
  profile:ChampionCombatProfile,
):Set<string>{
  const active=new Set(selected.filter(id=>entry.options.some(o=>o.id===id)));
  const groups=new Map<string,string[]>();
  for(const option of entry.options){
    if(!option.group||!active.has(option.id))continue;
    const list=groups.get(option.group)??[];
    list.push(option.id);groups.set(option.group,list);
  }
  for(const [group,ids] of groups){
    if(ids.length<=1)continue;
    const latest=[...selected].reverse().find(id=>ids.includes(id))??ids[ids.length-1];
    for(const id of ids)if(id!==latest)active.delete(id);
    profile.unmodelledEffects.push(`CONFLICT_${group.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}`);
    profile.notes.push(`Conflicting ${group} states were selected. Only the most recently selected state (${latest}) was applied.`);
  }
  return active;
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

const scaleLevel=(min:number,max:number,level:number)=>
  min+((Math.max(1,Math.min(18,Math.round(level)))-1)/17)*(max-min);
const normalise=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
const round=(n:number)=>Math.round(n*100)/100;