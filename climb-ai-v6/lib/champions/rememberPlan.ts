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

export interface RememberPlan{
  version:1;
  frozenFromChampSelect:true;
  usesLiveTelemetry:false;
  title:'REMEMBER YOUR PLAN';
  champion:string;
  role:string|null;
  draft:{
    powerCurve:RememberPowerCurve;
    teamShape:string;
    damageProfile:RememberDamageProfile;
  };
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
  const ourNames=(team.ourTeam||[]).map(p=>String(p?.name||'').trim()).filter(Boolean);
  const powerCurve=powerCurveFor(ourNames,input.roster||null);
  const damageProfile=damageProfileFor(ourNames,input.roster||null);
  const teamShape=shapeLabel(team);
  const steps=Array.isArray(team.roleWinCondition?.steps)?team.roleWinCondition!.steps!:[];
  const allies=(team.ourTeam||[]).map(p=>String(p?.name||'').trim()).filter(Boolean);
  const enemies=(team.theirTeam||[]).map(p=>String(p?.name||'').trim()).filter(Boolean);
  const playWith=mentioned(stepValue(steps,['STAY_WITH','PLAY_WITH','ENABLE','SET_UP']),allies,2)||fallbackPlayWith(role);
  const watch=mentioned(stepValue(steps,['SURVIVE','STOP','ANSWER']),enemies,2)||mentioned(String(team.roleWinCondition?.lossCondition||team.theirWinCondition||''),enemies,2)||'THEIR FIRST CLEAN ENGAGE';
  const fightRule=fightRuleFor(role,teamShape,watch,playWith);
  const objectiveRule=short(stepValue(steps,['CONVERT','CONTROL']),82)||'WIN FIGHT / PICK → TAKE OBJECTIVE → RESET';
  const statePlans=statePlansFor(teamShape,powerCurve,role);
  const winPath=winPathFor(role,powerCurve,teamShape,watch);

  return{
    version:1,
    frozenFromChampSelect:true,
    usesLiveTelemetry:false,
    title:'REMEMBER YOUR PLAN',
    champion:String(input.champion||'YOU').trim(),
    role,
    draft:{powerCurve,teamShape,damageProfile},
    winPath,
    resourceTarget:resourceTargetFor(role,input.rank),
    playWith,
    watch,
    fightRule,
    objectiveRule,
    behindPlan:statePlans.behind,
    statePlans,
    checks:[
      {minute:5,title:'FIRST READ',questions:['WHO HAS THE FIRST USABLE LEAD?','IS OUR ORIGINAL POWER-CURVE PLAN ON TRACK?']},
      {minute:10,title:'MAP READ',questions:['WHO IS STRONGEST NOW?','WHICH SIDE / OBJECTIVE MATTERS NEXT?']},
      {minute:15,title:'RECHECK THE WIN CONDITION',questions:['WHO IS THEIR BIGGEST THREAT NOW?','ORIGINAL PLAN OR BEHIND PLAN?']},
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

function statePlansFor(shape:string,power:RememberPowerCurve,role:string|null){
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
  let behind='SAFE WAVES → DEFEND VISION → GROUP EARLY → BUY TIME';
  if(shape==='SIDE PRESSURE')behind='TRADE SIDES → PRESSURE TOWER → AVOID A NEUTRAL 5V5';
  else if(shape==='PICK')behind='CLEAR WAVES → DENY ONE VISION CORRIDOR → FIND ONE PICK → TAKE THE 5V4';
  else if(shape==='POKE')behind='CLEAR WAVES → HOLD RANGE → POKE BEFORE CONTESTING → DO NOT FACE-CHECK';
  else if(shape==='DIVE')behind='STOP FORCING 5V5 → FIND NUMBERS / FLANK → COLLAPSE ON ONE TARGET';
  else if(shape==='FRONT TO BACK')behind='SAFE WAVES → DEFEND CHOKES → PEEL YOUR DAMAGE → WAIT FOR ITEM WINDOWS';
  if(role==='ADC'&&shape!=='SIDE PRESSURE')behind='SAFE FARM → STAY WITH PEEL → SURVIVE FIRST CONTACT → SCALE INTO THE NEXT FIGHT';
  return{ahead,even,behind};
}

function winPathFor(role:string|null,power:RememberPowerCurve,shape:string,watch:string){
  const powerCue=power==='SCALING'?'SCALE':power==='EARLY'?'CREATE EARLY LEAD':'HIT POWER WINDOW';
  if(role==='ADC')return`${powerCue} → SURVIVE ${upperShort(watch,28)} → DPS → OBJECTIVE`;
  if(role==='JUNGLE')return'CLEAR ON TEMPO → FIRST MOVE → OBJECTIVE SETUP → CONVERT';
  if(role==='SUPPORT')return`SET VISION → ${shapeAction(shape)} → ENABLE CARRY → OBJECTIVE`;
  if(role==='TOP'&&shape==='SIDE PRESSURE')return'SIDE PRESSURE → FORCE RESPONSE → MOVE FIRST → OBJECTIVE';
  if(role==='MID')return`${powerCue} → MID PRIORITY → ${shapeAction(shape)} → OBJECTIVE`;
  return`${powerCue} → ${shapeAction(shape)} → WIN FIGHT → OBJECTIVE`;
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
