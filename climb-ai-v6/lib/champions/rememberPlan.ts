import type {ChampionListEntry} from './ddragon';
import {damageType} from './ddragon';

export type RememberPowerCurve='EARLY'|'MID GAME'|'SCALING';
export type RememberDamageProfile='PHYSICAL-HEAVY'|'MAGIC-HEAVY'|'MIXED DAMAGE'|'UNKNOWN';

export interface RememberResourceTarget{
  kind:'CS'|'FARM'|'MAP';
  label:string;
  headline:string;
  summary:string;
  checkpoints:Array<{minute:number;target:number}>;
}

export interface RememberDraftRead{
  powerCurve:RememberPowerCurve;
  teamShape:string;
  damageProfile:RememberDamageProfile;
  macroPlan:string;
  carryPlan:string;
  threatPlan:string;
  objectiveRoute:string;
}

export interface RememberPlan{
  version:2;
  frozenFromChampSelect:true;
  usesLiveTelemetry:false;
  title:'REMEMBER YOUR PLAN';
  champion:string;
  role:string|null;
  draft:RememberDraftRead;
  winPath:string;
  resourceTarget:RememberResourceTarget;
  playWith:string;
  watch:string;
  fightRule:string;
  objectiveRule:string;
  behindPlan:string;
  statePlans:{ahead:string;even:string;behind:string};
  checks:Array<{minute:5|10|15;title:string;questions:string[]}>;
}

type TeamPlanLike={
  ourIdentity?:string|null;
  teamfight?:{label?:string|null;summary?:string|null}|null;
  roleWinCondition?:{steps?:Array<{key?:string;label?:string;value?:string}>;lossCondition?:string|null}|null;
  ourTeam?:Array<{name?:string|null;role?:string|null}>;
  theirTeam?:Array<{name?:string|null;role?:string|null}>;
  theirWinCondition?:string|null;
  strategyAccess?:{paidStrategy?:boolean|null}|null;
  compositionRead?:{
    damageCore?:string[]|null;
    enemyThreats?:string[]|null;
    enemyDamageCore?:string[]|null;
    firstContact?:string[]|null;
    protectors?:string[]|null;
  }|null;
};

const SCALERS=new Set([
  'Aurelion Sol','Aphelios','Azir','Bel\'Veth','Cassiopeia','Gangplank','Jax','Jinx','Kassadin','Kayle','Kindred','Kog\'Maw','Master Yi','Nasus','Senna','Shyvana','Smolder','Sona','Tristana','Twitch','Vayne','Veigar','Viktor','Vladimir','Yone',
]);
const EARLY=new Set([
  'Darius','Draven','Elise','Jarvan IV','Jayce','Kalista','Kled','Lee Sin','LeBlanc','Lucian','Nidalee','Olaf','Pantheon','Pyke','Rek\'Sai','Renekton','Rumble','Talon','Xin Zhao','Zed',
]);

const RANK_CS:Record<string,number>={
  IRON:5.5,BRONZE:6,SILVER:6.5,GOLD:7,PLATINUM:7.5,EMERALD:7.8,DIAMOND:8,MASTER:8.3,GRANDMASTER:8.5,CHALLENGER:8.7,
};
const RANK_JUNGLE:Record<string,number>={
  IRON:5,BRONZE:5.5,SILVER:6,GOLD:6.2,PLATINUM:6.5,EMERALD:6.8,DIAMOND:7,MASTER:7.2,GRANDMASTER:7.4,CHALLENGER:7.5,
};

