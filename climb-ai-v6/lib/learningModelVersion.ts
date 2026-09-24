export const CURRENT_LEARNING_MODEL_VERSION=1 as const;

export const REQUIRED_LEARNING_LAYERS=[
  'decisionTwinV2',
  'scenarioMemory',
  'decisionTransfer',
  'skillTransferGraph',
  'decisionPrincipleEngine',
  'curriculum',
  'coachTwin',
  'autonomyProfile',
  'interventionValue',
  'causalProfile',
  'playerCoachingIdentity',
  'learningVelocity',
  'adaptiveCoachingSession',
  'patchContext',
] as const;

export type LearningLayerKey=typeof REQUIRED_LEARNING_LAYERS[number];

export interface LearningLayerHealth{
  present:boolean;
  state:string;
}

export interface LearningModelHealth{
  modelVersion:number;
  complete:boolean;
  requiredLayers:number;
  presentLayers:number;
  missing:LearningLayerKey[];
  building:LearningLayerKey[];
  layers:Record<LearningLayerKey,LearningLayerHealth>;
  checkedAt:string;
}

function stateOf(value:any):string{
  if(!value||typeof value!=='object')return'MISSING';
  const candidate=value.status??value.state??value.identityStatus??value.overallState??value.lifecycleState??value.policy?.status;
  const state=String(candidate??'PRESENT').trim().toUpperCase().replace(/\s+/g,'_');
  return state||'PRESENT';
}

function isBuildingState(state:string){
  return state.includes('BUILD')||state.includes('INSUFFICIENT')||state.includes('LEARNING')||state.includes('PROVISIONAL');
}

export function buildLearningModelHealth(recentChange:Record<string,unknown>|null|undefined,checkedAt=new Date().toISOString()):LearningModelHealth{
  const source=(recentChange&&typeof recentChange==='object')?recentChange:{} as Record<string,unknown>;
  const missing:LearningLayerKey[]=[];
  const building:LearningLayerKey[]=[];
  const layers={} as Record<LearningLayerKey,LearningLayerHealth>;

  for(const key of REQUIRED_LEARNING_LAYERS){
    const value=(source as any)[key];
    const present=Boolean(value&&typeof value==='object');
    const state=present?stateOf(value):'MISSING';
    if(!present)missing.push(key);
    else if(isBuildingState(state))building.push(key);
    layers[key]={present,state};
  }

  return{
    modelVersion:CURRENT_LEARNING_MODEL_VERSION,
    complete:missing.length===0,
    requiredLayers:REQUIRED_LEARNING_LAYERS.length,
    presentLayers:REQUIRED_LEARNING_LAYERS.length-missing.length,
    missing,
    building,
    layers,
    checkedAt,
  };
}

export function learningModelNeedsRebuild(input:{storedVersion?:unknown;recentChange?:Record<string,unknown>|null;health?:unknown}){
  const version=Number(input.storedVersion??0);
  if(version<CURRENT_LEARNING_MODEL_VERSION)return true;
  return !buildLearningModelHealth(input.recentChange).complete;
}
