import type {HistoryAnalysisRow} from './riot/proHistory';
import type {
  DecisionBehaviourKey,
  DecisionSituationTag,
  DecisionTwinConfidence,
  DraftSituationContext,
} from './decisionTwin';
import type {DecisionSimulation} from './decisionSimulation';

export type ScenarioMemoryState='BUILDING'|'DUE'|'LEARNING'|'STABILISING'|'MASTERED'|'REGRESSED';

export interface ScenarioMemoryCard{
  id:string;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  situationTag:DecisionSituationTag;
  state:ScenarioMemoryState;
  confidence:DecisionTwinConfidence;
  comparableGames:number;
  cleanGames:number;
  improveGames:number;
  cleanRate:number|null;
  recentComparableGames:number;
  recentCleanGames:number;
  recentCleanRate:number|null;
  cleanStreak:number;
  gamesSinceLastSeen:number;
  reviewIntervalGames:number;
  gamesUntilReview:number;
  dueNextGame:boolean;
  memoryStrength:number;
  lastSeenAt:string;
  lastVerdict:'GOOD'|'IMPROVE';
  trigger:string;
  oldBranch:string;
  targetBranch:string;
  evidence:string;
  summary:string;
}

export interface ScenarioMemoryProfile{
  version:1;
  gamesAnalyzed:number;
  generatedAt:string;
  cards:ScenarioMemoryCard[];
  dueNextGame:number;
  mastered:number;
  regressed:number;
  strongestMemory:ScenarioMemoryCard|null;
  activeRep:ScenarioMemoryCard|null;
  summary:string;
  boundary:string;
}

export interface ScenarioPrime{
  version:1;
  memoryId:string;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  situationTag:DecisionSituationTag;
  state:ScenarioMemoryState;
  confidence:DecisionTwinConfidence;
  memoryStrength:number;
  title:string;
  trigger:string;
  oldBranch:string;
  targetBranch:string;
  exactDraftRead:string;
  rehearsalQuestion:string;
  dueReason:string;
  simulationScenarioId:string|null;
  evidence:string;
  boundary:string;
}

export interface ScenarioPrimeObservedDecision{
  behaviourKey:DecisionBehaviourKey;
  verdict:'GOOD'|'IMPROVE'|'NEUTRAL';
  confidence:'HIGH'|'MEDIUM'|'LOW';
  situationTags:DecisionSituationTag[];
}

export interface ScenarioPrimeReview{
  version:1;
  active:boolean;
  memoryId:string|null;
  behaviourKey:DecisionBehaviourKey|null;
  behaviourLabel:string|null;
  situationTag:DecisionSituationTag|null;
  status:'NO_REP'|'NOT_OBSERVED'|'EXECUTED'|'MISSED'|'MIXED';
  matchedMoments:number;
  cleanMoments:number;
  improveMoments:number;
  note:string;
  boundary:string;
}

type GameObservation={
  rowIndex:number;
  createdAt:string;
  verdict:'GOOD'|'IMPROVE';
  node:any;
};

const LABELS:Record<DecisionBehaviourKey,string>={
  FIGHT_SELECTION:'Fight Selection',
  DEATH_RECOVERY:'Recovery After Death',
  LEAD_PROTECTION:'Lead Protection',
  RESET_DISCIPLINE:'Reset Discipline',
  OBJECTIVE_READINESS:'Objective Arrival',
  FARM_VS_SETUP:'Farm vs Setup',
  THREAT_ADAPTATION:'Threat Adaptation',
  CARRY_PRESERVATION:'Carry Preservation',
  POWER_SPIKE_CONVERSION:'Power-Spike Conversion',
  SURVIVAL_VALUE:'Survival Value',
};

