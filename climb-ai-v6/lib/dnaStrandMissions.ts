import type {DnaDomain,ILPTask,IssueCategory,Role} from './types';
import type {CoachingMetricKey} from './subscription';
import type {HistoryAnalysisRow} from './riot/proHistory';
import {DNA_DOMAINS,DNA_DOMAIN_LABELS} from './dnaDomain';
import {notObservedReceipt,proMetricReceipt} from './missionGrading';
import {verifiedMissionAttempts} from './verifiedMissionProof';
import {gameMissionFocusPair} from './gameDnaSnapshot';
import {HABITS,type HabitId} from './habits/library';
import {createHabitStrandMission,gradeHabitGame,habitDomain,habitOfTask,type HabitGame} from './dna/plan';

type MissionTemplate={
  title:string;
  category:IssueCategory;
  metric:string;
  target:string;
  why:string;
  gameRule:string;
};

const THREE='85+ decision score · 3 proven games';

export const DNA_STRAND_MISSION_SEQUENCES:Record<DnaDomain,MissionTemplate[]>={
  LANING:[
    {
      title:'Stop accepting red-state fights',
      category:'LANING',
      metric:'red_state_fights',
      target:THREE,
      why:'Giving the opponent a visibly stronger state and fighting anyway turns lane pressure into avoidable losses.',
      gameRule:'Before you commit, check health, items, levels and the escape route. If the visible state is red, back out instead of forcing it.',
    },
    {
      title:'Choose fights from playable lane states',
      category:'TRADING',
      metric:'fight_selection',
      target:THREE,
      why:'Good laning means refusing trades and all-ins when the visible state is already against you.',
      gameRule:'Before a lane fight, check health, numbers, cooldowns and the escape route. Only commit when the state is playable.',
    },
    {
      title:'Stop the lane mistake becoming a death',
      category:'DEATHS',
      metric:'death_control',
      target:THREE,
      why:'A lane error is recoverable until it turns into a free death that costs the next wave and reset.',
      gameRule:'When a trade goes badly, protect the next safe state instead of forcing a second action immediately.',
    },
  ],
  WAVES_CS:[
    {
      title:'Improve reset quality',
      category:'RECALL_TIMING',
      metric:'reset_quality',
      target:THREE,
      why:'Good resets turn earned gold into real combat power without donating extra waves or arriving late.',
      gameRule:'Before staying for one more wave, decide whether your current gold completes a useful buy and whether staying makes the next reset late.',
    },
    {
      title:'Turn farm into real combat power',
      category:'RESOURCE_COLLECTION',
      metric:'resource_conversion',
      target:THREE,
      why:'Gold only helps when it is converted into items before the next meaningful fight.',
      gameRule:'When you have a useful purchase available, take the reset before exposing yourself to another fight or risky wave.',
    },
    {
      title:'Use your power spike on time',
      category:'ITEMISATION',
      metric:'power_spike_conversion',
      target:THREE,
      why:'Good wave and reset decisions should create a window where your completed items actually influence the game.',
      gameRule:'After completing a key item, protect the next wave and look for the first safe fight where that purchase matters.',
    },
  ],
  VISION_MAP:[
    {
      title:'Check the map before committing',
      category:'MAP_AWARENESS',
      metric:'repeat_threat',
      target:THREE,
      why:'Repeated deaths often begin before the fight, when you commit without accounting for the same threat again.',
      gameRule:'Before a trade, push or river move, glance at the minimap and name the closest missing or repeated threat.',
    },
    {
      title:'Adapt to the repeated threat',
      category:'MAP_AWARENESS',
      metric:'opponent_adaptation',
      target:THREE,
      why:'Seeing the same danger is only useful if you change your distance, timing or route the next time.',
      gameRule:'If one champion or pattern catches you once, change one thing before you enter that situation again.',
    },
    {
      title:'Keep adapting after the first read',
      category:'MAP_AWARENESS',
      metric:'opponent_adaptation',
      target:THREE,
      why:'Map awareness becomes reliable when the adjustment survives repeated threats and different situations.',
      gameRule:'Once you identify the danger, keep changing your route, spacing or timing every time the same threat can reach you.',
    },
  ],
  OBJECTIVES:[
    {
      title:'Be ready before the objective',
      category:'OBJECTIVES',
      metric:'objective_readiness',
      target:THREE,
      why:'Objective fights are usually won or lost in the setup window before the objective is started.',
      gameRule:'About 90 seconds before Dragon or Baron, decide your final wave, reset and route so you are moving before the setup becomes urgent.',
    },
    {
      title:'Decide the final wave early',
      category:'TEMPO',
      metric:'farm_fight_tradeoff',
      target:THREE,
      why:'Late indecision between farm and grouping is one of the easiest ways to arrive after the useful setup window.',
      gameRule:'Choose the last safe wave early, then stop farming and move when the objective setup demands it.',
    },
    {
      title:'Convert the objective power window',
      category:'OBJECTIVES',
      metric:'power_spike_conversion',
      target:THREE,
      why:'Objective control is stronger when your reset and item timing create a real power window before the contest.',
      gameRule:'Before the objective setup, spend your gold and arrive ready to use the item or level advantage you created.',
    },
  ],
  TEAMFIGHTS:[
    {
      title:'Survive the first threat cycle',
      category:'TEAMFIGHTING',
      metric:'survival_value',
      target:THREE,
      why:'Your impact disappears if the first dangerous cooldowns remove you before you can contribute.',
      gameRule:'Identify the main engage or assassin threat before entering sustained range, then wait for it to be committed, blocked or covered.',
    },
    {
      title:'Choose fights from playable states',
      category:'TEAMFIGHTING',
      metric:'fight_selection',
      target:THREE,
      why:'Mechanics cannot rescue every fight when the visible state is already poor.',
      gameRule:'Before committing, check numbers, health, items and position. Skip the fight when too many of those are against you.',
    },
    {
      title:'Keep the carry alive through the fight',
      category:'POSITIONING',
      metric:'carry_preservation',
      target:THREE,
      why:'Teamfight value comes from surviving the dangerous moments while staying able to contribute.',
      gameRule:'Track the threat that can remove you, keep a safe damage angle and do not trade your life for low-value access.',
    },
  ],
  CONSISTENCY:[
    {
      title:'Protect the advantage',
      category:'CONSISTENCY',
      metric:'lead_protection',
      target:THREE,
      why:'A lead only matters if you stop giving the opponent free routes back into the game.',
      gameRule:'When ahead, force the enemy to enter your threat instead of chasing into an uncontrolled state.',
    },
    {
      title:'Recover after a mistake',
      category:'CONSISTENCY',
      metric:'historical_recovery',
      target:THREE,
      why:'Good players stop one mistake becoming two or three.',
      gameRule:'After a death or failed play, collect safe resources, rebuild information and only then re-enter a contested situation.',
    },
    {
      title:'Make the adjustment stick',
      category:'CONSISTENCY',
      metric:'opponent_adaptation',
      target:THREE,
      why:'Improvement becomes real when the same correction survives different games and opponents.',
      gameRule:'When a familiar problem appears, apply the same correction immediately instead of waiting for the mistake to happen again.',
    },
  ],
};

