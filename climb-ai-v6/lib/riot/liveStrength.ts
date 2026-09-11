import type {LiveTelemetryPlayer,LiveTelemetrySnapshot} from './liveTelemetry';

export type StrengthVerdict='YOU_STRONGER'|'EVEN'|'THEM_STRONGER';
export type OpportunityType='ALL_IN_CANDIDATE'|'PRESSURE_WINDOW'|'CAUTION_WINDOW';

export interface StrengthPoint{
  atSeconds:number;
  verdict:StrengthVerdict;
  score:number;
  opponent:string|null;
  comparisonReason:string;
  you:{level:number;itemGold:number;dead:boolean};
  them:{level:number;itemGold:number;dead:boolean}|null;
  reasons:string[];
  confidence:'VISIBLE_STATE';
}

export interface OpportunityWindow{
  atSeconds:number;
  type:OpportunityType;
  opponent:string;
  confidence:'HIGH'|'MEDIUM';
  score:number;
  headline:string;
  detail:string;
  evidence:{
    levelDelta:number;
    itemGoldDelta:number;
    currentGold:number;
    healthPct:number|null;
    manaPct:number|null;
  };
  limitation:string;
}

export interface StrengthTimeline{
  points:StrengthPoint[];
  opportunities:OpportunityWindow[];
  strongestWindow:StrengthPoint|null;
  weakestWindow:StrengthPoint|null;
  modelNote:string;
}

const MODEL_NOTE='Visible-state power model only: level, visible item value, your current health/mana and death/respawn state. Enemy unspent gold, exact proximity and hidden cooldowns are excluded, so all-in windows are candidates rather than guaranteed kills.';

export function strengthPoint(snapshot:LiveTelemetrySnapshot):StrengthPoint{
  const me=findMe(snapshot);
  const opponent=chooseOpponent(snapshot,me);
  if(!me||!opponent){
    return {
      atSeconds:roundTime(snapshot.gameTime),verdict:'EVEN',score:0,opponent:null,
      comparisonReason:'No reliable opposing comparison target was available in this snapshot.',
      you:{level:me?.level??snapshot.active.level,itemGold:me?.itemGold??0,dead:me?.isDead??false},
      them:null,reasons:['Not enough visible state for a reliable strength comparison.'],confidence:'VISIBLE_STATE',
    };
  }

  const levelDelta=me.level-opponent.level;
  const goldDelta=me.itemGold-opponent.itemGold;
  const deathSwing=(me.isDead?-40:0)+(opponent.isDead?40:0);
  const score=round(clamp(levelDelta*12+goldDelta/125+deathSwing,-100,100));
  const verdict:StrengthVerdict=score>=8?'YOU_STRONGER':score<=-8?'THEM_STRONGER':'EVEN';
  const reasons:string[]=[];
  if(levelDelta!==0)reasons.push(`${levelDelta>0?'+':''}${levelDelta} level${Math.abs(levelDelta)===1?'':'s'}`);
  if(Math.abs(goldDelta)>=150)reasons.push(`${goldDelta>0?'+':''}${Math.round(goldDelta)}g in visible items`);
  if(me.isDead)reasons.push(`you are dead${me.respawnTimer>0?` (${Math.ceil(me.respawnTimer)}s respawn)`:''}`);
  if(opponent.isDead)reasons.push(`${opponent.championName} is dead${opponent.respawnTimer>0?` (${Math.ceil(opponent.respawnTimer)}s respawn)`:''}`);
  if(!reasons.length)reasons.push('Levels and visible item value are very close.');

  return {
    atSeconds:roundTime(snapshot.gameTime),verdict,score,opponent:opponent.championName,
    comparisonReason:comparisonReason(snapshot,opponent),
    you:{level:me.level,itemGold:me.itemGold,dead:me.isDead},
    them:{level:opponent.level,itemGold:opponent.itemGold,dead:opponent.isDead},
    reasons,confidence:'VISIBLE_STATE',
  };
}

export function buildStrengthTimeline(snapshots:LiveTelemetrySnapshot[]):StrengthTimeline{
  const ordered=[...snapshots].sort((a,b)=>a.gameTime-b.gameTime);
  const raw=ordered.map(strengthPoint);
  const points:StrengthPoint[]=[];
  let previous:StrengthPoint|null=null;
  for(const point of raw){
    const meaningful=!previous
      ||point.verdict!==previous.verdict
      ||Math.abs(point.score-previous.score)>=12
      ||point.you.level!==previous.you.level
      ||point.them?.level!==previous.them?.level
      ||Math.abs(point.you.itemGold-previous.you.itemGold)>=700
      ||Math.abs((point.them?.itemGold??0)-(previous.them?.itemGold??0))>=700
      ||point.you.dead!==previous.you.dead
      ||point.them?.dead!==previous.them?.dead;
    if(meaningful){points.push(point);previous=point}
  }
  const comparable=raw.filter(point=>point.them!==null);
  const strongestWindow=comparable.length?comparable.reduce((a,b)=>b.score>a.score?b:a):null;
  const weakestWindow=comparable.length?comparable.reduce((a,b)=>b.score<a.score?b:a):null;
  const opportunities=buildOpportunities(ordered,raw);
  return {points,opportunities,strongestWindow,weakestWindow,modelNote:MODEL_NOTE};
}

