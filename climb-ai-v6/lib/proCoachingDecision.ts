import type {AnalysisReport,IssueCategory,Match,Mission,Signal} from './types';
import type {ProConfidence,ProMatchAnalysis,ProMetric} from './riot/proAnalysis';
import {leakMetricBoosts} from './proLeakWeighting';

type Candidate={key:string;metric:ProMetric;priority:number};

type CoachingSpec={category:IssueCategory;title:string;rules:string[];suggestion:string};

const SPECS:Record<string,CoachingSpec>={
  fight_selection:{category:'TEAMFIGHTING',title:'FIGHT SELECTION',suggestion:'Before committing, classify the visible fight state: stronger, even, or enemy-favoured. Do not enter an already losing state without a clear reason.',rules:['Before each major fight, identify whether your visible level/item state is stronger, even, or weaker.','If the enemy already has the stronger state, delay the commit until the state changes or your team creates a numbers advantage.','After the fight, check whether your decision matched the state you identified.']},
  death_control:{category:'DEATHS',title:'DEATH CONTROL',suggestion:'Treat each death as a decision window. Protect your next minute of map uptime instead of judging the game by total KDA.',rules:['Before entering danger, identify what you gain if the play works and what disappears from the map if you die.','After a death, take the safest recovery resource before forcing another play.','Do not repeat the same threat interaction without changing position, timing, or information.']},
  resource_conversion:{category:'RECALL_TIMING',title:'CONVERT GOLD INTO POWER',suggestion:'Turn earned gold into purchased combat power before the next important fight instead of carrying a large bank into danger.',rules:['Before a major fight window, check whether you are carrying enough gold to materially improve your combat state.','Prefer a clean reset before the fight when your purchase meaningfully changes your power.','After buying, use the new item window deliberately rather than drifting back onto the map.']},
  unspent_gold:{category:'RECALL_TIMING',title:'SPEND BEFORE YOU FIGHT',suggestion:'Reduce fights taken while meaningful gold is still unspent.',rules:['Check your current gold before committing to the next contested play.','If a useful purchase is available and the map allows it, reset before taking the fight.','Do not let a won sequence turn into an overstay with unspent gold.']},
  reset_quality:{category:'RECALL_TIMING',title:'RESET QUALITY',suggestion:'Create cleaner purchase windows so your next fight uses the gold you already earned.',rules:['After a successful sequence, decide immediately whether the next best action is one more safe resource or a reset.','Reset before the next contested window when your purchase changes your combat strength.','Avoid staying for low-value extra resource when it risks losing the purchase window.']},
  objective_readiness:{category:'OBJECTIVES',title:'OBJECTIVE READINESS',suggestion:'Arrive at objective windows with your resources, position, and purchase state prepared before the contest begins.',rules:['Check the next major objective before choosing your final wave, camp, or reset.','Complete the last safe resource action early enough to arrive before the contest starts.','Do not be the player still farming, shopping, or recovering when the objective fight begins.']},
  lead_protection:{category:'TEMPO',title:'PROTECT YOUR LEAD',suggestion:'When you are visibly stronger, reduce the decisions that give the opponent a free route back into the game.',rules:['When ahead, identify what the enemy must make happen to recover.','Do not offer an isolated or low-information fight that gives away your stronger state.','Convert the lead through safe resource, objectives, or a controlled numbers advantage.']},
  thrown_advantage:{category:'TEMPO',title:'STOP THROWING STRONG STATES',suggestion:'Use favourable item and level states without turning them into unnecessary deaths.',rules:['When you have the stronger visible state, choose the lowest-risk conversion available.','Do not chase beyond the information your team currently has.','End the play once the objective or resource advantage is secured.']},
  fight_conversion:{category:'TEAMFIGHTING',title:'CONVERT POWER WINDOWS',suggestion:'Use clearly stronger combat states to create useful outcomes instead of letting the window expire.',rules:['Identify your stronger item or level window before the next contest.','Use that window around a concrete resource, objective, or numbers advantage.','If no useful conversion is available, preserve the state rather than forcing a low-quality fight.']},
  power_spike_conversion:{category:'CHAMPION_MASTERY',title:'USE YOUR POWER SPIKES',suggestion:'Connect completed-item spikes to the next high-value action on the map.',rules:['After completing a major item, identify the next realistic conversion window.','Move toward a useful resource or objective while the purchase advantage is fresh.','Do not force a fight solely because you bought; the map state still has to support it.']},
  historical_recovery:{category:'CONSISTENCY',title:'RECOVERY DISCIPLINE',suggestion:'After a bad event, stabilise the next sequence instead of allowing one mistake to become two.',rules:['After dying, make the first recovery action low variance.','Rebuild resource and information before re-entering the same contested area.','Judge the next play on its own state, not on the urge to win back the previous loss.']},
  carry_preservation:{category:'POSITIONING',title:'PRESERVE YOUR CARRY VALUE',suggestion:'Protect your uptime when your survival is worth more than one extra damage window.',rules:['Before the fight, identify the enemy threat most capable of removing you.','Position so that threat must spend meaningful resources to reach you.','Give up a small damage window rather than giving up the rest of the fight.']},
  farm_fight_tradeoff:{category:'RESOURCE_COLLECTION',title:'FARM vs FIGHT TRADE-OFF',suggestion:'Make resource rotations deliberate: know what guaranteed farm you are giving up for each fight or move.',rules:['Before leaving a safe resource, name what the move can realistically gain.','Do not abandon guaranteed gold for a low-information fight with no objective attached.','After the play, return to the highest-value safe resource instead of defaulting mid.']},
  opponent_adaptation:{category:'MATCHUPS',title:'ADAPT TO THE REPEAT THREAT',suggestion:'Change the next interaction when the same opponent or threat keeps producing the same bad outcome.',rules:['Identify the opponent or spell repeatedly deciding your bad interactions.','Change one variable before the next interaction: position, timing, vision, ally proximity, or cooldown state.','Do not replay the same losing interaction under the same conditions.']},
  repeat_threat:{category:'MATCHUPS',title:'SOLVE THE REPEAT THREAT',suggestion:'Stop giving the same enemy champion the same access pattern repeatedly.',rules:['Name the repeat threat before the next contested play.','Track the cooldown or route that gives that threat access to you.','Change your position or timing before interacting again.']},
};

