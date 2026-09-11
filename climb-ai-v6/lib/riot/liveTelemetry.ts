export type LiveTeam='ORDER'|'CHAOS'|'UNKNOWN';

export interface LiveTelemetryItem{
  itemId:number;
  displayName:string;
  count:number;
  price:number;
}

export interface LiveTelemetryPlayer{
  summonerName:string;
  riotId:string|null;
  championName:string;
  team:LiveTeam;
  level:number;
  position:string|null;
  isDead:boolean;
  respawnTimer:number;
  itemGold:number;
  items:LiveTelemetryItem[];
  scores:{kills:number;deaths:number;assists:number;creepScore:number;wardScore:number};
}

export interface LiveTelemetrySnapshot{
  version:1;
  gameTime:number;
  gameMode:string|null;
  mapName:string|null;
  receivedAt:string;
  active:{
    summonerName:string;
    riotId:string|null;
    championName:string;
    team:LiveTeam;
    level:number;
    position:string|null;
    currentGold:number;
    stats:{
      currentHealth:number|null;
      maxHealth:number|null;
      currentMana:number|null;
      maxMana:number|null;
      attackDamage:number|null;
      attackSpeed:number|null;
      abilityPower:number|null;
      armor:number|null;
      magicResist:number|null;
      moveSpeed:number|null;
    };
  };
  players:LiveTelemetryPlayer[];
  events:LiveTelemetryEvent[];
}

export interface LiveTelemetryEvent{
  id:number|null;
  name:string;
  time:number;
  actor:string|null;
  target:string|null;
  raw:Record<string,unknown>;
}

export function normalizeLiveClientData(input:unknown,receivedAt=new Date().toISOString()):LiveTelemetrySnapshot|null{
  if(!input||typeof input!=='object')return null;
  const root=input as Record<string,any>;
  const gameTime=number(root.gameData?.gameTime,0);
  const allPlayers=Array.isArray(root.allPlayers)?root.allPlayers:[];
  const activeRaw=root.activePlayer&&typeof root.activePlayer==='object'?root.activePlayer:{};
  const activeSummoner=text(activeRaw.summonerName);
  const activeRiotId=riotIdOf(activeRaw);
  const matched=allPlayers.find((p:any)=>samePlayer(p,activeSummoner,activeRiotId))
    ??allPlayers.find((p:any)=>text(p.championName)&&text(p.championName)===text(activeRaw.championName));
  const players=allPlayers.map(normalizePlayer).filter((p:LiveTelemetryPlayer|null):p is LiveTelemetryPlayer=>Boolean(p));
  const me=matched?normalizePlayer(matched):null;
  const stats=activeRaw.championStats&&typeof activeRaw.championStats==='object'?activeRaw.championStats:{};
  const eventsRaw=Array.isArray(root.events?.Events)?root.events.Events:[];

  return {
    version:1,
    gameTime,
    gameMode:text(root.gameData?.gameMode)||null,
    mapName:text(root.gameData?.mapName)||null,
    receivedAt,
    active:{
      summonerName:activeSummoner||me?.summonerName||'',
      riotId:activeRiotId||me?.riotId||null,
      championName:me?.championName||text(activeRaw.championName)||'',
      team:me?.team||'UNKNOWN',
      level:integer(activeRaw.level,me?.level??0),
      position:me?.position??null,
      currentGold:number(activeRaw.currentGold,0),
      stats:{
        currentHealth:nullable(stats.currentHealth),
        maxHealth:nullable(stats.maxHealth),
        currentMana:nullable(stats.resourceValue),
        maxMana:nullable(stats.resourceMax),
        attackDamage:nullable(stats.attackDamage),
        attackSpeed:nullable(stats.attackSpeed),
        abilityPower:nullable(stats.abilityPower),
        armor:nullable(stats.armor),
        magicResist:nullable(stats.magicResist),
        moveSpeed:nullable(stats.moveSpeed),
      },
    },
    players,
    events:eventsRaw.slice(-40).map(normalizeEvent),
  };
}

function normalizePlayer(raw:any):LiveTelemetryPlayer|null{
  if(!raw||typeof raw!=='object')return null;
  const items=Array.isArray(raw.items)?raw.items.map(normalizeItem).filter(Boolean) as LiveTelemetryItem[]:[];
  const scores=raw.scores&&typeof raw.scores==='object'?raw.scores:{};
  return {
    summonerName:text(raw.summonerName),
    riotId:riotIdOf(raw),
    championName:text(raw.championName)||text(raw.rawChampionName).replace(/^game_character_displayname_/i,''),
    team:teamOf(raw.team),
    level:integer(raw.level,0),
    position:text(raw.position)||null,
    isDead:Boolean(raw.isDead),
    respawnTimer:number(raw.respawnTimer,0),
    itemGold:items.reduce((sum,item)=>sum+Math.max(0,item.price)*Math.max(1,item.count),0),
    items,
    scores:{
      kills:integer(scores.kills,0),
      deaths:integer(scores.deaths,0),
      assists:integer(scores.assists,0),
      creepScore:integer(scores.creepScore,0),
      wardScore:number(scores.wardScore,0),
    },
  };
}

function normalizeItem(raw:any):LiveTelemetryItem|null{
  if(!raw||typeof raw!=='object')return null;
  const itemId=integer(raw.itemID??raw.itemId,0);
  return {
    itemId,
    displayName:text(raw.displayName)||`Item ${itemId}`,
    count:Math.max(1,integer(raw.count,1)),
    price:Math.max(0,number(raw.price,0)),
  };
}

function normalizeEvent(raw:any):LiveTelemetryEvent{
  const object=raw&&typeof raw==='object'?raw:{};
  return {
    id:Number.isFinite(Number(object.EventID))?Number(object.EventID):null,
    name:text(object.EventName)||'Event',
    time:number(object.EventTime,0),
    actor:text(object.KillerName)||text(object.Killer)||text(object.Assister)||null,
    target:text(object.VictimName)||text(object.Victim)||text(object.Stolen)||null,
    raw:Object.fromEntries(Object.entries(object).filter(([key])=>!['EventID','EventName','EventTime'].includes(key))),
  };
}

function samePlayer(raw:any,summonerName:string,riotId:string|null){
  if(!raw||typeof raw!=='object')return false;
  if(summonerName&&text(raw.summonerName)===summonerName)return true;
  const candidate=riotIdOf(raw);
  return Boolean(riotId&&candidate&&candidate===riotId);
}

function riotIdOf(raw:any):string|null{
  const direct=text(raw?.riotId);
  if(direct)return direct;
  const gameName=text(raw?.riotIdGameName);
  const tag=text(raw?.riotIdTagLine);
  return gameName?(tag?`${gameName}#${tag}`:gameName):null;
}

function teamOf(value:unknown):LiveTeam{
  const v=text(value).toUpperCase();
  if(v==='ORDER'||v==='BLUE'||v==='100')return 'ORDER';
  if(v==='CHAOS'||v==='RED'||v==='200')return 'CHAOS';
  return 'UNKNOWN';
}

const text=(value:unknown)=>typeof value==='string'?value.trim():'';
const number=(value:unknown,fallback:number)=>Number.isFinite(Number(value))?Number(value):fallback;
const integer=(value:unknown,fallback:number)=>Math.max(0,Math.round(number(value,fallback)));
const nullable=(value:unknown)=>Number.isFinite(Number(value))?Number(value):null;