export function isDnaStrandMission(task:Pick<ILPTask,'id'>){
  return String(task.id||'').startsWith('dna-strand-');
}

function live(task:ILPTask){
  return task.status!=='MASTERED'&&task.status!=='PAUSED';
}

function cycleFor(tasks:ILPTask[],domain:DnaDomain){
  // Habit missions are a detour chosen by the player, not a step in the strand's sequence.
  return tasks.filter(task=>isDnaStrandMission(task)&&task.dnaDomain===domain&&!habitOfTask(task)).length;
}

function templateFor(domain:DnaDomain,cycle:number){
  const sequence=DNA_STRAND_MISSION_SEQUENCES[domain];
  return sequence[Math.min(cycle,sequence.length-1)]!;
}

export function createDnaStrandMission(accountId:string,role:Role,domain:DnaDomain,cycle:number):ILPTask{
  const template=templateFor(domain,cycle);
  const now=new Date().toISOString();
  return{
    id:`dna-strand-${role.toLowerCase()}-${domain.toLowerCase()}-${cycle+1}`,
    accountId,
    title:template.title,
    dnaDomain:domain,
    category:template.category,
    why:template.why,
    gameRule:template.gameRule,
    metric:template.metric,
    target:template.target,
    progress:0,
    metricProgress:0,
    missionProgress:0,
    status:'ACTIVE',
    source:'SYSTEM',
    evidence:[`DNA STRAND: ${DNA_DOMAIN_LABELS[domain]} · one mission at a time`],
    roleScope:role,
    roleEvidence:[role],
    priority:100-DNA_DOMAINS.indexOf(domain),
    successfulGames:0,
    gamesObserved:0,
    masteryRequired:3,
    missionHistory:[],
    lastUpdatedReason:'New DNA strand mission. Complete it in 3 tracked games to master it.',
    history:[{at:now,type:'PROMOTED',note:`${DNA_DOMAIN_LABELS[domain]} strand mission activated.`}],
  };
}

