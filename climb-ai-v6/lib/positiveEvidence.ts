import type {DnaDomain,IssueCategory,Match} from './types';
import type {CoachingMetricKey} from './subscription';
import {benchmarkPass,missionBenchmark} from './rankMissionBenchmarks';
import {dnaDomainForTask} from './dnaDomain';

export type StrengthSource='RANK_BENCHMARK'|'DECISION_EVIDENCE'|'TIMELINE';

export interface StrengthEvidence{
  id:string;
  dnaDomain:DnaDomain;
  category:IssueCategory;
  title:string;
  subskill:string;
  whatHappened:string;
  whyItMattered:string;
  detail:string;
  technicalLabel:string;
  proof:string[];
  value:string;
  target:string;
  score:number|null;
  source:StrengthSource;
  atSeconds?:number;
  confidence:'HIGH'|'MEDIUM';
}

const BASE:Array<{metric:string;category:IssueCategory;title:string}>=[
  {metric:'csAt10',category:'LANING',title:'Strong first 10 minutes of farm'},
  {metric:'laneCsPerMin',category:'LANING',title:'Lane economy held up'},
  {metric:'deathsPre10',category:'DEATHS',title:'Protected the early game'},
  {metric:'csAt15',category:'FARMING',title:'Kept the lane economy moving'},
  {metric:'post15CsPerMin',category:'RESOURCE_COLLECTION',title:'Kept collecting after lane'},
  {metric:'csPerMin',category:'FARMING',title:'Farm stayed productive'},
  {metric:'secondItemMinute',category:'RECALL_TIMING',title:'Converted gold into items on time'},
  {metric:'visionScore',category:'VISION',title:'Created useful vision'},
  {metric:'killParticipation',category:'MAP_AWARENESS',title:'Was present for important plays'},
  {metric:'objectiveParticipation',category:'OBJECTIVES',title:'Showed up for objective windows'},
  {metric:'damageShare',category:'TEAMFIGHTING',title:'Converted fights into useful damage'},
  {metric:'deathsPost20',category:'DEATHS',title:'Protected the late game'},
  {metric:'deaths',category:'DEATHS',title:'Kept deaths under control'},
];

const PRO_DOMAIN:Partial<Record<CoachingMetricKey,{category:IssueCategory;title:string}>>={
  fight_selection:{category:'TEAMFIGHTING',title:'Selected fights well'},
  death_control:{category:'DEATHS',title:'Controlled avoidable deaths'},
  cs_curve:{category:'RESOURCE_COLLECTION',title:'Maintained a healthy CS curve'},
  underdog_conversion:{category:'TEAMFIGHTING',title:'Converted difficult fights'},
  fight_conversion:{category:'TEAMFIGHTING',title:'Converted favourable fight windows'},
  resource_conversion:{category:'RESOURCE_COLLECTION',title:'Converted resources into power'},
  lead_protection:{category:'TEMPO',title:'Protected an advantage'},
  power_spike_conversion:{category:'TEMPO',title:'Used power spikes well'},
  reset_quality:{category:'RECALL_TIMING',title:'Reset at useful times'},
  objective_readiness:{category:'OBJECTIVES',title:'Prepared well for objectives'},
  farm_fight_tradeoff:{category:'RESOURCE_COLLECTION',title:'Balanced farm and fighting well'},
  opponent_adaptation:{category:'MATCHUPS',title:'Adapted to repeated threats'},
  item_timing_diff:{category:'ITEMISATION',title:'Hit useful item timings'},
  build_response:{category:'ITEMISATION',title:'Built for the actual game'},
  damage_efficiency:{category:'TEAMFIGHTING',title:'Produced efficient fight damage'},
  survival_value:{category:'POSITIONING',title:'Stayed alive when survival mattered'},
  carry_preservation:{category:'POSITIONING',title:'Protected your value in fights'},
  historical_recovery:{category:'CONSISTENCY',title:'Recovered well after mistakes'},
};