const RULES:Record<DecisionBehaviourKey,string>={
  FIGHT_SELECTION:'WAIT FOR YOUR OWN NUMBERS, POSITION OR PLANNED FIGHT TRIGGER BEFORE COMMITTING.',
  DEATH_RECOVERY:'BREAK THE SECOND-DEATH CYCLE: REBUILD RESOURCES AND INFORMATION BEFORE THE NEXT CONTEST.',
  LEAD_PROTECTION:'WHEN AHEAD, CONVERT CONTROL. MAKE THEM ENTER YOUR SETUP INSTEAD OF BUYING A HARDER FIGHT.',
  RESET_DISCIPLINE:'IF YOUR BANK BECOMES REAL POWER, SPEND BEFORE THE NEXT VOLUNTARY FIGHT.',
  OBJECTIVE_READINESS:'LEAVE THE LAST LOW-VALUE RESOURCE IF TAKING IT MAKES YOU SECOND TO IMPORTANT SPACE.',
  FARM_VS_SETUP:'IF THE EXTRA WAVE OR CAMP MAKES YOU SECOND TO THE REAL WINDOW, CONNECT FIRST.',
  THREAT_ADAPTATION:'AFTER A THREAT SHOWS ITS PATTERN ONCE, CHANGE YOUR POSITION OR ENTRY BEFORE THE NEXT REP.',
  CARRY_PRESERVATION:'FIRST CONTACT DOES NOT MEAN WALK FORWARD. KEEP THE SAFE DAMAGE LINE AND HIT WHAT IS SAFE.',
  POWER_SPIKE_CONVERSION:'WHEN THE REAL SPIKE COMPLETES, CONNECT TO THE NEXT PRESSURE WINDOW BEFORE DRIFTING BACK INTO FARM.',
  SURVIVAL_VALUE:'WHEN YOUR LIFE HOLDS HIGH TEAM VALUE, SURVIVAL OUTRANKS ACCESS TO A LOWER-VALUE TARGET.',
};

const BOUNDARY='Scenario Memory uses repeated verified Decision Graph evidence. One game cannot create mastery, unobserved situations do not count as reps or move the comparable-evidence window, and a mastered memory can reopen only if comparable mistakes return.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function pct(value:number,total:number){return total?Math.round(value/total*100):null}
function cap(value:number,min=0,max=100){return Math.max(min,Math.min(max,Math.round(value)))}
function confidence(games:number):DecisionTwinConfidence{return games>=6?'HIGH':games>=3?'MEDIUM':'LOW'}
function tagsFor(node:any):DecisionSituationTag[]{
  const raw=Array.isArray(node?.situationTags)?node.situationTags:[];
  const tags=raw.map((tag:unknown)=>clean(tag).toUpperCase()).filter(Boolean) as DecisionSituationTag[];
  return tags.length?[...new Set(tags)]:['GENERAL'];
}
function memoryKey(behaviour:DecisionBehaviourKey,tag:DecisionSituationTag){return behaviour+'|'+tag}
function cleanStreak(observations:GameObservation[]){
  let streak=0;
  for(let i=observations.length-1;i>=0;i--){
    if(observations[i].verdict!=='GOOD')break;
    streak++;
  }
  return streak;
}
function stateFor(observations:GameObservation[]):ScenarioMemoryState{
  if(observations.length<3)return'BUILDING';
  const recent=observations.slice(-4);
  const recentClean=recent.filter(item=>item.verdict==='GOOD').length;
  const recentCleanRate=pct(recentClean,recent.length)??0;
  const streak=cleanStreak(observations);
  const older=observations.slice(0,-3);
  const olderClean=older.filter(item=>item.verdict==='GOOD').length;
  const olderCleanRate=pct(olderClean,older.length)??0;
  const recentThree=observations.slice(-3);
  const regressed=older.length>=3&&recentThree.length===3&&olderCleanRate>=80&&recentThree.every(item=>item.verdict==='IMPROVE');
  if(regressed)return'REGRESSED';
  if(observations.at(-1)?.verdict==='IMPROVE')return'DUE';
  if(streak>=3&&recentCleanRate>=80&&observations.length>=4)return'MASTERED';
  if(streak>=2)return'STABILISING';
  return'LEARNING';
}
function intervalFor(state:ScenarioMemoryState){
  if(state==='MASTERED')return 3;
  if(state==='STABILISING')return 1;
  return 0;
}
function strengthFor(observations:GameObservation[],state:ScenarioMemoryState){
  const clean=observations.filter(item=>item.verdict==='GOOD').length;
  const allRate=pct(clean,observations.length)??0;
  const recent=observations.slice(-4);
  const recentRate=pct(recent.filter(item=>item.verdict==='GOOD').length,recent.length)??0;
  const streak=Math.min(4,cleanStreak(observations));
  const stateBoost=state==='MASTERED'?10:state==='STABILISING'?5:state==='REGRESSED'?-10:0;
  return cap(allRate*.38+recentRate*.42+streak*3+stateBoost);
}
function representative(observations:GameObservation[]){
  const latestFailure=[...observations].reverse().find(item=>item.verdict==='IMPROVE'&&item.node?.counterfactual);
  return latestFailure??observations.at(-1)!;
}
function triggerFrom(node:any,tag:DecisionSituationTag){
  return clean(node?.situation)||clean(node?.title)||('WHEN THE '+tag.replaceAll('_',' ')+' DECISION WINDOW APPEARS.');
}
function oldBranchFrom(node:any){
  return clean(node?.counterfactual?.actual)||clean(node?.decisionRead)||'THE OLD BRANCH IS STILL BEING LEARNED FROM VERIFIED MATCH EVIDENCE.';
}
function targetBranchFrom(node:any,behaviour:DecisionBehaviourKey){
  return clean(node?.counterfactual?.alternative)||clean(node?.lockedPrinciple)||RULES[behaviour];
}
function summaryFor(card:{
  state:ScenarioMemoryState;behaviourLabel:string;situationTag:DecisionSituationTag;
  cleanRate:number|null;recentCleanRate:number|null;cleanStreak:number;gamesUntilReview:number;
}){
  const context=card.situationTag.replaceAll('_',' ').toLowerCase();
  if(card.state==='REGRESSED')return card.behaviourLabel+' had stabilised in '+context+', but comparable mistakes have returned. The memory is reopened.';
  if(card.state==='MASTERED')return card.behaviourLabel+' is currently stable in '+context+' ('+(card.recentCleanRate??0)+'% recent clean). Maintenance is spaced instead of repeated every game.';
  if(card.state==='STABILISING')return card.behaviourLabel+' is holding for '+String(card.cleanStreak)+' clean comparable games. One more correctly spaced rep matters more than volume.';
  if(card.state==='DUE')return card.behaviourLabel+' was missed in the latest comparable '+context+' decision. This memory is due for rehearsal next match.';
  if(card.state==='LEARNING')return card.behaviourLabel+' remains unstable in '+context+' ('+(card.cleanRate??0)+'% clean across comparable games).';
  return card.behaviourLabel+' in '+context+' is still building. OP CLIMB will not call it learned or broken yet.';
}

