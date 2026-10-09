import type {ILPMissionAttempt,ILPTask,Match,MissionEvidenceReceipt} from '@/lib/types';
import type {DecisionTwinPayload} from '@/lib/dashboard/learningLadder';

/**
 * SAMPLE DATA for the design lab only. Never imported by a product route.
 * It is shaped exactly like real stored data so the lab runs the same
 * view-model code the dashboard runs.
 */
const NOW=Date.parse('2026-10-09T18:00:00.000Z');
const hoursAgo=(hours:number)=>new Date(NOW-hours*3_600_000).toISOString();

const receipt=(metric:string,state:'BANKED'|'MISSED'|'NOT_OBSERVED',source:'DECISION_EVIDENCE'|'RIOT_POST_GAME'='DECISION_EVIDENCE'):MissionEvidenceReceipt=>({
  version:2,state,measurementSource:source,metric,metricLabel:'Sample metric',
  observedValue:state==='BANKED'?88:state==='MISSED'?41:null,observedValueLabel:state==='BANKED'?'88/100':state==='MISSED'?'41/100':'Not observed',
  targetLabel:'85+',confidence:'HIGH',opportunities:state==='NOT_OBSERVED'?0:1,successes:state==='BANKED'?1:0,misses:state==='MISSED'?1:0,
  events:[{atSeconds:1140,label:'Sample decision',detail:'Sample timestamped moment'}],
  reconstruction:{kind:source==='DECISION_EVIDENCE'?'PRO_METRIC':'MATCH_METRIC',fields:['sample'],formula:'sample'},
  reason:'Sample receipt for the design lab.',
});
const attempt=(matchId:string,metric:string,state:'BANKED'|'MISSED'|'NOT_OBSERVED',at:string,source:'DECISION_EVIDENCE'|'RIOT_POST_GAME'='DECISION_EVIDENCE'):ILPMissionAttempt=>({
  matchId,at,source:'TRACKED',adherence:'TRACKED',outcome:state==='BANKED'?'CONFIRMED':'UNEARNED',clearedBar:state==='BANKED',banksPass:state==='BANKED',evidenceV2:receipt(metric,state,source),
});
const task=(overrides:Partial<ILPTask>&Pick<ILPTask,'id'|'title'|'dnaDomain'|'category'|'metric'>):ILPTask=>({
  accountId:'sample',why:'',gameRule:'',target:'85+',progress:0,status:'ACTIVE',source:'SYSTEM',evidence:[],roleScope:'ADC',masteryRequired:3,
  ...overrides,
});

export const SAMPLE_TASKS:ILPTask[]=[
  task({id:'dna-strand-fights-2',title:'Stop accepting red-state fights',dnaDomain:'TEAMFIGHTS',category:'TEAMFIGHTING',metric:'red_state_fights',dnaFocusUnlocked:true,
    gameRule:'Before committing, check whether your side is actually stronger in that moment.',
    missionHistory:[attempt('s1','red_state_fights','BANKED',hoursAgo(50)),attempt('s3','red_state_fights','BANKED',hoursAgo(26)),attempt('s5','red_state_fights','MISSED',hoursAgo(3))]}),
  task({id:'dna-strand-waves-2',title:'Keep collecting after lane',dnaDomain:'WAVES_CS',category:'RESOURCE_COLLECTION',metric:'post15CsPerMin',target:'6.0+',dnaFocusUnlocked:true,
    gameRule:'After 15 minutes, take the safe wave nearest the next objective before grouping.',
    missionHistory:[attempt('s3','post15CsPerMin','NOT_OBSERVED',hoursAgo(26),'RIOT_POST_GAME'),attempt('s5','post15CsPerMin','BANKED',hoursAgo(3),'RIOT_POST_GAME')]}),
  task({id:'dna-strand-lane-1',title:'Trade on your terms',dnaDomain:'LANING',category:'TRADING',metric:'lane_trade',dnaFocusUnlocked:false}),
  task({id:'dna-strand-vision-1',title:'Eyes up before you commit',dnaDomain:'VISION_MAP',category:'MAP_AWARENESS',metric:'map_check',dnaFocusUnlocked:false}),
  task({id:'dna-strand-objectives-1',title:'Beat the clock to objectives',dnaDomain:'OBJECTIVES',category:'OBJECTIVES',metric:'objective_readiness',dnaFocusUnlocked:false}),
  task({id:'dna-strand-mind-1',title:'Make it your normal',dnaDomain:'CONSISTENCY',category:'CONSISTENCY',metric:'consistency',dnaFocusUnlocked:false}),
  // Mastered history: each verified mastery is +100 strand XP.
  task({id:'dna-strand-fights-1',title:'Survive the first threat cycle',dnaDomain:'TEAMFIGHTS',category:'POSITIONING',metric:'carry_preservation',status:'MASTERED',
    missionHistory:[attempt('o1','carry_preservation','BANKED',hoursAgo(400)),attempt('o2','carry_preservation','BANKED',hoursAgo(380)),attempt('o3','carry_preservation','BANKED',hoursAgo(360))]}),
  task({id:'dna-strand-waves-1',title:'Own the wave',dnaDomain:'WAVES_CS',category:'FARMING',metric:'laneCsPerMin',status:'MASTERED',
    missionHistory:[attempt('o4','laneCsPerMin','BANKED',hoursAgo(300),'RIOT_POST_GAME'),attempt('o5','laneCsPerMin','BANKED',hoursAgo(280),'RIOT_POST_GAME'),attempt('o6','laneCsPerMin','BANKED',hoursAgo(260),'RIOT_POST_GAME')]}),
];