export function positiveEvidenceForMatch(match:Match,rank=match.rank):StrengthEvidence[]{
  const out:StrengthEvidence[]=[];

  for(const spec of BASE){
    const benchmark=missionBenchmark(spec.metric,rank);
    if(!benchmark)continue;
    const raw=spec.metric==='deaths'?match.deaths:match.metrics[spec.metric as keyof Match['metrics']];
    if(typeof raw!=='number'||!Number.isFinite(raw))continue;
    if(benchmarkPass(spec.metric,raw,rank)!==true)continue;
    const dnaDomain=dnaDomainForTask({category:spec.category,metric:spec.metric,title:spec.title});
    const plain=rankStrengthExplanation(spec.metric,raw,benchmark.barText);
    out.push({
      id:'rank:'+spec.metric,
      dnaDomain,
      category:spec.category,
      title:spec.title,
      subskill:subskillLabel(spec.category),
      whatHappened:plain.whatHappened,
      whyItMattered:plain.whyItMattered,
      detail:strengthDetail(spec.metric,raw,benchmark.barText),
      technicalLabel:spec.metric,
      proof:[formatValue(spec.metric,raw)+' measured · '+benchmark.barText+' '+benchmark.rank.toLowerCase()+' target'],
      value:formatValue(spec.metric,raw),
      target:benchmark.barText,
      score:100,
      source:'RANK_BENCHMARK',
      confidence:'HIGH',
    });
  }

  for(const [key,metric] of Object.entries(match.proAnalysis?.metrics??{})){
    if(!metric||typeof metric.score!=='number'||metric.score<70)continue;
    if(metric.status==='UNAVAILABLE'||metric.status==='BUILDING')continue;
    const mapped=PRO_DOMAIN[key as CoachingMetricKey];
    if(!mapped)continue;
    const dnaDomain=dnaDomainForTask({category:mapped.category,metric:key,title:mapped.title});
    const plain=decisionStrengthExplanation(key as CoachingMetricKey,metric.summary,metric.value);
    out.push({
      id:'decision:'+key,
      dnaDomain,
      category:mapped.category,
      title:plain.title||mapped.title,
      subskill:subskillLabel(mapped.category),
      whatHappened:plain.whatHappened,
      whyItMattered:plain.whyItMattered,
      detail:metric.summary,
      technicalLabel:metric.label,
      proof:metric.evidence.slice(0,4).map(item=>[typeof item.atSeconds==='number'?clock(item.atSeconds):'',item.label,item.detail].filter(Boolean).join(' · ')),
      value:metric.value,
      target:'70+ decision score',
      score:Math.round(metric.score),
      source:'DECISION_EVIDENCE',
      atSeconds:metric.evidence.find(item=>typeof item.atSeconds==='number')?.atSeconds,
      confidence:metric.confidence==='HIGH'?'HIGH':'MEDIUM',
    });
  }

  for(const moment of match.moments??[]){
    if(moment.type!=='OBJECTIVE_TAKEN'||!moment.text.toLowerCase().includes('you were there'))continue;
    out.push({
      id:'timeline:objective:'+moment.atMs,
      dnaDomain:'OBJECTIVES',
      category:'OBJECTIVES',
      title:'Converted an objective window',
      subskill:'Objective timing',
      whatHappened:moment.text,
      whyItMattered:'You were present when your team turned map pressure into a real objective instead of arriving after the value was already taken.',
      detail:moment.text,
      technicalLabel:'Timeline objective participation',
      proof:[moment.clock+' · '+moment.text],
      value:moment.clock,
      target:'Be present when your team converts the objective',
      score:null,
      source:'TIMELINE',
      atSeconds:Math.round(moment.atMs/1000),
      confidence:'HIGH',
    });
  }

  return dedupe(out).sort((a,b)=>strengthPriority(b)-strengthPriority(a)).slice(0,8);
}

function subskillLabel(category:IssueCategory){
  const labels:Partial<Record<IssueCategory,string>>={
    FARMING:'Farming',POSITIONING:'Positioning',DEATHS:'Survival',LANING:'Laning',TRADING:'Trading',
    WAVE_MANAGEMENT:'Wave management',TEMPO:'Tempo',OBJECTIVES:'Objective timing',VISION:'Vision',
    TEAMFIGHTING:'Teamfighting',TARGET_SELECTION:'Target selection',RECALL_TIMING:'Reset timing',
    RESOURCE_COLLECTION:'Resource collection',MAP_AWARENESS:'Map awareness',CHAMPION_MASTERY:'Champion mastery',
    ITEMISATION:'Itemisation',MATCHUPS:'Matchups',CONSISTENCY:'Consistency',
  };
  return labels[category]||category.replaceAll('_',' ').toLowerCase();
}

