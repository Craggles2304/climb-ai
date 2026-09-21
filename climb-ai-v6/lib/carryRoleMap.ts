import {canonicalRole,type DraftRole,type DraftRolePlayer} from './draftRoleResolver';

export type DraftCarryRole='PRIMARY_CARRY'|'SECONDARY_CARRY'|'ENABLER'|'THREAT_DENIAL';

export interface DraftCarryCandidate{
  champion:string;
  role:DraftRole|null;
  score:number;
}

export interface DraftCarryMap{
  version:1;
  frozenFromPregame:true;
  usesLiveTelemetry:false;
  primary:DraftCarryCandidate;
  secondary:DraftCarryCandidate|null;
  enemyPrimary:DraftCarryCandidate|null;
  playerRole:DraftCarryRole;
  playerLabel:'PRIMARY CARRY'|'SECONDARY CARRY'|'ENABLER'|'THREAT DENIAL';
  resourceOwner:string;
  playAround:string;
  playerJob:string;
  reason:string;
}

const HYPERCARRY=new Set(['Aphelios','Aurelion Sol','Azir','Cassiopeia','Jinx',"Kog'Maw",'Smolder','Twitch','Vayne','Viktor','Vladimir','Zeri']);
const SCALING_CARRY=new Set(['Aurelion Sol','Azir',"Bel'Veth",'Cassiopeia','Gangplank','Jax','Kassadin','Kayle','Kindred','Master Yi','Nasus','Senna','Tristana','Veigar','Viktor','Vladimir','Yone']);
const SIDE_CARRY=new Set(['Camille','Fiora','Gangplank','Gwen','Irelia','Jax','Kayle','Nasus','Tryndamere','Vayne','Yorick']);
const JUNGLE_CARRY=new Set(["Bel'Veth",'Graves','Karthus','Kindred','Lillia','Master Yi','Nidalee','Nocturne','Shyvana','Viego']);
const BURST_CARRY=new Set(['Akali','Diana','Fizz','Katarina','LeBlanc','Qiyana','Syndra','Talon','Zed']);
const EARLY_CARRY=new Set(['Draven','Jayce','Kalista','Lee Sin','Lucian','Nidalee','Olaf','Pantheon','Renekton',"Rek'Sai",'Rumble','Xin Zhao']);
const PEEL=new Set(['Alistar','Braum','Galio','Gragas','Janna','Karma','Lulu','Maokai','Milio','Nami','Nautilus','Poppy','Rakan','Renata Glasc','Shen','Tahm Kench','Taric','Thresh','Zilean']);
const FRONTLINE=new Set(['Alistar','Amumu','Braum',"Cho'Gath",'Dr. Mundo','Galio','Gragas',"K'Sante",'Leona','Maokai','Malphite','Nautilus','Ornn','Poppy','Rakan','Rell','Sejuani','Sett','Shen','Sion','Skarner','Tahm Kench','Taric','Volibear','Zac']);
const DENIAL=new Set(['Braum','Galio','Gragas','Janna','Lulu','Maokai','Milio','Nautilus','Poppy','Rakan','Renata Glasc','Shen','Tahm Kench','Taric','Thresh','Zilean']);

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function roleOf(player:DraftRolePlayer){return canonicalRole(player.role)}
function clamp(value:number,min=0,max=100){return Math.max(min,Math.min(max,value))}
function roleBase(role:DraftRole|null){
  if(role==='ADC')return 48;
  if(role==='MID')return 35;
  if(role==='JUNGLE')return 29;
  if(role==='TOP')return 27;
  if(role==='SUPPORT')return 8;
  return 20;
}

export function carryScore(player:DraftRolePlayer){
  const champion=clean(player.champion);
  const role=roleOf(player);
  let score=roleBase(role);
  if(HYPERCARRY.has(champion))score+=28;
  if(SCALING_CARRY.has(champion))score+=17;
  if(SIDE_CARRY.has(champion))score+=17;
  if(role==='JUNGLE'&&JUNGLE_CARRY.has(champion))score+=20;
  if(BURST_CARRY.has(champion))score+=11;
  if(EARLY_CARRY.has(champion))score+=8;
  if(PEEL.has(champion))score-=14;
  if(FRONTLINE.has(champion))score-=16;
  if(role==='SUPPORT')score-=8;
  return clamp(score);
}

