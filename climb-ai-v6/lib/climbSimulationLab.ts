import {buildDecisionTwinV2,type DecisionTwinV2Profile} from './decisionTwinV2';
import {buildScenarioMemory,type ScenarioMemoryProfile,type ScenarioMemoryCard} from './scenarioMemory';
import {buildDecisionTransfer,selectDecisionTransferPrime,type DecisionTransferProfile,type DecisionTransferPrime} from './decisionTransfer';
import {buildClimbCurriculum,type ClimbCurriculum,type CurriculumLesson} from './climbCurriculum';
import {buildDraftSituationContext,type DecisionBehaviourKey,type DecisionSituationTag} from './decisionTwin';
import {buildClimbMatchMission,type ClimbMatchMission} from './climbMissionDesign';
import {buildDecisionGraph,type DecisionGraph,type LockedDecisionPlan} from './decisionGraph';
import type {HistoryAnalysisRow} from './riot/proHistory';
import type {ProMatchAnalysis} from './riot/proAnalysis';
import type {StrengthTimeline,FightReview} from './riot/liveStrength';

export type SimulationArchetypeId=
  |'FAST_LEARNER'
  |'STEADY_LEARNER'
  |'STUBBORN_REPEATER'
  |'CONTEXT_MEMORIZER'
  |'REGRESSION_CASE'
  |'SPARSE_EVIDENCE';

export interface SimulationArchetype{
  id:SimulationArchetypeId;
  label:string;
  initialSkill:number;
  learningRate:number;
  maxSkill:number;
  novelPenalty:number;
  notObservedRate:number;
  irrelevantDraftRate:number;
  regressionAt:number|null;
  regressionDrop:number;
}

export interface SimulationGameEvent{
  game:number;
  champion:string;
  situationTag:DecisionSituationTag;
  curriculumStatus:ClimbCurriculum['status'];
  curriculumPhase:CurriculumLesson['phase']|null;
  repLevel:number|null;
  repStage:string|null;
  missionStatus:ClimbMatchMission['status']|null;
  missionReview:string;
  transferPrime:boolean;
  outcome:'GOOD'|'IMPROVE'|'NOT_OBSERVED';
  latentSkill:number;
  comparableGames:number;
  memoryState:string|null;
  transferState:string|null;
  postRepLevel:number|null;
}

export interface SimulationCareerReport{
  archetype:SimulationArchetypeId;
  label:string;
  games:number;
  missionsReady:number;
  missionsNotRelevant:number;
  notObserved:number;
  goodDecisions:number;
  improveDecisions:number;
  promotions:number;
  demotions:number;
  maxLevel:number;
  finalLevel:number|null;
  finalPhase:string|null;
  principleOwned:boolean;
  finalMemoryState:string|null;
  finalTransferState:string|null;
  finalSkill:number;
  invariants:string[];
  events:SimulationGameEvent[];
}

export interface ClimbSimulationLabReport{
  version:1;
  gamesPerCareer:number;
  careers:SimulationCareerReport[];
  totalGames:number;
  totalPromotions:number;
  totalDemotions:number;
  totalNotObserved:number;
  invariantViolations:string[];
  summary:string;
}

type ProfileBundle={
  twin:DecisionTwinV2Profile;
  memory:ScenarioMemoryProfile;
  transfer:DecisionTransferProfile;
  curriculum:ClimbCurriculum;
};

const TARGET_BEHAVIOUR:DecisionBehaviourKey='FIGHT_SELECTION';

