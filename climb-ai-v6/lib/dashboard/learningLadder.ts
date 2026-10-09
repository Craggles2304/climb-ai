import type {DecisionBehaviourKey,DecisionSituationTag} from '../decisionTwin';
import type {DecisionTwinV2Profile} from '../decisionTwinV2';
import type {ScenarioMemoryCard,ScenarioMemoryProfile} from '../scenarioMemory';
import type {DecisionTransferCard,DecisionTransferProfile} from '../decisionTransfer';
import {championDisplayName} from '../championArt';

/**
 * Decision Twin V5 learning ladder, read from the PRO /api/decision-twin payload.
 *
 *   Mistake → Repeated Pattern → Scenario Memory → Local Mastery → Transfer → Generalisation → Principle Owned
 *
 * Each behaviour is placed on the highest rung its evidence supports and no
 * higher. A transfer card only exists once a behaviour was mastered on a source
 * champion and situation, so local mastery never implies transfer: a lesson
 * learned on Aphelios is LOCAL ONLY until clean decisions show up on another
 * champion or in a new situation.
 */

export const LADDER=['MISTAKE','REPEATED PATTERN','SCENARIO MEMORY','LOCAL MASTERY','TRANSFER','GENERALISATION','PRINCIPLE OWNED'] as const;
export type LadderRung=typeof LADDER[number];

export type TransferStatus='NOT_OBSERVED'|'NOT_READY'|'LOCAL_ONLY'|'TESTING'|'TRANSFERRED'|'GENERALISING'|'PRINCIPLE_OWNED'|'REGRESSED';

export const TRANSFER_STATUS_LABEL:Record<TransferStatus,string>={
  NOT_OBSERVED:'NOT OBSERVED',
  NOT_READY:'NOT READY',
  LOCAL_ONLY:'LOCAL ONLY',
  TESTING:'TRANSFER TESTING',
  TRANSFERRED:'TRANSFERRED',
  GENERALISING:'GENERALISING',
  PRINCIPLE_OWNED:'PRINCIPLE OWNED',
  REGRESSED:'REGRESSED',
};

export type LadderRow={
  behaviourKey:DecisionBehaviourKey;
  label:string;
  /** Index into LADDER of the highest rung the evidence supports. */
  reached:number;
  /** The rung being worked on now, or null once the principle is owned. */
  working:number|null;
  status:TransferStatus;
  regressed:boolean;
  sourceChampion:string|null;
  sourceSituation:string|null;
  testedOn:string[];
  transferGames:number;
  cleanTransferGames:number;
  memoryGames:number|null;
  memoryCleanRate:number|null;
  evidence:string;
  next:string;
};

export type LearningLadder={
  gamesAnalyzed:number;
  rows:LadderRow[];
  counts:{localOnly:number;testing:number;transferred:number;principleOwned:number;regressed:number};
  identity:{status:'BUILDING'|'READY';headline:string;summary:string}|null;
};

export type DecisionTwinPayload={
  twin?:DecisionTwinV2Profile|null;
  scenarioMemory?:ScenarioMemoryProfile|null;
  decisionTransfer?:DecisionTransferProfile|null;
};

const pretty=(value:string)=>value.replaceAll('_',' ').toLowerCase().replace(/(^|\s)\S/g,part=>part.toUpperCase());
const situation=(tag:DecisionSituationTag|null|undefined)=>tag&&tag!=='GENERAL'?pretty(tag):null;

const TRANSFER_RUNG:Record<DecisionTransferCard['state'],{reached:number;working:number|null;status:TransferStatus}>={
  NOT_READY:{reached:3,working:4,status:'LOCAL_ONLY'},
  LOCAL_ONLY:{reached:3,working:4,status:'LOCAL_ONLY'},
  TESTING:{reached:3,working:4,status:'TESTING'},
  TRANSFERRING:{reached:4,working:5,status:'TRANSFERRED'},
  GENERALISING:{reached:5,working:6,status:'GENERALISING'},
  PRINCIPLE_OWNED:{reached:6,working:null,status:'PRINCIPLE_OWNED'},
  REGRESSED:{reached:3,working:4,status:'REGRESSED'},
};

function fromTransfer(card:DecisionTransferCard,memory:ScenarioMemoryCard|undefined):LadderRow{
  const rung=TRANSFER_RUNG[card.state]??TRANSFER_RUNG.LOCAL_ONLY;
  const source=championDisplayName(card.sourceChampion);
  const tested=card.novelChampions.length
    ?card.novelChampions.map(championDisplayName)
    :card.novelContexts.map(tag=>pretty(tag));
  const next=card.state==='PRINCIPLE_OWNED'
    ?'Owned. OP CLIMB keeps watching for regression.'
    :card.state==='REGRESSED'
      ?`Recent games stopped showing it away from ${source}. Rebuild it before the next test.`
      :card.state==='LOCAL_ONLY'||card.state==='NOT_READY'
        ?`Learned on ${source}. Not yet seen on another champion or in a new situation.`
        :card.state==='TESTING'
          ?`Being tested away from ${source}: ${card.cleanTransferGames}/${card.transferGames} clean so far.`
          :`Holding away from ${source}. Widen it to more champions and situations.`;
  return{
    behaviourKey:card.behaviourKey,
    label:card.behaviourLabel,
    reached:rung.reached,
    working:rung.working,
    status:rung.status,
    regressed:card.state==='REGRESSED',
    sourceChampion:source,
    sourceSituation:situation(card.sourceTag),
    testedOn:tested,
    transferGames:card.transferGames,
    cleanTransferGames:card.cleanTransferGames,
    memoryGames:memory?.comparableGames??null,
    memoryCleanRate:memory?.cleanRate??null,
    evidence:card.evidence||card.summary,
    next,
  };
}

