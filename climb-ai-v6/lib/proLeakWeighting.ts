import type {ProLeakSignal,ProSeverity} from './riot/proAnalysis';

const LEAK_METRICS:Record<string,string[]>={
  BANKING_LEAK:['unspent_gold','resource_conversion','reset_quality'],
  RED_STATE:['fight_selection','red_state_fights','death_control'],
  CHAIN_DEATH:['chain_deaths','historical_recovery','death_control'],
  LEAD_THROW:['thrown_advantage','lead_protection','fight_conversion'],
  CARRY_DEATH:['carry_preservation','survival_value','death_control'],
};

const severityBoost:Record<ProSeverity,number>={CRITICAL:28,MAJOR:20,ACTIVE:12,POLISH:5};

export function leakMetricBoosts(leaks:ProLeakSignal[]){
  const boosts=new Map<string,number>();
  for(const leak of leaks){
    const base=severityBoost[leak.severity]+Math.min(12,Math.max(0,leak.count-1)*4);
    const metrics=LEAK_METRICS[leak.key]??[leak.key];
    metrics.forEach((metric,index)=>{
      const relationship=index===0?1:index===1?.72:.5;
      boosts.set(metric,(boosts.get(metric)??0)+base*relationship);
    });
  }
  return boosts;
}

export function metricsForLeak(key:string){return LEAK_METRICS[key]??[key];}