export function buildRememberPlan(input:{
  champion:string;
  role?:string|null;
  rank?:string|null;
  teamPlan:TeamPlanLike;
  roster?:Record<string,ChampionListEntry>|null;
}):RememberPlan{
  const role=normalizeRole(input.role);
  const team=input.teamPlan||{};
  const paid=Boolean(team.strategyAccess?.paidStrategy);
  const ourNames=(team.ourTeam||[]).map(p=>String(p?.name||'').trim()).filter(Boolean);
  const powerCurve=powerCurveFor(ourNames,input.roster||null);
  const damageProfile=damageProfileFor(ourNames,input.roster||null);
  const teamShape=shapeLabel(team);
  const steps=Array.isArray(team.roleWinCondition?.steps)?team.roleWinCondition!.steps!:[];
  const allies=(team.ourTeam||[]).map(p=>String(p?.name||'').trim()).filter(Boolean);
  const enemies=(team.theirTeam||[]).map(p=>String(p?.name||'').trim()).filter(Boolean);
  const playWith=mentioned(stepValue(steps,['STAY_WITH','PLAY_WITH','ENABLE','SET_UP']),allies,2)||fallbackPlayWith(role);
  const watch=paid
    ?mentioned(stepValue(steps,['SURVIVE','STOP','ANSWER']),enemies,2)||mentioned(String(team.roleWinCondition?.lossCondition||team.theirWinCondition||''),enemies,2)||firstNames(team.compositionRead?.enemyThreats,2)||'THEIR FIRST CLEAN ENGAGE'
    :'THEIR FIRST CLEAN ENGAGE';
  const carryPlan=carryPlanFor(team,role,paid);
  const threatPlan=threatPlanFor(team,watch,paid);
  const macroPlan=macroPlanFor(teamShape,powerCurve);
  const objectiveRoute=objectiveRouteFor(teamShape,powerCurve);
  const fightRule=fightRuleFor(role,teamShape,watch,playWith);
  const objectiveRule=short(stepValue(steps,['CONVERT','CONTROL']),82)||objectiveRoute;
  const statePlans=statePlansFor(teamShape,powerCurve,role,carryPlan);
  const winPath=winPathFor(role,powerCurve,teamShape,watch,objectiveRoute);

  return{
    version:2,
    frozenFromChampSelect:true,
    usesLiveTelemetry:false,
    title:'REMEMBER YOUR PLAN',
    champion:String(input.champion||'YOU').trim(),
    role,
    draft:{powerCurve,teamShape,damageProfile,macroPlan,carryPlan,threatPlan,objectiveRoute},
    winPath,
    resourceTarget:resourceTargetFor(role,input.rank),
    playWith,
    watch,
    fightRule,
    objectiveRule,
    behindPlan:statePlans.behind,
    statePlans,
    checks:[
      {minute:5,title:'FIRST BOARD READ',questions:[
        'WHO HAS THE FIRST GOLD / ITEM ADVANTAGE?',
        'WHICH LANE HAS USABLE PRIORITY?',
        `IS OUR ${powerCurve} PLAN ON TRACK?`,
      ]},
      {minute:10,title:'WIN-CONDITION CHECK',questions:[
        'WHO IS OUR STRONGEST USABLE CARRY NOW?',
        'WHAT IS THE NEXT OBJECTIVE / WHICH SIDE MATTERS?',
        'WHO IS THEIR MAIN THREAT NOW?',
      ]},
      {minute:15,title:'ADAPT THE PLAN',questions:[
        'WHO SHOULD RECEIVE SAFE WAVES / SOLO XP?',
        'GROUP / SIDE / PICK / STALL — WHICH STATE FAVOURS US?',
        'ORIGINAL PLAN OR RECOVERY PLAN?',
      ]},
    ],
  };
}

function powerCurveFor(names:string[],roster:Record<string,ChampionListEntry>|null):RememberPowerCurve{
  let score=0;
  for(const name of names){
    if(SCALERS.has(name))score+=2;
    if(EARLY.has(name))score-=2;
    const entry=findRoster(name,roster);
    const tags=entry?.tags||[];
    if(tags.includes('Marksman'))score+=.35;
    if(tags.includes('Mage'))score+=.15;
    if(tags.includes('Tank'))score+=.1;
    if(tags.includes('Assassin'))score-=.2;
    if(tags.includes('Fighter'))score-=.1;
  }
  if(score>=3)return'SCALING';
  if(score<=-3)return'EARLY';
  return'MID GAME';
}

function damageProfileFor(names:string[],roster:Record<string,ChampionListEntry>|null):RememberDamageProfile{
  if(!roster)return'UNKNOWN';
  let physical=0,magic=0,mixed=0;
  for(const name of names){
    const entry=findRoster(name,roster);if(!entry)continue;
    const type=damageType(entry.info);
    if(type==='PHYSICAL')physical++;
    else if(type==='MAGIC')magic++;
    else mixed++;
  }
  if(!physical&&!magic&&!mixed)return'UNKNOWN';
  if(physical>=3&&magic===0)return'PHYSICAL-HEAVY';
  if(magic>=3&&physical===0)return'MAGIC-HEAVY';
  return'MIXED DAMAGE';
}