export const DEFAULT_SIMULATION_ARCHETYPES:SimulationArchetype[]=[
  {id:'FAST_LEARNER',label:'Fast learner',initialSkill:.58,learningRate:.14,maxSkill:.96,novelPenalty:.05,notObservedRate:.04,irrelevantDraftRate:.04,regressionAt:null,regressionDrop:0},
  {id:'STEADY_LEARNER',label:'Steady learner',initialSkill:.46,learningRate:.085,maxSkill:.93,novelPenalty:.08,notObservedRate:.07,irrelevantDraftRate:.08,regressionAt:null,regressionDrop:0},
  {id:'STUBBORN_REPEATER',label:'Stubborn repeater',initialSkill:.31,learningRate:.018,maxSkill:.61,novelPenalty:.16,notObservedRate:.05,irrelevantDraftRate:.05,regressionAt:null,regressionDrop:0},
  {id:'CONTEXT_MEMORIZER',label:'Context memorizer',initialSkill:.54,learningRate:.10,maxSkill:.91,novelPenalty:.48,notObservedRate:.05,irrelevantDraftRate:.05,regressionAt:null,regressionDrop:0},
  {id:'REGRESSION_CASE',label:'Regression case',initialSkill:.52,learningRate:.10,maxSkill:.92,novelPenalty:.08,notObservedRate:.05,irrelevantDraftRate:.05,regressionAt:.62,regressionDrop:.42},
  {id:'SPARSE_EVIDENCE',label:'Sparse evidence',initialSkill:.48,learningRate:.075,maxSkill:.90,novelPenalty:.10,notObservedRate:.38,irrelevantDraftRate:.30,regressionAt:null,regressionDrop:0},
];

function clamp(value:number,min=0,max=1){return Math.max(min,Math.min(max,value))}
function rng(seed:number){
  let state=(seed>>>0)||1;
  return()=>{
    state=(Math.imul(state,1664525)+1013904223)>>>0;
    return state/4294967296;
  };
}
function bestMemory(memory:ScenarioMemoryProfile){
  return memory.cards
    .filter(card=>card.behaviourKey===TARGET_BEHAVIOUR)
    .sort((a,b)=>b.comparableGames-a.comparableGames||b.memoryStrength-a.memoryStrength)[0]??null;
}
function transferCard(transfer:DecisionTransferProfile){
  return transfer.cards.find(card=>card.behaviourKey===TARGET_BEHAVIOUR)??null;
}
function lessonFor(curriculum:ClimbCurriculum):CurriculumLesson|null{
  if(curriculum.currentLesson?.behaviourKey===TARGET_BEHAVIOUR)return curriculum.currentLesson;
  return curriculum.queue.find(item=>item.behaviourKey===TARGET_BEHAVIOUR)
    ??curriculum.graduated.find(item=>item.behaviourKey===TARGET_BEHAVIOUR)
    ??null;
}
function rebuild(rows:HistoryAnalysisRow[],previous:ClimbCurriculum|null,at:string):ProfileBundle{
  const twin=buildDecisionTwinV2(rows,at);
  const memory=buildScenarioMemory(rows,at);
  const transfer=buildDecisionTransfer(rows,memory,at);
  const curriculum=buildClimbCurriculum(twin,memory,transfer,at,previous);
  return{twin,memory,transfer,curriculum};
}

type DraftKind='SOURCE'|'NOVEL_PICK'|'NOVEL_CHAMPION'|'IRRELEVANT';
function draftFor(kind:DraftKind,game:number){
  if(kind==='SOURCE')return{
    champion:'Jinx',
    enemies:[
      {champion:'Nocturne',role:'JUNGLE'},
      {champion:'Rakan',role:'SUPPORT'},
      {champion:'Orianna',role:'MID'},
      {champion:'Ornn',role:'TOP'},
      {champion:'Jhin',role:'ADC'},
    ],
  };
  if(kind==='NOVEL_PICK')return{
    champion:game%2?'Ashe':'Caitlyn',
    enemies:[
      {champion:'Blitzcrank',role:'SUPPORT'},
      {champion:'Pyke',role:'MID'},
      {champion:'Lux',role:'SUPPORT'},
      {champion:'Garen',role:'TOP'},
      {champion:'Ezreal',role:'ADC'},
    ],
  };
  if(kind==='NOVEL_CHAMPION')return{
    champion:game%2?'Ashe':'Caitlyn',
    enemies:[
      {champion:'Nocturne',role:'JUNGLE'},
      {champion:'Rakan',role:'SUPPORT'},
      {champion:'Orianna',role:'MID'},
      {champion:'Ornn',role:'TOP'},
      {champion:'Jhin',role:'ADC'},
    ],
  };
  return{
    champion:'Jinx',
    enemies:[
      {champion:'Garen',role:'TOP'},
      {champion:'Master Yi',role:'JUNGLE'},
      {champion:'Corki',role:'MID'},
      {champion:'Ezreal',role:'ADC'},
      {champion:'Soraka',role:'SUPPORT'},
    ],
  };
}
function chooseDraft(input:{
  random:()=>number;
  archetype:SimulationArchetype;
  curriculum:ClimbCurriculum;
  game:number;
}):DraftKind{
  if(input.random()<input.archetype.irrelevantDraftRate)return'IRRELEVANT';
  const lesson=lessonFor(input.curriculum);
  const advanced=Boolean(lesson&&(lesson.phase==='TRANSFER'||lesson.repLadder.level>=4));
  if(!advanced)return'SOURCE';
  return input.game%3===0?'NOVEL_CHAMPION':'NOVEL_PICK';
}

