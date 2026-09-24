import type {HistoryAnalysisRow} from './riot/proHistory';

export type PatchSource='MATCH_V5'|'DATA_DRAGON_CURRENT_AT_RECORDING'|'UNKNOWN';

export interface LearningPatchChange{
  patch:string;
  entityType:'CHAMPION'|'ITEM'|'RUNE'|'SUMMONER';
  entityId:string;
  entityName:string|null;
  changeType:'ADDED'|'REMOVED'|'MODIFIED';
  changedFields:string[];
}

export interface LearningPatchContext{
  version:1;
  status:'NO_PATCH_DATA'|'SINGLE_PATCH'|'CROSS_PATCH';
  latestPatch:string|null;
  patches:Array<{patch:string;games:number}>;
  unknownGames:number;
  patchBoundaries:number;
  affectedChampionBoundaries:number;
  affectedChampions:string[];
  trendReliability:'HIGH'|'MEDIUM'|'LOW';
  boundary:string;
}

const clean=(value:unknown)=>String(value??'').trim();
const normalise=(value:unknown)=>clean(value).toLowerCase().replace(/[^a-z0-9]/g,'');

export function canonicalLeaguePatch(version:unknown):string|null{
  const raw=clean(version).replace(/^lolpatch_/i,'');
  const match=/(\d+)\.(\d+)/.exec(raw);
  return match?String(Number(match[1]))+'.'+String(Number(match[2])):null;
}

export function dataDragonBuild(version:unknown):number|null{
  const raw=clean(version);
  const match=/(\d+)\.(\d+)\.(\d+)/.exec(raw);
  return match?Number(match[3]):null;
}

export function buildLearningPatchContext(
  rows:HistoryAnalysisRow[],
  changes:LearningPatchChange[]=[],
):LearningPatchContext{
  const ordered=[...rows].sort((a,b)=>Date.parse(a.createdAt)-Date.parse(b.createdAt));
  const counts=new Map<string,number>();
  let unknownGames=0;
  for(const row of ordered){
    const patch=canonicalLeaguePatch(row.patch);
    if(!patch)unknownGames++;
    else counts.set(patch,(counts.get(patch)||0)+1);
  }

  const patches=[...counts.entries()].map(([patch,games])=>({patch,games}));
  const changeIndex=new Map<string,LearningPatchChange[]>();
  for(const change of changes){
    if(change.entityType!=='CHAMPION')continue;
    const key=canonicalLeaguePatch(change.patch);
    if(!key)continue;
    const current=changeIndex.get(key)??[];
    current.push(change);
    changeIndex.set(key,current);
  }

  let patchBoundaries=0;
  let affectedChampionBoundaries=0;
  const affectedChampions=new Set<string>();
  for(let i=1;i<ordered.length;i++){
    const before=canonicalLeaguePatch(ordered[i-1].patch);
    const after=canonicalLeaguePatch(ordered[i].patch);
    if(!before||!after||before===after)continue;
    patchBoundaries++;
    const champion=normalise(ordered[i].champion);
    const affected=(changeIndex.get(after)??[]).find(change=>
      normalise(change.entityId)===champion||normalise(change.entityName)===champion);
    if(affected){
      affectedChampionBoundaries++;
      affectedChampions.add(ordered[i].champion);
    }
  }

  const status:LearningPatchContext['status']=!patches.length?'NO_PATCH_DATA':patches.length===1?'SINGLE_PATCH':'CROSS_PATCH';
  const trendReliability:LearningPatchContext['trendReliability']=
    status==='NO_PATCH_DATA'||affectedChampionBoundaries>0||unknownGames>Math.max(1,ordered.length/4)
      ?'LOW'
      :status==='CROSS_PATCH'?'MEDIUM':'HIGH';
  const latestPatch=[...ordered].reverse().map(row=>canonicalLeaguePatch(row.patch)).find(Boolean)??null;
  const boundary=status==='NO_PATCH_DATA'
    ?'PATCH CONTEXT IS NOT YET AVAILABLE FOR THESE HISTORICAL GAMES. OP CLIMB MUST NOT ATTRIBUTE A CROSS-GAME CHANGE PURELY TO PLAYER LEARNING WHEN THE GAME VERSION IS UNKNOWN.'
    :affectedChampionBoundaries>0
      ?'RIOT BALANCE CHANGES AFFECT ONE OR MORE CHAMPION PATCH BOUNDARIES IN THIS HISTORY. DECISION TWIN MAY DESCRIBE THE OBSERVED PLAYER PATTERN, BUT IT MUST NOT CLAIM THE BEFORE/AFTER TREND IS PURE PLAYER IMPROVEMENT OR REGRESSION.'
      :status==='CROSS_PATCH'
        ?'THIS HISTORY CROSSES RIOT PATCHES. PATCH IS TREATED AS A CONTEXT VARIABLE; CROSS-PATCH TREND CLAIMS REMAIN QUALIFIED EVEN WHEN NO STORED CHAMPION CHANGE IS DETECTED.'
        :'ALL PATCH-TAGGED GAMES IN THIS LEARNING WINDOW SHARE ONE RIOT PATCH, SO PATCH DRIFT IS NOT A CURRENT TREND CONFOUNDER.';

  return{
    version:1,status,latestPatch,patches,unknownGames,patchBoundaries,affectedChampionBoundaries,
    affectedChampions:[...affectedChampions],trendReliability,boundary,
  };
}
