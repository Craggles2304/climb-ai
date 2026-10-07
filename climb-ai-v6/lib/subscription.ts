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
  lead_protection:'PRO',power_spike_conversion:'PRO',reset_quality:'PLUS',objective_readiness:'PRO',farm_fight_tradeoff:'PRO',repeat_threat:'PRO',opponent_adaptation:'PRO',item_timing_diff:'PRO',build_response:'PRO',damage_efficiency:'PRO',survival_value:'PRO',carry_preservation:'PRO',decision_fingerprint:'PRO',historical_leak_rate:'PRO',historical_recovery:'PRO',champion_identity:'PRO',
};

/**
 * Stage 8 commercial contract.
 * FREE proves the loop. PLUS turns Game DNA into a managed player plan. PRO adds the persistent player model.
 * Keep homepage, pricing, billing and in-product gates derived from this story.
 */
export const PLAN_COPY={
  FREE:{name:'FREE',price:'£0',historyDays:7,fixDepth:2,reviewAllowance:'3 detailed reviews / week',description:'Find what is holding you back, take one rule into the next game and prove whether it changes.'},
  PLUS:{name:'PLUS',price:'£9.99/month',historyDays:90,fixDepth:4,reviewAllowance:'Higher review allowance',description:'Turn your Game DNA into a live player plan: learn the next weakness, prove it in games, master it, transfer-test it and move on.'},
  PRO:{name:'PRO',price:'£19.99/month',historyDays:3650,fixDepth:5,reviewAllowance:'Highest coaching allowance',description:'Everything in PLUS, plus a persistent Decision Twin and Coach Memory that learn your recurring habits, coaching needs and long-term player identity.'},
} as const;

export const PLAN_ENTITLEMENTS={
  FREE:[
    'RECENT GAME REVIEW',
    'ONE NEXT-GAME FOCUS',
    'OP MATCH GRADE',
    'BASIC FIGHT + DEATH COACHING',
    '2 FIX LADDER STAGES',
    '7-DAY PROGRESS',
  ],
  PLUS:[
    'EVERYTHING IN FREE',
    'DNA PLAYER PLAN · YOUR NEXT CLIMB',
    'OP CLIMB CHOOSES THE PRIMARY NEXT SKILL',
    'MISSION → EVIDENCE → REPEAT → MASTERY',
    'TRANSFER TEST BEFORE A SKILL IS RETIRED',
    'FULL 5V5 GAME PLAN',
    'OUR WIN CONDITION + THEIR WIN CONDITION',
    'YOUR ROLE IN THE DRAFT',
    'DEEPER ECONOMY + RESET CONTEXT',
    '4 FIX LADDER STAGES',
    '90-DAY HISTORY',
  ],
  PRO:[
    'EVERYTHING IN PLUS',
    'DECISION TWIN + COACH MEMORY',
    'REMEMBERS RECURRING HABITS ACROSS GAMES',
    'SCENARIO MEMORY + PERSONAL TRAPS',
    'LEARNING VELOCITY + ADAPTIVE COACHING',
    'CONNECTS SKILLS INTO DECISION PRINCIPLES',
    'LONG-TERM CHAMPION + PLAYER IDENTITY',
    'ALL 5 FIX LADDER STAGES',
  ],
} as const;

export function normalizeTier(value:unknown):SubscriptionTier{
  const tier=String(value||'').toUpperCase();
  return tier==='PRO'?'PRO':tier==='PLUS'?'PLUS':'FREE';
}
export function hasTier(current:SubscriptionTier,required:SubscriptionTier){return TIER_RANK[current]>=TIER_RANK[required]}
export function canUseMetric(current:SubscriptionTier,key:CoachingMetricKey){return hasTier(current,METRIC_TIER[key])}


export function historyCutoffIso(tier:SubscriptionTier,now=Date.now()):string|null{
  if(tier==='PRO')return null;
  const days=PLAN_COPY[tier].historyDays;
  return new Date(now-days*24*60*60*1000).toISOString();
}

export function filterHistoryForTier<T extends {createdAt:string}>(items:T[],tier:SubscriptionTier,now=Date.now()):T[]{
  const cutoff=historyCutoffIso(tier,now);
  if(!cutoff)return items;
  const cutoffMs=Date.parse(cutoff);
  return items.filter(item=>{
    const at=Date.parse(String(item.createdAt||''));
    return Number.isFinite(at)&&at>=cutoffMs;
  });
}

export function historyWindowLabel(tier:SubscriptionTier){
  return tier==='FREE'?'LAST 7 DAYS':tier==='PLUS'?'LAST 90 DAYS':'LONG-TERM HISTORY';
}

export function hasPersistentDevelopment(tier:SubscriptionTier){
  return tier==='PRO';
}


export function requiredTierForHistoryDate(createdAt:string,now=Date.now()):SubscriptionTier{
  const at=Date.parse(createdAt);
  if(!Number.isFinite(at))return'PRO';
  const ageDays=Math.max(0,(now-at)/(24*60*60*1000));
  return ageDays<=PLAN_COPY.FREE.historyDays?'FREE':ageDays<=PLAN_COPY.PLUS.historyDays?'PLUS':'PRO';
}