function shapeLabel(team:TeamPlanLike){
  const raw=`${team.ourIdentity||''} ${team.teamfight?.label||''}`.toUpperCase();
  if(raw.includes('SIDE'))return'SIDE PRESSURE';
  if(raw.includes('POKE'))return'POKE';
  if(raw.includes('PICK'))return'PICK';
  if(raw.includes('DIVE'))return'DIVE';
  if(raw.includes('FRONT')||raw.includes('LAYERED'))return'FRONT TO BACK';
  return'CONNECTED 5V5';
}

function macroPlanFor(shape:string,power:RememberPowerCurve){
  if(shape==='SIDE PRESSURE')return'SIDE LANE FIRST → FORCE A RESPONSE → MOVE OR TRADE CROSS-MAP';
  if(shape==='POKE')return'ARRIVE FIRST → TAKE SPACE → LOWER HP → FORCE A BAD ENGAGE';
  if(shape==='PICK')return'DENY VISION → CATCH ONE → PLAY THE 5V4';
  if(shape==='DIVE')return'CREATE PRIORITY → BUILD AN ANGLE → ENTER TOGETHER';
  if(shape==='FRONT TO BACK')return'CONTROL WAVES → ARRIVE GROUPED → PROTECT DAMAGE THROUGH FIRST CONTACT';
  if(power==='SCALING')return'SURVIVE EARLY → FARM CLEAN → FIGHT ON ITEM WINDOWS';
  if(power==='EARLY')return'CREATE EARLY PRIORITY → FORCE NUMBERS → CONVERT BEFORE THEY SCALE';
  return'CREATE FIRST MOVE → STAY CONNECTED → CONVERT CLEAN FIGHTS';
}

function carryPlanFor(team:TeamPlanLike,role:string|null,paid:boolean){
  if(!paid)return role==='SUPPORT'?'ENABLE YOUR MAIN DAMAGE LINE':role==='JUNGLE'?'PLAY TOWARD THE LANE WITH FIRST MOVE':'KEEP YOUR MAIN DAMAGE LINE FUNDED AND CONNECTED';
  const fromGraph=firstNames(team.compositionRead?.damageCore,2);
  if(fromGraph)return`PRIMARY DAMAGE · ${fromGraph}`;
  const picks=team.ourTeam||[];
  const byRole=(wanted:string)=>picks.find(p=>normalizeRole(p?.role)===wanted&&String(p?.name||'').trim())?.name||'';
  const adc=byRole('ADC'),mid=byRole('MID'),top=byRole('TOP');
  const names=[adc,mid,top].filter(Boolean).slice(0,2);
  return names.length?`PRIMARY DAMAGE · ${names.join(' / ')}`:'KEEP THE STRONGEST DAMAGE DEALER FUNDED AND CONNECTED';
}

function threatPlanFor(team:TeamPlanLike,watch:string,paid:boolean){
  if(!paid)return'SCAN THEIR ENGAGE / DIVE BEFORE YOU COMMIT';
  const threat=firstNames(team.compositionRead?.enemyThreats,2)||watch;
  const carry=firstNames(team.compositionRead?.enemyDamageCore,2);
  if(threat&&carry&&threat!==carry)return`ACCESS · ${threat} / DAMAGE · ${carry}`;
  return threat?`MAIN THREAT · ${threat}`:'FIND WHO CAN BREAK YOUR FORMATION FIRST';
}

function objectiveRouteFor(shape:string,power:RememberPowerCurve){
  if(shape==='SIDE PRESSURE')return'SIDE PRESSURE → FORCE RESPONSE → TOWER / BARON CROSS-MAP';
  if(shape==='PICK')return'VISION DENIAL → PICK → DRAGON / BARON';
  if(shape==='POKE')return'ARRIVE FIRST → POKE → FORCE THEM OFF DRAGON / BARON';
  if(shape==='DIVE')return'PRIORITY → ANGLE → ONE COLLAPSE → DRAGON / BARON';
  if(shape==='FRONT TO BACK')return'RESET FIRST → OWN CHOKE → FRONT-TO-BACK → DRAGON / BARON';
  if(power==='EARLY')return'FIRST MOVE → GRUBS / DRAGON → TOWER → DENY SCALE';
  if(power==='SCALING')return'SAFE WAVES → ITEM WINDOW → GROUPED DRAGON / BARON';
  return'FIRST MOVE → CLEAN FIGHT → DRAGON / BARON / TOWER';
}

