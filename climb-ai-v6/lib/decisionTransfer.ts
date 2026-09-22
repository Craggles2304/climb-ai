import type {HistoryAnalysisRow} from './riot/proHistory';
import type {
  DecisionBehaviourKey,
  DecisionSituationTag,
  DecisionTwinConfidence,
  DraftSituationContext,
} from './decisionTwin';
import type {DecisionSimulation} from './decisionSimulation';
import type {ScenarioMemoryProfile,ScenarioPrime} from './scenarioMemory';

export type DecisionTransferState='NOT_READY'|'LOCAL_ONLY'|'TESTING'|'TRANSFERRING'|'GENERALISING'|'PRINCIPLE_OWNED'|'REGRESSED';
export type DecisionTransferDimension='NONE'|'CHAMPION'|'CONTEXT'|'BOTH';

export interface DecisionTransferCard{
  id:string;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  state:DecisionTransferState;
  confidence:DecisionTwinConfidence;
  sourceMemoryId:string;
  sourceTag:DecisionSituationTag;
  sourceChampion:string;
  sourceRole:string|null;
  sourceStrength:number;
  sourceMasteredGame:number;
  principle:string;
  transferGames:number;
  cleanTransferGames:number;
  improveTransferGames:number;
  transferCleanRate:number|null;
  recentTransferGames:number;
  recentCleanRate:number|null;
  transferCleanStreak:number;
  novelChampions:string[];
  novelContexts:DecisionSituationTag[];
  dimension:DecisionTransferDimension;
  breadthScore:number;
  transferStrength:number;
  lastTransferAt:string|null;
  nextTransferNeeded:boolean;
  summary:string;
  evidence:string;
}

export interface DecisionTransferProfile{
  version:1;
  gamesAnalyzed:number;
  generatedAt:string;
  cards:DecisionTransferCard[];
  locallyMastered:number;
  transferring:number;
  principleOwned:number;
  regressed:number;
  activeTransfer:DecisionTransferCard|null;
  summary:string;
  boundary:string;
}

export interface DecisionTransferPrime{
  version:1;
  transferId:string;
  behaviourKey:DecisionBehaviourKey;
  behaviourLabel:string;
  sourceMemoryId:string;
  sourceTag:DecisionSituationTag;
  sourceChampion:string;
  targetTag:DecisionSituationTag;
  targetChampion:string;
  targetRole:string|null;
  dimension:Exclude<DecisionTransferDimension,'NONE'>;
  state:DecisionTransferState;
  confidence:DecisionTwinConfidence;
  transferStrength:number;
  title:string;
  principle:string;
  trigger:string;
  targetMove:string;
  exactDraftRead:string;
  whyNow:string;
  rehearsalQuestion:string;
  evidence:string;
  simulationScenarioId:string|null;
  boundary:string;
}

export interface DecisionTransferObservedDecision{
  behaviourKey:DecisionBehaviourKey;
  verdict:'GOOD'|'IMPROVE'|'NEUTRAL';
  confidence:'HIGH'|'MEDIUM'|'LOW';
  situationTags:DecisionSituationTag[];
}

export interface DecisionTransferReview{
  version:1;
  active:boolean;
  transferId:string|null;
  behaviourKey:DecisionBehaviourKey|null;
  behaviourLabel:string|null;
  sourceTag:DecisionSituationTag|null;
  targetTag:DecisionSituationTag|null;
  dimension:DecisionTransferDimension;
  status:'NO_TEST'|'NOT_OBSERVED'|'TRANSFERRED'|'FAILED_TRANSFER'|'MIXED';
  matchedMoments:number;
  cleanMoments:number;
  improveMoments:number;
  note:string;
  boundary:string;
}

