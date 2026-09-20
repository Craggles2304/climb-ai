import type {CoachingMetricKey} from '../subscription';
import type {StrengthTimeline,FightReview} from './liveStrength';
import type {LiveTelemetryPlayer,LiveTelemetrySnapshot,LiveTelemetryEvent} from './liveTelemetry';
import type {RiotMatchDto,RiotParticipant,RiotTimelineDto,RiotTimelineEvent,RiotTimelineFrame} from './riotTypes';

export type ProMetricStatus='MEASURED'|'DERIVED'|'BUILDING'|'UNAVAILABLE';
export type ProConfidence='HIGH'|'MEDIUM'|'LOW';
export type ProSeverity='CRITICAL'|'MAJOR'|'ACTIVE'|'POLISH';

export interface ProEvidence{
  atSeconds?:number;
  label:string;
  detail:string;
}

export interface ProMetric{
  key:CoachingMetricKey;
  label:string;
  score:number|null;
  value:string;
  status:ProMetricStatus;
  confidence:ProConfidence;
  sources:string[];
  summary:string;
  evidence:ProEvidence[];
}

export interface ProLeakSignal{
  key:string;
  label:string;
  count:number;
  severity:ProSeverity;
  detail:string;
  evidenceSeconds:number[];
}

export interface ProFingerprint{
  primary:string;
  sequence:string[];
  confidence:ProConfidence;
  explanation:string;
}

export interface ProMatchAnalysis{
  version:1;
  champion:string;
  role:string|null;
  evidenceSources:string[];
  metrics:Partial<Record<CoachingMetricKey,ProMetric>>;
  leakSignals:ProLeakSignal[];
  fingerprint:ProFingerprint;
  decisionGraph?:import('../decisionGraph').DecisionGraph;
}

export interface RiotProOptions{
  completedItemIds?:ReadonlySet<number>;
}

const clamp=(n:number,min=0,max=100)=>Math.max(min,Math.min(max,Math.round(n)));
const round=(n:number,dp=1)=>Number(n.toFixed(dp));
const pct=(a:number,b:number)=>b>0?Math.round(a/b*100):0;