function fakeFight(clean:boolean,atSeconds:number):FightReview{
  return{
    atSeconds,
    category:clean?'STRENGTH':'WEAKNESS',
    outcome:clean?'ASSIST':'DEATH',
    opponent:'Pantheon',
    opponentChampion:'Pantheon',
    score:clean?18:-24,
    verdict:clean?'EVEN':'THEM_STRONGER',
    headline:clean?'Synthetic clean fight selection':'Synthetic red-state death',
    summary:clean
      ?'The simulated player waited for the planned entry condition and produced a positive fight result.'
      :'The simulated player entered while the visible state was already enemy-favoured.',
    evidence:{
      youLevel:11,
      themLevel:clean?11:12,
      levelDelta:clean?0:-1,
      youItemGold:6200,
      themItemGold:clean?6150:6900,
      itemGoldDelta:clean?50:-700,
      currentGold:420,
      healthPct:.82,
      manaPct:.68,
    },
    why:[clean?'The entry matched the planned condition.':'The enemy held the stronger visible state.'],
    howToWin:['Wait for the frozen fight trigger before committing.'],
    howYouLose:['Let first contact choose the fight.'],
    betterDecision:['Decline the first contact and enter only after the planned trigger becomes true.'],
    limitation:'Synthetic Simulation Lab evidence generated to exercise the coaching pipeline.',
  };
}
function fakeAnalysis(champion:string,clean:boolean|null,atSeconds:number):ProMatchAnalysis{
  const observed=clean!==null;
  const metrics:any={};
  if(observed){
    const score=clean?90:38;
    metrics.fight_selection={
      key:'fight_selection',
      label:'FIGHT SELECTION',
      score,
      value:String(score)+'/100',
      status:'DERIVED',
      confidence:'HIGH',
      sources:['SIMULATION_LAB'],
      summary:'Synthetic comparable fight-selection decision.',
      evidence:[{atSeconds,label:clean?'Clean decision':'Red-state decision',detail:clean?'Waited for the planned trigger.':'Entered before the planned trigger was true.'}],
    };
  }
  return{
    version:1,
    champion,
    role:'ADC',
    evidenceSources:['SIMULATION_LAB'],
    metrics,
    leakSignals:observed&&!clean?[{
      key:'RED_STATE',
      label:'Bad fight selection',
      count:1,
      severity:'ACTIVE',
      detail:'Synthetic red-state fight used by CLIMB Simulation Lab.',
      evidenceSeconds:[atSeconds],
    }]:[],
    fingerprint:{
      primary:!observed?'NO COMPARABLE DECISION':clean?'CLEAN FIGHT SELECTION':'BAD FIGHT SELECTION',
      sequence:!observed?['No comparable decision window']:clean?['Recognise trigger','Wait','Enter cleanly']:['First contact','Enter early','Enemy-favoured fight'],
      confidence:observed?'HIGH':'LOW',
      explanation:'Synthetic career evidence for CLIMB Simulation Lab.',
    },
  };
}
function fakeSummary(clean:boolean|null,atSeconds:number):StrengthTimeline{
  return{
    points:[],
    opportunities:[],
    fightReviews:clean===null?[]:[fakeFight(clean,atSeconds)],
    strongestWindow:null,
    weakestWindow:null,
    modelNote:'Synthetic Simulation Lab strength timeline.',
  };
}
function memoryComparable(card:ScenarioMemoryCard|null){return card?.comparableGames??0}
function chanceFor(input:{
  archetype:SimulationArchetype;
  skill:number;
  level:number;
  novel:boolean;
  missionReady:boolean;
}){
  const difficultyPenalty=[0,.00,.06,.13,.22,.29][Math.max(1,Math.min(5,input.level))]??0;
  const novelty=input.novel?input.archetype.novelPenalty:0;
  const coaching=input.missionReady?.045:0;
  return clamp(.10+input.skill*.92-difficultyPenalty-novelty+coaching,.04,.97);
}
function applyLearning(input:{
  archetype:SimulationArchetype;
  skill:number;
  clean:boolean;
  novel:boolean;
}){
  const novelScale=input.novel&&input.archetype.id==='CONTEXT_MEMORIZER'?.12:1;
  const signal=input.clean?1:.32;
  const gain=input.archetype.learningRate*novelScale*signal*(1-input.skill);
  return Math.min(input.archetype.maxSkill,clamp(input.skill+gain));
}
function transitionInvariant(input:{
  archetype:SimulationArchetypeId;
  game:number;
  preLevel:number|null;
  postLevel:number|null;
  postLesson:CurriculumLesson|null;
  postMemory:ScenarioMemoryCard|null;
  postTransfer:ReturnType<typeof transferCard>;
  mission:ClimbMatchMission|null;
  transferPrime:DecisionTransferPrime|null;
  review:DecisionGraph['summary']['climbMission'];
}){
  const errors:string[]=[];
  const prefix=input.archetype+' game '+String(input.game)+': ';
  if(input.review.status==='NOT_OBSERVED'&&input.preLevel!==null&&input.postLevel!==null&&input.postLevel!==input.preLevel){
    errors.push(prefix+'NOT_OBSERVED changed Rep Ladder difficulty from '+String(input.preLevel)+' to '+String(input.postLevel)+'.');
  }
  if(input.mission&&input.review.missionId!==input.mission.id){
    errors.push(prefix+'post-game review did not use the frozen pre-game mission.');
  }
  if(input.mission?.repLevel===5&&input.mission.status==='READY'&&!input.transferPrime){
    errors.push(prefix+'Level 5 mission was forced without a frozen transfer test.');
  }
  if(input.postLevel&&input.preLevel&&input.postLevel>input.preLevel){
    if(input.postLevel>=2&&(input.postMemory?.comparableGames??0)<3){
      errors.push(prefix+'difficulty promoted without three comparable games.');
    }
    if(input.postLevel>=3&&input.postLesson?.phase==='PRACTISE'){
      if((input.postMemory?.cleanStreak??0)<2||(input.postMemory?.memoryStrength??0)<60){
        errors.push(prefix+'Level 3 promotion lacked stabilising evidence.');
      }
    }
    if(input.postLevel>=4&&!['TRANSFER','GRADUATED'].includes(String(input.postLesson?.phase))){
      errors.push(prefix+'advanced difficulty appeared before local mastery/transfer.');
    }
    if(input.postLevel===5&&input.postLesson?.phase==='TRANSFER'){
      if((input.postTransfer?.transferGames??0)<2||(input.postTransfer?.transferStrength??0)<65||(input.postTransfer?.transferCleanStreak??0)<1){
        errors.push(prefix+'Level 5 promotion lacked repeated transfer evidence.');
      }
    }
  }
  return errors;
}