function resourceTargetFor(role:string|null,rank?:string|null):RememberResourceTarget{
  if(role==='SUPPORT')return{kind:'MAP',label:'MAP TARGET',headline:'SET UP FIRST',summary:'MOVE WITH JUNGLE → VISION → OBJECTIVE',checkpoints:[]};
  const tier=rankTier(rank);
  const base=role==='JUNGLE'?(RANK_JUNGLE[tier]??6.2):(RANK_CS[tier]??7);
  const rate=role==='TOP'?Math.max(5,base-.2):role==='ADC'?base+.2:base;
  const rounded=Math.round(rate*10)/10;
  const checkpoints=[10,15,20].map(minute=>({minute,target:roundFive(rounded*minute)}));
  return{
    kind:role==='JUNGLE'?'FARM':'CS',
    label:role==='JUNGLE'?'FARM TARGET':'CS TARGET',
    headline:`${rounded.toFixed(1)} CS/MIN`,
    summary:checkpoints.map(p=>`${p.target} @${p.minute}`).join(' · '),
    checkpoints,
  };
}

function statePlansFor(shape:string,power:RememberPowerCurve,role:string|null,carryPlan:string){
  const carryCue=short(carryPlan.replace(/^PRIMARY DAMAGE ·\s*/i,''),34)||'YOUR BEST SCALER';
  const ahead=shape==='SIDE PRESSURE'
    ?'PRESS SIDE → FORCE RESPONSE → TAKE CROSS-MAP OBJECTIVE'
    :shape==='POKE'
      ?'ARRIVE FIRST → TAKE SPACE → POKE BEFORE COMMITTING'
      :shape==='PICK'
        ?'DENY VISION → FIND ONE → TAKE THE 5V4 OBJECTIVE'
        :'RESET ON TIME → GROUP FIRST → CONVERT EVERY CLEAN WIN';
  const even=power==='SCALING'
    ?'KEEP FARM CLEAN → GROUP ON TIME → DO NOT FORCE BEFORE YOUR WINDOW'
    :power==='EARLY'
      ?'CREATE FIRST MOVE → FIGHT WITH NUMBERS → CONVERT QUICKLY'
      :'PLAY THE LOCKED PLAN → FIRST MOVE → CLEAN OBJECTIVE FIGHT';
  let behind=power==='SCALING'
    ?`FUNNEL SAFE WAVES / XP INTO ${carryCue} → DEFEND VISION → BUY ITEM WINDOWS`
    :'STOP NEUTRAL 5V5S → CLEAR WAVES → FIND PICK / CROSS-MAP TRADE → BUY TIME';
  if(shape==='SIDE PRESSURE')behind='TRADE SIDES → PRESSURE TOWER → FORCE A RESPONSE → AVOID A NEUTRAL 5V5';
  else if(shape==='PICK')behind='CLEAR WAVES → DENY ONE VISION CORRIDOR → FIND ONE PICK → TAKE THE 5V4';
  else if(shape==='POKE')behind='CLEAR WAVES → HOLD RANGE → POKE BEFORE CONTESTING → DO NOT FACE-CHECK';
  else if(shape==='DIVE')behind='STOP FORCING 5V5 → FIND NUMBERS / FLANK → COLLAPSE ON ONE TARGET';
  else if(shape==='FRONT TO BACK'&&power!=='EARLY')behind=`SAFE WAVES INTO ${carryCue} → DEFEND CHOKES → PEEL DAMAGE → WAIT FOR ITEM WINDOWS`;
  if(role==='ADC'&&shape!=='SIDE PRESSURE')behind='SAFE FARM → STAY WITH PEEL → SURVIVE FIRST CONTACT → SCALE INTO THE NEXT FIGHT';
  return{ahead,even,behind};
}

function winPathFor(role:string|null,power:RememberPowerCurve,shape:string,watch:string,objectiveRoute:string){
  const powerCue=power==='SCALING'?'SCALE':power==='EARLY'?'CREATE EARLY LEAD':'HIT POWER WINDOW';
  const conversion=objectiveRoute.includes('→')?objectiveRoute.split('→').slice(-1)[0]?.trim()||'OBJECTIVE':'OBJECTIVE';
  if(role==='ADC')return`${powerCue} → SURVIVE ${upperShort(watch,28)} → DPS → ${conversion}`;
  if(role==='JUNGLE')return power==='EARLY'?'CLEAR ON TEMPO → CREATE FIRST MOVE → OBJECTIVE SETUP → CONVERT':'FARM TEMPO → PLAY WITH PRIORITY → OBJECTIVE SETUP → CONVERT';
  if(role==='SUPPORT')return`SET VISION → ${shapeAction(shape)} → ENABLE CARRY → ${conversion}`;
  if(role==='TOP'&&shape==='SIDE PRESSURE')return'SIDE PRESSURE → FORCE RESPONSE → MOVE FIRST / TRADE CROSS-MAP';
  if(role==='MID')return`${powerCue} → MID PRIORITY → ${shapeAction(shape)} → ${conversion}`;
  return`${powerCue} → ${shapeAction(shape)} → WIN FIGHT → ${conversion}`;
}

