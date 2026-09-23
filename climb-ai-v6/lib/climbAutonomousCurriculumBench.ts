import type {DecisionBehaviourKey} from './decisionTwin';
import {buildClimbAutonomousCurriculum,type ClimbAutonomousCurriculum,type BuildAutonomousCurriculumInput} from './climbAutonomousCurriculumV6';
import type {CurriculumDecision,CurriculumLesson,CurriculumPhase} from './climbCurriculum';
import type {ClimbCareerMatrix} from './climbCareerMatrix';

export interface AutonomousCurriculumBenchCaseResult{
  id:string;
  pass:boolean;
  expected:string;
  actual:string;
  detail:string;
}

export interface ClimbAutonomousCurriculumBenchReport{
  version:1;
  cases:number;
  passed:number;
  lifecycleAccuracy:number;
  contractContinuity:number;
  transferDiscipline:number;
  interruptionDiscipline:number;
  results:AutonomousCurriculumBenchCaseResult[];
  failures:string[];
  boundary:string;
}

const BOUNDARY='Autonomous Curriculum Bench is a deterministic lifecycle regression suite. It validates sequencing contracts and evidence gates; it does not manufacture player evidence or replace the underlying Scenario Memory, Decision Transfer or Career Matrix models.';

function lesson(
  key:DecisionBehaviourKey,
  phase:CurriculumPhase,
  extra:Partial<CurriculumLesson>={},
):CurriculumLesson{
  const level=phase==='TRANSFER'?4:phase==='STABILISE'?3:phase==='PRACTISE'?2:1;
  return{
    behaviourKey:key,
    label:key.replaceAll('_',' '),
    phase,
    readiness:'ACTIVE',
    confidence:'HIGH',
    priority:80,
    prerequisite:null,
    prerequisiteLabel:null,
    whyNow:'Synthetic V6 benchmark lesson.',
    gameRule:'SYNTHETIC RULE',
    graduationRule:'Repeated verified evidence required.',
    evidence:'Synthetic V6 benchmark evidence.',
    comparableGames:phase==='FOUNDATION'?1:5,
    cleanStreak:phase==='FOUNDATION'?0:phase==='PRACTISE'?2:4,
    memoryStrength:phase==='FOUNDATION'?20:phase==='PRACTISE'?58:phase==='STABILISE'?76:92,
    transferStrength:phase==='TRANSFER'?45:null,
    transferGames:phase==='TRANSFER'?1:0,
    transferCleanStreak:phase==='TRANSFER'?1:0,
    repLadder:{
      version:1,
      level:level as any,
      maxLevel:5,
      stage:level===1?'RECOGNISE':level===2?'EXECUTE':level===3?'STABILISE':'ADAPT',
      label:'Synthetic stage',
      objective:'Synthetic objective',
      difficultyRule:'Synthetic difficulty rule',
      promotionGate:'Synthetic promotion gate',
      demotionRule:'Synthetic demotion rule',
      reason:'Synthetic ladder evidence.',
      evidence:'Synthetic ladder evidence.',
    },
    nextUnlock:null,
    ...extra,
  };
}

function matrix(keys:DecisionBehaviourKey[]):ClimbCareerMatrix{
  return{
    version:1,
    generatedAt:'2026-09-23T00:00:00.000Z',
    gamesAnalyzed:10,
    recommendedSkill:keys[0]??null,
    selectionMode:keys.length?'START':'COMPLETE',
    recommendationReason:'Synthetic benchmark priority.',
    candidates:keys.map((key,index)=>({
      key,
      label:key.replaceAll('_',' '),
      currentScore:50,
      severity:50,
      recurrence:60,
      impact:80,
      prioritySignal:80-index,
      confidence:'HIGH',
      regressionRisk:0,
      locallyMastered:false,
      transferStrength:0,
      principleOwned:false,
      strictPrerequisite:null,
      prerequisiteSatisfied:true,
      evidence:'Synthetic benchmark evidence.',
      state:'CANDIDATE',
      downstreamSkills:[],
      rootCauseLeverage:0,
      trainabilityNow:80,
      noveltyNeed:0,
      curriculumDebt:0,
      coachingExposureGames:0,
      developmentLeverage:70-index,
      priorityScore:80-index,
      whyNow:'Synthetic benchmark priority.',
      deferredReason:index?'Deferred behind the active contract.':null,
    })),
    deferred:[],
    boundary:'Synthetic benchmark matrix.',
  };
}

