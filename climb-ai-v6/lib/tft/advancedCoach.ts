import type {TftContested,TftMatch} from './types';

export type TftSkillKey='ECONOMY'|'TEMPO'|'FLEXIBILITY'|'POSITIONING'|'CONVERSION';

export interface TftSkillScore{
  key:TftSkillKey;
  label:string;
  score:number|null;
  confidence:number;
  evidenceCount:number;
  rationale:string;
}

export interface TftIlpTask{
  id:string;
  skill:TftSkillKey;
  title:string;
  why:string;
  target:string;
  progress:number;
  goal:number;
  priority:number;
}

export interface TftTacticianProfile{
  grade:number|null;
  confidence:number;
  primaryLeak:TftSkillScore|null;
  skills:TftSkillScore[];
  ilp:TftIlpTask[];
}

const clamp=(n:number,min=0,max=100)=>Math.min(max,Math.max(min,n));
const label:Record<TftSkillKey,string>={
  ECONOMY:'Economy',TEMPO:'Tempo',FLEXIBILITY:'Flexibility',POSITIONING:'Positioning',CONVERSION:'Conversion',
};

function finishScore(totalDelta:number,evidence:number){
  if(!evidence)return null;
  return Math.round(clamp(72+(totalDelta/Math.sqrt(evidence)),25,96));
}

function confidence(evidence:number){return Math.round(clamp(15+evidence*11,0,95));}

function economy(matches:TftMatch[]):TftSkillScore{
  let delta=0,evidence=0,highGoldBottom=0,panic=0,cleanSpend=0;
  for(const m of matches){
    if(m.goldLeft!==undefined){
      evidence++;
      if(m.placement>=5&&m.goldLeft>=10){delta-=14;highGoldBottom++;}
      else if(m.placement<=4&&m.goldLeft<=9){delta+=5;cleanSpend++;}
      if(m.placement>=7&&m.goldLeft>=20)delta-=8;
    }
    const r=m.decisionReview;
    if(!r)continue;
    if(r.economyChoice&&r.economyChoice!=='UNKNOWN'){
      evidence++;
      if(r.economyChoice==='SPENT_TO_STABILISE')delta+=7;
      if(r.economyChoice==='PANIC_ROLL'){delta-=12;panic++;}
      if(r.economyChoice==='HELD_FOR_ECON'&&m.placement>=5)delta-=7;
      if(r.economyChoice==='FAST_LEVEL'&&m.placement<=4)delta+=4;
    }
    if(r.rollTiming&&r.rollTiming!=='UNKNOWN'){
      evidence++;
      if(r.rollTiming==='ON_TIME')delta+=7;
      if(r.rollTiming==='LATE')delta-=10;
      if(r.rollTiming==='EARLY'&&m.placement>=5)delta-=5;
    }
  }
  const rationale=highGoldBottom>=2?`${highGoldBottom} bottom-four games ended with 10+ gold.`:panic>=2?`${panic} games were marked as panic roll-downs.`:cleanSpend>=2?'Recent top-four games show cleaner resource conversion.':'More gold/roll timing reviews will make this score more reliable.';
  return{key:'ECONOMY',label:label.ECONOMY,score:finishScore(delta,evidence),confidence:confidence(evidence),evidenceCount:evidence,rationale};
}

function tempo(matches:TftMatch[]):TftSkillScore{
  let delta=0,evidence=0,late=0,earlyWeak=0;
  for(const m of matches){
    if(m.level!==undefined){
      evidence++;
      if(m.placement>=5&&m.level<=7)delta-=10;
      if(m.placement<=4&&m.level>=8)delta+=5;
    }
    const r=m.decisionReview;
    if(!r)continue;
    if(r.weakStage&&r.weakStage!=='NEVER'){
      evidence++;
      if(r.weakStage==='STAGE_2'||r.weakStage==='STAGE_3'){delta-=7;earlyWeak++;}
      if(r.weakStage==='STAGE_5_PLUS')delta+=4;
    }
    if(r.rollTiming&&r.rollTiming!=='UNKNOWN'){
      evidence++;
      if(r.rollTiming==='ON_TIME')delta+=8;
      if(r.rollTiming==='LATE'){delta-=11;late++;}
    }
    if(r.itemChoice&&r.itemChoice!=='UNKNOWN'){
      evidence++;
      if(r.itemChoice==='SLAMMED_TEMPO')delta+=5;
      if(r.itemChoice==='GREEDY_COMPONENTS'&&m.placement>=5)delta-=7;
    }
  }
  const rationale=late>=2?`${late} games show the stabilisation roll arriving late.`:earlyWeak>=2?`Your board was already weak by stage 2/3 in ${earlyWeak} reviewed games.`:'Tempo score blends final level, weak-stage timing, roll timing and item tempo.';
  return{key:'TEMPO',label:label.TEMPO,score:finishScore(delta,evidence),confidence:confidence(evidence),evidenceCount:evidence,rationale};
}

