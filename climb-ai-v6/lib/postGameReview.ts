export type ReviewPoint={
  title:string;
  detail:string;
  atSeconds?:number;
  verified:boolean;
};

export type NeutralObservation={title:string;detail:string};

export type FightReview={
  atSeconds:number;
  category:'STRENGTH'|'WEAKNESS';
  outcome:'KILL'|'DEATH'|'ASSIST';
  opponentChampion?:string|null;
  score:number;
  verdict:'YOU_STRONGER'|'EVEN'|'THEM_STRONGER';
  headline:string;
  summary:string;
  why?:string[];
  betterDecision?:string[];
  evidence?:{currentGold?:number;itemGoldDelta?:number|null;levelDelta?:number|null};
};

export type ReviewMatch={
  champion:string;
  role:string;
  durationSeconds:number;
  kda:string;
  csPerMin:number|null;
}|null;

type BuildInput={
  fights:FightReview[];
  match:ReviewMatch;
  partial:boolean;
  detailLimit:number;
};

export function buildPostGameSections({fights,match,partial,detailLimit}:BuildInput){
  const strengths=fights.filter(f=>f.category==='STRENGTH');
  const weaknesses=fights.filter(f=>f.category==='WEAKNESS');
  const doneWell=padVerified(buildGood(strengths,detailLimit),'positive');
  const improve=padVerified(buildCritical(weaknesses,detailLimit),'improve');
  const topWeakness=rankWeaknesses(weaknesses)[0];
  const nextFocus=topWeakness
    ?{title:nextTitle(topWeakness),rule:short(topWeakness.betterDecision?.[0]||topWeakness.summary,detailLimit)}
    :{title:'REPEAT THE CLEAN DECISIONS',rule:'Keep the same CLIMB MISSION next game and build more evidence before changing focus.'};

  return{
    doneWell,
    improve,
    neutral:buildNeutral(match,fights.length,strengths.length,weaknesses.length,partial),
    nextFocus,
    evidenceCount:fights.length,
  };
}

function buildGood(fights:FightReview[],detailLimit:number):ReviewPoint[]{
  return dedupe([...fights]
    .sort((a,b)=>strengthScore(b)-strengthScore(a))
    .map(f=>({
      title:f.verdict==='YOU_STRONGER'?`Converted your advantage at ${clock(f.atSeconds)}`:f.verdict==='THEM_STRONGER'?`Won from a harder state at ${clock(f.atSeconds)}`:`Clean conversion at ${clock(f.atSeconds)}`,
      detail:short(f.summary,detailLimit),
      atSeconds:f.atSeconds,
      verified:true,
    })));
}

function buildCritical(fights:FightReview[],detailLimit:number):ReviewPoint[]{
  return dedupe(rankWeaknesses(fights).map(f=>({
    title:f.verdict==='YOU_STRONGER'?`Threw a favourable state at ${clock(f.atSeconds)}`:f.verdict==='THEM_STRONGER'?`Took an enemy-favoured fight at ${clock(f.atSeconds)}`:`Death from an even state at ${clock(f.atSeconds)}`,
    detail:short(f.betterDecision?.[0]||f.summary,detailLimit),
    atSeconds:f.atSeconds,
    verified:true,
  })));
}

function padVerified(items:ReviewPoint[],kind:'positive'|'improve'){
  const output=items.slice(0,3);
  while(output.length<3){
    const number=output.length+1;
    output.push(kind==='positive'
      ?{title:`Positive ${number} not verified`,detail:'The recording did not capture another decision strong enough to call a genuine positive. OP CLIMB will not invent praise.',verified:false}
      :{title:`Improvement ${number} not verified`,detail:'The recording did not capture another mistake strong enough to call a genuine leak. Keep collecting evidence instead of forcing a conclusion.',verified:false});
  }
  return output;
}

function buildNeutral(match:ReviewMatch,total:number,positives:number,improvements:number,partial:boolean):NeutralObservation[]{
  const record=match
    ?[match.champion,match.role,match.kda?`${match.kda} KDA`:null,Number.isFinite(match.csPerMin)?`${match.csPerMin} CS/min`:null,formatDuration(match.durationSeconds)].filter(Boolean).join(' · ')
    :'Final match telemetry was not available for the short review.';
  const coverage=`${total} timestamped fight decision${total===1?'':'s'} recorded: ${positives} positive signal${positives===1?'':'s'} and ${improvements} improvement signal${improvements===1?'':'s'}.${partial?' This was a partial recording.':''}`;
  return[
    {title:'Match record',detail:record},
    {title:'Evidence coverage',detail:coverage},
  ];
}

function rankWeaknesses(fights:FightReview[]){return [...fights].sort((a,b)=>weaknessScore(b)-weaknessScore(a))}
function weaknessScore(f:FightReview){
  const state=f.verdict==='YOU_STRONGER'?40:f.verdict==='EVEN'?30:24;
  const pocket=Math.min(15,Math.round(Number(f.evidence?.currentGold||0)/150));
  return state+pocket+Math.min(20,Math.abs(Number(f.score||0)));
}
function strengthScore(f:FightReview){const state=f.verdict==='THEM_STRONGER'?34:f.verdict==='YOU_STRONGER'?30:24;return state+Math.min(20,Math.abs(Number(f.score||0)))}
function nextTitle(f:FightReview){if(f.verdict==='YOU_STRONGER')return'PROTECT THE ADVANTAGE';if(f.verdict==='THEM_STRONGER')return'STOP TAKING THE BAD FIGHT';return'CREATE AN EDGE BEFORE COMMITTING'}
function dedupe(items:ReviewPoint[]){const seen=new Set<string>();return items.filter(item=>{const key=item.title.replace(/\d+:\d+/g,'TIME').toLowerCase();if(seen.has(key))return false;seen.add(key);return true})}
function short(value:string,max=210){const clean=String(value||'').replace(/\s+/g,' ').trim();return clean.length>max?`${clean.slice(0,max-1).replace(/\s+\S*$/,'')}…`:clean}
function clock(seconds:number){const s=Math.max(0,Math.floor(Number(seconds)||0));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`}
function formatDuration(seconds:number){const s=Math.max(0,Math.floor(Number(seconds)||0));return`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')} game`}