function buildOpportunities(snapshots:LiveTelemetrySnapshot[],points:StrengthPoint[]):OpportunityWindow[]{
  const windows:OpportunityWindow[]=[];
  let lastKey='';
  let lastAt=-999;
  for(let i=0;i<snapshots.length;i++){
    const snapshot=snapshots[i];
    const point=points[i];
    if(!point?.them||!point.opponent||point.you.dead||point.them.dead)continue;
    if(point.score>-12&&point.score<12)continue;
    const me=findMe(snapshot);
    const opponent=chooseOpponent(snapshot,me);
    if(!me||!opponent)continue;
    const levelDelta=me.level-opponent.level;
    const itemGoldDelta=me.itemGold-opponent.itemGold;
    const healthPct=ratio(snapshot.active.stats.currentHealth,snapshot.active.stats.maxHealth);
    const manaPct=ratio(snapshot.active.stats.currentMana,snapshot.active.stats.maxMana);
    const healthy=healthPct===null||healthPct>=0.6;
    const resourced=manaPct===null||manaPct>=0.3;
    const type:OpportunityType=point.score<=-12?'CAUTION_WINDOW':point.score>=24&&healthy&&resourced?'ALL_IN_CANDIDATE':'PRESSURE_WINDOW';
    const confidence:'HIGH'|'MEDIUM'=Math.abs(point.score)>=24&&healthy&&resourced?'HIGH':'MEDIUM';
    const key=`${type}:${point.opponent}`;
    if(key===lastKey&&point.atSeconds-lastAt<45)continue;
    lastKey=key;lastAt=point.atSeconds;
    const advantage=describeDelta(levelDelta,itemGoldDelta);
    const headline=type==='CAUTION_WINDOW'
      ?`Enemy-favoured window vs ${point.opponent}`
      :type==='ALL_IN_CANDIDATE'
        ?`Possible all-in window vs ${point.opponent}`
        :`Power advantage vs ${point.opponent}`;
    const detail=type==='CAUTION_WINDOW'
      ?`${point.opponent} held the stronger visible state (${advantage}). This was a poor default fight unless another advantage changed the situation.`
      :`${advantage}. If ${point.opponent} was in a reachable fight, this was a ${type==='ALL_IN_CANDIDATE'?'strong all-in candidate':'good pressure window'}.`;
    windows.push({
      atSeconds:point.atSeconds,type,opponent:point.opponent,confidence,score:point.score,headline,detail,
      evidence:{levelDelta,itemGoldDelta,currentGold:Math.round(snapshot.active.currentGold),healthPct,manaPct},
      limitation:'Riot Live Client Data does not expose enemy pocket gold, exact champion proximity or hidden cooldowns. This identifies a power window, not a guaranteed kill.',
    });
  }
  return windows.slice(0,16);
}

function describeDelta(levelDelta:number,itemGoldDelta:number){
  const pieces:string[]=[];
  if(levelDelta)pieces.push(`${levelDelta>0?'+':''}${levelDelta} level${Math.abs(levelDelta)===1?'':'s'}`);
  if(Math.abs(itemGoldDelta)>=100)pieces.push(`${itemGoldDelta>0?'+':''}${Math.round(itemGoldDelta)}g visible item value`);
  return pieces.length?pieces.join(' and '):'visible combat state was close';
}

function findMe(snapshot:LiveTelemetrySnapshot):LiveTelemetryPlayer|null{
  const riotId=snapshot.active.riotId;
  const summoner=snapshot.active.summonerName;
  return snapshot.players.find(player=>Boolean(riotId&&player.riotId===riotId))
    ??snapshot.players.find(player=>Boolean(summoner&&player.summonerName===summoner))
    ??snapshot.players.find(player=>player.championName===snapshot.active.championName&&player.team===snapshot.active.team)
    ??null;
}

function chooseOpponent(snapshot:LiveTelemetrySnapshot,me:LiveTelemetryPlayer|null):LiveTelemetryPlayer|null{
  if(!me)return null;
  const enemies=snapshot.players.filter(player=>player.team!==me.team&&player.team!=='UNKNOWN');
  if(!enemies.length)return null;
  if(me.position){
    const same=enemies.find(player=>player.position&&player.position.toUpperCase()===me.position!.toUpperCase());
    if(same)return same;
  }
  return enemies.reduce((best,current)=>{
    const currentGap=Math.abs(current.level-me.level)*1000+Math.abs(current.itemGold-me.itemGold);
    const bestGap=Math.abs(best.level-me.level)*1000+Math.abs(best.itemGold-me.itemGold);
    return currentGap<bestGap?current:best;
  });
}

function comparisonReason(snapshot:LiveTelemetrySnapshot,opponent:LiveTelemetryPlayer):string{
  const me=findMe(snapshot);
  if(me?.position&&opponent.position&&me.position.toUpperCase()===opponent.position.toUpperCase())
    return `Matched by Riot-exposed position: ${me.position}.`;
  return 'No exact lane match was exposed, so OVERPOWERED used the closest visible enemy state and labels this comparison accordingly.';
}

function ratio(value:number|null,max:number|null){
  if(value===null||max===null||max<=0)return null;
  return round(clamp(value/max,0,1));
}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const round=(n:number)=>Math.round(n*10)/10;
const roundTime=(n:number)=>Math.round(Math.max(0,n)*10)/10;