export function buildLiveProAnalysis(snapshots:LiveTelemetrySnapshot[],summary:StrengthTimeline):ProMatchAnalysis{
  const ordered=[...snapshots].sort((a,b)=>a.gameTime-b.gameTime);
  const final=ordered[ordered.length-1];
  const me=final?findMe(final):null;
  const champion=me?.championName||final?.active.championName||'Unknown';
  const role=final?.active.position||me?.position||null;
  const fights=summary.fightReviews??[];
  const deaths=fights.filter(f=>f.outcome==='DEATH');
  const positives=fights.filter(f=>f.outcome!=='DEATH');
  const stronger=fights.filter(f=>f.verdict==='YOU_STRONGER');
  const weaker=fights.filter(f=>f.verdict==='THEM_STRONGER');
  const redDeaths=deaths.filter(f=>f.verdict==='THEM_STRONGER');
  const thrown=deaths.filter(f=>f.verdict==='YOU_STRONGER');
  const chain=chainDeaths(deaths);
  const highGoldFights=fights.filter(f=>f.evidence.currentGold>=900);
  const highGoldDeaths=deaths.filter(f=>f.evidence.currentGold>=1200);
  const underdog=positives.filter(f=>f.verdict==='THEM_STRONGER');
  const convertedAhead=positives.filter(f=>f.verdict==='YOU_STRONGER');
  const objectiveEvents=uniqueLiveEvents(ordered).filter(isObjectiveEvent);
  const spikes=livePowerSpikes(ordered);
  const purchaseWindows=livePurchaseWindows(ordered);
  const recovery=liveRecovery(ordered,deaths);
  const carry=liveCarryPreservation(ordered,deaths);
  const itemTiming=liveItemTiming(ordered);
  const farmTrade=liveFarmFightTradeoff(ordered,fights);
  const objective=liveObjectiveReadiness(ordered,objectiveEvents,deaths);
  const spikeConversion=conversionAfterSpikes(spikes,positives);
  const threat=repeatThreat(deaths);
  const adaptation=liveOpponentAdaptation(fights,threat?.name??null);
  const resetScore=clamp(100-highGoldDeaths.length*28-Math.max(0,highGoldFights.length-highGoldDeaths.length)*7);
  const fightSelectionScore=clamp(100-pct(redDeaths.length,Math.max(1,fights.length)));
  const deathControlScore=clamp(100-deaths.length*9-thrown.length*10-chain.length*8);
  const leadProtectionScore=stronger.length?clamp(100-pct(thrown.length,stronger.length)):100;
  const resourceScore=clamp(100-highGoldDeaths.length*25-Math.max(0,highGoldFights.length-highGoldDeaths.length)*8);
  const csCurve=liveCsCurve(ordered);
  const survival=liveSurvivalValue(ordered,deaths,objectiveEvents);
  const buildResponse=liveBuildResponse(final,threat?.count??0);

  const metrics:Partial<Record<CoachingMetricKey,ProMetric>>={
    fight_selection:metric('fight_selection','FIGHT SELECTION',fightSelectionScore,`${fightSelectionScore}/100`,'DERIVED','HIGH','Share of reviewed fights where you avoided entering an already enemy-favoured visible state.',redDeaths.map(f=>ev(f.atSeconds,'Red-state death',f.headline))),
    death_control:metric('death_control','DEATH CONTROL',deathControlScore,`${deathControlScore}/100`,'DERIVED','HIGH','Weights total deaths, thrown advantages and chain deaths instead of treating every death equally.',deaths.slice(0,6).map(f=>ev(f.atSeconds,'Death',f.summary))),
    cs_curve:metric('cs_curve','CS CURVE',csCurve.score,csCurve.value,csCurve.status,'MEDIUM',csCurve.summary,csCurve.evidence),
    unspent_gold:metric('unspent_gold','UNSPENT GOLD EXPOSURE',resourceScore,`${highGoldFights.length} exposed fights`,'MEASURED','HIGH',`${highGoldDeaths.length} reviewed death${highGoldDeaths.length===1?'':'s'} happened while holding 1200g+. Gold that is not spent gives no combat stats.`,highGoldFights.slice(0,6).map(f=>ev(f.atSeconds,`${Math.round(f.evidence.currentGold)}g held`,f.headline))),
    red_state_fights:metric('red_state_fights','RED-STATE FIGHT RATE',fightSelectionScore,`${pct(redDeaths.length,Math.max(1,deaths.length))}% of deaths`,'DERIVED','HIGH','Tracks deaths taken while the opponent already held the stronger visible level/item state.',redDeaths.map(f=>ev(f.atSeconds,'Enemy-favoured',f.headline))),
    chain_deaths:metric('chain_deaths','CHAIN-DEATH RATE',recovery.score,`${chain.length}/${deaths.length} deaths`,'DERIVED','HIGH','A chain death is a second death within 90 seconds of the previous one. Recovery quality also checks whether you resumed collecting CS before re-fighting.',chain.map(f=>ev(f.atSeconds,'Chain death','Second death inside the recovery window.'))),
    thrown_advantage:metric('thrown_advantage','THROWN ADVANTAGE RATE',leadProtectionScore,`${pct(thrown.length,Math.max(1,stronger.length))}%`,'DERIVED','HIGH','How often a visibly stronger combat state still ended in your death.',thrown.map(f=>ev(f.atSeconds,'Advantage thrown',f.headline))),
    underdog_conversion:metric('underdog_conversion','UNDERDOG CONVERSION',weaker.length?clamp(pct(underdog.length,weaker.length)):null,weaker.length?`${pct(underdog.length,weaker.length)}%`:'No disadvantaged fights',weaker.length?'DERIVED':'BUILDING','MEDIUM','Positive outcomes produced while the opponent held the stronger visible state. Useful as execution evidence, not proof the matchup was favourable.',underdog.map(f=>ev(f.atSeconds,'Underdog conversion',f.headline))),
    fight_conversion:metric('fight_conversion','POWER WINDOW CONVERSION',stronger.length?clamp(pct(convertedAhead.length,stronger.length)):null,stronger.length?`${pct(convertedAhead.length,stronger.length)}%`:'No clear power windows',stronger.length?'DERIVED':'BUILDING','HIGH','How often reviewed stronger states became positive outcomes instead of deaths.',convertedAhead.map(f=>ev(f.atSeconds,'Converted advantage',f.headline))),
    resource_conversion:metric('resource_conversion','RESOURCE CONVERSION',resourceScore,`${resourceScore}/100`,'DERIVED','HIGH','Scores whether earned gold was converted into purchased combat power before reviewed fights.',highGoldFights.slice(0,6).map(f=>ev(f.atSeconds,'Unconverted gold',`${Math.round(f.evidence.currentGold)}g was still in pocket.`))),
    lead_protection:metric('lead_protection','LEAD PROTECTION',leadProtectionScore,`${leadProtectionScore}/100`,'DERIVED','HIGH','Measures whether you kept favourable visible states instead of donating them back through deaths.',thrown.map(f=>ev(f.atSeconds,'Lead lost',f.headline))),
    power_spike_conversion:metric('power_spike_conversion','POWER-SPIKE CONVERSION',spikeConversion.score,spikeConversion.value,spikeConversion.status,'MEDIUM',spikeConversion.summary,spikeConversion.evidence),
    reset_quality:metric('reset_quality','RESET QUALITY',resetScore,`${resetScore}/100`,'DERIVED','MEDIUM',`Tracker proxy built from ${purchaseWindows.length} detected purchase window${purchaseWindows.length===1?'':'s'} plus fights taken while carrying large unspent gold. Match-V5 upgrades this with purchase timeline evidence.`,[...purchaseWindows.slice(0,4).map(p=>ev(p.atSeconds,'Purchase window',`About ${Math.round(p.goldSpent)}g converted into items.`)),...highGoldDeaths.slice(0,3).map(f=>ev(f.atSeconds,'Overstay cost',`Death while holding ${Math.round(f.evidence.currentGold)}g.`))]),
    objective_readiness:metric('objective_readiness','OBJECTIVE READINESS',objective.score,objective.value,objective.status,'MEDIUM',objective.summary,objective.evidence),
    farm_fight_tradeoff:metric('farm_fight_tradeoff','FARM vs FIGHT TRADE-OFF',farmTrade.score,farmTrade.value,farmTrade.status,'MEDIUM',farmTrade.summary,farmTrade.evidence),
    repeat_threat:metric('repeat_threat','REPEAT THREAT',threat?clamp(100-Math.max(0,threat.count-1)*20):100,threat?`${threat.name} ×${threat.count}`:'No repeat killer',threat?'MEASURED':'DERIVED','HIGH',threat?`${threat.name} appeared repeatedly in your death events. This is a matchup-adaptation signal, not just a total-death stat.`:'No single opponent repeatedly caused your reviewed deaths.',threat?.evidence.map(f=>ev(f.atSeconds,'Repeated threat',f.headline))??[]),
    opponent_adaptation:metric('opponent_adaptation','OPPONENT ADAPTATION',adaptation.score,adaptation.value,adaptation.status,'MEDIUM',adaptation.summary,adaptation.evidence),
    item_timing_diff:metric('item_timing_diff','ITEM TIMING DIFFERENTIAL',itemTiming.score,itemTiming.value,itemTiming.status,'MEDIUM',itemTiming.summary,itemTiming.evidence),
    build_response:metric('build_response','BUILD RESPONSE',buildResponse.score,buildResponse.value,buildResponse.status,'LOW',buildResponse.summary,buildResponse.evidence),
    damage_efficiency:metric('damage_efficiency','DAMAGE EFFICIENCY',null,'Match-V5 required','UNAVAILABLE','LOW','The local Riot client does not expose final champion damage. Match-V5 upgrades this to damage per minute, damage share and damage per 1,000 gold.',[]),
    survival_value:metric('survival_value','SURVIVAL VALUE',survival.score,survival.value,survival.status,'MEDIUM',survival.summary,survival.evidence),
    carry_preservation:metric('carry_preservation','CARRY PRESERVATION',carry.score,carry.value,carry.status,'MEDIUM',carry.summary,carry.evidence),
    historical_recovery:metric('historical_recovery','RECOVERY SCORE',recovery.score,`${recovery.score}/100`,'DERIVED','MEDIUM',recovery.summary,recovery.evidence),
  };

  const leaks=buildLeakSignals({highGoldDeaths,redDeaths,chain,thrown,deaths,objective,carry});
  const fingerprint=buildFingerprint(leaks,metrics,champion,role);
  metrics.decision_fingerprint=metric('decision_fingerprint','DECISION FINGERPRINT',null,fingerprint.primary,'DERIVED','MEDIUM',fingerprint.explanation,fingerprint.sequence.map((step,i)=>({label:`Step ${i+1}`,detail:step})));
  metrics.champion_identity=championIdentityMetric(champion,role,metrics);
  metrics.historical_leak_rate=metric('historical_leak_rate','OP LEAK RATE',null,'Building history','BUILDING','LOW','This becomes a true historical rate after multiple completed tracked games. The current match contributes its detected leak signals to that profile.',leaks.slice(0,5).map(l=>({label:l.label,detail:`${l.count} occurrence${l.count===1?'':'s'} this game.`})));

  return {version:1,champion,role,evidenceSources:['LIVE_TELEMETRY'],metrics,leakSignals:leaks,fingerprint};
}