function flexibility(matches:TftMatch[]):TftSkillScore{
  let delta=0,evidence=0,forced=0,earlyFlex=0;
  for(const m of matches){
    const r=m.decisionReview;
    if(!r)continue;
    if(r.contested&&r.contested!=='UNKNOWN'){
      evidence++;
      if(r.contested==='HEAVY'&&r.pivotQuality==='FORCED_CONTESTED')delta-=10;
      if(r.contested==='NONE')delta+=2;
    }
    if(r.pivotQuality&&r.pivotQuality!=='UNKNOWN'){
      evidence++;
      if(r.pivotQuality==='FLEXED_EARLY'){delta+=10;earlyFlex++;}
      if(r.pivotQuality==='STAYED_UNCONTESTED')delta+=6;
      if(r.pivotQuality==='FLEXED_LATE')delta-=5;
      if(r.pivotQuality==='FORCED_CONTESTED'){delta-=14;forced++;}
    }
    if(r.planFollowed&&r.planFollowed!=='UNKNOWN'&&m.planSnapshot){
      evidence++;
      if(r.planFollowed==='YES')delta+=3;
      if(r.planFollowed==='NO'&&r.contested==='HEAVY')delta-=6;
    }
  }
  const rationale=forced>=2?`${forced} reviews show you forcing a contested line.`:earlyFlex>=2?`${earlyFlex} early pivots show good comp flexibility.`:'Flexibility becomes more precise when you record contest pressure and pivot quality.';
  return{key:'FLEXIBILITY',label:label.FLEXIBILITY,score:finishScore(delta,evidence),confidence:confidence(evidence),evidenceCount:evidence,rationale};
}

function positioning(matches:TftMatch[]):TftSkillScore{
  let delta=0,evidence=0,lost=0,won=0;
  for(const m of matches){
    const p=m.decisionReview?.positioningResult;
    if(!p||p==='UNKNOWN')continue;
    evidence++;
    if(p==='WON_FIGHTS'){delta+=10;won++;}
    if(p==='NEUTRAL')delta+=2;
    if(p==='LOST_FIGHTS'){delta-=13;lost++;}
  }
  const rationale=lost>=2?`${lost} games were marked as losing decisive fights to positioning.`:won>=2?`${won} reviews credit positioning with winning decisive fights.`:'This score only uses explicit post-game positioning evidence; it is never guessed from placement.';
  return{key:'POSITIONING',label:label.POSITIONING,score:finishScore(delta,evidence),confidence:confidence(evidence),evidenceCount:evidence,rationale};
}

function conversion(matches:TftMatch[]):TftSkillScore{
  let delta=0,evidence=0,top4=0,top2=0;
  for(const m of matches){
    evidence++;
    if(m.placement===1){delta+=14;top4++;top2++;}
    else if(m.placement===2){delta+=9;top4++;top2++;}
    else if(m.placement<=4){delta+=3;top4++;}
    else if(m.placement>=7)delta-=10;
    else delta-=3;
    if(m.playersEliminated!==undefined){evidence++;if(m.playersEliminated>=3)delta+=4;}
    if(m.placement<=4&&m.goldLeft!==undefined&&m.goldLeft>=15){evidence++;delta-=4;}
  }
  const rationale=top4>=4&&top2<=1?'You reach top four, but too few of those games convert into top-two finishes.':top2>=3?`${top2} top-two finishes show strong late-game conversion.`:'Conversion measures how often stable games become top fours, top twos and wins.';
  return{key:'CONVERSION',label:label.CONVERSION,score:finishScore(delta,evidence),confidence:confidence(evidence),evidenceCount:evidence,rationale};
}

