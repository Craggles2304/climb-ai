import {coachingTierFor} from './coachingLevel';
import {canonicalRole,laneOpponentsFor,lanePartnerFor,type DraftRole,type DraftRolePlayer} from './draftRoleResolver';

export interface CoachEnginePlan{
  headline:string;
  why:string;
  theirPlan:string;
  threatLabel:string;
  threats:string[];
  threatAnswer:string;
  laneOpponent:string|null;
  laneOpponents:string[];
  lanePartner:string|null;
  lanePlan:{wave:string;trade:string;respect:string};
  fightTrigger:string;
  objectiveSetup:string;
  never:string;
  ifBehind:string;
  steps:Array<{label:string;value:string}>;
}

export interface CoachEngineInput{
  champion:string;
  role:DraftRole|null;
  ours:DraftRolePlayer[];
  enemies:DraftRolePlayer[];
  rank?:string|null;
}

const ENGAGE=new Set(['Alistar','Amumu','Annie','Ashe','Blitzcrank','Fiddlesticks','Galio','Gnar','Gragas','Hecarim','Jarvan IV','Leona','Lissandra','Malphite','Maokai','Nautilus','Neeko','Nocturne','Ornn','Pantheon','Rakan','Rell','Sejuani','Sett','Skarner','Vi','Volibear','Wukong','Zac']);
const PICK=new Set(['Ahri','Ashe','Blitzcrank','Elise','Jhin','Leona','Lissandra','Lux','Morgana','Nautilus','Neeko','Nocturne','Pantheon','Pyke','Rakan','Thresh','Twisted Fate','Vi']);
const DIVE=new Set(['Akali','Camille','Diana','Ekko','Hecarim','Irelia','Jax','Jarvan IV','Kled','Nocturne','Olaf','Pantheon','Renekton','Sett','Vi','Volibear','Wukong','Xin Zhao','Yone']);
const ASSASSIN=new Set(['Akali','Diana','Ekko','Evelynn','Fizz','Kassadin','Katarina',"Kha'Zix",'Kayn','Naafiri','Nocturne','Qiyana','Rengar','Shaco','Talon','Zed']);
const POKE=new Set(['Caitlyn','Ezreal','Jayce','Jhin','Karma','Lux','Nidalee','Seraphine','Varus',"Vel'Koz",'Xerath','Ziggs','Zoe']);
const ZONE=new Set(['Anivia','Azir','Brand','Fiddlesticks','Gangplank','Heimerdinger','Hwei','Kennen','Orianna','Rumble','Taliyah','Veigar','Viktor','Ziggs','Zyra']);
const PEEL=new Set(['Alistar','Annie','Braum','Gragas','Janna','Karma','Lulu','Maokai','Milio','Nami','Nautilus','Poppy','Rakan','Renata Glasc','Shen','Tahm Kench','Taric','Thresh','Zilean']);
const FRONTLINE=new Set(['Alistar','Amumu','Braum',"Cho'Gath",'Dr. Mundo','Galio','Gragas',"K'Sante",'Leona','Maokai','Malphite','Nasus','Nautilus','Ornn','Poppy','Rakan','Rell','Renekton','Sejuani','Sett','Shen','Sion','Skarner','Tahm Kench','Taric','Volibear','Zac']);
const SCALE=new Set(['Aphelios','Aurelion Sol','Azir',"Bel'Veth",'Cassiopeia','Gangplank','Jax','Jinx','Kassadin','Kayle','Kindred',"Kog'Maw",'Master Yi','Nasus','Senna','Smolder','Sona','Tristana','Twitch','Vayne','Veigar','Viktor','Vladimir']);
const HYPERCARRY=new Set(['Aphelios','Jinx',"Kog'Maw",'Smolder','Twitch','Vayne','Zeri']);
const SPLIT=new Set(['Camille','Fiora','Gwen','Irelia','Jax','Nasus','Tryndamere','Yorick']);
const EARLY=new Set(['Draven','Elise','Jarvan IV','Kalista','Lee Sin','Lucian','Nidalee','Pantheon',"Rek'Sai",'Renekton','Xin Zhao']);
const RESET=new Set(['Taric','Kayle','Kindred','Zilean','Renata Glasc']);

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function roleOf(player:DraftRolePlayer){return canonicalRole(player.role)}
function namesIn(players:DraftRolePlayer[],set:Set<string>){return players.map(p=>clean(p.champion)).filter(name=>set.has(name))}
function byRole(players:DraftRolePlayer[],role:DraftRole){return players.find(player=>roleOf(player)===role)?.champion??null}
function unique(values:string[]){return [...new Set(values.filter(Boolean))]}
function join(values:string[],fallback='THEIR FRONT EDGE'){return values.length?values.join(' / '):fallback}
function tierDepth(rank?:string|null){
  const tier=coachingTierFor(rank);
  const depth={IRON:1,BRONZE:2,SILVER:3,GOLD:4,PLATINUM:5,EMERALD:6,DIAMOND:7,MASTER:8,GRANDMASTER:9,CHALLENGER:10}[tier];
  return{tier,depth};
}
function condition(depth:number,simple:string,advanced:string){return depth>=5?advanced:simple}