export function buildScenarioMemory(rows:HistoryAnalysisRow[],generatedAt=new Date().toISOString()):ScenarioMemoryProfile{
  const ordered=[...rows].filter(row=>row.analysis?.version===1).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  const groups=new Map<string,{behaviour:DecisionBehaviourKey;tag:DecisionSituationTag;games:Map<number,GameObservation>}>();

  ordered.forEach((row,rowIndex)=>{
    const nodes=(((row.analysis as any)?.decisionGraph?.nodes??[]) as any[])
      .filter(node=>node&&node.confidence!=='LOW'&&(node.verdict==='GOOD'||node.verdict==='IMPROVE'));
    for(const node of nodes){
      const behaviour=clean(node.behaviourKey).toUpperCase() as DecisionBehaviourKey;
      if(!LABELS[behaviour])continue;
      for(const tag of tagsFor(node)){
        const key=memoryKey(behaviour,tag);
        const group=groups.get(key)??{behaviour,tag,games:new Map<number,GameObservation>()};
        const previous=group.games.get(rowIndex);
        const next:GameObservation={rowIndex,createdAt:row.createdAt,verdict:node.verdict,node};
        if(!previous||next.verdict==='IMPROVE'||(previous.verdict===next.verdict&&node.counterfactual&&!previous.node?.counterfactual))group.games.set(rowIndex,next);
        groups.set(key,group);
      }
    }
  });

  const cards=[...groups.values()].map(group=>{
    // Retention is bounded by comparable evidence, not by unrelated matches. An
    // unobserved/irrelevant game must never evict a clean comparison and create a
    // synthetic regression. New comparable decisions are the only thing that can
    // move the 50-rep memory window.
    const observations=[...group.games.values()].sort((a,b)=>a.rowIndex-b.rowIndex).slice(-50);
    const comparableGames=observations.length;
    const cleanGames=observations.filter(item=>item.verdict==='GOOD').length;
    const improveGames=comparableGames-cleanGames;
    const recent=observations.slice(-4);
    const recentCleanGames=recent.filter(item=>item.verdict==='GOOD').length;
    const state=stateFor(observations);
    const last=observations.at(-1)!;
    const gamesSinceLastSeen=Math.max(0,ordered.length-1-last.rowIndex);
    const reviewIntervalGames=intervalFor(state);
    const gamesUntilReview=Math.max(0,reviewIntervalGames-gamesSinceLastSeen);
    const dueNextGame=gamesUntilReview<=1&&state!=='BUILDING';
    const rep=representative(observations);
    const card:ScenarioMemoryCard={
      id:'memory:'+group.behaviour.toLowerCase()+':'+group.tag.toLowerCase(),
      behaviourKey:group.behaviour,
      behaviourLabel:LABELS[group.behaviour],
      situationTag:group.tag,
      state,
      confidence:confidence(comparableGames),
      comparableGames,
      cleanGames,
      improveGames,
      cleanRate:pct(cleanGames,comparableGames),
      recentComparableGames:recent.length,
      recentCleanGames,
      recentCleanRate:pct(recentCleanGames,recent.length),
      cleanStreak:cleanStreak(observations),
      gamesSinceLastSeen,
      reviewIntervalGames,
      gamesUntilReview,
      dueNextGame,
      memoryStrength:strengthFor(observations,state),
      lastSeenAt:last.createdAt,
      lastVerdict:last.verdict,
      trigger:triggerFrom(rep.node,group.tag),
      oldBranch:oldBranchFrom(rep.node),
      targetBranch:targetBranchFrom(rep.node,group.behaviour),
      evidence:comparableGames+' comparable game'+(comparableGames===1?'':'s')+' · '+String(improveGames)+' improve · '+String(cleanGames)+' clean · '+confidence(comparableGames)+' confidence',
      summary:'',
    };
    card.summary=summaryFor(card);
    return card;
  }).sort((a,b)=>{
    const stateWeight=(state:ScenarioMemoryState)=>state==='REGRESSED'?6:state==='DUE'?5:state==='LEARNING'?4:state==='STABILISING'?3:state==='MASTERED'?2:1;
    return Number(b.dueNextGame)-Number(a.dueNextGame)
      ||stateWeight(b.state)-stateWeight(a.state)
      ||a.memoryStrength-b.memoryStrength
      ||b.comparableGames-a.comparableGames;
  });

  const usable=cards.filter(card=>card.state!=='BUILDING');
  const activeRep=usable.find(card=>card.dueNextGame&&card.state!=='MASTERED')??usable.find(card=>card.dueNextGame)??null;
  const strongestMemory=[...usable].sort((a,b)=>b.memoryStrength-a.memoryStrength||b.comparableGames-a.comparableGames)[0]??null;
  const dueNextGame=usable.filter(card=>card.dueNextGame).length;
  const mastered=usable.filter(card=>card.state==='MASTERED').length;
  const regressed=usable.filter(card=>card.state==='REGRESSED').length;

  return{
    version:1,
    gamesAnalyzed:ordered.length,
    generatedAt,
    cards,
    dueNextGame,
    mastered,
    regressed,
    strongestMemory,
    activeRep,
    summary:!usable.length
      ?'Scenario Memory is still building. OP CLIMB needs repeated comparable Decision Graph evidence before it schedules training reps.'
      :regressed
        ?String(regressed)+' previously stable scenario '+(regressed===1?'has':'have')+' reopened. V4 will prioritise the returning pattern before adding new complexity.'
        :dueNextGame
          ?String(dueNextGame)+' scenario memor'+(dueNextGame===1?'y is':'ies are')+' due for the next matching game.'
          :'No unstable memory is due next game. Mastered scenarios stay on maintenance spacing instead of being drilled forever.',
    boundary:BOUNDARY,
  };
}

