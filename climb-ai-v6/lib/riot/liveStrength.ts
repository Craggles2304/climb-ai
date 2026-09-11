import type {LiveTelemetryPlayer,LiveTelemetrySnapshot} from './liveTelemetry';

export type StrengthVerdict='YOU_STRONGER'|'EVEN'|'THEM_STRONGER';

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

export interface StrengthTimeline{
  points:StrengthPoint[];
  strongestWindow:StrengthPoint|null;
  weakestWindow:StrengthPoint|null;
  modelNote:string;
}

const MODEL_NOTE='Visible-state power model only: level, visible item value and death/respawn state. Unspent gold is excluded. It does not infer hidden enemy cooldowns, unseen information or issue live tactical instructions.';

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
  return {points,strongestWindow,weakestWindow,modelNote:MODEL_NOTE};
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
  // Fail transparently to the enemy whose visible level/item state is closest,
  // rather than pretending we know a lane assignment that Riot did not expose.
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
  return 'No exact lane match was exposed, so CLIMB used the closest visible enemy state and labels this comparison accordingly.';
}

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const round=(n:number)=>Math.round(n*10)/10;
const roundTime=(n:number)=>Math.round(Math.max(0,n)*10)/10;