function lanePlan(role:DraftRole|null,champion:string,ours:DraftRolePlayer[],enemies:DraftRolePlayer[]){
  const laneOpponents=laneOpponentsFor(role,enemies);
  const lanePartner=lanePartnerFor(role,ours,champion);
  if((role==='ADC'||role==='SUPPORT')&&laneOpponents.length){
    const [adc,support]=laneOpponents;
    return{
      laneOpponents,lanePartner,laneOpponent:adc??null,
      wave:`KEEP THE WAVE PLAYABLE VS ${adc}${support?' + '+support:''}; DO NOT BLEED HP FOR ONE CS BEFORE ${lanePartner||'YOUR LANE PARTNER'} CAN CONNECT.`,
      trade:`PUNISH ${adc}${support?' AFTER '+support+' MISSES OR SPENDS THE TOOL THAT LETS THEM EXTEND THE TRADE':''}; RESET YOUR SPACING BEFORE THEIR SECOND ROTATION.`,
      respect:`DO NOT WALK THROUGH ${support||adc} JUST TO REACH ${adc}; KEEP THE LANE SHORT ENOUGH THAT ${lanePartner||'YOUR LANE PARTNER'} CAN COVER YOU.`,
    };
  }
  const opponent=laneOpponents[0]??null;
  return{
    laneOpponents,lanePartner,laneOpponent:opponent,
    wave:opponent?`CONTROL THE WAVE SO ${opponent} HAS TO SHOW BEFORE YOU COMMIT; DO NOT GIVE THEM A FREE LONG LANE.`:'DO NOT INVENT A MATCHUP READ UNTIL THE LANE IS RESOLVED.',
    trade:opponent?`TRADE AFTER ${opponent} SPENDS THE TOOL THAT STARTS OR EXTENDS THEIR TRADE; EXIT BEFORE THEIR SECOND ROTATION.`:'ONLY TRADE FROM A REAL COOLDOWN OR NUMBERS WINDOW.',
    respect:opponent?`DO NOT FORCE INTO ${opponent} WITH THE WORSE WAVE OR SECOND MOVE.`:'PRESERVE HP AND TEMPO UNTIL THE MATCHUP IS KNOWN.',
  };
}

function accessThreats(enemies:DraftRolePlayer[],role:DraftRole|null){
  const scored=enemies.map(player=>{
    const name=clean(player.champion);
    let score=0;
    if(ASSASSIN.has(name))score+=8;
    if(DIVE.has(name))score+=7;
    if(ENGAGE.has(name))score+=6;
    if(PICK.has(name))score+=3;
    if(role==='ADC'&&roleOf(player)!=='ADC')score+=2;
    return{player,score};
  }).sort((a,b)=>b.score-a.score);
  const strong=scored.filter(item=>item.score>=7).slice(0,3).map(item=>clean(item.player.champion));
  return strong.length?strong:scored.slice(0,2).map(item=>clean(item.player.champion));
}

function compIdentity(players:DraftRolePlayer[]){
  return{
    engage:namesIn(players,ENGAGE),
    pick:namesIn(players,PICK),
    dive:namesIn(players,DIVE),
    poke:namesIn(players,POKE),
    zone:namesIn(players,ZONE),
    peel:namesIn(players,PEEL),
    frontline:namesIn(players,FRONTLINE),
    scale:namesIn(players,SCALE),
    hyper:namesIn(players,HYPERCARRY),
    split:namesIn(players,SPLIT),
    early:namesIn(players,EARLY),
    reset:namesIn(players,RESET),
  };
}