export function ensureOneMissionPerDnaStrand(tasks:ILPTask[],accountId:string,role:Role){
  const changes:string[]=[];
  let next=tasks.map(task=>({...task}));

  // Retire every legacy live mission. The six DNA strand missions are the plan now.
  next=next.map(task=>{
    if(!live(task)||isDnaStrandMission(task))return task;
    return{
      ...task,
      status:'PAUSED' as const,
      lastUpdatedReason:'Archived when the development plan moved to one mission per Game DNA strand.',
      history:[...(task.history??[]),{at:new Date().toISOString(),type:'PAUSED' as const,note:'Replaced by the six-strand Game DNA mission system.'}].slice(-12),
    };
  });

  for(const domain of DNA_DOMAINS){
    const current=next
      .filter(task=>isDnaStrandMission(task)&&task.dnaDomain===domain&&live(task))
      .sort((a,b)=>(Number(b.priority)||0)-(Number(a.priority)||0))[0];

    if(current)continue;

    const paused=next
      .filter(task=>isDnaStrandMission(task)&&task.dnaDomain===domain&&task.status==='PAUSED')
      .sort((a,b)=>Number(b.id.split('-').at(-1)||0)-Number(a.id.split('-').at(-1)||0))[0];

    if(paused){
      next=next.map(task=>task.id===paused.id?{
        ...task,
        status:'ACTIVE' as const,
        lastUpdatedReason:'Restored to the six-strand DNA plan. Each strand keeps one live mission until it is mastered.',
        history:[...(task.history??[]),{at:new Date().toISOString(),type:'PROMOTED' as const,note:'Restored after removal of the old three-mission cap.'}].slice(-12),
      }:task);
      changes.push(`${DNA_DOMAIN_LABELS[domain]}: restored ${paused.title}`);
      continue;
    }

    const cycle=cycleFor(next,domain);
    const inheritedFocus=next.some(task=>isDnaStrandMission(task)&&task.dnaDomain===domain&&task.dnaFocusUnlocked===true);
    const mission={...createDnaStrandMission(accountId,role,domain,cycle),dnaFocusUnlocked:inheritedFocus};
    next.push(mission);
    changes.push(`${DNA_DOMAIN_LABELS[domain]}: ${mission.title}`);
  }

  // Defensive: only one live DNA mission is allowed per strand.
  for(const domain of DNA_DOMAINS){
    const liveRows=next.filter(task=>isDnaStrandMission(task)&&task.dnaDomain===domain&&live(task));
    const keep=liveRows[0]?.id;
    if(!keep)continue;
    next=next.map(task=>isDnaStrandMission(task)&&task.dnaDomain===domain&&live(task)&&task.id!==keep
      ?{...task,status:'PAUSED' as const,lastUpdatedReason:'Archived because this DNA strand already has one current mission.'}
      :task);
  }

  return{tasks:next,changes};
}

/**
 * Make a Career DNA habit its strand's mission. The strand's current mission is
 * paused, not discarded: once the habit mission is mastered, the next plan pass
 * restores it. The new mission keeps the strand's unlocked/locked state, so the
 * player's two chosen DNA trees do not change.
 */