function taskProgress(skill:TftSkillKey,matches:TftMatch[]){
  const sample=matches.slice(0,5);
  if(skill==='ECONOMY')return sample.filter(m=>{
    const r=m.decisionReview;
    const hasGold=m.goldLeft!==undefined;
    const hasReview=Boolean(r&&(r.rollTiming&&r.rollTiming!=='UNKNOWN'||r.economyChoice&&r.economyChoice!=='UNKNOWN'));
    if(!hasGold&&!hasReview)return false;
    if(m.placement>=5&&hasGold&&(m.goldLeft as number)>=10)return false;
    if(r?.rollTiming==='LATE'||r?.economyChoice==='PANIC_ROLL')return false;
    return true;
  }).length;
  if(skill==='TEMPO')return sample.filter(m=>{
    const r=m.decisionReview;
    const explicit=r?.rollTiming==='ON_TIME';
    const scoreboard=m.level!==undefined&&m.level>=8&&m.placement<=4;
    return explicit||scoreboard;
  }).length;
  if(skill==='FLEXIBILITY')return sample.filter(m=>m.decisionReview?.pivotQuality==='FLEXED_EARLY'||m.decisionReview?.pivotQuality==='STAYED_UNCONTESTED').length;
  if(skill==='POSITIONING')return sample.filter(m=>m.decisionReview?.positioningResult==='WON_FIGHTS'||m.decisionReview?.positioningResult==='NEUTRAL').length;
  return sample.filter(m=>m.placement<=2).length;
}

function buildTask(skill:TftSkillScore,matches:TftMatch[],priority:number):TftIlpTask{
  const common={id:`tft-${skill.key.toLowerCase()}`,skill:skill.key,why:skill.rationale,progress:Math.min(3,taskProgress(skill.key,matches)),goal:3,priority};
  if(skill.key==='ECONOMY')return{...common,title:'CONVERT GOLD BEFORE HP',target:'Across 3 reviewed danger-state games: no late roll-down and no bottom-four finish with 10+ unspent gold.'};
  if(skill.key==='TEMPO')return{...common,title:'OWN THE STABILISATION WINDOW',target:'Across 3 games, record when the board first becomes weak and act on the planned level/roll window instead of reacting after multiple losses.'};
  if(skill.key==='FLEXIBILITY')return{...common,title:'BREAK THE CONTEST TAX',target:'Across 3 games, if two opponents clearly occupy your intended line, record an early pivot or a justified uncontested stay.'};
  if(skill.key==='POSITIONING')return{...common,title:'WIN THE LAST THREE FIGHTS',target:'Review the final three meaningful fights in 3 games and record whether positioning won, lost or was neutral in each game.'};
  return{...common,title:'TURN STABILITY INTO TOP TWO',target:'Convert 3 tracked games into top-two finishes; after every top four, record the final upgrade, positioning or cap decision that blocked the win.'};
}

export function buildTacticianProfile(matches:TftMatch[]):TftTacticianProfile{
  const sample=matches.slice(0,20);
  const skills=[economy(sample),tempo(sample),flexibility(sample),positioning(sample),conversion(sample)];
  const known=skills.filter(s=>s.score!==null);
  const weighted=known.map(s=>({score:s.score as number,weight:Math.max(.2,s.confidence/100)}));
  const weightTotal=weighted.reduce((sum,s)=>sum+s.weight,0);
  const grade=weighted.length?Math.round(weighted.reduce((sum,s)=>sum+s.score*s.weight,0)/weightTotal):null;
  const profileConfidence=known.length?Math.round(known.reduce((sum,s)=>sum+s.confidence,0)/known.length):0;
  const ranked=[...skills].sort((a,b)=>{
    if(a.score===null&&b.score===null)return a.key.localeCompare(b.key);
    if(a.score===null)return 1;
    if(b.score===null)return -1;
    const aPriority=(100-a.score)*(a.confidence/100);
    const bPriority=(100-b.score)*(b.confidence/100);
    return bPriority-aPriority;
  });
  const primaryLeak=ranked.find(s=>s.score!==null&&s.confidence>=35)||known.sort((a,b)=>(a.score||100)-(b.score||100))[0]||null;
  const ilp=ranked.map((skill,index)=>buildTask(skill,sample,index+1));
  return{grade,confidence:profileConfidence,primaryLeak,skills,ilp};
}