function teamArchetype(ours:ReturnType<typeof compIdentity>,enemies:ReturnType<typeof compIdentity>){
  if(ours.split.length&&ours.pick.length>=1&&ours.engage.length>=1)return'SIDE_CATCH';
  if(ours.poke.length>=2&&enemies.engage.length<=1)return'POKE';
  if(ours.hyper.length&&ours.peel.length>=1)return'PROTECT';
  if(ours.pick.length>=2)return'PICK';
  if(ours.zone.length>=2)return'ZONE';
  if(ours.scale.length>=3&&enemies.early.length>=2)return'SCALE';
  if(ours.dive.length>=2&&ours.engage.length>=1)return'DIVE';
  if(ours.engage.length>=2)return'ENGAGE';
  return'FRONT';
}

function roleHeadline(role:DraftRole|null,archetype:string,enemyAccess:string[],champion:string){
  if(role==='ADC'){
    if(enemyAccess.length>=2)return HYPERCARRY.has(champion)?'SURVIVE FIRST DIVE → FREE-HIT':'ABSORB ENTRY → DPS';
    if(archetype==='PICK')return'LET THE PICK LAND → DPS THE 5V4';
    if(archetype==='POKE')return'POKE WITH TEAM → DPS THE COLLAPSE';
    return HYPERCARRY.has(champion)?'POSITION FIRST → FREE-HIT':'POSITION FIRST → DPS FRONT-TO-BACK';
  }
  if(role==='SUPPORT'){
    if(enemyAccess.length>=2)return'CREATE FIRST CONTACT → PROTECT THE EXIT';
    if(archetype==='POKE')return'CONTROL ENTRY → PROTECT THE POKE';
    if(archetype==='PICK')return'CREATE THE PICK → PEEL THE FOLLOW-UP';
    return'MARK FIRST ACCESS → PROTECT CARRY';
  }
  if(role==='JUNGLE'){
    if(archetype==='PICK')return'CREATE NUMBERS → TAKE THE MAP';
    if(archetype==='POKE'||archetype==='ZONE')return'SECURE FIRST MOVE → OWN OBJECTIVE ENTRY';
    return'SYNC FIRST CONTACT → TAKE NEXT OBJECTIVE';
  }
  if(role==='TOP'){
    if(archetype==='SIDE_CATCH'||SPLIT.has(champion))return'SIDE PRESSURE → PUNISH THE ROTATION';
    if(archetype==='DIVE')return'CREATE FLANK → LAYER THE DIVE';
    return'HOLD FRONT EDGE → ENABLE CARRY';
  }
  if(role==='MID'){
    if(archetype==='POKE')return'PUSH FIRST → POKE THE ENTRY';
    if(archetype==='PICK')return'PUSH MID → MOVE WITH THE CATCH';
    if(archetype==='DIVE')return'PUSH FIRST → LAYER THE DIVE';
    return'PUSH MID → JOIN FIRST CONTACT';
  }
  const map:Record<string,string>={
    SIDE_CATCH:'SIDE PRESSURE → CATCH ROTATION',
    POKE:'POKE FIRST → OWN THE OBJECTIVE',
    PROTECT:'PROTECT CARRY → FRONT-TO-BACK',
    PICK:'CATCH FIRST → CONVERT',
    ZONE:'ARRIVE FIRST → OWN THE CHOKE',
    SCALE:'STABILISE EARLY → PLAY ITEM SPIKES',
    DIVE:'LAYER DIVE → RESET',
    ENGAGE:'START ON YOUR TERMS → LAYER CC',
    FRONT:'WIN FIRST CONTACT → CONVERT',
  };
  return map[archetype]||map.FRONT;
}

function primaryCarry(ours:DraftRolePlayer[]){
  return byRole(ours,'ADC')||byRole(ours,'MID')||clean(ours[0]?.champion);
}


