import type {HistoryAnalysisRow} from './riot/proHistory';
import type {CausalChainDiagnosis,CausalCoachLayer,DecisionCausalChainReview} from './decisionCausalChain';

export type CausalProfileStatus='BUILDING'|'PATTERN_EMERGING'|'REPEATED_ROOT_CAUSE'|'STABLE_CLEAN';

export interface CausalLayerStats{
  layer:CausalCoachLayer;
  label:string;
  chains:number;
  games:number;
  share:number;
  recentChains:number;
}

export interface DecisionCausalProfile{
  version:1;
  generatedAt:string;
  gamesAnalyzed:number;
  gamesWithCausalEvidence:number;
  verifiableChains:number;
  status:CausalProfileStatus;
  dominantLayer:CausalCoachLayer|null;
  dominantLayerLabel:string|null;
  dominantShare:number|null;
  dominantGames:number;
  layerStats:CausalLayerStats[];
  diagnosisCounts:Record<CausalChainDiagnosis,number>;
  summary:string;
  nextCoachRule:string;
  boundary:string;
}

const LAYERS:CausalCoachLayer[]=['GAME_READ','FOLLOW_THROUGH','EXECUTION','RECOGNITION','AUTONOMY','EVIDENCE'];
const LABELS:Record<CausalCoachLayer,string>={
  GAME_READ:'Game-State Recognition',
  FOLLOW_THROUGH:'Follow-Through',
  EXECUTION:'Decision Execution',
  RECOGNITION:'Recognition Retest',
  AUTONOMY:'Autonomy / Support Fade',
  EVIDENCE:'Evidence Building',
};
const BOUNDARY='CAUSAL PROFILE AGGREGATES ONLY VERIFIED READ → DECISION CHAINS ACROSS MATCHES. A REPEATED ROOT CAUSE REQUIRES MULTIPLE GAMES AND A CLEAR SHARE OF VERIFIABLE CHAINS; ONE MATCH CANNOT REWRITE THE PLAYER MODEL.';

function causalReview(row:HistoryAnalysisRow):DecisionCausalChainReview|null{
  const review=(row.analysis as any)?.decisionGraph?.summary?.causalChain as DecisionCausalChainReview|undefined;
  return review?.version===1&&review.active?review:null;
}
function ordered(rows:HistoryAnalysisRow[]){
  return [...rows].filter(row=>row.analysis?.version===1).sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt)).slice(-40);
}
function emptyCounts():Record<CausalChainDiagnosis,number>{
  return{MISREAD_COMPOUNDED:0,PRIORITY_DEVIATION:0,EXECUTION_GAP:0,MISREAD_RECOVERED:0,CLEAN_CHAIN:0,NOT_VERIFIABLE:0};
}
function coachRule(layer:CausalCoachLayer|null,status:CausalProfileStatus){
  if(status==='BUILDING'||!layer)return'KEEP COLLECTING VERIFIED READ → DECISION PAIRS. DO NOT CHANGE THE COACHING LAYER FROM ONE GAME.';
  if(status==='STABLE_CLEAN')return'KEEP THE SELF-READ CHECKS BUT FADE EXTRA INSTRUCTION. RETEST UNDER HARDER GAME STATES BEFORE CALLING THE SKILL MASTERED.';
  if(layer==='GAME_READ')return'TEACH RECOGNITION BEFORE EXECUTION. REQUIRE THE PLAYER TO CLASSIFY THE GAME STATE BEFORE THE PLAN BRANCH IS REVEALED.';
  if(layer==='FOLLOW_THROUGH')return'KEEP THE PLAYER SELF-READING, THEN TRAIN COMMITMENT TO THE PRIORITY THEY CHOSE. THE ISSUE IS NOT SEEING THE STATE; IT IS FOLLOWING THE BRANCH.';
  if(layer==='EXECUTION')return'DO NOT RETEACH THE GAME STATE. PRESERVE AUTONOMOUS READS AND COACH THE SPECIFIC EXECUTION BEHAVIOUR THAT FAILS AFTER CORRECT RECOGNITION.';
  if(layer==='RECOGNITION')return'RETEST RECOGNITION WHILE CREDITING CLEAN RECOVERY. AVOID ADDING EXECUTION COACHING UNLESS LATER CHAINS SUPPORT IT.';
  if(layer==='AUTONOMY')return'FADE SUPPORT GRADUALLY AND TEST WHETHER CLEAN READ → ACTION CHAINS HOLD WITHOUT THE COACH CUE.';
  return'BUILD MORE EVIDENCE BEFORE CHANGING THE COACHING LAYER.';
}