function decision(
  action:CurriculumDecision['action'],
  previousLesson:DecisionBehaviourKey|null,
  currentLesson:DecisionBehaviourKey|null,
):CurriculumDecision{
  return{
    action,
    previousLesson,
    currentLesson,
    changed:previousLesson!==currentLesson,
    reason:'Synthetic '+action+' transition.',
  };
}

function build(input:Partial<BuildAutonomousCurriculumInput>&{
  currentLesson?:CurriculumLesson|null;
  nextLesson?:CurriculumLesson|null;
  decision:CurriculumDecision;
  gamesAnalyzed:number;
},previous:ClimbAutonomousCurriculum|null=null){
  const current=input.currentLesson??null;
  const next=input.nextLesson??null;
  return buildClimbAutonomousCurriculum({
    generatedAt:'2026-09-23T00:00:00.000Z',
    gamesAnalyzed:input.gamesAnalyzed,
    status:input.status??(current?'ACTIVE':'BUILDING'),
    currentLesson:current,
    nextLesson:next,
    decision:input.decision,
    careerMatrix:input.careerMatrix??matrix([current?.behaviourKey,next?.behaviourKey].filter(Boolean) as DecisionBehaviourKey[]),
  },previous);
}

function result(id:string,pass:boolean,expected:string,actual:string,detail:string):AutonomousCurriculumBenchCaseResult{
  return{id,pass,expected,actual,detail};
}