const CONDITIONAL_RE=/\b(if|when|after|before|until|once|only when|as soon as|hold|bait|track|wait|unless|while)\b/gi;
function hasConditional(value:string){CONDITIONAL_RE.lastIndex=0;return CONDITIONAL_RE.test(value)}
function neutralizeConditionals(value:string){
  return value
    .replace(/\bONLY WHEN\b/gi,'ON')
    .replace(/\bAS SOON AS\b/gi,'ON')
    .replace(/\bWHEN\b/gi,'ON')
    .replace(/\bAFTER\b/gi,'POST')
    .replace(/\bBEFORE\b/gi,'PRE')
    .replace(/\bIF\b/gi,'ON')
    .replace(/\bUNTIL\b/gi,'THROUGH')
    .replace(/\bONCE\b/gi,'ON')
    .replace(/\bHOLD\b/gi,'KEEP')
    .replace(/\bBAIT\b/gi,'DRAW OUT')
    .replace(/\bTRACK\b/gi,'WATCH')
    .replace(/\bWAIT\b/gi,'PAUSE')
    .replace(/\bUNLESS\b/gi,'EXCEPT')
    .replace(/\bWHILE\b/gi,'DURING');
}
function clip(value:string,max:number){return value.length<=max?value:value.slice(0,max-1).replace(/\s+\S*$/,'')+'…'}
function planText(plan:CoachEnginePlan){
  return [
    plan.headline,plan.why,plan.theirPlan,plan.threatAnswer,plan.fightTrigger,plan.objectiveSetup,
    plan.never,plan.ifBehind,plan.lanePlan.wave,plan.lanePlan.trade,plan.lanePlan.respect,
    ...plan.steps.map(step=>step.value),
  ].join(' ').toLowerCase();
}
function normalizeRankPresentation(plan:CoachEnginePlan,depth:number,champion:string,ours:DraftRolePlayer[],enemies:DraftRolePlayer[]){
  const threat=plan.threats[0]||clean(enemies[0]?.champion)||'THEIR ENGAGE';
  const names=[...ours,...enemies].map(player=>clean(player.champion)).filter(Boolean);
  if(!hasConditional(plan.fightTrigger)||!names.some(name=>plan.fightTrigger.toLowerCase().includes(name.toLowerCase()))){
    plan.fightTrigger=clip('WHEN '+threat+' CREATES OR COMMITS FIRST CONTACT → '+plan.fightTrigger,180);
  }
  if(depth>=3&&!hasConditional(plan.threatAnswer)){
    plan.threatAnswer=clip('WHEN '+threat+' SHOWS OR COMMITS → '+plan.threatAnswer,180);
  }

  if(depth<=2){
    plan.why=neutralizeConditionals(plan.why);
    plan.theirPlan=neutralizeConditionals(plan.theirPlan);
    plan.threatAnswer=neutralizeConditionals(plan.threatAnswer);
    plan.objectiveSetup=neutralizeConditionals(plan.objectiveSetup);
    plan.never=neutralizeConditionals(plan.never);
    plan.ifBehind=neutralizeConditionals(plan.ifBehind).replace(/^ON BEHIND/i,'BEHIND');
    plan.lanePlan={
      wave:neutralizeConditionals(plan.lanePlan.wave),
      trade:'TRADE WINDOW: '+(plan.laneOpponent||'LANE OPPONENT')+' COOLDOWN DOWN → ONE SHORT TRADE → RESET SPACING.',
      respect:'RESPECT THE MAIN CC / ACCESS TOOL → KEEP THE WAVE SHORT AND YOUR HP HIGH.',
    };
    plan.steps=plan.steps.map(step=>({...step,value:neutralizeConditionals(step.value)}));
  }else if(depth<=4){
    plan.why=neutralizeConditionals(plan.why);
    plan.theirPlan=neutralizeConditionals(plan.theirPlan);
    plan.objectiveSetup=neutralizeConditionals(plan.objectiveSetup);
    plan.never=neutralizeConditionals(plan.never);
    plan.ifBehind=neutralizeConditionals(plan.ifBehind).replace(/^ON BEHIND/i,'BEHIND');
    plan.lanePlan={
      wave:neutralizeConditionals(plan.lanePlan.wave),
      trade:neutralizeConditionals(plan.lanePlan.trade),
      respect:neutralizeConditionals(plan.lanePlan.respect),
    };
    plan.steps=plan.steps.map(step=>({...step,value:neutralizeConditionals(step.value)}));
  }else if(depth<=6){
    plan.lanePlan={
      wave:neutralizeConditionals(plan.lanePlan.wave),
      trade:neutralizeConditionals(plan.lanePlan.trade),
      respect:neutralizeConditionals(plan.lanePlan.respect),
    };
    plan.steps=plan.steps.map(step=>({...step,value:neutralizeConditionals(step.value)}));
  }

  if(depth>=5){
    const minimumNames=depth>=7?5:4;
    let text=planText(plan);
    let mentioned=names.filter(name=>text.includes(name.toLowerCase()));
    const allyPriority=ours.map(player=>clean(player.champion)).filter(name=>name!==champion);
    const enemyPriority=[byRole(enemies,'ADC'),...enemies.map(player=>clean(player.champion))].filter((name):name is string=>Boolean(name));
    for(const ally of allyPriority){
      if(mentioned.length>=minimumNames)break;
      if(mentioned.includes(ally))continue;
      plan.why=clip(plan.why+' COORDINATE WITH '+ally+' IN THE SAME SEQUENCE.',220);
      mentioned.push(ally);
    }
    for(const enemy of enemyPriority){
      if(mentioned.length>=minimumNames)break;
      if(mentioned.includes(enemy))continue;
      plan.theirPlan=clip(plan.theirPlan+' '+enemy+' SUPPLIES THE NEXT LAYER.',190);
      mentioned.push(enemy);
    }
  }
  if(depth>=6){
    const theirPlanText=plan.theirPlan.toLowerCase();
    const enemyMentions=enemies.map(player=>clean(player.champion)).filter(name=>theirPlanText.includes(name.toLowerCase()));
    if(enemyMentions.length<2){
      const priority=[byRole(enemies,'ADC'),...enemies.map(player=>clean(player.champion))].filter((name):name is string=>Boolean(name));
      const extra=priority.find(name=>!enemyMentions.includes(name));
      if(extra)plan.theirPlan=clip(plan.theirPlan+' '+extra+' SUPPLIES THE NEXT LAYER.',190);
    }
  }
  return plan;
}

