export type WavePosition='YOUR_TOWER'|'YOUR_SIDE'|'CENTER'|'THEIR_SIDE'|'THEIR_TOWER';

export interface LaneContextInput{
  wavePosition:WavePosition;
  yourMinions:number;
  enemyMinions:number;
  yourCannon?:boolean;
  enemyCannon?:boolean;
}

export interface LaneContextReport{
  facts:{
    wavePosition:WavePosition;
    yourMinions:number;
    enemyMinions:number;
    minionDelta:number;
    yourCannon:boolean;
    enemyCannon:boolean;
  };
  waveNumbers:'YOU'|'THEM'|'EVEN';
  constraints:string[];
  rerunTriggers:string[];
  modelNote:string;
}

export const LANE_CONTEXT_MODEL_NOTE=
  'Lane context uses only the explicit wave position and minion counts supplied by the player. '+
  'It does not add guessed minion DPS, turret damage, aggro, movement, jungle pressure or future wave behaviour to champion combat.';

/**
 * Translate explicit lane facts into coaching constraints without altering the
 * deterministic champion-vs-champion damage result. This prevents a clean 2v2
 * calculation from being presented as permission to fight inside a bad wave or
 * dive a tower when those damage sources are outside the combat engine.
 */
export function buildLaneContext(input:LaneContextInput):LaneContextReport{
  const yourMinions=clampCount(input.yourMinions);
  const enemyMinions=clampCount(input.enemyMinions);
  const minionDelta=yourMinions-enemyMinions;
  const yourCannon=Boolean(input.yourCannon);
  const enemyCannon=Boolean(input.enemyCannon);
  const waveNumbers=minionDelta>0?'YOU':minionDelta<0?'THEM':'EVEN';
  const constraints:string[]=[];
  const rerunTriggers:string[]=[];

  if(minionDelta<0){
    constraints.push(`The enemy wave has ${Math.abs(minionDelta)} more minion${Math.abs(minionDelta)===1?'':'s'}. CLIMB's champion-only damage result does not include those minions hitting you, so do not treat the raw fight result as fully representative inside the wave.`);
  }else if(minionDelta>0){
    constraints.push(`Your wave has ${minionDelta} more minion${minionDelta===1?'':'s'}. CLIMB does not add their damage to your combat total, so the champion-only result intentionally does not credit that extra lane pressure.`);
  }else{
    constraints.push('The visible wave is even by minion count. Minion health/aggro are still outside the combat model, so equal count is not treated as equal minion damage.');
  }

  if(enemyCannon&&!yourCannon)
    constraints.push('The enemy wave has the cannon advantage. Cannon damage/aggro are not priced into the 2v2 result.');
  else if(yourCannon&&!enemyCannon)
    constraints.push('Your wave has the cannon advantage, but CLIMB does not inflate your simulated champion damage with cannon damage.');

  if(input.wavePosition==='THEIR_TOWER'){
    constraints.push('The fight is set at the enemy tower. The combat result is not a dive calculation: turret shots and turret aggro are excluded, so an ALL-IN call must not be read as “tower dive is safe.”');
    rerunTriggers.push('Move the wave position away from THEIR TOWER when the enemy steps out; that removes the tower-context warning without changing champion stats.');
  }else if(input.wavePosition==='YOUR_TOWER'){
    constraints.push('The fight is set at your tower. The simulator does not add allied turret damage, so any defensive advantage from turret shots is deliberately omitted.');
    rerunTriggers.push('Rerun at YOUR SIDE or CENTER once the wave leaves your tower; spacing/access assumptions may change even if builds do not.');
  }else if(input.wavePosition==='THEIR_SIDE'){
    constraints.push('The wave is on their side of lane. Treat access as something you must explicitly earn; CLIMB will not assume you can walk through the lane to start the stationary fight.');
  }else if(input.wavePosition==='YOUR_SIDE'){
    constraints.push('The wave is on your side of lane. The context is favourable for making the enemy come farther forward, but no jungle or movement advantage is converted into damage automatically.');
  }else{
    constraints.push('The wave is centred. No tower-side advantage is assumed.');
  }

  if(minionDelta!==0)
    rerunTriggers.push('Update the minion counts after the next wave thins; the coaching constraint should follow the actual wave, not a stale count.');
  if(yourCannon!==enemyCannon)
    rerunTriggers.push('Update cannon state when the cannon dies; CLIMB treats cannon presence as an explicit lane fact, not a permanent buff.');

  return {
    facts:{wavePosition:input.wavePosition,yourMinions,enemyMinions,minionDelta,yourCannon,enemyCannon},
    waveNumbers,
    constraints,
    rerunTriggers,
    modelNote:LANE_CONTEXT_MODEL_NOTE,
  };
}

const clampCount=(value:number)=>Math.max(0,Math.min(30,Number.isFinite(value)?Math.round(value):0));