function compatible(card:ScenarioMemoryCard,context:DraftSituationContext){
  return card.situationTag==='GENERAL'||context.tags.includes(card.situationTag);
}
function statePriority(state:ScenarioMemoryState){
  return state==='REGRESSED'?50:state==='DUE'?44:state==='LEARNING'?36:state==='STABILISING'?24:state==='MASTERED'?8:0;
}

export function selectScenarioPrime(input:{
  memory:ScenarioMemoryProfile;
  situationContext:DraftSituationContext;
  simulation:DecisionSimulation|null|undefined;
}):ScenarioPrime|null{
  const candidates=input.memory.cards
    .filter(card=>card.state!=='BUILDING'&&compatible(card,input.situationContext))
    .filter(card=>card.dueNextGame||card.state==='REGRESSED'||card.state==='DUE'||card.state==='LEARNING')
    .map(card=>{
      const simulation=input.simulation?.scenarios?.find(item=>
        item.behaviourKey===card.behaviourKey
        && (!item.situationTag||item.situationTag===card.situationTag||card.situationTag==='GENERAL')
      )??null;
      const score=statePriority(card.state)
        +(card.dueNextGame?20:0)
        +(card.confidence==='HIGH'?12:card.confidence==='MEDIUM'?7:2)
        +(100-card.memoryStrength)*.2
        +(simulation?15:0);
      return{card,simulation,score};
    })
    .sort((a,b)=>b.score-a.score||b.card.comparableGames-a.card.comparableGames);

  const selected=candidates[0];
  if(!selected)return null;
  const {card,simulation}=selected;
  const context=card.situationTag.replaceAll('_',' ').toLowerCase();
  const dueReason=card.state==='REGRESSED'
    ?'This used to be stable, but the pattern has returned. Reopen it before adding a new focus.'
    :card.state==='DUE'
      ?'The latest comparable decision missed this branch, so it is due immediately.'
      :card.state==='LEARNING'
        ?'This memory is still unstable and matches the current draft.'
        :card.state==='STABILISING'
          ?'The pattern is improving; one correctly spaced clean rep can move it toward mastery.'
          :'Maintenance spacing says this memory is due again.';

  return{
    version:1,
    memoryId:card.id,
    behaviourKey:card.behaviourKey,
    behaviourLabel:card.behaviourLabel,
    situationTag:card.situationTag,
    state:card.state,
    confidence:card.confidence,
    memoryStrength:card.memoryStrength,
    title:'ONE REP · '+card.behaviourLabel.toUpperCase()+' · '+context.toUpperCase(),
    trigger:clean(simulation?.trigger)||card.trigger,
    oldBranch:card.oldBranch,
    targetBranch:clean(simulation?.targetMove)||card.targetBranch,
    exactDraftRead:clean(simulation?.exactDraftRead)||('This draft contains a verified '+context+' decision context that matches this memory.'),
    rehearsalQuestion:'WHEN THIS TRIGGER APPEARS, CAN YOU NAME THE BETTER BRANCH BEFORE FIRST CONTACT CHOOSES FOR YOU?',
    dueReason,
    simulationScenarioId:simulation?.id??null,
    evidence:card.evidence+' · memory strength '+String(card.memoryStrength)+'/100',
    boundary:'This is spaced coaching practice from repeated evidence, not a guarantee the scenario will appear or that one clean rep proves mastery.',
  };
}