function rankStrengthExplanation(metric:string,value:number,target:string){
  const measured=formatValue(metric,value);
  switch(metric){
    case'csAt10':return{whatHappened:'You reached 10:00 with '+measured+' CS and cleared your rank target of '+target+'.',whyItMattered:'That gives you a healthier early gold baseline and makes your first important item timings easier to reach.'};
    case'csAt15':return{whatHappened:'You reached 15:00 with '+measured+' CS and stayed above your rank target.',whyItMattered:'You kept converting lane time into reliable gold instead of needing kills to stay relevant.'};
    case'laneCsPerMin':return{whatHappened:'Your lane farm held at '+measured+', above the target for your current rank.',whyItMattered:'Stable lane income gives you more predictable item timings and more choices when the map starts to open.'};
    case'post15CsPerMin':return{whatHappened:'You kept collecting at '+measured+' after lane instead of letting your economy disappear when teams started moving.',whyItMattered:'Keeping your income alive after lane helps you arrive at later fights with the items your role needs.'};
    case'csPerMin':return{whatHappened:'Your overall farm stayed at '+measured+', clearing the current rank benchmark.',whyItMattered:'Consistent resource collection keeps levels and item timings from falling behind as the game gets more chaotic.'};
    case'deathsPre10':return{whatHappened:'You reached 10:00 without giving away an early death.',whyItMattered:'You protected your lane gold, XP and tempo instead of handing the opponent an avoidable early advantage.'};
    case'deathsPost20':return{whatHappened:'You kept late deaths within the '+target+' benchmark.',whyItMattered:'Late deaths carry long timers and can immediately expose Baron, Dragon or the map, so staying available has extra value.'};
    case'deaths':return{whatHappened:'You kept total deaths within the '+target+' benchmark.',whyItMattered:'Staying on the map lets you keep collecting resources and be available for the next important play.'};
    case'secondItemMinute':return{whatHappened:'You completed your second item at '+measured+', inside the current rank timing bar.',whyItMattered:'You converted earned gold into combat power on time instead of carrying value that could not help you in fights.'};
    case'visionScore':return{whatHappened:'You produced '+measured+' vision score, clearing your current rank benchmark.',whyItMattered:'Better information gives you and your team more warning before fights, rotations and objective setups.'};
    case'killParticipation':return{whatHappened:'You were involved in '+measured+' of your team’s takedowns, above your current rank target.',whyItMattered:'You were present for a strong share of the plays that actually changed the game instead of being disconnected from them.'};
    case'objectiveParticipation':return{whatHappened:'Your objective involvement reached '+measured+', above your current rank target.',whyItMattered:'Being present for objective windows helps turn good map states into permanent value: dragons, Baron, Herald and structures.'};
    case'damageShare':return{whatHappened:'You contributed '+measured+' of your team’s champion damage, clearing the current rank bar.',whyItMattered:'You stayed useful long enough in fights to convert your role and resources into actual teamfight output.'};
    default:return{whatHappened:'You produced '+measured+', which cleared the current rank target of '+target+'.',whyItMattered:'This is measurable evidence of a behaviour worth repeating in future games.'};
  }
}