export type DecisionStage='2-1'|'2-5'|'3-2'|'3-5'|'4-1'|'4-2'|'4-5'|'5-1+';
export type BoardStrength='WEAK'|'EVEN'|'STRONG';
export type StreakState='LOSS_3_PLUS'|'LOSS_1_2'|'NONE'|'WIN_1_2'|'WIN_3_PLUS';

export interface TftDecisionReplayInput{
  stage:DecisionStage;
  hp:number;
  gold:number;
  level:number;
  boardStrength:BoardStrength;
  streak:StreakState;
  contested:TftContested;
  upgradesNeeded:number;
}

export interface TftDecisionReplayResult{
  call:'ROLL / STABILISE'|'PUSH LEVEL / TEMPO'|'HOLD ECON'|'PIVOT LINE'|'SMALL ROLL / REASSESS';
  urgency:'LOW'|'MEDIUM'|'HIGH';
  score:number;
  reasons:string[];
  checkpoint:string;
}

export function analyseDecisionReplay(input:TftDecisionReplayInput):TftDecisionReplayResult{
  const reasons:string[]=[];
  const lateStage=['4-1','4-2','4-5','5-1+'].includes(input.stage);
  const danger=input.hp<=45;
  const critical=input.hp<=30;
  const weak=input.boardStrength==='WEAK';
  const strong=input.boardStrength==='STRONG';
  const losing=input.streak==='LOSS_3_PLUS';
  const winning=input.streak==='WIN_3_PLUS';

  if(input.contested==='HEAVY'&&input.upgradesNeeded>=2){
    reasons.push('The line is heavily contested while multiple upgrades are still missing.');
    if(lateStage)reasons.push('The later the stage, the more expensive it becomes to wait for the same shared unit pool.');
    return{call:'PIVOT LINE',urgency:danger?'HIGH':'MEDIUM',score:danger?92:82,reasons,checkpoint:'In the replay, identify the first shop/augment/item point where a second viable line was still open.'};
  }

  if((critical||danger&&losing)&&weak){
    reasons.push(`HP was ${input.hp}, so future economy had less value than immediate board strength.`);
    reasons.push('The board was weak and already under loss-streak pressure.');
    if(input.gold>=20)reasons.push(`${input.gold} gold meant there was still enough resource to buy meaningful stabilisation.`);
    return{call:'ROLL / STABILISE',urgency:'HIGH',score:95,reasons,checkpoint:'Replay the roll-down: what exact upgrades or trait breakpoints would have made you stop rolling?'};
  }

  if(strong&&input.gold>=40&&(winning||input.hp>=70)){
    reasons.push('The board was already strong enough to preserve HP.');
    reasons.push(`${input.gold} gold gave room to convert economy into level/tempo without an emergency roll.`);
    return{call:'PUSH LEVEL / TEMPO',urgency:'LOW',score:86,reasons,checkpoint:'Check whether leveling created a real unit/trait breakpoint; if it did not, holding economy may have been better.'};
  }

  if(!lateStage&&input.hp>=60&&input.gold>=40&&!weak){
    reasons.push('HP and board strength were stable enough that an emergency spend was not forced.');
    reasons.push('Preserving interest kept more future options open.');
    return{call:'HOLD ECON',urgency:'LOW',score:80,reasons,checkpoint:'Define the next forced decision point: level breakpoint, HP threshold or a specific upgrade pair.'};
  }

  if(weak&&input.gold>=20){
    reasons.push('The board was weak, but the state was not yet an automatic all-in.');
    reasons.push('A controlled roll can test upgrade density before committing the full bank.');
    return{call:'SMALL ROLL / REASSESS',urgency:danger?'HIGH':'MEDIUM',score:78,reasons,checkpoint:'Set a stop condition before rolling: target upgrades, minimum gold floor and the board strength required to stop.'};
  }

  reasons.push('No single emergency signal dominates this replay state.');
  reasons.push('The best decision depends on the next concrete breakpoint rather than spending by habit.');
  return{call:strong?'PUSH LEVEL / TEMPO':'HOLD ECON',urgency:'MEDIUM',score:70,reasons,checkpoint:'Name the next real breakpoint before spending: level, trait, two-star upgrade, item completion or HP danger threshold.'};
}
