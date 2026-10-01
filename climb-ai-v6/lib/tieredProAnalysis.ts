import type {ProMatchAnalysis} from './riot/proAnalysis';
import {METRIC_TIER,canUseMetric,type CoachingMetricKey,type SubscriptionTier} from './subscription';

export function proAnalysisForTier(analysis:ProMatchAnalysis|undefined,tier:SubscriptionTier):ProMatchAnalysis|undefined{
  if(!analysis)return undefined;
  const metrics=Object.fromEntries(Object.entries(analysis.metrics??{}).filter(([key])=>{
    if(!(key in METRIC_TIER))return true;
    return canUseMetric(tier,key as CoachingMetricKey);
  })) as ProMatchAnalysis['metrics'];
  const leakSignals=(analysis.leakSignals??[]).filter(signal=>{
    const key=String(signal.key||'');
    if(key in METRIC_TIER)return canUseMetric(tier,key as CoachingMetricKey);
    return tier!=='FREE';
  });
  return{
    ...analysis,
    metrics,
    leakSignals,
    fingerprint:tier==='PRO'?analysis.fingerprint:{
      primary:'PRO MEMORY LOCKED',
      sequence:[],
      confidence:'LOW',
      explanation:'Persistent decision fingerprints unlock on PRO.',
    },
    decisionGraph:tier==='FREE'?undefined:analysis.decisionGraph,
  };
}