export function startHabitStrandMission(tasks:ILPTask[],input:{
  accountId:string;role:Role;habit:HabitId;
  reading?:{occurred:number;measured:number;rate:number};
  now?:Date;
}):{tasks:ILPTask[];status:'STARTED'|'ALREADY_ACTIVE';mission:ILPTask}{
  const domain=habitDomain(input.habit);
  const inStrand=(task:ILPTask)=>isDnaStrandMission(task)&&task.dnaDomain===domain&&task.roleScope===input.role;
  const existing=tasks.find(task=>inStrand(task)&&live(task)&&habitOfTask(task)===input.habit);
  if(existing)return{tasks,status:'ALREADY_ACTIVE',mission:existing};

  const current=tasks.filter(task=>inStrand(task)&&live(task));
  const now=(input.now??new Date()).toISOString();
  const name=HABITS[input.habit].name.toLowerCase();
  const mission=createHabitStrandMission({...input,dnaFocusUnlocked:current.some(task=>task.dnaFocusUnlocked===true)});
  const paused=tasks.map(task=>current.includes(task)?{
    ...task,
    status:'PAUSED' as const,
    lastUpdatedReason:`Paused while you break ${name}. It comes back when that habit mission is mastered.`,
    history:[...(task.history??[]),{at:now,type:'PAUSED' as const,note:`Paused for the ${name} habit mission.`}].slice(-12),
  }:task);
  return{tasks:[...paused,mission],status:'STARTED',mission};
}

function missionScoreTarget(task:ILPTask){
  const score=String(task.target||'').match(/(\d+(?:\.\d+)?)\s*\+/);
  return score?Number(score[1]):85;
}

function refreshMissionProgress(task:ILPTask){
  const attempts=[...(task.missionHistory??[])].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at));
  const observedAttempts=attempts.filter(attempt=>Boolean(attempt.evidenceV2)&&attempt.evidenceV2?.state!=='NOT_OBSERVED');
  const required=Math.max(1,Number(task.masteryRequired)||3);
  const confirmed=verifiedMissionAttempts({...task,missionHistory:attempts}).length;
  const progress=Math.round(Math.min(required,confirmed)/required*100);
  const mastered=confirmed>=required;
  return{
    ...task,
    progress,
    metricProgress:progress,
    missionProgress:progress,
    status:mastered?'MASTERED' as const:observedAttempts.length?'EVIDENCE_BUILDING' as const:'ACTIVE' as const,
    successfulGames:confirmed,
    gamesObserved:observedAttempts.length,
    masteryRequired:required,
    missionHistory:attempts,
    lastUpdatedReason:mastered
      ?`${confirmed}/${required} tracked games completed this DNA mission. Moving the strand to its next mission.`
      :`${confirmed}/${required} tracked games completed this DNA mission.`,
    history:mastered&&task.status!=='MASTERED'
      ?[...(task.history??[]),{at:new Date().toISOString(),type:'MASTERED' as const,note:`${confirmed}/${required} tracked games completed the DNA strand mission.`}].slice(-12)
      :task.history,
  };
}

/**
 * `habitGames` carries each game's habit data by match id. Habit missions are
 * graded from it; without it they stay NOT OBSERVED rather than guessed.
 */