function ranked(players:DraftRolePlayer[]){
  return players
    .map(player=>({champion:clean(player.champion),role:roleOf(player),score:carryScore(player)}))
    .filter(player=>player.champion)
    .sort((a,b)=>b.score-a.score||a.champion.localeCompare(b.champion));
}

function playerAssignment(local:DraftCarryCandidate,primary:DraftCarryCandidate,secondary:DraftCarryCandidate|null){
  if(local.champion===primary.champion)return'PRIMARY_CARRY' as const;
  if(secondary&&local.champion===secondary.champion&&local.score>=46)return'SECONDARY_CARRY' as const;
  if(DENIAL.has(local.champion)||PEEL.has(local.champion)||FRONTLINE.has(local.champion)||local.role==='SUPPORT')return'THREAT_DENIAL' as const;
  return'ENABLER' as const;
}

function labelFor(role:DraftCarryRole):DraftCarryMap['playerLabel']{
  if(role==='PRIMARY_CARRY')return'PRIMARY CARRY';
  if(role==='SECONDARY_CARRY')return'SECONDARY CARRY';
  if(role==='THREAT_DENIAL')return'THREAT DENIAL';
  return'ENABLER';
}

export function buildDraftCarryMap(input:{
  champion:string;
  ours:DraftRolePlayer[];
  enemies:DraftRolePlayer[];
  mainThreat?:string|null;
}):DraftCarryMap{
  const allyRanked=ranked(input.ours);
  const enemyRanked=ranked(input.enemies);
  const fallback={champion:clean(input.champion)||clean(input.ours[0]?.champion)||'YOU',role:null,score:0};
  const primary=allyRanked[0]??fallback;
  const secondary=allyRanked.find(player=>player.champion!==primary.champion)??null;
  const enemyPrimary=enemyRanked[0]??null;
  const local=allyRanked.find(player=>player.champion.toLowerCase()===clean(input.champion).toLowerCase())??fallback;
  const playerRole=playerAssignment(local,primary,secondary);
  const threat=clean(input.mainThreat)||enemyPrimary?.champion||'THEIR MAIN THREAT';

  let playAround=primary.champion;
  let playerJob='';
  let reason='';

  if(playerRole==='PRIMARY_CARRY'){
    playAround='YOUR SPIKE / YOUR SAFE ACCESS';
    playerJob='TAKE THE SAFEST HIGH-VALUE RESOURCES → ARRIVE ON YOUR SPIKE → STAY ALIVE FOR THE FULL FIGHT';
    reason=primary.champion+' is the highest draft carry-value slot in your composition.';
  }else if(playerRole==='SECONDARY_CARRY'){
    playAround=primary.champion;
    playerJob='KEEP YOUR OWN SPIKE → CONNECT TO '+primary.champion+' WHEN THE FIGHT STARTS → DO NOT START A SECOND FIGHT';
    reason=primary.champion+' is the first resource priority; '+local.champion+' is the next damage condition.';
  }else if(playerRole==='THREAT_DENIAL'){
    playAround=primary.champion+' / DENY '+threat;
    playerJob='KEEP '+primary.champion+' PLAYABLE → HOLD CONTROL / POSITION FOR '+threat+' → DO NOT CHASE AWAY FROM THE CARRY';
    reason=local.champion+' creates more draft value by denying access and enabling '+primary.champion+' than by taking first resource.';
  }else{
    playAround=primary.champion;
    playerJob='CREATE FIRST MOVE / SPACE FOR '+primary.champion+' → TAKE YOUR OWN SAFE RESOURCES WITHOUT BREAKING THEIR WINDOW';
    reason=primary.champion+' has the stronger draft carry claim; '+local.champion+' should connect the map and enable the winning fight.';
  }

  return{
    version:1,
    frozenFromPregame:true,
    usesLiveTelemetry:false,
    primary,
    secondary,
    enemyPrimary,
    playerRole,
    playerLabel:labelFor(playerRole),
    resourceOwner:primary.champion,
    playAround,
    playerJob,
    reason,
  };
}