function fightRuleFor(role:string|null,shape:string,watch:string,playWith:string){
  if(role==='ADC')return`SURVIVE ${upperShort(watch,30)} → HIT NEAREST SAFE TARGET`;
  if(role==='SUPPORT')return shape==='DIVE'?`START WITH ${upperShort(playWith,28)} → THEN TURN BACK TO YOUR CARRY`:`PROTECT THE DAMAGE LINE → STOP ${upperShort(watch,28)}`;
  if(role==='JUNGLE')return shape==='DIVE'?'ENTER WITH TEAM → ONE TARGET → DO NOT STAGGER':'ARRIVE FIRST → ONE CALL → CONVERT THE FIGHT';
  if(role==='MID')return shape==='PICK'?'FOG / ANGLE → ONE CARRY → RESET':'PLAY BEHIND FIRST CONTACT → LAYER DAMAGE / CONTROL';
  if(role==='TOP')return shape==='SIDE PRESSURE'?'FORCE RESPONSE → ENTER AFTER FIRST CONTACT':'GIVE THE TEAM A FRONT EDGE → PEEL OR ENGAGE';
  return'STAY CONNECTED → ONE FIRST-CONTACT CALL → SAME FIGHT';
}

function shapeAction(shape:string){
  if(shape==='FRONT TO BACK')return'FRONT TO BACK';
  if(shape==='DIVE')return'DIVE TOGETHER';
  if(shape==='POKE')return'POKE FIRST';
  if(shape==='PICK')return'FIND PICK';
  if(shape==='SIDE PRESSURE')return'CREATE SIDE PRESSURE';
  return'FIGHT CONNECTED';
}

function firstNames(value:string[]|null|undefined,max:number){
  const names=(Array.isArray(value)?value:[]).map(name=>String(name||'').trim()).filter(Boolean).slice(0,max);
  return names.join(' / ');
}
function mentioned(text:string,names:string[],max:number){
  const hits=names.filter(name=>name&&text.toLowerCase().includes(name.toLowerCase())).slice(0,max);
  return hits.join(' / ');
}
function stepValue(steps:Array<{key?:string;label?:string;value?:string}>,keys:string[]){
  const wanted=new Set(keys.map(k=>k.toUpperCase()));
  const hit=steps.find(step=>wanted.has(String(step?.key||step?.label||'').toUpperCase().replace(/\s+/g,'_')));
  return String(hit?.value||'').trim();
}
function fallbackPlayWith(role:string|null){
  if(role==='ADC')return'YOUR PEEL / FRONT LINE';
  if(role==='SUPPORT')return'YOUR JUNGLE + MAIN CARRY';
  if(role==='JUNGLE')return'THE LANE WITH FIRST MOVE';
  return'YOUR FIRST-CONTACT CHAMPION';
}
function normalizeRole(value?:string|null){
  const role=String(value??'').trim().toUpperCase();
  if(role==='BOTTOM'||role==='ADC')return'ADC';
  if(role==='UTILITY'||role==='SUPPORT')return'SUPPORT';
  if(role==='MIDDLE')return'MID';
  return role||null;
}
function rankTier(rank?:string|null){
  const raw=String(rank||'GOLD').trim().toUpperCase();
  return Object.keys(RANK_CS).find(tier=>raw.startsWith(tier))||'GOLD';
}
function findRoster(name:string,roster:Record<string,ChampionListEntry>|null){
  if(!roster)return null;
  const needle=key(name);
  return Object.values(roster).find(entry=>key(entry.name)===needle||key(entry.id)===needle)||null;
}
function key(value:string){return String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'')}
function roundFive(value:number){return Math.max(0,Math.round(value/5)*5)}
function short(value:string,max:number){const text=String(value||'').replace(/\s+/g,' ').trim();return text.length<=max?text:`${text.slice(0,max-1).replace(/\s+\S*$/,'')}…`}
function upperShort(value:string,max:number){return short(value,max).toUpperCase()}