export function buildRiotProAnalysis(dto:RiotMatchDto,timeline:RiotTimelineDto|null,puuid:string,opts:RiotProOptions={}):ProMatchAnalysis|null{
  const me=dto.info.participants.find(p=>p.puuid===puuid);
  if(!me)return null;
  const role=me.teamPosition||me.individualPosition||null;
  const metrics:Partial<Record<CoachingMetricKey,ProMetric>>={};
  const minutes=Math.max(1,durationSeconds(dto)/60);
  const damage=me.totalDamageDealtToChampions;
  const gold=me.goldEarned;
  if(typeof damage==='number'&&typeof gold==='number'&&gold>0){
    const per1k=round(damage/gold*1000,0);
    metrics.damage_efficiency=metric('damage_efficiency','DAMAGE EFFICIENCY',null,`${per1k} dmg / 1k gold`,'MEASURED','HIGH',`${round(damage/minutes,0)} champion damage per minute with ${round(gold/minutes,0)} gold per minute. This is measured from Riot's completed-match payload, not inferred from KDA.`,[],'MATCH_V5');
  }

  if(!timeline){
    const fingerprint:ProFingerprint={primary:'MATCH DATA ONLY',sequence:['Match-V5 result available','Timeline unavailable'],confidence:'LOW',explanation:'The match payload enriched final damage/economy, but timeline-dependent PRO metrics could not be upgraded.'};
    return {version:1,champion:me.championName,role,evidenceSources:['MATCH_V5'],metrics,leakSignals:[],fingerprint};
  }

  const events=allRiotEvents(timeline);
  const meId=me.participantId;
  const opponent=findLaneOpponent(dto,me);
  const myDeaths=events.filter(e=>e.type==='CHAMPION_KILL'&&e.victimId===meId);
  const completed=opts.completedItemIds;
  const myCompleted=completed?[...events].filter(e=>e.type==='ITEM_PURCHASED'&&e.participantId===meId&&typeof e.itemId==='number'&&completed.has(e.itemId)):[];
  const positiveEvents=events.filter(e=>riotPositiveForPlayer(e,meId));
  const spikeConverted=myCompleted.filter(spike=>positiveEvents.some(e=>e.timestamp>=spike.timestamp&&e.timestamp<=spike.timestamp+120_000));
  metrics.power_spike_conversion=metric('power_spike_conversion','POWER-SPIKE CONVERSION',myCompleted.length?clamp(pct(spikeConverted.length,myCompleted.length)):null,myCompleted.length?`${pct(spikeConverted.length,myCompleted.length)}%`:'No completed-item spikes detected',myCompleted.length?'MEASURED':'BUILDING','HIGH','Completed-item purchase timings are matched against kills, assists and team objective participation in the following two minutes.',myCompleted.slice(0,6).map(e=>({atSeconds:e.timestamp/1000,label:'Completed item spike',detail:positiveEvents.some(p=>p.timestamp>=e.timestamp&&p.timestamp<=e.timestamp+120_000)?'Converted within 2 minutes.':'No recorded conversion inside 2 minutes.'})),'MATCH_V5_TIMELINE');

  const shopClusters=riotPurchaseClusters(events,meId,timeline);
  const costlyDeaths=myDeaths.filter(d=>currentGoldNear(timeline,d.timestamp,meId)>=1200);
  const resetScore=clamp(100-costlyDeaths.length*25-shopClusters.filter(s=>s.preGold>=1500).length*8);
  metrics.reset_quality=metric('reset_quality','RESET QUALITY',resetScore,`${resetScore}/100`,'DERIVED','MEDIUM','Uses Riot purchase clusters and minute-frame pocket gold to detect large-bank overstays before shopping and deaths taken while still carrying purchasable gold.',[...shopClusters.slice(0,5).map(s=>({atSeconds:s.atSeconds,label:'Shop window',detail:`Approx. ${Math.round(s.preGold)}g available before the purchase cluster.`})),...costlyDeaths.slice(0,4).map(d=>({atSeconds:d.timestamp/1000,label:'Death before spending',detail:`Approx. ${Math.round(currentGoldNear(timeline,d.timestamp,meId))}g in the nearest Riot frame.`}))],'MATCH_V5_TIMELINE');

  const objective=riotObjectiveReadiness(events,timeline,meId,myDeaths);
  metrics.objective_readiness=metric('objective_readiness','OBJECTIVE READINESS',objective.score,objective.value,objective.status,'HIGH',objective.summary,objective.evidence,'MATCH_V5_TIMELINE');

  const farm=riotFarmFightTradeoff(timeline,events,meId);
  metrics.farm_fight_tradeoff=metric('farm_fight_tradeoff','FARM vs FIGHT TRADE-OFF',farm.score,farm.value,farm.status,'HIGH',farm.summary,farm.evidence,'MATCH_V5_TIMELINE');

  const timing=riotItemTiming(events,me,opponent,completed);
  metrics.item_timing_diff=metric('item_timing_diff','ITEM TIMING DIFFERENTIAL',timing.score,timing.value,timing.status,'HIGH',timing.summary,timing.evidence,'MATCH_V5_TIMELINE');

  const carry=riotCarryPreservation(dto,timeline,myDeaths,me);
  metrics.carry_preservation=metric('carry_preservation','CARRY PRESERVATION',carry.score,carry.value,carry.status,'HIGH',carry.summary,carry.evidence,'MATCH_V5_TIMELINE');

  const dpm=typeof damage==='number'?damage/minutes:0;
  const survivalScore=clamp(100-myDeaths.length*6-carry.highValueDeaths*12);
  metrics.survival_value=metric('survival_value','SURVIVAL VALUE',survivalScore,`${round(dpm,0)} DPM · ${myDeaths.length} deaths`,'MEASURED','HIGH','Combines final champion damage with the cost of dying while holding a high share of your team economy.',carry.evidence,'MATCH_V5');

  const repeat=riotRepeatThreat(dto,myDeaths);
  metrics.repeat_threat=metric('repeat_threat','REPEAT THREAT',repeat?clamp(100-(repeat.count-1)*20):100,repeat?`${repeat.name} ×${repeat.count}`:'No repeat killer',repeat?'MEASURED':'DERIVED','HIGH',repeat?`${repeat.name} killed you repeatedly in the Riot timeline.`:'No single opponent repeatedly killed you.',repeat?.evidence??[],'MATCH_V5_TIMELINE');
  const adaptation=riotOpponentAdaptation(dto,events,meId,repeat?.participantId??null);
  metrics.opponent_adaptation=metric('opponent_adaptation','OPPONENT ADAPTATION',adaptation.score,adaptation.value,adaptation.status,'HIGH',adaptation.summary,adaptation.evidence,'MATCH_V5_TIMELINE');

  const fingerprint:ProFingerprint={primary:'RIOT TIMELINE ENRICHED',sequence:['Live decision evidence','Riot purchase/objective timeline','Persistent history'],confidence:'HIGH',explanation:'This match has authoritative Riot match and timeline evidence layered over the live tracker review.'};
  return {version:1,champion:me.championName,role,evidenceSources:['MATCH_V5','MATCH_V5_TIMELINE'],metrics,leakSignals:[],fingerprint};
}