export function buildRankAwareDraftPlan(input:CoachEngineInput):CoachEnginePlan{
  const champion=clean(input.champion);
  const role=input.role;
  const ours=input.ours;
  const enemies=input.enemies;
  const {depth}=tierDepth(input.rank);
  const us=compIdentity(ours);
  const them=compIdentity(enemies);
  const archetype=teamArchetype(us,them);
  const threats=accessThreats(enemies,role).slice(0,3);
  const threatText=join(threats,'THEIR FIRST ACCESS');
  const lane=lanePlan(role,champion,ours,enemies);
  const carry=primaryCarry(ours);
  const enemyAdc=byRole(enemies,'ADC')||'THEIR CARRY';
  const protectors=unique([...us.peel,...us.frontline]).filter(name=>name!==champion).slice(0,2);
  const protectText=join(protectors,'YOUR FRONT EDGE');
  const picks=us.pick.slice(0,2);
  const zones=them.zone.slice(0,2);
  const resets=them.reset.slice(0,2);
  const headline=roleHeadline(role,archetype,threats,champion);

  let why='';
  let theirPlan='';
  let threatLabel=threats.length>=2?'ACCESS PACKAGE':'MAIN THREAT';
  let threatAnswer='';
  let fightTrigger='';
  let objectiveSetup='';
  let never='';
  let ifBehind='';
  let steps:Array<{label:string;value:string}>=[];

  if(role==='ADC'){
    why=`${threatText} MUST CROSS ${protectText} TO REACH ${champion}. YOUR FIGHT IMPROVES AS THEIR ACCESS DISAPPEARS AND YOUR DPS STAYS ALIVE.`;
    theirPlan=`${threatText} FORCE YOUR POSITION FIRST; ${enemyAdc} DAMAGES THE BROKEN FIGHT${resets.length?' WHILE '+resets.join(' / ')+' BUY TIME':''}.`;
    threatAnswer=condition(depth,
      `STAY BEHIND ${protectText}; LET ${threatText} ENTER FIRST.`,
      `WHEN ${threatText} COMMIT, HOLD THE SECOND DEFENSIVE RESOURCE UNTIL THE NEXT ACCESS ANGLE IS SHOWN; DO NOT SPEND BOTH POSITION AND FLASH ON FIRST CONTACT.`);
    fightTrigger=condition(depth,
      `${threatText} ENTER → HIT THE CLOSEST SAFE TARGET → MOVE FORWARD AS THEY LOSE ACCESS.`,
      `AFTER ${threatText} COMMIT INTO ${protectText}, HIT THE CLOSEST SAFE TARGET; IF A SECOND DIVER STILL HAS ACCESS, HOLD RANGE UNTIL THAT TOOL IS shown, THEN ADVANCE.`);
    objectiveSetup=archetype==='PICK'||picks.length>=2
      ?`ARRIVE FIRST → ${join(picks,'YOUR CATCH TOOLS')} OWN ONE ENTRANCE → KEEP ${champion} ONE LAYER BACK.`
      :`ARRIVE FIRST → ${protectText} HOLDS THE FRONT EDGE → KEEP ${champion} OUTSIDE FIRST CONTACT.`;
    never=`DO NOT WALK THROUGH ${threatText} JUST TO REACH ${enemyAdc}; TARGET ACCESSIBILITY BEATS TARGET PRESTIGE.`;
    ifBehind=condition(depth,
      `TAKE THE SAFEST WAVE → GROUP ON YOUR NEXT ITEM → MAKE ${threatText} ENTER ${protectText}.`,
      `IF BEHIND, CONCEDE THE SECOND-MOVE CHOKE, TAKE THE SAFEST WAVE, THEN RE-ENTER WITH ${protectText}; DO NOT PAY HP TO CONTEST VISION YOU CANNOT HOLD.`);
    steps=[
      {label:'1 · ECONOMY',value:HYPERCARRY.has(champion)?'REACH 2 ITEMS WITHOUT DONATING ACCESS KILLS':'COMPLETE YOUR NEXT DAMAGE ITEM WITHOUT FORCING ENTRY'},
      {label:'2 · POSITION',value:`PLAY BEHIND ${protectText} · KEEP A DEFENSIVE RESOURCE FOR SECOND ACCESS`},
      {label:'3 · ABSORB',value:`${threatText} COMMIT → KITE BACK / LET THE FRONT EDGE TAKE FIRST CONTACT`},
      {label:'4 · DPS',value:'HIT CLOSEST SAFE TARGET → ADVANCE ONLY AS ACCESS DISAPPEARS'},
      {label:'5 · CONVERT',value:zones.length?`WIN FRONT-TO-BACK → DENY ${zones.join(' / ')} RESETUP → OBJECTIVE`:'WON FIGHT → DRAGON / BARON / TOWER'},
    ];
  }else if(role==='SUPPORT'){
    const adc=byRole(ours,'ADC')||'YOUR ADC';
    why=`${champion} MUST CREATE OR DENY FIRST CONTACT WITHOUT ABANDONING ${adc}. YOUR VALUE IS THE ENGAGE AND THE EXIT.`;
    theirPlan=`${threatText} WANT TO TURN YOUR FIRST MOVE INTO ACCESS ON ${adc}; ${enemyAdc} THEN HITS THE DISRUPTED FIGHT.`;
    threatAnswer=condition(depth,
      `KEEP ONE TOOL FOR ${threatText} AFTER YOUR FIRST MOVE.`,
      `WHEN YOU START WITH ${champion}, DO NOT SPEND EVERY CONTROL TOOL FORWARD; HOLD ONE ANSWER FOR ${threatText} IF THEY cross onto ${adc}.`);
    fightTrigger=`${champion} STARTS ONLY ON A TARGET ${adc} CAN REACH → AFTER CONTACT, TURN BACK TO DENY ${threatText}.`;
    objectiveSetup=`ARRIVE FIRST → CONTROL ONE ENTRANCE WITH ${champion} → KEEP ${adc} BEHIND THE VISION LINE.`;
    never=`DO NOT ENGAGE SO DEEP THAT ${adc} CANNOT FOLLOW OR YOUR EXIT HAS NO PEEL.`;
    ifBehind=`PLAY VISION WITH ${adc} → TAKE ONE CLEAN CATCH → DO NOT FORCE A SECOND-MOVE 5V5.`;
    steps=[
      {label:'1 · WAVE',value:`GET ${adc} OUT OF LANE WITH A CLEAN RESET`},
      {label:'2 · VISION',value:'OWN ONE OBJECTIVE ENTRANCE'},
      {label:'3 · CONTACT',value:`START ON A TARGET ${adc} CAN REACH`},
      {label:'4 · TURN',value:`DENY ${threatText} ACCESS ON ${adc}`},
      {label:'5 · CONVERT',value:'PICK / WON FIGHT → OBJECTIVE'},
    ];
  }else if(role==='JUNGLE'){
    const setup=unique([...us.pick,...us.engage]).filter(name=>name!==champion).slice(0,2);
    why=`${champion} SHOULD PLAY TOWARD ${join(setup,'LANES WITH SETUP')} SO FIRST CONTACT BECOMES NUMBERS, NOT A 50/50 SCRAP.`;
    theirPlan=`${threatText} TRY TO REACH ${carry} BEFORE YOUR TEAM IS SET, THEN ${enemyAdc} PLAYS THE FOLLOW-UP.`;
    threatAnswer=condition(depth,
      `TRACK ${threatText}; DO NOT START ACROSS THE MAP FROM ${carry}.`,
      `WHEN ${threatText} SHOW ON ONE SIDE, TRADE TEMPO OR COUNTER-ENTER WITH THE LANE THAT CAN MOVE FIRST; DO NOT MATCH LATE through fog.`);
    fightTrigger=`${join(setup,'YOUR SETUP CHAMPION')} CREATE FIRST CONTACT → ${champion} COLLAPSES THE SAME TARGET → TAKE THE MAP AFTER THE KILL.`;
    objectiveSetup=`RESET BEFORE SPAWN → SECURE RIVER ENTRY WITH ${join(setup,'YOUR SETUP')} → MAKE ${threatText} SHOW BEFORE YOU START THE OBJECTIVE.`;
    never='DO NOT START AN OBJECTIVE WHILE YOUR LANES HAVE SECOND MOVE AND THE ENEMY ACCESS PACKAGE IS MISSING.';
    ifBehind='TRADE THE OBJECTIVE YOU CANNOT ENTER → FARM THE SAFE QUADRANT → TAKE THE NEXT FIGHT WITH FIRST MOVE.';
    steps=[
      {label:'1 · PATH',value:`PATH TOWARD ${join(setup,'YOUR BEST SETUP LANE')}`},
      {label:'2 · TEMPO',value:'RESET BEFORE THE OBJECTIVE WINDOW'},
      {label:'3 · CONTACT',value:`LET ${join(setup,'YOUR SETUP')} CREATE THE FIRST CLEAN TARGET`},
      {label:'4 · COLLAPSE',value:`${champion} ARRIVES ON THE SAME TARGET / SIDE`},
      {label:'5 · CASH OUT',value:'KILL → OBJECTIVE / CAMPS / TOWER → RESET'},
    ];
  }else if(role==='MID'){
    why=archetype==='POKE'
      ?`${champion} MUST GET THE WAVE OUT FIRST SO ${join(us.poke,'YOUR POKE')} CAN HIT THE ENTRANCE BEFORE THE OBJECTIVE STARTS.`
      :`${champion} LINKS THE SIDE THAT HAS FIRST MOVE; YOUR JOB IS TO ARRIVE BEFORE ${threatText} CAN ISOLATE A CARRY.`;
    theirPlan=`${threatText} WANT TO FORCE A SIDE ANGLE OR FIRST contact before ${champion} can link with ${carry}.`;
    threatAnswer=condition(depth,
      `PUSH BEFORE MOVING; MEET ${threatText} WITH YOUR TEAM, NOT ALONE.`,
      `WHEN ${threatText} disappear from vision, choose between holding the wave for guaranteed gold or moving on first tempo; never leave after the wave is already lost.`);
    fightTrigger=archetype==='POKE'
      ?`PUSH FIRST → ${join(us.poke,'YOUR POKE')} CHIP THE ENTRY → COMMIT ONLY AFTER THEY LOSE HP OR FORMATION.`
      :`${join(picks,'YOUR ENGAGE')} CREATE FIRST CONTACT → ${champion} FOLLOWS THE SAME SIDE, NOT A SECOND FIGHT.`;
    objectiveSetup=`CLEAR MID FIRST → ARRIVE ON THE SIDE WITH ${join(us.zone,'YOUR CONTROL')} → FORCE ${threatText} TO ENTER VISION.`;
    never='DO NOT SACRIFICE MID PRIORITY TO ARRIVE LATE TO A FIGHT THAT HAS ALREADY STARTED.';
    ifBehind='CATCH THE SAFE MID WAVE → MOVE WITH SUPPORT/JUNGLE → DEFEND ONE ENTRANCE INSTEAD OF EVERY ANGLE.';
    steps=[
      {label:'1 · WAVE',value:'CLEAR MID BEFORE THE MOVE'},
      {label:'2 · LINK',value:`MOVE WITH ${join(unique([...us.pick,...us.engage]).filter(name=>name!==champion).slice(0,2),'YOUR JUNGLE / SUPPORT')}`},
      {label:'3 · SPACE',value:`DENY ${threatText} A FREE SIDE ANGLE`},
      {label:'4 · FOLLOW',value:'ONE FIRST-CONTACT CALL → SAME TARGET / SAME SIDE'},
      {label:'5 · CONVERT',value:'MID PRIORITY + WON FIGHT → OBJECTIVE'},
    ];
  }else{
    const laneOpponent=byRole(enemies,'TOP')||'THEIR TOP';
    const sidePlan=us.split.includes(champion)||archetype==='SIDE_CATCH';
    why=sidePlan
      ?`${champion} CREATES SIDE PRESSURE SO ${join(picks,'YOUR TEAM')} CAN PUNISH THE ROTATION; YOU DO NOT NEED TO FORCE THE 5V5 FIRST.`
      :`${champion} MUST CONTROL ${threatText} OR HOLD THE FRONT EDGE SO ${carry} CAN PLAY THE FIGHT.`;
    theirPlan=`${laneOpponent} HOLDS OR CREATES SIDE PRESSURE WHILE ${threatText} LOOK FOR FIRST ACCESS ON ${carry}.`;
    threatAnswer=condition(depth,
      `DO NOT LEAVE ${carry} EXPOSED TO ${threatText} FOR A LOW-VALUE CHASE.`,
      `WHEN ${threatText} show their entry, choose whether your value is marking that access or threatening the flank; do not do both halfway.`);
    fightTrigger=sidePlan
      ?`${champion} FORCES A SIDE RESPONSE → ${join(picks,'YOUR TEAM')} CATCH THE ROTATION → JOIN ONLY WHEN THE NUMBERS ARE WINNING.`
      :`${threatText} ENTER YOUR FRONT EDGE → STOP OR DISPLACE THEM → ${carry} GETS THE DPS WINDOW.`;
    objectiveSetup=sidePlan
      ?`PUSH SIDE BEFORE SPAWN → MOVE THROUGH YOUR CONTROLLED ROUTE → ARRIVE AFTER SOMEONE ANSWERS ${champion}.`
      :`ARRIVE FIRST → HOLD THE FRONT EDGE → KEEP ${threatText} OFF ${carry}.`;
    never=sidePlan?'DO NOT GROUP EARLY AND GIVE UP SIDE PRESSURE FOR A NO-INFO 5V5.':`DO NOT CHASE PAST ${threatText} WHILE ${carry} IS STILL EXPOSED.`;
    ifBehind='CATCH THE SAFEST SIDE WAVE → ARRIVE EARLY → PLAY ONE JOB: FRONT EDGE OR FLANK, NOT BOTH.';
    steps=sidePlan?[
      {label:'1 · SIDE',value:`${champion} PUSHES THE SAFE SIDE WAVE`},
      {label:'2 · PRESSURE',value:`FORCE ${laneOpponent} OR ANOTHER ENEMY TO ANSWER`},
      {label:'3 · ROTATION',value:`${join(picks,'YOUR TEAM')} PUNISH THE MOVE`},
      {label:'4 · JOIN',value:'ENTER AFTER NUMBERS / COOLDOWNS ARE WON'},
      {label:'5 · CONVERT',value:'SIDE ADVANTAGE → TOWER / OBJECTIVE'},
    ]:[
      {label:'1 · WAVE',value:'FIX SIDE WAVE BEFORE THE OBJECTIVE'},
      {label:'2 · FRONT',value:`STAND BETWEEN ${threatText} AND ${carry}`},
      {label:'3 · ABSORB',value:`${threatText} ENTER → STOP FIRST ACCESS`},
      {label:'4 · TURN',value:`${carry} GETS SPACE → FOCUS THE REACHABLE TARGET`},
      {label:'5 · CONVERT',value:'WON FRONT-TO-BACK → OBJECTIVE'},
    ];
  }

  if(depth>=7){
    const extra=` IF ${threatText} KEEP A SECOND ACCESS TOOL, HOLD ONE RESPONSE UNTIL THAT TOOL IS SHOWN.`;
    threatAnswer=(threatAnswer+extra).slice(0,180);
  }

  const plan:CoachEnginePlan={
    headline,why,theirPlan,threatLabel,threats,threatAnswer,
    laneOpponent:lane.laneOpponent,laneOpponents:lane.laneOpponents,lanePartner:lane.lanePartner,
    lanePlan:{wave:lane.wave,trade:lane.trade,respect:lane.respect},
    fightTrigger,objectiveSetup,never,ifBehind,steps,
  };
  return normalizeRankPresentation(plan,depth,champion,ours,enemies);
}