function fromMemory(card:ScenarioMemoryCard):LadderRow{
  const mastered=card.state==='MASTERED';
  const building=card.state==='BUILDING';
  return{
    behaviourKey:card.behaviourKey,
    label:card.behaviourLabel,
    reached:mastered?3:building?1:2,
    working:mastered?4:building?2:3,
    status:mastered?'LOCAL_ONLY':'NOT_READY',
    regressed:card.state==='REGRESSED',
    sourceChampion:null,
    sourceSituation:situation(card.situationTag),
    testedOn:[],
    transferGames:0,
    cleanTransferGames:0,
    memoryGames:card.comparableGames,
    memoryCleanRate:card.cleanRate,
    evidence:card.evidence||card.summary,
    next:mastered
      ?'Mastered in this situation. The transfer test comes next.'
      :card.dueNextGame?'This situation is due for review in your next game.':'Clean repeats in this situation build local mastery.',
  };
}

/** Behaviours worth showing, most urgent first, without inventing any that have no evidence. */
export function buildLearningLadder(payload:DecisionTwinPayload|null|undefined,limit=4):LearningLadder|null{
  if(!payload)return null;
  const transfer=payload.decisionTransfer?.cards??[];
  const memory=payload.scenarioMemory?.cards??[];
  const twin=payload.twin??null;
  const rows:LadderRow[]=[];
  const seen=new Set<DecisionBehaviourKey>();
  const strongestMemory=(key:DecisionBehaviourKey)=>memory
    .filter(card=>card.behaviourKey===key)
    .sort((a,b)=>b.memoryStrength-a.memoryStrength||b.comparableGames-a.comparableGames)[0];

  const transferOrder:Record<DecisionTransferCard['state'],number>={REGRESSED:0,TESTING:1,LOCAL_ONLY:2,NOT_READY:3,TRANSFERRING:4,GENERALISING:5,PRINCIPLE_OWNED:6};
  for(const card of [...transfer].sort((a,b)=>transferOrder[a.state]-transferOrder[b.state])){
    if(seen.has(card.behaviourKey))continue;
    seen.add(card.behaviourKey);
    rows.push(fromTransfer(card,strongestMemory(card.behaviourKey)));
  }
  const memoryOrder:Record<ScenarioMemoryCard['state'],number>={REGRESSED:0,DUE:1,LEARNING:2,STABILISING:3,MASTERED:4,BUILDING:5};
  for(const card of [...memory].filter(item=>item.state!=='BUILDING').sort((a,b)=>memoryOrder[a.state]-memoryOrder[b.state]||b.comparableGames-a.comparableGames)){
    if(seen.has(card.behaviourKey))continue;
    seen.add(card.behaviourKey);
    rows.push(fromMemory(card));
  }
  // A recurring risk the twin has named, before any scenario memory exists for it.
  const risk=twin?.identity.primary;
  if(risk&&risk.kind==='RISK'&&!seen.has(risk.key)&&risk.applicableGames>0){
    seen.add(risk.key);
    const repeated=risk.applicableGames>=2&&risk.confidence!=='LOW';
    rows.push({
      behaviourKey:risk.key,
      label:risk.behaviourLabel,
      reached:repeated?1:0,
      working:repeated?2:1,
      status:'NOT_READY',
      regressed:false,
      sourceChampion:null,
      sourceSituation:null,
      testedOn:[],
      transferGames:0,
      cleanTransferGames:0,
      memoryGames:null,
      memoryCleanRate:null,
      evidence:risk.evidence,
      next:repeated?'Seen across games. Comparable situations now build a scenario memory.':'Seen once. One game is a mistake, not yet a pattern.',
    });
  }

  return{
    gamesAnalyzed:Math.max(twin?.gamesAnalyzed??0,payload.scenarioMemory?.gamesAnalyzed??0,payload.decisionTransfer?.gamesAnalyzed??0),
    rows:rows.slice(0,limit),
    counts:{
      localOnly:transfer.filter(card=>card.state==='LOCAL_ONLY'||card.state==='NOT_READY').length,
      testing:transfer.filter(card=>card.state==='TESTING').length,
      transferred:transfer.filter(card=>card.state==='TRANSFERRING'||card.state==='GENERALISING').length,
      principleOwned:transfer.filter(card=>card.state==='PRINCIPLE_OWNED').length,
      regressed:transfer.filter(card=>card.state==='REGRESSED').length,
    },
    identity:twin?{status:twin.identity.status,headline:twin.identity.headline,summary:twin.identity.summary}:null,
  };
}