export function mergeProAnalyses(base:ProMatchAnalysis,upgrade:ProMatchAnalysis|null|undefined):ProMatchAnalysis{
  if(!upgrade)return base;
  const metrics={...base.metrics};
  for(const [key,value] of Object.entries(upgrade.metrics))if(value)metrics[key as CoachingMetricKey]=value;
  return {
    ...base,
    champion:upgrade.champion||base.champion,
    role:upgrade.role||base.role,
    evidenceSources:[...new Set([...base.evidenceSources,...upgrade.evidenceSources])],
    metrics,
    leakSignals:base.leakSignals.length?base.leakSignals:upgrade.leakSignals,
    fingerprint:upgrade.fingerprint.confidence==='HIGH'?{...base.fingerprint,confidence:'HIGH',explanation:`${base.fingerprint.explanation} Riot timeline enrichment is available for this match.`}:base.fingerprint,
  };
}

function metric(key:CoachingMetricKey,label:string,score:number|null,value:string,status:ProMetricStatus,confidence:ProConfidence,summary:string,evidence:ProEvidence[],source='LIVE_TELEMETRY'):ProMetric{
  return {key,label,score,value,status,confidence,sources:[source],summary,evidence};
}
function ev(atSeconds:number,label:string,detail:string):ProEvidence{return{atSeconds,label,detail}}

function findMe(snapshot:LiveTelemetrySnapshot):LiveTelemetryPlayer|null{
  const riotId=snapshot.active.riotId,summoner=snapshot.active.summonerName;
  return snapshot.players.find(p=>Boolean(riotId&&p.riotId===riotId))
    ??snapshot.players.find(p=>Boolean(summoner&&p.summonerName===summoner))
    ??snapshot.players.find(p=>p.championName===snapshot.active.championName&&p.team===snapshot.active.team)
    ??null;
}
function findLaneOpponentLive(snapshot:LiveTelemetrySnapshot,me:LiveTelemetryPlayer|null){
  if(!me)return null;
  return snapshot.players.find(p=>p.team!==me.team&&p.team!=='UNKNOWN'&&p.position&&me.position&&p.position===me.position)??null;
}
function snapshotAtOrBefore(snapshots:LiveTelemetrySnapshot[],seconds:number){let best:LiveTelemetrySnapshot|null=null;for(const s of snapshots){if(s.gameTime<=seconds+2)best=s;else break}return best}
function snapshotAfter(snapshots:LiveTelemetrySnapshot[],seconds:number){return snapshots.find(s=>s.gameTime>=seconds)??null}
function healthPct(s:LiveTelemetrySnapshot|null){if(!s||!s.active.stats.currentHealth||!s.active.stats.maxHealth)return null;return s.active.stats.currentHealth/s.active.stats.maxHealth}
function uniqueLiveEvents(snapshots:LiveTelemetrySnapshot[]){const map=new Map<string,LiveTelemetryEvent>();for(const s of snapshots)for(const e of s.events){const key=e.id!==null?`id:${e.id}`:`${e.name}:${round(e.time,1)}:${e.actor||''}:${e.target||''}`;map.set(key,e)}return[...map.values()].sort((a,b)=>a.time-b.time)}
function isObjectiveEvent(e:LiveTelemetryEvent){return /dragon|baron|herald|horde|turret|inhib/i.test(e.name)}

function chainDeaths(deaths:FightReview[]){return deaths.filter((d,i)=>i>0&&d.atSeconds-deaths[i-1].atSeconds<=90)}
function repeatThreat(deaths:FightReview[]){const groups=new Map<string,FightReview[]>();for(const d of deaths){const name=d.opponentChampion||d.opponent;if(name)groups.set(name,[...(groups.get(name)||[]),d])}const sorted=[...groups.entries()].sort((a,b)=>b[1].length-a[1].length);return sorted[0]&&sorted[0][1].length>1?{name:sorted[0][0],count:sorted[0][1].length,evidence:sorted[0][1]}:null}

function livePowerSpikes(snapshots:LiveTelemetrySnapshot[]){const out:{atSeconds:number;label:string}[]=[];let prev:LiveTelemetryPlayer|null=null;const seenItems=new Set<number>();for(const s of snapshots){const me=findMe(s);if(!me)continue;if(prev&&[6,11,16].includes(me.level)&&me.level>prev.level)out.push({atSeconds:s.gameTime,label:`Level ${me.level}`});for(const item of me.items){if(item.price>=1600&&!seenItems.has(item.itemId)){seenItems.add(item.itemId);out.push({atSeconds:s.gameTime,label:item.displayName})}}prev=me}return dedupeTimes(out,20)}
function conversionAfterSpikes(spikes:{atSeconds:number;label:string}[],positives:FightReview[]){if(!spikes.length)return{score:null,value:'No major spikes detected',status:'BUILDING' as ProMetricStatus,summary:'No level 6/11/16 or major-item acquisition was reliably detected in the tracker snapshots.',evidence:[] as ProEvidence[]};const converted=spikes.filter(s=>positives.some(f=>f.atSeconds>=s.atSeconds&&f.atSeconds<=s.atSeconds+120));const score=clamp(pct(converted.length,spikes.length));return{score,value:`${converted.length}/${spikes.length} converted`,status:'DERIVED' as ProMetricStatus,summary:'Measures whether a major item/level spike was followed by a positive fight conversion within two minutes.',evidence:spikes.slice(0,6).map(s=>ev(s.atSeconds,s.label,converted.includes(s)?'Positive fight conversion followed inside 2 minutes.':'No positive reviewed conversion inside 2 minutes.'))}}
function livePurchaseWindows(snapshots:LiveTelemetrySnapshot[]){const out:{atSeconds:number;goldSpent:number}[]=[];for(let i=1;i<snapshots.length;i++){const a=snapshots[i-1],b=snapshots[i],ma=findMe(a),mb=findMe(b);if(!ma||!mb)continue;const goldDrop=a.active.currentGold-b.active.currentGold;const itemGain=mb.itemGold-ma.itemGold;if(goldDrop>=300&&(itemGain>=200||itemsChanged(ma,mb)))out.push({atSeconds:b.gameTime,goldSpent:goldDrop})}return dedupeTimes(out,20)}
function itemsChanged(a:LiveTelemetryPlayer,b:LiveTelemetryPlayer){const aa=a.items.map(i=>`${i.itemId}:${i.count}`).sort().join(','),bb=b.items.map(i=>`${i.itemId}:${i.count}`).sort().join(',');return aa!==bb}

