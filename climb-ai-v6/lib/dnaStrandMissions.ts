import type {DnaDomain,ILPTask,IssueCategory,Role} from './types';
import {DNA_DOMAINS,DNA_DOMAIN_LABELS} from './dnaDomain';

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
      title:'Reach 10 minutes clean',
      category:'LANING',
      metric:'deathsPre10',
      target:'0 deaths before 10m · 3 proven games',
      why:'A clean opening protects XP, waves and your first meaningful purchase.',
      gameRule:'Before an early trade or all-in, make sure the wave, enemy position and your exit are all playable.',
    },
    {
      title:'Own your lane economy',
      category:'LANING',
      metric:'laneCsPerMin',
      target:'Rank target · 3 proven games',
      why:'Reliable lane farm gives you item timings without needing the game to hand you kills.',
      gameRule:'Protect valuable waves first and do not trade health for low-value poke when it costs the next wave.',
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
      title:'Protect your second-item timing',
      category:'ITEMISATION',
      metric:'secondItemMinute',
      target:'Rank target · 3 proven games',
      why:'Second-item timing is a strong signal that waves, recalls and deaths are being managed cleanly.',
      gameRule:'After every recall, identify the safest next wave and the purchase timing you are trying to protect.',
    },
    {
      title:'Keep collecting after lane',
      category:'RESOURCE_COLLECTION',
      metric:'post15CsPerMin',
      target:'Rank target · 3 proven games',
      why:'Post-lane farm keeps your build moving when the map becomes chaotic.',
      gameRule:'After every reset, check the objective timer, then take the safest available wave before grouping.',
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
      title:'Be where the map matters',
      category:'MAP_AWARENESS',
      metric:'killParticipation',
      target:'Rank target · 3 proven games',
      why:'Useful map awareness should put you near the plays that actually matter.',
      gameRule:'Before moving away from your current lane or wave, name the play you are moving toward and what you are giving up.',
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
      title:'Be involved in objective plays',
      category:'OBJECTIVES',
      metric:'objectiveParticipation',
      target:'Rank target · 3 proven games',
      why:'Good setup should turn into actual involvement around the objectives that decide the map.',
      gameRule:'Plan your reset and route around the next major objective so you are present before the first important contact.',
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
      title:'Convert safety into damage',
      category:'TEAMFIGHTING',
      metric:'damageShare',
      target:'Rank target · 3 proven games',
      why:'Surviving matters because it should create more useful damage uptime.',
      gameRule:'Once the first major threat is spent, step forward with your frontline and hit the closest safe target continuously.',
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
  return tasks.filter(task=>isDnaStrandMission(task)&&task.dnaDomain===domain).length;
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

    const cycle=cycleFor(next,domain);
    const mission=createDnaStrandMission(accountId,role,domain,cycle);
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
