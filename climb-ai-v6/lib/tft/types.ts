export interface TftTrait{
  name:string;
  num_units:number;
  style?:number;
  tier_current?:number;
  tier_total?:number;
}

export interface TftUnit{
  character_id:string;
  name?:string;
  rarity?:number;
  tier?:number;
  itemNames?:string[];
}

export interface TftMatch{
  id:string;
  riotAccountId:string;
  queueId?:number;
  playedAt:string;
  gameLengthSeconds:number;
  gameVersion:string;
  setNumber?:number;
  setCoreName?:string;
  placement:number;
  level?:number;
  lastRound?:number;
  playersEliminated?:number;
  totalDamageToPlayers?:number;
  goldLeft?:number;
  augments:string[];
  traits:TftTrait[];
  units:TftUnit[];
  companion?:Record<string,unknown>;
  compSignature:string;
}

export interface TftSummary{
  games:number;
  averagePlacement:number;
  top4Rate:number;
  winRate:number;
  averageLevel:number;
  averageDamage:number;
  recentForm:number;
  previousForm:number|null;
}

export function summarizeTft(matches:TftMatch[]):TftSummary{
  const games=matches.length;
  if(!games)return{games:0,averagePlacement:0,top4Rate:0,winRate:0,averageLevel:0,averageDamage:0,recentForm:0,previousForm:null};
  const avg=(values:number[])=>values.reduce((a,b)=>a+b,0)/Math.max(1,values.length);
  const recent=matches.slice(0,5);
  const previous=matches.slice(5,10);
  return{
    games,
    averagePlacement:avg(matches.map(m=>m.placement)),
    top4Rate:matches.filter(m=>m.placement<=4).length/games,
    winRate:matches.filter(m=>m.placement===1).length/games,
    averageLevel:avg(matches.map(m=>m.level||0).filter(Boolean)),
    averageDamage:avg(matches.map(m=>m.totalDamageToPlayers||0)),
    recentForm:avg(recent.map(m=>m.placement)),
    previousForm:previous.length?avg(previous.map(m=>m.placement)):null,
  };
}

export function tftCoachingRead(matches:TftMatch[]):{title:string;detail:string;target:string}{
  if(!matches.length)return{title:'BUILD YOUR TFT BASELINE',detail:'Log finished TFT games or sync them later. OP CLIMB can build your placement, comp and consistency model without Riot API access.',target:'Track at least 5 finished games — manual and Riot-imported games count together.'};
  const s=summarizeTft(matches);
  const bottom4=matches.filter(m=>m.placement>=5).length;
  const highGold=matches.filter(m=>(m.goldLeft||0)>=10&&m.placement>=5).length;
  const lowLevel=matches.filter(m=>(m.level||0)<=7&&m.placement>=5).length;
  if(highGold>=2)return{title:'SPEND BEFORE YOU BLEED OUT',detail:`${highGold} recent bottom-four finishes ended with 10+ unspent gold. That is evidence of resources surviving longer than the board did.`,target:'In your next 3 danger-state games, finish the decisive roll-down with less than 10 gold unless you are safely streaking.'};
  if(lowLevel>=2)return{title:'TEMPO IS FALLING BEHIND',detail:`${lowLevel} bottom-four games ended at level 7 or below. The result pattern points to lobby tempo or economy conversion arriving too late.`,target:'Review the stage where your HP first becomes unstable and define the level/roll trigger before the next queue.'};
  if(bottom4>matches.length/2)return{title:'STABILISE THE FLOOR',detail:`Your recent sample is ${Math.round(bottom4/matches.length*100)}% bottom-four. The first job is reducing 7th/8th outcomes before chasing more firsts.`,target:'Aim for 3 top-four finishes in the next 5 ranked games with no 8th.'};
  if(s.top4Rate>=.6)return{title:'TURN TOP FOURS INTO WINS',detail:`You are top-four in ${Math.round(s.top4Rate*100)}% of this sample. The next leak is conversion: preserving enough HP/economy to upgrade the final board.`,target:'After every top-four, record the final missing upgrade, item mismatch or positioning loss that stopped the win.'};
  return{title:'MAKE THE MIDGAME REPEATABLE',detail:`Average placement is ${s.averagePlacement.toFixed(2)}. Your next gain is consistency rather than forcing one comp or one high-roll line.`,target:'Use one clear stage-3 stabilisation rule for the next 5 games and compare placement spread.'};
}