function liveObjectiveReadiness(snapshots:LiveTelemetrySnapshot[],events:LiveTelemetryEvent[],deaths:FightReview[]){if(!events.length)return{score:null,value:'No major objective events',status:'BUILDING' as ProMetricStatus,summary:'No dragon, Baron, Herald or structure event was available in the local event feed.',evidence:[] as ProEvidence[]};let ready=0;const evidence:ProEvidence[]=[];for(const e of events){const s=snapshotAtOrBefore(snapshots,e.time),me=s?findMe(s):null;const recentDeath=deaths.some(d=>d.atSeconds<=e.time&&e.time-d.atSeconds<=45);const hp=healthPct(s);const gold=s?.active.currentGold??0;const good=Boolean(me&&!me.isDead&&!recentDeath&&gold<1200&&(hp===null||hp>=.5));if(good)ready++;else evidence.push(ev(e.time,e.name,recentDeath?'You died within 45s before this event.':gold>=1200?`You were carrying about ${Math.round(gold)}g.`:me?.isDead?'You were dead around the event.':'Low health/resource readiness reduced your margin.'))}const score=clamp(pct(ready,events.length));return{score,value:`${ready}/${events.length} ready`,status:'DERIVED' as ProMetricStatus,summary:'Readiness proxy checks whether you were alive, not freshly dead, reasonably healthy and not holding a large unspent bank around major objective events.',evidence:evidence.slice(0,6)}}

function liveFarmFightTradeoff(snapshots:LiveTelemetrySnapshot[],fights:FightReview[]){const final=snapshots[snapshots.length-1],first=snapshots[0],mf=final?findMe(final):null,mi=first?findMe(first):null;if(!mf||!mi||final.gameTime-first.gameTime<180)return{score:null,value:'Building sample',status:'BUILDING' as ProMetricStatus,summary:'Not enough time-series CS evidence to separate normal farming from post-fight farming.',evidence:[] as ProEvidence[]};const overall=(mf.scores.creepScore-mi.scores.creepScore)/Math.max((final.gameTime-first.gameTime)/60,.1);const rates:number[]=[];const evidence:ProEvidence[]=[];for(const f of fights.slice(0,10)){const a=snapshotAtOrBefore(snapshots,f.atSeconds),b=snapshotAfter(snapshots,f.atSeconds+90),ma=a?findMe(a):null,mb=b?findMe(b):null;if(!a||!b||!ma||!mb)continue;const rate=(mb.scores.creepScore-ma.scores.creepScore)/Math.max((b.gameTime-a.gameTime)/60,.1);rates.push(rate);if(rate<overall*.55)evidence.push(ev(f.atSeconds,'Farm dropped after fight',`${round(rate,1)} CS/min after this event vs ${round(overall,1)} overall.`))}if(!rates.length)return{score:null,value:`${round(overall,1)} overall CS/min`,status:'BUILDING' as ProMetricStatus,summary:'Fight windows did not have enough following snapshot coverage for a reliable comparison.',evidence};const avg=rates.reduce((a,b)=>a+b,0)/rates.length;const score=overall>0?clamp(Math.min(1,avg/(overall*.75))*100):100;return{score,value:`${round(avg,1)} CS/min after fights`,status:'DERIVED' as ProMetricStatus,summary:`Overall farming was ${round(overall,1)} CS/min. This checks whether fighting repeatedly collapses the next 90 seconds of resource collection.`,evidence:evidence.slice(0,6)}}

function liveRecovery(snapshots:LiveTelemetrySnapshot[],deaths:FightReview[]){if(!deaths.length)return{score:100,summary:'No reviewed deaths created a recovery window.',evidence:[] as ProEvidence[]};let clean=0;const evidence:ProEvidence[]=[];for(const d of deaths){const nextDeath=deaths.find(x=>x.atSeconds>d.atSeconds&&x.atSeconds-d.atSeconds<=90);const a=snapshotAfter(snapshots,d.atSeconds+5),b=snapshotAfter(snapshots,d.atSeconds+90),ma=a?findMe(a):null,mb=b?findMe(b):null;const csGain=ma&&mb?mb.scores.creepScore-ma.scores.creepScore:0;if(!nextDeath&&(csGain>=4||!b))clean++;else evidence.push(ev(d.atSeconds,'Recovery failed',nextDeath?'Another death followed inside 90 seconds.':`Only ${csGain} CS was collected in the recovery window.`))}const score=clamp(pct(clean,deaths.length));return{score,summary:`${clean}/${deaths.length} death recovery windows avoided an immediate chain death and showed resource stabilisation.`,evidence:evidence.slice(0,6)}}

function liveCarryPreservation(snapshots:LiveTelemetrySnapshot[],deaths:FightReview[]){if(!deaths.length)return{score:100,value:'No deaths',status:'DERIVED' as ProMetricStatus,summary:'No death exposed your team investment this game.',evidence:[] as ProEvidence[],highValueDeaths:0};let high=0;const evidence:ProEvidence[]=[];for(const d of deaths){const s=snapshotAtOrBefore(snapshots,d.atSeconds),me=s?findMe(s):null;if(!s||!me)continue;const team=s.players.filter(p=>p.team===me.team).sort((a,b)=>b.itemGold-a.itemGold);const rank=team.findIndex(p=>sameLivePlayer(p,me))+1;if(rank>0&&rank<=2){high++;evidence.push(ev(d.atSeconds,'High-value death',`You were #${rank} on your team in visible item value immediately around the death.`))}}const score=clamp(100-pct(high,deaths.length));return{score,value:`${high}/${deaths.length} high-value deaths`,status:'DERIVED' as ProMetricStatus,summary:'Penalises deaths that occur while you are one of your team’s top visible economic carries.',evidence:evidence.slice(0,6),highValueDeaths:high}}
function sameLivePlayer(a:LiveTelemetryPlayer,b:LiveTelemetryPlayer){return Boolean(a.riotId&&b.riotId&&a.riotId===b.riotId)||Boolean(a.summonerName&&a.summonerName===b.summonerName)||a.championName===b.championName}

function liveSurvivalValue(snapshots:LiveTelemetrySnapshot[],deaths:FightReview[],objectives:LiveTelemetryEvent[]){if(!deaths.length)return{score:100,value:'No reviewed deaths',status:'DERIVED' as ProMetricStatus,summary:'You preserved your life through every reviewed fight event.',evidence:[] as ProEvidence[]};let costly=0;const evidence:ProEvidence[]=[];for(const d of deaths){const nearObj=objectives.some(o=>o.time>=d.atSeconds&&o.time-d.atSeconds<=45);const s=snapshotAtOrBefore(snapshots,d.atSeconds),me=s?findMe(s):null;const team=s&&me?s.players.filter(p=>p.team===me.team).sort((a,b)=>b.itemGold-a.itemGold):[];const rank=me?team.findIndex(p=>sameLivePlayer(p,me))+1:0;const highGold=d.evidence.currentGold>=1200;if(nearObj||highGold||(rank>0&&rank<=2)){costly++;evidence.push(ev(d.atSeconds,'High-cost death',[nearObj?'major objective within 45s':'',highGold?`${Math.round(d.evidence.currentGold)}g unspent`:'',rank>0&&rank<=2?`#${rank} team item value`:'' ].filter(Boolean).join(' · ')))}}const score=clamp(100-deaths.length*5-costly*15);return{score,value:`${costly}/${deaths.length} high-cost deaths`,status:'DERIVED' as ProMetricStatus,summary:'Separates ordinary deaths from deaths that expose a large bank, team carry value or an upcoming objective window.',evidence:evidence.slice(0,6)}}