export function runSimulationCareer(input:{
  archetype:SimulationArchetype;
  games:number;
  seed:number;
}):SimulationCareerReport{
  const random=rng(input.seed);
  const rows:HistoryAnalysisRow[]=[];
  const events:SimulationGameEvent[]=[];
  const invariants:string[]=[];
  let previousCurriculum:ClimbCurriculum|null=null;
  let skill=input.archetype.initialSkill;
  let regressionApplied=false;
  let promotions=0;
  let demotions=0;
  let maxLevel=0;
  let missionsReady=0;
  let missionsNotRelevant=0;
  let notObserved=0;
  let goodDecisions=0;
  let improveDecisions=0;

  for(let game=1;game<=input.games;game++){
    const at=new Date(Date.UTC(2026,0,1,12,0,0)+(game-1)*86_400_000).toISOString();
    let pre=rebuild(rows,previousCurriculum,at);
    previousCurriculum=pre.curriculum;
    const preLesson=lessonFor(pre.curriculum);
    const preLevel=preLesson?.repLadder.level??null;
    maxLevel=Math.max(maxLevel,preLevel??0);

    if(!regressionApplied&&input.archetype.regressionAt!==null&&game>=Math.ceil(input.games*input.archetype.regressionAt)){
      skill=clamp(skill-input.archetype.regressionDrop,.08,input.archetype.maxSkill);
      regressionApplied=true;
    }

    const draftKind=chooseDraft({random,archetype:input.archetype,curriculum:pre.curriculum,game});
    const draft=draftFor(draftKind,game);
    const situationContext=buildDraftSituationContext({champion:draft.champion,role:'ADC',enemies:draft.enemies});
    const transferPrime=selectDecisionTransferPrime({
      transfer:pre.transfer,
      memory:pre.memory,
      scenarioPrime:null,
      situationContext,
      simulation:null,
      champion:draft.champion,
      role:'ADC',
    });
    const activeLesson=pre.curriculum.status==='ACTIVE'?pre.curriculum.currentLesson:null;
    const mission=buildClimbMatchMission({
      lesson:activeLesson,
      situationContext,
      coach:{
        headline:'WAIT FOR YOUR FROZEN FIGHT TRIGGER.',
        fightTrigger:'FIRST CONTACT → CHECK NUMBERS AND ACCESS → ENTER ONLY WHEN THE FROZEN TRIGGER IS TRUE.',
        never:'DO NOT LET FIRST CONTACT CHOOSE THE FIGHT.',
      },
      champion:draft.champion,
      role:'ADC',
      transferPrime,
    });
    if(mission?.status==='READY')missionsReady++;
    if(mission?.status==='NOT_RELEVANT')missionsNotRelevant++;

    const relevant=situationContext.tags.includes('MULTI_ACCESS')||situationContext.tags.includes('PICK_PRESSURE');
    const missionReady=mission?.status==='READY';
    const forcedUnobserved=!relevant||(missionReady&&random()<input.archetype.notObservedRate);
    const novel=draftKind==='NOVEL_PICK'||draftKind==='NOVEL_CHAMPION';
    const level=mission?.repLevel??preLevel??1;
    const clean=forcedUnobserved?null:random()<chanceFor({archetype:input.archetype,skill,level,novel,missionReady:Boolean(missionReady)});

    if(clean===null)notObserved++;
    else if(clean)goodDecisions++;
    else improveDecisions++;

    const atSeconds=600+(game%7)*65;
    const analysis=fakeAnalysis(draft.champion,clean,atSeconds);
    const summary=fakeSummary(clean,atSeconds);
    const lockedPlan:LockedDecisionPlan={
      source:'SIMULATION_LAB',
      headline:'WAIT FOR YOUR FROZEN FIGHT TRIGGER.',
      fightTrigger:'FIRST CONTACT → CHECK NUMBERS AND ACCESS → ENTER ONLY WHEN THE FROZEN TRIGGER IS TRUE.',
      never:'DO NOT LET FIRST CONTACT CHOOSE THE FIGHT.',
      situationContext,
      decisionTransferPrime:transferPrime,
      climbMission:mission,
    };
    const graph=buildDecisionGraph({analysis,summary,lockedPlan,generatedAt:at});
    analysis.decisionGraph=graph;
    rows.push({champion:draft.champion,role:'ADC',createdAt:at,analysis});

    if(clean!==null)skill=applyLearning({archetype:input.archetype,skill,clean,novel});

    const postAt=new Date(Date.parse(at)+1_000).toISOString();
    const post=rebuild(rows,pre.curriculum,postAt);
    previousCurriculum=post.curriculum;
    const postLesson=lessonFor(post.curriculum);
    const postLevel=postLesson?.repLadder.level??null;
    maxLevel=Math.max(maxLevel,postLevel??0);
    if(preLevel!==null&&postLevel!==null&&postLevel>preLevel)promotions++;
    if(preLevel!==null&&postLevel!==null&&postLevel<preLevel)demotions++;

    const preMemory=bestMemory(pre.memory);
    const postMemory=bestMemory(post.memory);
    const postTransfer=transferCard(post.transfer);
    invariants.push(...transitionInvariant({
      archetype:input.archetype.id,
      game,
      preLevel,
      postLevel,
      postLesson,
      postMemory,
      postTransfer,
      mission,
      transferPrime,
      review:graph.summary.climbMission,
    }));

    const activeCount=post.curriculum.queue.filter(item=>item.readiness==='ACTIVE').length;
    if(activeCount>1)invariants.push(input.archetype.id+' game '+String(game)+': Curriculum exposed more than one ACTIVE lesson.');

    events.push({
      game,
      champion:draft.champion,
      situationTag:mission?.targetTag??situationContext.tags[0]??'GENERAL',
      curriculumStatus:pre.curriculum.status,
      curriculumPhase:activeLesson?.phase??null,
      repLevel:mission?.repLevel??preLevel,
      repStage:mission?.repStage??preLesson?.repLadder.stage??null,
      missionStatus:mission?.status??null,
      missionReview:graph.summary.climbMission.status,
      transferPrime:Boolean(transferPrime),
      outcome:clean===null?'NOT_OBSERVED':clean?'GOOD':'IMPROVE',
      latentSkill:Number(skill.toFixed(3)),
      comparableGames:postMemory?.comparableGames??0,
      memoryState:postMemory?.state??null,
      transferState:postTransfer?.state??null,
      postRepLevel:postLevel,
    });
  }

  const finalAt=new Date(Date.UTC(2026,0,1,12,0,0)+input.games*86_400_000).toISOString();
  const final=rebuild(rows,previousCurriculum,finalAt);
  const finalLesson=lessonFor(final.curriculum);
  const finalMemory=bestMemory(final.memory);
  const finalTransfer=transferCard(final.transfer);

  return{
    archetype:input.archetype.id,
    label:input.archetype.label,
    games:input.games,
    missionsReady,
    missionsNotRelevant,
    notObserved,
    goodDecisions,
    improveDecisions,
    promotions,
    demotions,
    maxLevel,
    finalLevel:finalLesson?.repLadder.level??null,
    finalPhase:finalLesson?.phase??null,
    principleOwned:finalTransfer?.state==='PRINCIPLE_OWNED'||finalLesson?.phase==='GRADUATED',
    finalMemoryState:finalMemory?.state??null,
    finalTransferState:finalTransfer?.state??null,
    finalSkill:Number(skill.toFixed(3)),
    invariants,
    events,
  };
}