export function buildDecisionCausalProfile(rows:HistoryAnalysisRow[],generatedAt=new Date().toISOString()):DecisionCausalProfile{
  const history=ordered(rows);
  const gameReviews=history.map(row=>({row,review:causalReview(row)})).filter((item):item is {row:HistoryAnalysisRow;review:DecisionCausalChainReview}=>Boolean(item.review));
  const diagnosisCounts=emptyCounts();
  const perLayer=new Map<CausalCoachLayer,{chains:number;games:Set<string>;recentChains:number}>();
  for(const layer of LAYERS)perLayer.set(layer,{chains:0,games:new Set(),recentChains:0});

  const recentGameKeys=new Set(gameReviews.slice(-5).map(item=>item.row.createdAt));
  let verifiableChains=0;
  for(const {row,review} of gameReviews){
    for(const chain of review.chains??[]){
      diagnosisCounts[chain.diagnosis]=(diagnosisCounts[chain.diagnosis]??0)+1;
      if(chain.diagnosis==='NOT_VERIFIABLE')continue;
      verifiableChains+=1;
      const layer=chain.coachLayer;
      const stat=perLayer.get(layer)??{chains:0,games:new Set<string>(),recentChains:0};
      stat.chains+=1;
      stat.games.add(row.createdAt);
      if(recentGameKeys.has(row.createdAt))stat.recentChains+=1;
      perLayer.set(layer,stat);
    }
  }

  const layerStats=LAYERS.map(layer=>{
    const stat=perLayer.get(layer)!;
    return{
      layer,
      label:LABELS[layer],
      chains:stat.chains,
      games:stat.games.size,
      share:verifiableChains?Math.round(stat.chains/verifiableChains*100):0,
      recentChains:stat.recentChains,
    };
  }).sort((a,b)=>b.chains-a.chains||b.games-a.games||LAYERS.indexOf(a.layer)-LAYERS.indexOf(b.layer));

  const top=layerStats[0]??null;
  const clean=layerStats.find(item=>item.layer==='AUTONOMY')??null;
  const repeated=Boolean(top&&top.layer!=='EVIDENCE'&&top.chains>=3&&top.games>=2&&top.share>=60);
  const stableClean=Boolean(clean&&clean.chains>=4&&clean.games>=3&&clean.share>=70);
  const emerging=Boolean(top&&top.chains>=2&&top.games>=2&&top.share>=50);
  const status:CausalProfileStatus=stableClean?'STABLE_CLEAN':repeated?'REPEATED_ROOT_CAUSE':emerging?'PATTERN_EMERGING':'BUILDING';
  const dominantLayer=status==='BUILDING'?null:stableClean?'AUTONOMY':top?.layer??null;
  const dominantStat=dominantLayer?layerStats.find(item=>item.layer===dominantLayer)??null:null;

  const summary=
    status==='STABLE_CLEAN'
      ?'Clean read → action chains are now the dominant repeated pattern across multiple verified games. OP CLIMB can test more autonomy instead of adding more instruction.'
      :status==='REPEATED_ROOT_CAUSE'&&dominantStat
        ?dominantStat.label+' is the repeated earliest supported coaching failure: '+dominantStat.chains+' of '+verifiableChains+' verifiable chains across '+dominantStat.games+' games.'
        :status==='PATTERN_EMERGING'&&dominantStat
          ?dominantStat.label+' is emerging as the most common coaching layer, but OP CLIMB needs more repeated evidence before treating it as the player root cause.'
          :'Causal Coach Memory is building. OP CLIMB will not choose a root-cause layer until the pattern repeats across multiple games.';

  return{
    version:1,
    generatedAt,
    gamesAnalyzed:history.length,
    gamesWithCausalEvidence:gameReviews.length,
    verifiableChains,
    status,
    dominantLayer,
    dominantLayerLabel:dominantLayer?LABELS[dominantLayer]:null,
    dominantShare:dominantStat?.share??null,
    dominantGames:dominantStat?.games??0,
    layerStats,
    diagnosisCounts,
    summary,
    nextCoachRule:coachRule(dominantLayer,status),
    boundary:BOUNDARY,
  };
}

export const DECISION_CAUSAL_PROFILE_BOUNDARY=BOUNDARY;