function liveCsCurve(snapshots:LiveTelemetrySnapshot[]){const checkpoints=[5,10,15,20].map(min=>{const s=snapshotAtOrBefore(snapshots,min*60),me=s?findMe(s):null;return me?{min,cs:me.scores.creepScore}:null}).filter(Boolean) as {min:number;cs:number}[];if(checkpoints.length<2)return{score:null,value:'Building curve',status:'BUILDING' as ProMetricStatus,summary:'Not enough checkpoint coverage for a useful CS curve.',evidence:[] as ProEvidence[]};const rates=checkpoints.map(x=>x.cs/x.min);const consistency=Math.max(0,1-(Math.max(...rates)-Math.min(...rates))/Math.max(...rates,.1));const score=clamp(consistency*100);return{score,value:checkpoints.map(x=>`${x.min}m ${x.cs}`).join(' · '),status:'MEASURED' as ProMetricStatus,summary:'Tracks the shape of your farm instead of hiding lane collapse or recovery inside one final CS/min number.',evidence:checkpoints.map(x=>ev(x.min*60,`${x.min} minute CS`,`${x.cs} CS (${round(x.cs/x.min,1)}/min).`))}}

function liveItemTiming(snapshots:LiveTelemetrySnapshot[]){const mine=majorItemTimes(snapshots,true),theirs=majorItemTimes(snapshots,false);if(!mine.length||!theirs.length)return{score:null,value:'Building timing data',status:'BUILDING' as ProMetricStatus,summary:'A comparable major-item timing for the lane opponent was not reliably detected.',evidence:[] as ProEvidence[]};const diffs:number[]=[];const evidence:ProEvidence[]=[];for(let i=0;i<Math.min(3,mine.length,theirs.length);i++){const diff=theirs[i].atSeconds-mine[i].atSeconds;diffs.push(diff);evidence.push(ev(mine[i].atSeconds,`Item ${i+1} timing`,`${mine[i].label} arrived ${formatDelta(diff)} relative to the lane opponent's comparable major item.`))}const avg=diffs.reduce((a,b)=>a+b,0)/diffs.length;return{score:clamp(50+avg/12),value:`${formatDelta(avg)} avg`,status:'DERIVED' as ProMetricStatus,summary:'Compares when you and the same-role opponent first showed major completed-item purchases in tracker snapshots.',evidence}}
function majorItemTimes(snapshots:LiveTelemetrySnapshot[],mine:boolean){const out:{atSeconds:number;label:string}[]=[];const seen=new Set<number>();for(const s of snapshots){const me=findMe(s),p=mine?me:findLaneOpponentLive(s,me);if(!p)continue;for(const item of p.items){if(item.price>=1600&&!seen.has(item.itemId)){seen.add(item.itemId);out.push({atSeconds:s.gameTime,label:item.displayName})}}}return dedupeTimes(out,20)}
function formatDelta(seconds:number){const sign=seconds>=0?'+':'-';const s=Math.round(Math.abs(seconds));return`${sign}${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}

function liveOpponentAdaptation(fights:FightReview[],threat:string|null){if(!threat)return{score:null,value:'No repeat threat',status:'BUILDING' as ProMetricStatus,summary:'Opponent adaptation becomes meaningful when the same threat appears in multiple interactions.',evidence:[] as ProEvidence[]};const related=fights.filter(f=>(f.opponentChampion||f.opponent)===threat);const firstDeath=related.findIndex(f=>f.outcome==='DEATH');if(firstDeath<0||related.length<=firstDeath+1)return{score:null,value:`${threat}: building sample`,status:'BUILDING' as ProMetricStatus,summary:'Not enough interactions after the first loss to judge whether your decisions adapted.',evidence:[] as ProEvidence[]};const later=related.slice(firstDeath+1),positive=later.filter(f=>f.outcome!=='DEATH');const score=clamp(pct(positive.length,later.length));return{score,value:`${positive.length}/${later.length} later conversions`,status:'DERIVED' as ProMetricStatus,summary:`After the first reviewed death involving ${threat}, OP CLIMB checks whether later interactions improved.`,evidence:later.slice(0,6).map(f=>ev(f.atSeconds,f.outcome,f.headline))}}

function liveBuildResponse(final:LiveTelemetrySnapshot|undefined,repeatThreatCount:number){const me=final?findMe(final):null;if(!me)return{score:null,value:'Unavailable',status:'UNAVAILABLE' as ProMetricStatus,summary:'No final build was available.',evidence:[] as ProEvidence[]};const defensive=/guardian angel|maw|mercurial|wit's end|randuin|frozen heart|jak|banshee|zhonya|edge of night|sterak|death's dance|shieldbow/i;const reactive=me.items.filter(i=>defensive.test(i.displayName));if(!repeatThreatCount)return{score:null,value:'No forced adaptation',status:'BUILDING' as ProMetricStatus,summary:'No repeated threat created a strong enough reason to grade build adaptation from telemetry alone.',evidence:[] as ProEvidence[]};return{score:reactive.length?75:45,value:reactive.length?reactive.map(i=>i.displayName).join(', '):'No defensive pivot detected',status:'DERIVED' as ProMetricStatus,summary:'Low-confidence signal: it detects obvious defensive adaptation items after repeated threat exposure. It does not claim the item was definitely correct without enemy damage-profile data.',evidence:reactive.map(i=>({label:'Defensive adaptation',detail:i.displayName}))}}

function buildLeakSignals(input:{highGoldDeaths:FightReview[];redDeaths:FightReview[];chain:FightReview[];thrown:FightReview[];deaths:FightReview[];objective:ReturnType<typeof liveObjectiveReadiness>;carry:ReturnType<typeof liveCarryPreservation>}):ProLeakSignal[]{const rows:{key:string;label:string;count:number;detail:string;times:number[]}[]=[
  {key:'BANKING_LEAK',label:'Fighting before spending',count:input.highGoldDeaths.length,detail:'Deaths while carrying 1200g+.',times:input.highGoldDeaths.map(x=>x.atSeconds)},
  {key:'RED_STATE',label:'Bad fight selection',count:input.redDeaths.length,detail:'Deaths taken from an already enemy-favoured visible state.',times:input.redDeaths.map(x=>x.atSeconds)},
  {key:'CHAIN_DEATH',label:'Recovery discipline',count:input.chain.length,detail:'Second deaths inside 90 seconds.',times:input.chain.map(x=>x.atSeconds)},
  {key:'LEAD_THROW',label:'Lead protection',count:input.thrown.length,detail:'Deaths from a visibly stronger state.',times:input.thrown.map(x=>x.atSeconds)},
  {key:'CARRY_DEATH',label:'Carry preservation',count:input.carry.highValueDeaths,detail:'Deaths while top-two on team visible item value.',times:input.carry.evidence.map(x=>x.atSeconds??0)},
].filter(x=>x.count>0);return rows.sort((a,b)=>b.count-a.count).map(x=>({key:x.key,label:x.label,count:x.count,severity:severity(x.count),detail:x.detail,evidenceSeconds:x.times.filter(Boolean)}))}
function severity(n:number):ProSeverity{return n>=4?'CRITICAL':n>=3?'MAJOR':n>=2?'ACTIVE':'POLISH'}
function buildFingerprint(leaks:ProLeakSignal[],metrics:Partial<Record<CoachingMetricKey,ProMetric>>,champion:string,role:string|null):ProFingerprint{if(!leaks.length)return{primary:'CLEAN CONVERSION',sequence:['Create advantage','Protect state','Convert pressure'],confidence:'MEDIUM',explanation:`No repeated high-confidence decision leak dominated this ${champion} match.`};const primary=leaks[0];const sequence:string[]=[];if(leaks.some(l=>l.key==='BANKING_LEAK'))sequence.push('Earn gold → delay spend');if(leaks.some(l=>l.key==='RED_STATE'))sequence.push('Accept enemy-favoured fight');if(leaks.some(l=>l.key==='LEAD_THROW'))sequence.push('Expose an earned advantage');if(leaks.some(l=>l.key==='CHAIN_DEATH'))sequence.push('Re-enter before stabilising');if(leaks.some(l=>l.key==='CARRY_DEATH'))sequence.push('Lose high-value carry uptime');if(!sequence.length)sequence.push(primary.label);return{primary:primary.label.toUpperCase(),sequence,confidence:leaks.length>=2||primary.count>=2?'HIGH':'MEDIUM',explanation:`The strongest recorded pattern was ${primary.label.toLowerCase()} (${primary.count} occurrence${primary.count===1?'':'s'}). OP CLIMB will compare this sequence with future ${role||'role'} games instead of treating it as a one-off stat.`}}
function championIdentityMetric(champion:string,role:string|null,metrics:Partial<Record<CoachingMetricKey,ProMetric>>):ProMetric{const r=(role||'').toUpperCase();const weights=r==='BOTTOM'||r==='ADC'?([['carry_preservation',.3],['death_control',.25],['cs_curve',.2],['power_spike_conversion',.25]] as const):r==='JUNGLE'?([['objective_readiness',.3],['fight_selection',.25],['historical_recovery',.2],['power_spike_conversion',.25]] as const):([['fight_selection',.3],['lead_protection',.25],['cs_curve',.2],['power_spike_conversion',.25]] as const);let total=0,w=0;for(const [key,weight] of weights){const s=metrics[key]?.score;if(typeof s==='number'){total+=s*weight;w+=weight}}const score=w?clamp(total/w):null;return metric('champion_identity','CHAMPION IDENTITY',score,score===null?`${champion} profile building`:`${champion} ${score}/100`,score===null?'BUILDING':'DERIVED','MEDIUM',r==='BOTTOM'||r==='ADC'?`For ${champion} as a carry, this weights survival/carry preservation, farm curve and conversion of item spikes more heavily than generic KDA.`:`The identity score changes its weighting by role so ${champion} is not graded with the same rubric as every other champion.`,[])}

function dedupeTimes<T extends {atSeconds:number}>(items:T[],seconds:number){const out:T[]=[];for(const item of items.sort((a,b)=>a.atSeconds-b.atSeconds)){if(!out.length||item.atSeconds-out[out.length-1].atSeconds>=seconds)out.push(item)}return out}

// ---- Riot Match-V5 helpers -------------------------------------------------
function durationSeconds(dto:RiotMatchDto){return dto.info.gameEndTimestamp?dto.info.gameDuration:(dto.info.gameDuration>10000?dto.info.gameDuration/1000:dto.info.gameDuration)}
function allRiotEvents(timeline:RiotTimelineDto){return timeline.info.frames.flatMap(f=>f.events||[]).sort((a,b)=>a.timestamp-b.timestamp)}
function riotPositiveForPlayer(e:RiotTimelineEvent,id:number){if(e.type==='CHAMPION_KILL')return e.killerId===id||(e.assistingParticipantIds||[]).includes(id);if(e.type==='ELITE_MONSTER_KILL'||e.type==='BUILDING_KILL')return e.killerId===id||(e.assistingParticipantIds||[]).includes(id);return false}
function findLaneOpponent(dto:RiotMatchDto,me:RiotParticipant){const pos=me.teamPosition||me.individualPosition;return dto.info.participants.find(p=>p.teamId!==me.teamId&&(p.teamPosition||p.individualPosition)===pos)??null}
function frameAt(timeline:RiotTimelineDto,timestamp:number){let best:RiotTimelineFrame|null=null;for(const f of timeline.info.frames){if(f.timestamp<=timestamp)best=f;else break}return best}
function currentGoldNear(timeline:RiotTimelineDto,timestamp:number,pid:number){return frameAt(timeline,timestamp)?.participantFrames[String(pid)]?.currentGold??0}
function csFrame(frame:RiotTimelineFrame|undefined,pid:number){const p=frame?.participantFrames[String(pid)];return p?(p.minionsKilled||0)+(p.jungleMinionsKilled||0):0}
function riotPurchaseClusters(events:RiotTimelineEvent[],pid:number,timeline:RiotTimelineDto){const purchases=events.filter(e=>e.type==='ITEM_PURCHASED'&&e.participantId===pid);const clusters:{atSeconds:number;preGold:number}[]=[];for(const p of purchases){const last=clusters[clusters.length-1];if(last&&p.timestamp/1000-last.atSeconds<=15)continue;clusters.push({atSeconds:p.timestamp/1000,preGold:currentGoldNear(timeline,Math.max(0,p.timestamp-30_000),pid)})}return clusters}
function riotObjectiveReadiness(events:RiotTimelineEvent[],timeline:RiotTimelineDto,pid:number,deaths:RiotTimelineEvent[]){const objectives=events.filter(e=>e.type==='ELITE_MONSTER_KILL'||e.type==='BUILDING_KILL');if(!objectives.length)return{score:null,value:'No objective events',status:'BUILDING' as ProMetricStatus,summary:'No major objective event was available in the Riot timeline.',evidence:[] as ProEvidence[]};let ready=0;const evidence:ProEvidence[]=[];for(const o of objectives){const recent=deaths.some(d=>d.timestamp<=o.timestamp&&o.timestamp-d.timestamp<=45_000);const gold=currentGoldNear(timeline,o.timestamp,pid);if(!recent&&gold<1400)ready++;else evidence.push({atSeconds:o.timestamp/1000,label:o.type,detail:recent?'Death occurred within 45 seconds before the objective.':`Nearest Riot frame showed roughly ${Math.round(gold)}g unspent.`})}const score=clamp(pct(ready,objectives.length));return{score,value:`${ready}/${objectives.length} ready`,status:'DERIVED' as ProMetricStatus,summary:'Authoritative timeline proxy: penalises deaths immediately before objectives and arriving at major map events while still carrying a large bank.',evidence:evidence.slice(0,6)}}
function riotFarmFightTradeoff(timeline:RiotTimelineDto,events:RiotTimelineEvent[],pid:number){const frames=timeline.info.frames;if(frames.length<4)return{score:null,value:'Building sample',status:'BUILDING' as ProMetricStatus,summary:'Not enough Riot frames for farm-vs-fight analysis.',evidence:[] as ProEvidence[]};const fightTimes=events.filter(e=>e.type==='CHAMPION_KILL'&&(e.killerId===pid||e.victimId===pid||(e.assistingParticipantIds||[]).includes(pid))).map(e=>e.timestamp);const active:number[]=[],quiet:number[]=[];const evidence:ProEvidence[]=[];for(let i=1;i<frames.length;i++){const dt=(frames[i].timestamp-frames[i-1].timestamp)/60_000;if(dt<=0)continue;const rate=(csFrame(frames[i],pid)-csFrame(frames[i-1],pid))/dt;const mid=(frames[i].timestamp+frames[i-1].timestamp)/2;const fight=fightTimes.some(t=>Math.abs(t-mid)<=75_000);(fight?active:quiet).push(rate)}if(!active.length||!quiet.length)return{score:null,value:'Building sample',status:'BUILDING' as ProMetricStatus,summary:'The timeline did not contain enough both fight-heavy and quiet farming intervals.',evidence};const a=active.reduce((x,y)=>x+y,0)/active.length,q=quiet.reduce((x,y)=>x+y,0)/quiet.length;const ratio=q>0?a/q:1;const score=clamp(Math.min(1,ratio/.7)*100);if(ratio<.55)evidence.push({label:'Farm collapse after fighting',detail:`Fight-heavy intervals averaged ${round(a,1)} CS/min vs ${round(q,1)} in quiet intervals.`});return{score,value:`${round(a,1)} vs ${round(q,1)} CS/min`,status:'MEASURED' as ProMetricStatus,summary:'Compares minute-frame resource collection in fight-heavy intervals against your own quiet intervals, so roaming/fighting is judged against your personal baseline.',evidence}}
function riotItemTiming(events:RiotTimelineEvent[],me:RiotParticipant,opp:RiotParticipant|null,completed?:ReadonlySet<number>){if(!opp||!completed?.size)return{score:null,value:'Completed-item data unavailable',status:'UNAVAILABLE' as ProMetricStatus,summary:'A same-role opponent and Data Dragon completed-item catalogue are required.',evidence:[] as ProEvidence[]};const times=(pid:number)=>events.filter(e=>e.type==='ITEM_PURCHASED'&&e.participantId===pid&&typeof e.itemId==='number'&&completed.has(e.itemId)).map(e=>e.timestamp).sort((a,b)=>a-b);const mine=times(me.participantId),theirs=times(opp.participantId);if(!mine.length||!theirs.length)return{score:null,value:'No comparable item timing',status:'BUILDING' as ProMetricStatus,summary:'One side did not complete a recognised major item in the available timeline.',evidence:[] as ProEvidence[]};const diffs:number[]=[];const evidence:ProEvidence[]=[];for(let i=0;i<Math.min(3,mine.length,theirs.length);i++){const diff=(theirs[i]-mine[i])/1000;diffs.push(diff);evidence.push({atSeconds:mine[i]/1000,label:`Completed item ${i+1}`,detail:`Your timing was ${formatDelta(diff)} relative to the lane opponent.`})}const avg=diffs.reduce((a,b)=>a+b,0)/diffs.length;return{score:clamp(50+avg/12),value:`${formatDelta(avg)} avg`,status:'MEASURED' as ProMetricStatus,summary:'Direct comparison of recognised completed-item purchase events against the same-role opponent.',evidence}}
function riotCarryPreservation(dto:RiotMatchDto,timeline:RiotTimelineDto,deaths:RiotTimelineEvent[],me:RiotParticipant){let high=0;const evidence:ProEvidence[]=[];for(const d of deaths){const frame=frameAt(timeline,d.timestamp);if(!frame)continue;const team=dto.info.participants.filter(p=>p.teamId===me.teamId).map(p=>({p,g:frame.participantFrames[String(p.participantId)]?.totalGold??0})).sort((a,b)=>b.g-a.g);const rank=team.findIndex(x=>x.p.participantId===me.participantId)+1;if(rank>0&&rank<=2){high++;evidence.push({atSeconds:d.timestamp/1000,label:'High-value death',detail:`You were #${rank} on your team in total gold in the nearest Riot timeline frame.`})}}const score=deaths.length?clamp(100-pct(high,deaths.length)):100;return{score,value:`${high}/${deaths.length} high-value deaths`,status:'MEASURED' as ProMetricStatus,summary:'Uses team gold at each death to identify when the team lost one of its highest-investment players.',evidence:evidence.slice(0,6),highValueDeaths:high}}
function riotRepeatThreat(dto:RiotMatchDto,deaths:RiotTimelineEvent[]){const map=new Map<number,RiotTimelineEvent[]>();for(const d of deaths)if(d.killerId)map.set(d.killerId,[...(map.get(d.killerId)||[]),d]);const top=[...map.entries()].sort((a,b)=>b[1].length-a[1].length)[0];if(!top||top[1].length<2)return null;const p=dto.info.participants.find(x=>x.participantId===top[0]);return{name:p?.championName||`Participant ${top[0]}`,participantId:top[0],count:top[1].length,evidence:top[1].slice(0,6).map(d=>({atSeconds:d.timestamp/1000,label:'Death to repeat threat',detail:p?.championName||'Repeated opponent'}))}}
function riotOpponentAdaptation(dto:RiotMatchDto,events:RiotTimelineEvent[],meId:number,threatId:number|null){if(!threatId)return{score:null,value:'No repeat threat',status:'BUILDING' as ProMetricStatus,summary:'No repeated killer created an adaptation sample.',evidence:[] as ProEvidence[]};const interactions=events.filter(e=>e.type==='CHAMPION_KILL'&&((e.victimId===meId&&e.killerId===threatId)||(e.victimId===threatId&&(e.killerId===meId||(e.assistingParticipantIds||[]).includes(meId))))).sort((a,b)=>a.timestamp-b.timestamp);const firstLoss=interactions.findIndex(e=>e.victimId===meId);if(firstLoss<0||interactions.length<=firstLoss+1)return{score:null,value:'Building sample',status:'BUILDING' as ProMetricStatus,summary:'Not enough later interactions after the first loss.',evidence:[] as ProEvidence[]};const later=interactions.slice(firstLoss+1),positive=later.filter(e=>e.victimId===threatId);const score=clamp(pct(positive.length,later.length));const threat=dto.info.participants.find(p=>p.participantId===threatId)?.championName||'repeat threat';return{score,value:`${positive.length}/${later.length} later wins`,status:'MEASURED' as ProMetricStatus,summary:`After your first loss to ${threat}, this checks whether later kill interactions shifted in your favour.`,evidence:later.slice(0,6).map(e=>({atSeconds:e.timestamp/1000,label:e.victimId===threatId?'Positive adaptation':'Repeated loss',detail:`Interaction with ${threat}.`}))}}