const confidenceWeight:Record<ProConfidence,number>={HIGH:1,MEDIUM:.82,LOW:.58};
const statusWeight:Record<ProMetric['status'],number>={MEASURED:1,DERIVED:.92,BUILDING:.45,UNAVAILABLE:0};

export function analyseProMatch(match:Match,analysis:ProMatchAnalysis):AnalysisReport|null{
  const candidate=pickCandidate(analysis); if(!candidate)return null;
  const {key,metric}=candidate; const spec=SPECS[key]??genericSpec(metric.label);
  const confidence=confidenceWeight[metric.confidence]; const score=metric.score??50;
  const severity=Math.max(0,Math.min(1,(100-score)/100));
  const evidence=metric.evidence.slice(0,3).map(item=>item.atSeconds!==undefined?`${clock(item.atSeconds)} — ${item.label}: ${item.detail}`:`${item.label}: ${item.detail}`);
  const facts=evidence.length?evidence:[metric.value,metric.summary].filter(Boolean);
  const primary:Signal={category:spec.category,severity:+severity.toFixed(2),confidence:+confidence.toFixed(2),facts,inference:metric.summary,suggestion:spec.suggestion};
  const target=Math.min(100,Math.round(score+10));
  const mission:Mission={id:`m-${match.riotAccountId}-pro-${key}`,riotAccountId:match.riotAccountId,category:spec.category,title:spec.title,metric:key,target,unit:'PRO evidence score',gamesRequired:3,gamesCompleted:0,successfulGames:0,rules:spec.rules,status:'DISCOVER',createdAt:new Date().toISOString()};
  const scored=Object.values(analysis.metrics).filter((m):m is ProMetric=>Boolean(m&&typeof m.score==='number'&&m.status!=='UNAVAILABLE'));
  const performance=scored.length?Math.max(1,Math.min(10,+((scored.reduce((sum,m)=>sum+(m.score??0),0)/scored.length/10).toFixed(1)))):5;
  return {matchId:match.id,performance,good:positiveEvidence(analysis),primary,mission,summary:`${spec.title} is the highest-priority evidence-backed behaviour in this match. The target is improvement against your own current PRO evidence baseline, not a generic rank benchmark.`};
}

export function pickProCoachingCandidate(analysis:ProMatchAnalysis):Candidate|null{
  const leakBoost=leakMetricBoosts(analysis.leakSignals); const candidates:Candidate[]=[];
  for(const [key,metric] of Object.entries(analysis.metrics)){
    if(!metric||metric.score===null||metric.status==='UNAVAILABLE'||metric.status==='BUILDING')continue;
    if(key==='decision_fingerprint'||key==='champion_identity'||key==='historical_leak_rate')continue;
    const weakness=100-metric.score;
    const priority=weakness*confidenceWeight[metric.confidence]*statusWeight[metric.status]+(leakBoost.get(key)??0);
    candidates.push({key,metric,priority});
  }
  candidates.sort((a,b)=>b.priority-a.priority); return candidates[0]??null;
}

function pickCandidate(analysis:ProMatchAnalysis){return pickProCoachingCandidate(analysis)}
function positiveEvidence(analysis:ProMatchAnalysis){return Object.values(analysis.metrics).filter((m):m is ProMetric=>Boolean(m&&typeof m.score==='number'&&m.status!=='UNAVAILABLE')).sort((a,b)=>(b.score??0)-(a.score??0)).slice(0,3).map(m=>`${m.label}: ${m.value}. ${m.summary}`)}
function genericSpec(label:string):CoachingSpec{return{category:'CONSISTENCY',title:label.toUpperCase(),suggestion:`Use the next games to improve ${label.toLowerCase()} against your own current evidence baseline.`,rules:[`Before the relevant decision, name the ${label.toLowerCase()} behaviour you are trying to improve.`,'Make the decision deliberately rather than on autopilot.','After the game, use the recorded evidence to check whether the behaviour improved.']}}
function clock(seconds:number){const s=Math.max(0,Math.round(seconds));return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