export function runClimbSimulationLab(input:{
  gamesPerCareer?:number;
  archetypes?:SimulationArchetype[];
  seed?:number;
}={}):ClimbSimulationLabReport{
  const gamesPerCareer=Math.max(20,Math.floor(input.gamesPerCareer??120));
  const archetypes=input.archetypes??DEFAULT_SIMULATION_ARCHETYPES;
  const baseSeed=input.seed??23042026;
  const careers=archetypes.map((archetype,index)=>runSimulationCareer({
    archetype,
    games:gamesPerCareer,
    seed:baseSeed+index*7919,
  }));
  const invariantViolations=careers.flatMap(career=>career.invariants);
  const totalGames=careers.reduce((sum,career)=>sum+career.games,0);
  const totalPromotions=careers.reduce((sum,career)=>sum+career.promotions,0);
  const totalDemotions=careers.reduce((sum,career)=>sum+career.demotions,0);
  const totalNotObserved=careers.reduce((sum,career)=>sum+career.notObserved,0);
  return{
    version:1,
    gamesPerCareer,
    careers,
    totalGames,
    totalPromotions,
    totalDemotions,
    totalNotObserved,
    invariantViolations,
    summary:invariantViolations.length
      ?'CLIMB Simulation Lab found '+String(invariantViolations.length)+' learning invariant violation'+(invariantViolations.length===1?'':'s')+' across '+String(totalGames)+' synthetic games.'
      :'CLIMB Simulation Lab completed '+String(totalGames)+' synthetic games with no learning invariant violations.',
  };
}