export function reviewScenarioPrime(
  prime:ScenarioPrime|null|undefined,
  nodes:ScenarioPrimeObservedDecision[],
):ScenarioPrimeReview{
  if(!prime){
    return{
      version:1,
      active:false,
      memoryId:null,
      behaviourKey:null,
      behaviourLabel:null,
      situationTag:null,
      status:'NO_REP',
      matchedMoments:0,
      cleanMoments:0,
      improveMoments:0,
      note:'No spaced Scenario Memory rep was frozen before this game.',
      boundary:'No rep means no score. OP CLIMB does not backfill a training target after seeing the result.',
    };
  }
  const matched=nodes.filter(node=>
    node.confidence!=='LOW'
    &&node.behaviourKey===prime.behaviourKey
    &&(prime.situationTag==='GENERAL'||node.situationTags.includes(prime.situationTag))
    &&(node.verdict==='GOOD'||node.verdict==='IMPROVE')
  );
  const cleanMoments=matched.filter(node=>node.verdict==='GOOD').length;
  const improveMoments=matched.filter(node=>node.verdict==='IMPROVE').length;
  const status:ScenarioPrimeReview['status']=!matched.length
    ?'NOT_OBSERVED'
    :cleanMoments&&improveMoments
      ?'MIXED'
      :improveMoments
        ?'MISSED'
        :'EXECUTED';
  return{
    version:1,
    active:true,
    memoryId:prime.memoryId,
    behaviourKey:prime.behaviourKey,
    behaviourLabel:prime.behaviourLabel,
    situationTag:prime.situationTag,
    status,
    matchedMoments:matched.length,
    cleanMoments,
    improveMoments,
    note:status==='NOT_OBSERVED'
      ?'The scheduled memory rep did not produce a verified comparable decision, so the spacing schedule is not rewarded or punished.'
      :status==='EXECUTED'
        ?'The scheduled memory rep appeared and every verified comparable decision used the cleaner branch. This is one reinforcement rep, not instant mastery.'
        :status==='MISSED'
          ?'The scheduled memory rep appeared and the old branch returned in every verified comparable decision. Keep the memory active.'
          :'The scheduled memory rep was mixed: the new branch appeared, but it is not stable yet.',
    boundary:'A single clean game reinforces a memory but never proves mastery by itself. Mastery still requires repeated comparable evidence across games.',
  };
}