function decisionStrengthExplanation(key:CoachingMetricKey,summary:string,value:string){
  switch(key){
    case'carry_preservation':return{title:'Protected your value in fights',whatHappened:'You avoided giving away high-value deaths while your team had meaningful gold and item value invested in you.',whyItMattered:'Keeping that value alive meant your team did not lose one of its important resources before the fight or objective was finished.'};
    case'survival_value':return{title:'Stayed alive when your life mattered most',whatHappened:'You avoided costly deaths in the reviewed windows — especially around objectives, large unspent gold or high team item value.',whyItMattered:'Those are the deaths that remove pressure and expose major map objectives, so avoiding them protects more than your KDA.'};
    case'fight_selection':return{title:'Chose your fight entries well',whatHappened:'You mostly avoided committing when the visible fight state was already weighted toward the enemy.',whyItMattered:'That gave your mechanics a fairer fight to work with instead of asking you to outplay a bad setup.'};
    case'death_control':return{title:'Controlled avoidable deaths',whatHappened:'Your reviewed deaths stayed low enough that the system did not detect a strong repeat pattern of throws or chain deaths.',whyItMattered:'Fewer avoidable deaths means more time farming, pressuring the map and being available for the next important window.'};
    case'underdog_conversion':return{title:'Won difficult fight states',whatHappened:'You produced positive outcomes from fights where the visible power state started against you.',whyItMattered:'That is useful execution evidence: when the setup was harder, you still found a way to convert.'};
    case'fight_conversion':return{title:'Turned advantages into winning fights',whatHappened:'When you entered reviewed fights from a stronger visible state, you converted that advantage into positive outcomes.',whyItMattered:'An advantage only has value when it becomes damage, kills, space or objectives. You converted the setup rather than wasting it.'};
    case'lead_protection':return{title:'Protected your advantage',whatHappened:'You avoided donating favourable visible states back through unnecessary deaths.',whyItMattered:'Keeping a lead intact forces the opponent to solve your advantage instead of giving them a free route back into the game.'};
    case'objective_readiness':return{title:'Prepared well for objectives',whatHappened:'Your objective windows showed enough preparation and availability to clear the decision-evidence bar.',whyItMattered:'Objectives are usually won before they spawn through resets, position and availability, not only by the final Smite or fight.'};
    case'reset_quality':return{title:'Used your reset windows well',whatHappened:'You generally converted earned gold into purchases without repeatedly overstaying into costly fight or death windows.',whyItMattered:'A good reset turns farm and kills into actual combat stats before the next important play begins.'};
    case'power_spike_conversion':return{title:'Used your power spikes',whatHappened:'After important level or item spikes, you converted enough of those windows into positive action.',whyItMattered:'Power spikes are temporary advantages. Using them before the opponent catches up turns your build into real map value.'};
    case'farm_fight_tradeoff':return{title:'Balanced farming and fighting well',whatHappened:'You kept collecting resources without repeatedly missing the important fight windows the game presented.',whyItMattered:'Strong players do not choose farm or fights blindly; they collect when it is safe and arrive when the play is actually worth more.'};
    case'opponent_adaptation':return{title:'Adapted after seeing the threat',whatHappened:'Later interactions improved after the same opponent threat had already caused a problem earlier in the game.',whyItMattered:'That shows you were not repeating the exact same decision after receiving new information.'};
    case'historical_recovery':return{title:'Recovered instead of spiralling',whatHappened:'After mistakes, you stabilised enough to avoid immediately repeating the same costly pattern.',whyItMattered:'Recovery is a learnable skill: one mistake stays one mistake instead of turning into a chain of lost decisions.'};
    default:return{title:'',whatHappened:summary||('Your '+key.replaceAll('_',' ').toLowerCase()+' evidence cleared the positive decision bar at '+value+'.'),whyItMattered:'The underlying evidence was strong enough to treat this as something worth repeating, not just a good-looking result.'};
  }
}

function strengthPriority(item:StrengthEvidence){
  const source=item.source==='DECISION_EVIDENCE'?3:item.source==='TIMELINE'?2:1;
  return source*100+(item.score??80);
}

function dedupe(items:StrengthEvidence[]){
  const seen=new Set<string>();
  return items.filter(item=>{
    const key=item.dnaDomain+'|'+item.title.toLowerCase();
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  });
}

function strengthDetail(metric:string,value:number,target:string){
  return 'Measured '+formatValue(metric,value)+' against your rank target of '+target+'. This is a behaviour worth repeating, not generic praise.';
}

function clock(seconds:number){
  const value=Math.max(0,Math.floor(seconds));
  return Math.floor(value/60)+':'+String(value%60).padStart(2,'0');
}

function formatValue(metric:string,value:number){
  if(metric==='objectiveParticipation'||metric==='damageShare'||metric==='killParticipation')return Math.round(value*100)+'%';
  if(metric==='secondItemMinute'){
    const minutes=Math.floor(value),seconds=Math.round((value-minutes)*60);
    return minutes+':'+String(seconds).padStart(2,'0');
  }
  if(metric.toLowerCase().includes('cspermin'))return value.toFixed(1)+' CS/min';
  if(metric==='csAt10'||metric==='csAt15'||metric==='visionScore'||metric==='deaths'||metric==='deathsPre10'||metric==='deathsPost20')return String(Math.round(value));
  return Number.isInteger(value)?String(value):value.toFixed(1);
}