export function runClimbAutonomousCurriculumBench():ClimbAutonomousCurriculumBenchReport{
  const results:AutonomousCurriculumBenchCaseResult[]=[];

  const building=build({
    gamesAnalyzed:2,
    status:'BUILDING',
    currentLesson:null,
    nextLesson:null,
    decision:decision('BUILDING',null,null),
  });
  results.push(result(
    'wait-before-evidence',
    building.action==='WAIT_FOR_EVIDENCE'&&building.activeContract===null,
    'WAIT_FOR_EVIDENCE / no contract',
    building.action+' / '+String(building.activeContract?.id??'none'),
    'V6 must not invent an objective before repeated evidence exists.',
  ));

  const start=build({
    gamesAnalyzed:6,
    currentLesson:lesson('FIGHT_SELECTION','FOUNDATION'),
    nextLesson:lesson('RESET_DISCIPLINE','PRACTISE'),
    decision:decision('START',null,'FIGHT_SELECTION'),
  });
  results.push(result(
    'start-learning-contract',
    start.action==='START_OBJECTIVE'&&start.activeContract?.state==='TEACH'&&start.activeContract?.startedGame===6,
    'START_OBJECTIVE / TEACH / game 6',
    start.action+' / '+String(start.activeContract?.state)+' / game '+String(start.activeContract?.startedGame),
    'The chosen Stage 1 skill must become one persistent learning contract.',
  ));

  const hold=build({
    gamesAnalyzed:7,
    currentLesson:lesson('FIGHT_SELECTION','PRACTISE'),
    nextLesson:lesson('DEATH_RECOVERY','PRACTISE',{priority:99}),
    decision:decision('KEEP','FIGHT_SELECTION','FIGHT_SELECTION'),
  },start);
  results.push(result(
    'hold-contract-against-challenger',
    hold.action==='HOLD_OBJECTIVE'&&hold.activeContract?.id===start.activeContract?.id&&hold.activeContract?.ageGames===2,
    'HOLD_OBJECTIVE / same contract / age 2',
    hold.action+' / '+String(hold.activeContract?.id)+' / age '+String(hold.activeContract?.ageGames),
    'A newly worse competing skill must not reset the current learning contract.',
  ));

  const stabilise=build({
    gamesAnalyzed:8,
    currentLesson:lesson('FIGHT_SELECTION','STABILISE'),
    nextLesson:lesson('DEATH_RECOVERY','PRACTISE'),
    decision:decision('KEEP','FIGHT_SELECTION','FIGHT_SELECTION'),
  },hold);
  results.push(result(
    'fade-support-at-stabilise',
    stabilise.action==='FADE_SUPPORT'&&stabilise.activeContract?.supportPolicy==='FADED'&&stabilise.activeContract?.id===start.activeContract?.id,
    'FADE_SUPPORT / FADED / same contract',
    stabilise.action+' / '+String(stabilise.activeContract?.supportPolicy)+' / '+String(stabilise.activeContract?.id),
    'V6 should reduce scaffolding as local execution stabilises without changing the objective.',
  ));

  const transfer=build({
    gamesAnalyzed:9,
    currentLesson:lesson('FIGHT_SELECTION','TRANSFER',{transferGames:0,transferStrength:0,repLadder:{...lesson('FIGHT_SELECTION','TRANSFER').repLadder,level:4,stage:'ADAPT'} as any}),
    nextLesson:lesson('DEATH_RECOVERY','PRACTISE'),
    decision:decision('KEEP','FIGHT_SELECTION','FIGHT_SELECTION'),
  },stabilise);
  results.push(result(
    'schedule-deliberate-transfer',
    transfer.action==='SCHEDULE_TRANSFER_TEST'
      &&transfer.activeContract?.testDirective.mode==='TRANSFER_TEST'
      &&transfer.activeContract?.testDirective.behaviourKey==='FIGHT_SELECTION'
      &&transfer.activeContract?.testDirective.needsNovelChampionOrContext===true,
    'SCHEDULE_TRANSFER_TEST / FIGHT_SELECTION / novel condition',
    transfer.action+' / '+String(transfer.activeContract?.testDirective.behaviourKey)+' / '+String(transfer.activeContract?.testDirective.needsNovelChampionOrContext),
    'Local mastery must trigger a frozen novel-condition test for the same active objective.',
  ));

  const retest=build({
    gamesAnalyzed:10,
    currentLesson:lesson('FIGHT_SELECTION','TRANSFER',{transferGames:2,transferStrength:72}),
    nextLesson:lesson('DEATH_RECOVERY','PRACTISE'),
    decision:decision('KEEP','FIGHT_SELECTION','FIGHT_SELECTION'),
  },transfer);
  results.push(result(
    'retest-unowned-principle',
    retest.action==='RETEST_TRANSFER'
      &&retest.activeContract?.id===start.activeContract?.id
      &&(retest.activeContract?.completion??100)<100,
    'RETEST_TRANSFER / same contract / not complete',
    retest.action+' / '+String(retest.activeContract?.id)+' / '+String(retest.activeContract?.completion),
    'Strong transfer evidence is still not permission to declare principle ownership.',
  ));

  const redirected=build({
    gamesAnalyzed:11,
    currentLesson:lesson('RESET_DISCIPLINE','REOPEN'),
    nextLesson:lesson('POWER_SPIKE_CONVERSION','PRACTISE'),
    decision:decision('PREREQUISITE','POWER_SPIKE_CONVERSION','RESET_DISCIPLINE'),
  },retest);
  results.push(result(
    'prerequisite-redirect',
    redirected.action==='PREREQUISITE_REDIRECT'&&redirected.activeContract?.objectiveKey==='RESET_DISCIPLINE',
    'PREREQUISITE_REDIRECT / RESET_DISCIPLINE',
    redirected.action+' / '+String(redirected.activeContract?.objectiveKey),
    'A broken prerequisite must own the contract before the downstream skill can continue.',
  ));

  const regression=build({
    gamesAnalyzed:12,
    currentLesson:lesson('DEATH_RECOVERY','REOPEN',{priority:100}),
    nextLesson:lesson('FIGHT_SELECTION','PRACTISE'),
    decision:decision('REOPEN','RESET_DISCIPLINE','DEATH_RECOVERY'),
  },redirected);
  results.push(result(
    'verified-regression-interrupt',
    regression.action==='REGRESSION_INTERRUPT'&&regression.activeContract?.state==='REOPEN',
    'REGRESSION_INTERRUPT / REOPEN',
    regression.action+' / '+String(regression.activeContract?.state),
    'Only an explicit verified regression transition may interrupt an unfinished contract for another weakness.',
  ));

  const replacement=build({
    gamesAnalyzed:13,
    currentLesson:lesson('DEATH_RECOVERY','PRACTISE'),
    nextLesson:lesson('RESET_DISCIPLINE','PRACTISE'),
    decision:decision('ADVANCE','FIGHT_SELECTION','DEATH_RECOVERY'),
  },retest);
  results.push(result(
    'graduation-replaces-objective',
    replacement.action==='REPLACE_OBJECTIVE'
      &&replacement.activeContract?.objectiveKey==='DEATH_RECOVERY'
      &&replacement.activeContract?.id!==retest.activeContract?.id
      &&replacement.objectiveChanges===1,
    'REPLACE_OBJECTIVE / DEATH_RECOVERY / new contract / one change',
    replacement.action+' / '+String(replacement.activeContract?.objectiveKey)+' / '+String(replacement.activeContract?.id)+' / '+String(replacement.objectiveChanges),
    'Once the previous principle is genuinely graduated, V6 must close that contract and create a new contract for the next unlocked objective.',
  ));

  const complete=build({
    gamesAnalyzed:14,
    status:'COMPLETE',
    currentLesson:null,
    nextLesson:null,
    careerMatrix:matrix([]),
    decision:decision('COMPLETE','FIGHT_SELECTION',null),
  },replacement);
  results.push(result(
    'complete-without-phantom-objective',
    complete.action==='COMPLETE_CURRICULUM'&&complete.activeContract===null,
    'COMPLETE_CURRICULUM / no active contract',
    complete.action+' / '+String(complete.activeContract?.id??'none'),
    'When no unfinished evidence-backed lesson remains, V6 should maintain learned skills instead of inventing work.',
  ));

  const passed=results.filter(item=>item.pass).length;
  const lifecycleIds=new Set(['wait-before-evidence','start-learning-contract','fade-support-at-stabilise','graduation-replaces-objective','complete-without-phantom-objective']);
  const continuityIds=new Set(['start-learning-contract','hold-contract-against-challenger','fade-support-at-stabilise','retest-unowned-principle']);
  const transferIds=new Set(['schedule-deliberate-transfer','retest-unowned-principle']);
  const interruptionIds=new Set(['prerequisite-redirect','verified-regression-interrupt']);
  const rate=(ids:Set<string>)=>{
    const selected=results.filter(item=>ids.has(item.id));
    return selected.length?Math.round(selected.filter(item=>item.pass).length/selected.length*1000)/10:100;
  };
  const failures=results.filter(item=>!item.pass).map(item=>item.id+': expected '+item.expected+' but got '+item.actual);

  return{
    version:1,
    cases:results.length,
    passed,
    lifecycleAccuracy:rate(lifecycleIds),
    contractContinuity:rate(continuityIds),
    transferDiscipline:rate(transferIds),
    interruptionDiscipline:rate(interruptionIds),
    results,
    failures,
    boundary:BOUNDARY,
  };
}

export const CLIMB_AUTONOMOUS_CURRICULUM_BENCH_BOUNDARY=BOUNDARY;
