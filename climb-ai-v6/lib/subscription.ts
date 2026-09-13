export type SubscriptionTier='FREE'|'PLUS'|'PRO';
export type SubscriptionProduct='LOL'|'TFT';

export type CoachingMetricKey=
  |'op_score'
  |'fight_selection'
  |'death_control'
  |'cs_curve'
  |'unspent_gold'
  |'red_state_fights'
  |'chain_deaths'
  |'thrown_advantage'
  |'underdog_conversion'
  |'fight_conversion'
  |'lead_protection'
  |'resource_conversion'
  |'power_spike_conversion'
  |'reset_quality'
  |'objective_readiness'
  |'farm_fight_tradeoff'
  |'repeat_threat'
  |'opponent_adaptation'
  |'item_timing_diff'
  |'build_response'
  |'damage_efficiency'
  |'survival_value'
  |'carry_preservation'
  |'decision_fingerprint'
  |'historical_leak_rate'
  |'historical_recovery'
  |'champion_identity';

export const TIER_RANK:Record<SubscriptionTier,number>={FREE:0,PLUS:1,PRO:2};

export const METRIC_TIER:Record<CoachingMetricKey,SubscriptionTier>={
  op_score:'FREE',fight_selection:'FREE',death_control:'FREE',cs_curve:'FREE',
  unspent_gold:'PLUS',red_state_fights:'PLUS',chain_deaths:'PLUS',thrown_advantage:'PLUS',underdog_conversion:'PLUS',fight_conversion:'PLUS',resource_conversion:'PLUS',
  lead_protection:'PRO',power_spike_conversion:'PRO',reset_quality:'PRO',objective_readiness:'PRO',farm_fight_tradeoff:'PRO',repeat_threat:'PRO',opponent_adaptation:'PRO',item_timing_diff:'PRO',build_response:'PRO',damage_efficiency:'PRO',survival_value:'PRO',carry_preservation:'PRO',decision_fingerprint:'PRO',historical_leak_rate:'PRO',historical_recovery:'PRO',champion_identity:'PRO',
};

/** League pricing remains unchanged. TFT is intentionally a different product entitlement. */
export const PLAN_COPY={
  FREE:{name:'FREE',price:'£0',historyDays:7,fixDepth:2,reviewAllowance:'3 detailed reviews / week',description:'See the obvious leaks and get a useful first learning loop.'},
  PLUS:{name:'PLUS',price:'£9.99/month',historyDays:90,fixDepth:4,reviewAllowance:'Higher review allowance',description:'Decision coaching, economic leaks and repeatable fight-state analysis.'},
  PRO:{name:'PRO',price:'£19.99/month',historyDays:3650,fixDepth:5,reviewAllowance:'Highest coaching allowance',description:'Persistent Decision Fingerprint, long-term pattern detection and champion-specific mastery.'},
} as const;

export function normalizeTier(value:unknown):SubscriptionTier{
  const tier=String(value||'').toUpperCase();
  return tier==='PRO'?'PRO':tier==='PLUS'?'PLUS':'FREE';
}
export function hasTier(current:SubscriptionTier,required:SubscriptionTier){return TIER_RANK[current]>=TIER_RANK[required]}
export function canUseMetric(current:SubscriptionTier,key:CoachingMetricKey){return hasTier(current,METRIC_TIER[key])}