type Observation={
  rowIndex:number;
  createdAt:string;
  champion:string;
  role:string|null;
  verdict:'GOOD'|'IMPROVE';
  tags:DecisionSituationTag[];
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

const DEFAULT_RULES:Record<DecisionBehaviourKey,string>={
  FIGHT_SELECTION:'CHOOSE THE FIGHT FROM NUMBERS, POSITION AND YOUR TRIGGER — NOT FROM FIRST CONTACT.',
  DEATH_RECOVERY:'AFTER A SETBACK, REBUILD RESOURCES AND INFORMATION BEFORE THE NEXT CONTEST.',
  LEAD_PROTECTION:'CONVERT A LEAD INTO CONTROL INSTEAD OF USING IT TO BUY A HARDER FIGHT.',
  RESET_DISCIPLINE:'TURN BANKED GOLD INTO REAL POWER BEFORE THE NEXT VOLUNTARY FIGHT.',
  OBJECTIVE_READINESS:'ARRIVE TO IMPORTANT SPACE BEFORE THE LAST LOW-VALUE RESOURCE.',
  FARM_VS_SETUP:'CONNECT TO THE REAL TEAM WINDOW BEFORE TAKING THE EXTRA WAVE OR CAMP.',
  THREAT_ADAPTATION:'WHEN A THREAT SHOWS ITS ACCESS PATTERN, CHANGE THE NEXT ENTRY.',
  CARRY_PRESERVATION:'FIRST CONTACT DOES NOT REMOVE THE SECOND THREAT. PRESERVE THE SAFE DAMAGE LINE.',
  POWER_SPIKE_CONVERSION:'WHEN YOUR POWER WINDOW COMPLETES, CONNECT TO PRESSURE BEFORE DRIFTING BACK INTO FARM.',
  SURVIVAL_VALUE:'WHEN YOUR LIFE HOLDS HIGH TEAM VALUE, PRESERVE UPTIME BEFORE REACHING FOR LOWER-VALUE ACCESS.',
};

const BOUNDARY='Decision Transfer only starts after a Scenario Memory has been locally mastered in verified history. A later isolated miss does not erase that earned transfer history; sustained regression can reopen it. Same-champion/same-context play is retention, not transfer, and generalisation still requires repeated verified decisions under meaningfully different conditions.';

function clean(value:unknown){return String(value??'').replace(/\s+/g,' ').trim()}
function pct(value:number,total:number){return total?Math.round(value/total*100):null}
function cap(value:number,min=0,max=100){return Math.max(min,Math.min(max,Math.round(value)))}
function confidence(games:number):DecisionTwinConfidence{return games>=6?'HIGH':games>=3?'MEDIUM':'LOW'}
function tagsFor(node:any):DecisionSituationTag[]{
  const tags=(Array.isArray(node?.situationTags)?node.situationTags:[])
    .map((tag:unknown)=>clean(tag).toUpperCase())
    .filter(Boolean) as DecisionSituationTag[];
  return tags.length?[...new Set(tags)]:['GENERAL'];
}
function streak(values:Observation[]){
  let count=0;
  for(let i=values.length-1;i>=0;i--){
    if(values[i].verdict!=='GOOD')break;
    count++;
  }
  return count;
}
function chooseMostCommon(values:string[]){
  const counts=new Map<string,number>();
  for(const value of values.filter(Boolean))counts.set(value,(counts.get(value)??0)+1);
  return [...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??'Unknown';
}
function chooseRole(values:(string|null)[]){
  const choice=chooseMostCommon(values.map(value=>clean(value)).filter(Boolean));
  return choice==='Unknown'?null:choice;
}
function principleFrom(observations:Observation[],behaviour:DecisionBehaviourKey){
  const latest=[...observations].reverse().find(item=>clean(item.node?.counterfactual?.alternative)||clean(item.node?.lockedPrinciple));
  return clean(latest?.node?.counterfactual?.alternative)||clean(latest?.node?.lockedPrinciple)||DEFAULT_RULES[behaviour];
}
function masteredIndex(observations:Observation[]):number|null{
  for(let i=3;i<observations.length;i++){
    const prefix=observations.slice(0,i+1);
    const recent=prefix.slice(-4);
    const recentClean=recent.filter(item=>item.verdict==='GOOD').length;
    if(streak(prefix)>=3&&(pct(recentClean,recent.length)??0)>=80)return observations[i].rowIndex;
  }
  return null;
}
function breadth(champions:string[],contexts:DecisionSituationTag[]){
  const championPoints=Math.min(2,champions.length);
  const contextPoints=Math.min(2,contexts.length);
  return championPoints+contextPoints;
}
function dimensionFor(champions:string[],contexts:DecisionSituationTag[]):DecisionTransferDimension{
  if(champions.length&&contexts.length)return'BOTH';
  if(champions.length)return'CHAMPION';
  if(contexts.length)return'CONTEXT';
  return'NONE';
}
function transferState(input:{
  novel:Observation[];
  clean:number;
  recentRate:number|null;
  novelChampions:string[];
  novelContexts:DecisionSituationTag[];
}):DecisionTransferState{
  if(!input.novel.length)return'LOCAL_ONLY';
  const older=input.novel.slice(0,-3);
  const olderRate=pct(older.filter(item=>item.verdict==='GOOD').length,older.length)??0;
  const recentThree=input.novel.slice(-3);
  if(older.length>=3&&recentThree.length===3&&olderRate>=80&&recentThree.every(item=>item.verdict==='IMPROVE'))return'REGRESSED';
  const cleanStreak=streak(input.novel);
  const breadthScore=breadth(input.novelChampions,input.novelContexts);
  if(input.clean>=4&&(input.recentRate??0)>=80&&cleanStreak>=3&&breadthScore>=2)return'PRINCIPLE_OWNED';
  if(input.clean>=3&&(input.recentRate??0)>=75&&breadthScore>=2)return'GENERALISING';
  if(input.clean>=2&&(input.recentRate??0)>=67)return'TRANSFERRING';
  return'TESTING';
}
function strength(input:{
  novel:Observation[];clean:number;recentRate:number|null;novelChampions:string[];novelContexts:DecisionSituationTag[];state:DecisionTransferState;
}){
  if(!input.novel.length)return 0;
  const allRate=pct(input.clean,input.novel.length)??0;
  const breadthScore=breadth(input.novelChampions,input.novelContexts);
  const stateBoost=input.state==='PRINCIPLE_OWNED'?10:input.state==='GENERALISING'?6:input.state==='REGRESSED'?-12:0;
  return cap(allRate*.38+(input.recentRate??0)*.36+breadthScore*6+Math.min(4,streak(input.novel))*3+stateBoost);
}

export function buildDecisionTransfer(
  rows:HistoryAnalysisRow[],
  memory:ScenarioMemoryProfile,
  generatedAt=new Date().toISOString(),
):DecisionTransferProfile{
  const ordered=[...rows].filter(row=>row.analysis?.version===1).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-50);
  const byBehaviour=new Map<DecisionBehaviourKey,Observation[]>();

  ordered.forEach((row,rowIndex)=>{
    const nodes=(((row.analysis as any)?.decisionGraph?.nodes??[]) as any[])
      .filter(node=>node&&node.confidence!=='LOW'&&(node.verdict==='GOOD'||node.verdict==='IMPROVE'));
    const perBehaviour=new Map<DecisionBehaviourKey,Observation>();
    for(const node of nodes){
      const behaviour=clean(node.behaviourKey).toUpperCase() as DecisionBehaviourKey;
      if(!LABELS[behaviour])continue;
      const next:Observation={
        rowIndex,
        createdAt:row.createdAt,
        champion:clean(row.champion)||'Unknown',
        role:clean(row.role)||null,
        verdict:node.verdict,
        tags:tagsFor(node),
        node,
      };
      const previous=perBehaviour.get(behaviour);
      if(!previous||next.verdict==='IMPROVE'||(previous.verdict===next.verdict&&node.counterfactual&&!previous.node?.counterfactual))perBehaviour.set(behaviour,next);
    }
    for(const [behaviour,observation] of perBehaviour){
      const list=byBehaviour.get(behaviour)??[];
      list.push(observation);
      byBehaviour.set(behaviour,list);
    }
  });

  const bestHistoricallyMastered=new Map<DecisionBehaviourKey,ScenarioMemoryProfile['cards'][number]>();
  for(const card of memory.cards.filter(item=>item.state!=='BUILDING')){
    const observations=byBehaviour.get(card.behaviourKey)??[];
    const sourceObs=observations.filter(item=>item.tags.includes(card.situationTag));
    if(sourceObs.length<4||masteredIndex(sourceObs)===null)continue;
    const current=bestHistoricallyMastered.get(card.behaviourKey);
    if(!current||card.memoryStrength>current.memoryStrength||card.comparableGames>current.comparableGames)bestHistoricallyMastered.set(card.behaviourKey,card);
  }

  const cards:DecisionTransferCard[]=[];
  for(const [behaviour,source] of bestHistoricallyMastered){
    const observations=byBehaviour.get(behaviour)??[];
    const sourceObs=observations.filter(item=>item.tags.includes(source.situationTag));
    if(sourceObs.length<4)continue;
    const championGroups=new Map<string,Observation[]>();
    for(const observation of sourceObs){
      const list=championGroups.get(observation.champion)??[];
      list.push(observation);
      championGroups.set(observation.champion,list);
    }
    const masteredSources=[...championGroups.entries()]
      .map(([champion,items])=>({champion,items,masteredAt:masteredIndex(items)}))
      .filter((item):item is {champion:string;items:Observation[];masteredAt:number}=>item.masteredAt!==null)
      .sort((a,b)=>b.items.length-a.items.length||a.masteredAt-b.masteredAt||a.champion.localeCompare(b.champion));
    const masteredSource=masteredSources[0];
    if(!masteredSource)continue;
    const sourceChampion=masteredSource.champion;
    const sourceChampionObs=masteredSource.items;
    const sourceRole=chooseRole(sourceChampionObs.map(item=>item.role));
    const sourceMasteredGame=masteredSource.masteredAt;
    const postMastery=observations.filter(item=>item.rowIndex>sourceMasteredGame);
    const novel=postMastery.filter(item=>
      item.champion!==sourceChampion
      ||item.tags.some(tag=>tag!=='GENERAL'&&tag!==source.situationTag)
    );
    const cleanTransferGames=novel.filter(item=>item.verdict==='GOOD').length;
    const improveTransferGames=novel.length-cleanTransferGames;
    const recent=novel.slice(-4);
    const recentRate=pct(recent.filter(item=>item.verdict==='GOOD').length,recent.length);
    const novelChampions=[...new Set(novel.filter(item=>item.champion!==sourceChampion).map(item=>item.champion))];
    const novelContexts=[...new Set(novel.flatMap(item=>item.tags).filter(tag=>tag!=='GENERAL'&&tag!==source.situationTag))];
    const state=transferState({novel,clean:cleanTransferGames,recentRate,novelChampions,novelContexts});
    const dimension=dimensionFor(novelChampions,novelContexts);
    const transferStrength=strength({novel,clean:cleanTransferGames,recentRate,novelChampions,novelContexts,state});
    const principle=principleFrom(sourceChampionObs,behaviour);
    const card:DecisionTransferCard={
      id:'transfer:'+behaviour.toLowerCase(),
      behaviourKey:behaviour,
      behaviourLabel:LABELS[behaviour],
      state,
      confidence:confidence(novel.length),
      sourceMemoryId:source.id,
      sourceTag:source.situationTag,
      sourceChampion,
      sourceRole,
      sourceStrength:source.memoryStrength,
      sourceMasteredGame:sourceMasteredGame+1,
      principle,
      transferGames:novel.length,
      cleanTransferGames,
      improveTransferGames,
      transferCleanRate:pct(cleanTransferGames,novel.length),
      recentTransferGames:recent.length,
      recentCleanRate:recentRate,
      transferCleanStreak:streak(novel),
      novelChampions,
      novelContexts,
      dimension,
      breadthScore:breadth(novelChampions,novelContexts),
      transferStrength,
      lastTransferAt:novel.at(-1)?.createdAt??null,
      nextTransferNeeded:state!=='PRINCIPLE_OWNED',
      summary:'',
      evidence:source.behaviourLabel+' locally mastered in '+source.situationTag.replaceAll('_',' ').toLowerCase()+' · '+sourceChampion+' source · '+novel.length+' novel game'+(novel.length===1?'':'s')+' · '+cleanTransferGames+' clean',
    };
    card.summary=state==='PRINCIPLE_OWNED'
      ?card.behaviourLabel+' is transferring across meaningfully different conditions. The principle is supported beyond one memorised cue.'
      :state==='REGRESSED'
        ?card.behaviourLabel+' had transferred cleanly, but a recent novel condition reopened the principle.'
        :state==='GENERALISING'
          ?card.behaviourLabel+' is now clean across more than one condition. Keep testing breadth before calling the principle owned.'
          :state==='TRANSFERRING'
            ?card.behaviourLabel+' has started to transfer beyond '+sourceChampion+' / '+source.situationTag.replaceAll('_',' ').toLowerCase()+'.'
            :state==='TESTING'
              ?card.behaviourLabel+' is locally mastered, but transfer evidence is still mixed or too small.'
              :card.behaviourLabel+' is locally mastered. OP CLIMB has not yet seen a genuinely different condition to prove transfer.';
    cards.push(card);
  }

  cards.sort((a,b)=>{
    const weight=(state:DecisionTransferState)=>state==='REGRESSED'?6:state==='LOCAL_ONLY'?5:state==='TESTING'?4:state==='TRANSFERRING'?3:state==='GENERALISING'?2:state==='PRINCIPLE_OWNED'?1:0;
    return weight(b.state)-weight(a.state)||a.transferStrength-b.transferStrength||b.sourceStrength-a.sourceStrength;
  });

  const locallyMastered=cards.length;
  const transferring=cards.filter(card=>['TRANSFERRING','GENERALISING'].includes(card.state)).length;
  const principleOwned=cards.filter(card=>card.state==='PRINCIPLE_OWNED').length;
  const regressed=cards.filter(card=>card.state==='REGRESSED').length;
  const activeTransfer=cards.find(card=>card.nextTransferNeeded)??null;

  return{
    version:1,
    gamesAnalyzed:ordered.length,
    generatedAt,
    cards,
    locallyMastered,
    transferring,
    principleOwned,
    regressed,
    activeTransfer,
    summary:!cards.length
      ?'Transfer Learning is waiting for a locally mastered Scenario Memory. V5 will not test generalisation before the underlying decision is stable.'
      :regressed
        ?String(regressed)+' transferred principle '+(regressed===1?'has':'have')+' reopened under a novel condition.'
        :principleOwned===cards.length
          ?'Every eligible locally mastered behaviour has now shown repeated transfer beyond its original cue.'
          :String(cards.filter(card=>card.nextTransferNeeded).length)+' locally mastered principle '+(cards.filter(card=>card.nextTransferNeeded).length===1?'still needs':'still need')+' proof under a different condition.',
    boundary:BOUNDARY,
  };
}

function targetTagFor(source:DecisionTransferCard,context:DraftSituationContext){
  return context.tags.find(tag=>tag!=='GENERAL'&&tag!==source.sourceTag)??source.sourceTag;
}
function targetDimension(source:DecisionTransferCard,champion:string,targetTag:DecisionSituationTag):Exclude<DecisionTransferDimension,'NONE'>{
  const championNovel=clean(champion)!==clean(source.sourceChampion);
  const contextNovel=targetTag!==source.sourceTag;
  return championNovel&&contextNovel?'BOTH':championNovel?'CHAMPION':'CONTEXT';
}

export function selectDecisionTransferPrime(input:{
  transfer:DecisionTransferProfile;
  memory:ScenarioMemoryProfile;
  scenarioPrime:ScenarioPrime|null|undefined;
  situationContext:DraftSituationContext;
  simulation:DecisionSimulation|null|undefined;
  champion:string;
  role:string|null;
  enabled?:boolean;
  behaviourKey?:DecisionBehaviourKey|null;
}):DecisionTransferPrime|null{
  if(input.enabled===false)return null;
  if(input.scenarioPrime&&input.scenarioPrime.state!=='MASTERED')return null;

  const candidates=input.transfer.cards
    .filter(card=>card.nextTransferNeeded)
    .filter(card=>!input.behaviourKey||card.behaviourKey===input.behaviourKey)
    .map(card=>{
      const targetTag=targetTagFor(card,input.situationContext);
      const championNovel=clean(input.champion)!==clean(card.sourceChampion);
      const contextNovel=targetTag!==card.sourceTag;
      if(!championNovel&&!contextNovel)return null;
      const simulation=input.simulation?.scenarios?.find(item=>
        item.behaviourKey===card.behaviourKey
        &&(!item.situationTag||item.situationTag===targetTag||targetTag==='GENERAL')
      )??null;
      const stateWeight=card.state==='REGRESSED'?45:card.state==='LOCAL_ONLY'?36:card.state==='TESTING'?31:card.state==='TRANSFERRING'?24:card.state==='GENERALISING'?17:0;
      const score=stateWeight+(100-card.transferStrength)*.18+(simulation?14:0)+(contextNovel?8:0)+(championNovel?6:0);
      return{card,targetTag,simulation,score};
    })
    .filter(Boolean)
    .sort((a,b)=>(b?.score??0)-(a?.score??0));

  const selected=candidates[0];
  if(!selected)return null;
  const {card,targetTag,simulation}=selected;
  const dimension=targetDimension(card,input.champion,targetTag);
  const targetContext=targetTag.replaceAll('_',' ').toLowerCase();
  const sourceContext=card.sourceTag.replaceAll('_',' ').toLowerCase();

  return{
    version:1,
    transferId:card.id,
    behaviourKey:card.behaviourKey,
    behaviourLabel:card.behaviourLabel,
    sourceMemoryId:card.sourceMemoryId,
    sourceTag:card.sourceTag,
    sourceChampion:card.sourceChampion,
    targetTag,
    targetChampion:clean(input.champion)||'Unknown',
    targetRole:clean(input.role)||null,
    dimension,
    state:card.state,
    confidence:card.confidence,
    transferStrength:card.transferStrength,
    title:'TRANSFER TEST · '+card.behaviourLabel.toUpperCase(),
    principle:card.principle,
    trigger:clean(simulation?.trigger)||('WHEN THE '+targetContext.toUpperCase()+' WINDOW APPEARS.'),
    targetMove:clean(simulation?.targetMove)||card.principle,
    exactDraftRead:clean(simulation?.exactDraftRead)||('You learned this principle on '+card.sourceChampion+' in '+sourceContext+'. This draft tests whether it survives '+(dimension==='BOTH'?'a new champion and context':dimension==='CHAMPION'?'a new champion':'a new context')+'.'),
    whyNow:card.state==='REGRESSED'
      ?'The principle had transferred before, but novel mistakes returned. Re-test it before promoting the learning again.'
      :card.state==='LOCAL_ONLY'
        ?'The original Scenario Memory is mastered. The next coaching question is whether you learned the principle or only memorised the original cue.'
        :'The principle has begun to transfer, but V5 still needs repeated clean evidence under different conditions.',
    rehearsalQuestion:'CAN YOU APPLY THE SAME PRINCIPLE WITHOUT RELYING ON THE ORIGINAL '+card.sourceChampion.toUpperCase()+' / '+sourceContext.toUpperCase()+' CUE?',
    evidence:card.evidence+' · transfer strength '+String(card.transferStrength)+'/100',
    simulationScenarioId:simulation?.id??null,
    boundary:'This tests generalisation from prior verified learning. It does not assume a different champion or context is mechanically identical, and one clean transfer is not enough to own the principle.',
  };
}

export function reviewDecisionTransfer(
  prime:DecisionTransferPrime|null|undefined,
  nodes:DecisionTransferObservedDecision[],
):DecisionTransferReview{
  if(!prime){
    return{
      version:1,active:false,transferId:null,behaviourKey:null,behaviourLabel:null,sourceTag:null,targetTag:null,dimension:'NONE',
      status:'NO_TEST',matchedMoments:0,cleanMoments:0,improveMoments:0,
      note:'No Decision Transfer test was frozen before this game.',
      boundary:'No frozen transfer test means no transfer score. OP CLIMB does not invent generalisation after seeing the result.',
    };
  }
  const matched=nodes.filter(node=>
    node.confidence!=='LOW'
    &&node.behaviourKey===prime.behaviourKey
    &&(prime.targetTag==='GENERAL'||node.situationTags.includes(prime.targetTag))
    &&(node.verdict==='GOOD'||node.verdict==='IMPROVE')
  );
  const cleanMoments=matched.filter(node=>node.verdict==='GOOD').length;
  const improveMoments=matched.filter(node=>node.verdict==='IMPROVE').length;
  const status:DecisionTransferReview['status']=!matched.length
    ?'NOT_OBSERVED'
    :cleanMoments&&improveMoments
      ?'MIXED'
      :improveMoments
        ?'FAILED_TRANSFER'
        :'TRANSFERRED';
  return{
    version:1,
    active:true,
    transferId:prime.transferId,
    behaviourKey:prime.behaviourKey,
    behaviourLabel:prime.behaviourLabel,
    sourceTag:prime.sourceTag,
    targetTag:prime.targetTag,
    dimension:prime.dimension,
    status,
    matchedMoments:matched.length,
    cleanMoments,
    improveMoments,
    note:status==='NOT_OBSERVED'
      ?'The novel transfer condition did not produce a verified comparable decision, so V5 leaves the transfer model unchanged.'
      :status==='TRANSFERRED'
        ?'The player applied the learned principle under the frozen novel condition. This is transfer evidence, not proof of universal mastery.'
        :status==='FAILED_TRANSFER'
          ?'The original principle did not hold in the frozen novel condition. Keep local mastery, but do not promote the principle as generalised.'
          :'The novel condition produced both clean and missed decisions. The principle is transferring, but it is not stable yet.',
    boundary:'Transfer is credited only when the test was frozen before the match and a verified comparable decision actually occurred. One game cannot prove a universal principle.',
  };
}