export function gradeDnaStrandMissionsFromHistory(tasks:ILPTask[],history:HistoryAnalysisRow[],habitGames?:ReadonlyMap<string,HabitGame>){
  const ordered=[...history].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  const changes:string[]=[];
  let graded=tasks.map(task=>({...task,missionHistory:[...(task.missionHistory??[])]}));

  for(const row of ordered){
    const matchId=String(row.matchId||`analysis-${row.role||'role'}-${row.createdAt}-${row.champion}`);
    const alreadyGraded=graded.filter(task=>isDnaStrandMission(task)&&(task.missionHistory??[]).some(attempt=>attempt.matchId===matchId));
    if(alreadyGraded.length)continue;

    const rowTime=Date.parse(row.createdAt);
    const eligible=graded.filter(task=>{
      if(!isDnaStrandMission(task)||task.status==='MASTERED'||task.status==='PAUSED')return false;
      const start=(task.history??[]).filter(event=>event.type==='PROMOTED').at(-1)?.at;
      const startedAt=start&&Number.isFinite(Date.parse(start))?Date.parse(start):Number.NEGATIVE_INFINITY;
      return rowTime>=startedAt;
    });
    const role=(eligible[0]?.roleScope||row.role||'ADC') as Role;
    const focus=gameMissionFocusPair(eligible,role);
    const focusIds=new Set(focus.map(item=>item.task.id));

    graded=graded.map(task=>{
      if(!focusIds.has(task.id))return task;
      const threshold=missionScoreTarget(task);
      const metric=row.analysis?.metrics?.[task.metric as CoachingMetricKey];
      const targetLabel=`${threshold}+ decision score · 3 proven games`;
      let attempt:NonNullable<ILPTask['missionHistory']>[number];

      if(habitOfTask(task)){
        const grade=gradeHabitGame(task,habitGames?.get(matchId));
        const state=grade.evidenceV2.state;
        attempt={
          matchId,at:row.createdAt,adherence:'TRACKED',clearedBar:grade.passed,
          outcome:state==='BANKED'?'CONFIRMED':state==='MISSED'?'UNREWARDED':'NO_REP',
          banksPass:state==='BANKED',source:'TRACKED',evidenceV2:grade.evidenceV2,
        };
      }else if(!metric||metric.status==='UNAVAILABLE'||metric.status==='BUILDING'||typeof metric.score!=='number'){
        const reason='This mission belongs to one of your two unlocked DNA trees, but the game did not expose enough recorded decision evidence to grade it.';
        attempt={
          matchId,at:row.createdAt,adherence:'TRACKED',clearedBar:false,outcome:'NO_REP',banksPass:false,source:'TRACKED',
          evidenceV2:notObservedReceipt(task.metric,'DECISION_EVIDENCE',targetLabel,reason),
        };
      }else{
        const timestamped=(metric.evidence??[]).filter(event=>typeof event.atSeconds==='number'&&Number.isFinite(event.atSeconds)&&String(event.detail||event.label||'').trim());
        if(!timestamped.length){
          const reason='A decision score existed, but OP CLIMB could not prove when the behaviour happened. The mission stays NOT OBSERVED instead of guessing.';
          attempt={
            matchId,at:row.createdAt,adherence:'TRACKED',clearedBar:false,outcome:'NO_REP',banksPass:false,source:'TRACKED',
            evidenceV2:notObservedReceipt(task.metric,'DECISION_EVIDENCE',targetLabel,reason),
          };
        }else{
          const pass=metric.score>=threshold;
          const valueLabel=`${Math.round(metric.score)}/100`;
          const first=timestamped[0]!;
          const minutes=Math.floor(Number(first.atSeconds)/60);
          const seconds=Math.floor(Number(first.atSeconds)%60);
          const clock=`${minutes}:${String(seconds).padStart(2,'0')}`;
          const reason=`${clock} · ${first.label}: ${first.detail} Overall ${metric.label} scored ${valueLabel} from ${metric.sources.join(' + ')} evidence.`;
          attempt={
            matchId,at:row.createdAt,adherence:'TRACKED',clearedBar:pass,outcome:pass?'CONFIRMED':'UNREWARDED',banksPass:pass,source:'TRACKED',
            evidenceV2:proMetricReceipt({
              metric:task.metric,metricLabel:metric.label,score:metric.score,valueLabel,targetLabel,passed:pass,
              confidence:metric.confidence,sources:metric.sources,evidence:timestamped,reason,
            }),
          };
        }
      }

      const beforeMastered=task.status==='MASTERED';
      const next=refreshMissionProgress({...task,missionHistory:[...(task.missionHistory??[]),attempt]});
      if(!beforeMastered&&next.status==='MASTERED')changes.push(`${DNA_DOMAIN_LABELS[task.dnaDomain]} mastered: ${task.title}`);
      return next;
    });
  }

  return{tasks:graded,changes};
}