const HABIT_GAME=(index:number)=>({
  soloDeath:index<4||index%3===0?2:0,
  deathWithGold:index%2===0?1:0,
  earlyDeaths:index>9?2:0,
  noControlWard:index%4===0?1:0,
  lateFarmDrop:index%5===0?1:0,
});
const CHAMPS=['Aphelios','Jinx',"Kai'Sa",'Aphelios','Ezreal','Jinx','Aphelios','Varus','Jinx','Aphelios','Ezreal','Jinx','Aphelios','Kai\'Sa'];

/** Fourteen sample games, newest first; the oldest ten form the sample "birth DNA". */
export const SAMPLE_MATCHES:Match[]=CHAMPS.map((champion,index)=>{
  const win=[0,2,3,5,6,8,10,11].includes(index);
  return{
    id:'s'+(index+1),riotAccountId:'sample',champion,role:'ADC',result:win?'WIN':'LOSS',
    kills:win?8+index%4:3+index%3,deaths:win?3+index%2:6+index%3,assists:win?9+index%5:4+index%4,
    durationSeconds:1740+index*47,rank:'DIAMOND II',source:'riot',createdAt:hoursAgo(3+index*11),
    metrics:{cs:220+index*3,csPerMin:7.1+(index%4)*.2,deaths:win?3:6,killParticipation:.52+index*.01,visionScore:24+index},
    habitRelevant:true,habits:HABIT_GAME(index),
  } as Match;
});

export const SAMPLE_TWIN:DecisionTwinPayload={
  decisionTransfer:{version:1,gamesAnalyzed:41,generatedAt:'',locallyMastered:1,transferring:0,principleOwned:1,regressed:0,activeTransfer:null,summary:'',boundary:'',cards:[
    {id:'t1',behaviourKey:'CARRY_PRESERVATION',behaviourLabel:'Carry Preservation',state:'LOCAL_ONLY',confidence:'MEDIUM',sourceMemoryId:'m1',sourceTag:'HIGH_VALUE_CARRY',sourceChampion:'Aphelios',sourceRole:'ADC',sourceStrength:84,sourceMasteredGame:18,principle:'Do not commit while another threat can still reach you.',transferGames:0,cleanTransferGames:0,improveTransferGames:0,transferCleanRate:null,recentTransferGames:0,recentCleanRate:null,transferCleanStreak:0,novelChampions:[],novelContexts:[],dimension:'NONE',breadthScore:0,transferStrength:0,lastTransferAt:null,nextTransferNeeded:true,summary:'Sample',evidence:'Sample: 5 clean high-value-carry fights on Aphelios.'},
    {id:'t2',behaviourKey:'FIGHT_SELECTION',behaviourLabel:'Fight Selection',state:'TESTING',confidence:'LOW',sourceMemoryId:'m2',sourceTag:'ENEMY_STRONG_FIGHT',sourceChampion:'Aphelios',sourceRole:'ADC',sourceStrength:71,sourceMasteredGame:22,principle:'Choose the fight from numbers, not first contact.',transferGames:2,cleanTransferGames:1,improveTransferGames:1,transferCleanRate:50,recentTransferGames:2,recentCleanRate:50,transferCleanStreak:0,novelChampions:['Jinx'],novelContexts:[],dimension:'CHAMPION',breadthScore:1,transferStrength:34,lastTransferAt:null,nextTransferNeeded:true,summary:'Sample',evidence:'Sample'},
    {id:'t3',behaviourKey:'LEAD_PROTECTION',behaviourLabel:'Lead Protection',state:'PRINCIPLE_OWNED',confidence:'HIGH',sourceMemoryId:'m3',sourceTag:'LEAD_CONVERSION',sourceChampion:'Jinx',sourceRole:'ADC',sourceStrength:90,sourceMasteredGame:9,principle:'Convert a lead into control.',transferGames:7,cleanTransferGames:6,improveTransferGames:1,transferCleanRate:86,recentTransferGames:4,recentCleanRate:100,transferCleanStreak:4,novelChampions:['Aphelios',"Kai'Sa",'Ezreal'],novelContexts:['ZONE_OBJECTIVE'],dimension:'BOTH',breadthScore:3,transferStrength:88,lastTransferAt:null,nextTransferNeeded:false,summary:'Sample',evidence:'Sample'},
  ]},
  scenarioMemory:{version:1,gamesAnalyzed:41,generatedAt:'',dueNextGame:1,mastered:2,regressed:0,strongestMemory:null,activeRep:null,summary:'',boundary:'',cards:[
    {id:'m4',behaviourKey:'RESET_DISCIPLINE',behaviourLabel:'Reset Discipline',situationTag:'HIGH_BANK_FIGHT',state:'LEARNING',confidence:'MEDIUM',comparableGames:6,cleanGames:3,improveGames:3,cleanRate:50,recentComparableGames:3,recentCleanGames:2,recentCleanRate:67,cleanStreak:1,gamesSinceLastSeen:1,reviewIntervalGames:2,gamesUntilReview:1,dueNextGame:true,memoryStrength:46,lastSeenAt:hoursAgo(3),lastVerdict:'GOOD',trigger:'1,200+ gold as a fight starts',oldBranch:'Fight with the gold',targetBranch:'Reset first',evidence:'Sample',summary:'Sample'},
  ]},
};

export const SAMPLE_MEMORY={count:9,mastered:3,due:1,transfer:2,top:'Sample memory: you win fights when the engage lands on someone else first, and lose them when you are the first one in.'};
