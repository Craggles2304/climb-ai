(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.opPlanRecognitionReview=api;
})(typeof window!=='undefined'?window:null,function(){
  const BRANCH_TO_VERDICT={AHEAD:'YOU_STRONGER',EVEN:'EVEN',BEHIND:'THEM_STRONGER'};
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  const upper=value=>clean(value).toUpperCase();
  const finite=value=>Number.isFinite(Number(value))?Number(value):null;
  const minute=seconds=>{
    const safe=Math.max(0,Math.round(Number(seconds)||0));
    return Math.floor(safe/60)+':'+String(safe%60).padStart(2,'0');
  };
  const safeArray=value=>Array.isArray(value)?value.filter(Boolean):[];

  function nearestPoint(points,seconds,maxDistance=100){
    const at=finite(seconds);if(at===null)return null;
    let best=null,bestDistance=Infinity;
    for(const raw of safeArray(points)){
      const pointAt=finite(raw?.atSeconds);if(pointAt===null)continue;
      const distance=Math.abs(pointAt-at);
      if(distance<bestDistance){best=raw;bestDistance=distance}
    }
    return best&&bestDistance<=maxDistance?{point:best,distance:bestDistance}:null;
  }

  function nearbyFight(fights,seconds,maxDistance=90){
    const at=finite(seconds);if(at===null)return null;
    let best=null,bestDistance=Infinity;
    for(const raw of safeArray(fights)){
      const fightAt=finite(raw?.atSeconds);if(fightAt===null)continue;
      const distance=Math.abs(fightAt-at);
      if(distance<bestDistance){best=raw;bestDistance=distance}
    }
    return best&&bestDistance<=maxDistance?{fight:best,distance:bestDistance}:null;
  }

  function proofForPoint(point,distance){
    const reasons=safeArray(point?.reasons).map(clean).filter(Boolean).slice(0,2);
    const reason=clean(point?.comparisonReason);
    const evidence=[reason,...reasons].filter(Boolean).join(' · ');
    return (evidence||'Visible level/item state was available around this read.')+' · '+Math.round(distance)+'s from your selection.';
  }

  function reviewBranchSelection(selection,points){
    const branch=upper(selection?.branch);
    const gameSeconds=finite(selection?.gameSeconds);
    if(!['AHEAD','EVEN','BEHIND'].includes(branch)||gameSeconds===null)return null;
    const nearest=nearestPoint(points,gameSeconds);
    if(!nearest){
      return{kind:'BRANCH',choice:branch,atSeconds:gameSeconds,minuteLabel:minute(gameSeconds),status:'NOT_VERIFIABLE',confidence:'LOW',title:branch+' READ NOT GRADED',detail:'No close-enough visible-state comparison was recorded around this click.',proof:'No evidence within 100 seconds of the selection.'};
    }
    const actual=upper(nearest.point?.verdict);
    const expected=BRANCH_TO_VERDICT[branch];
    const confidence=nearest.distance<=45?'HIGH':'MEDIUM';
    if(actual===expected){
      return{kind:'BRANCH',choice:branch,atSeconds:gameSeconds,minuteLabel:minute(gameSeconds),status:'SUPPORTED',confidence,title:branch+' READ SUPPORTED',detail:'Your selected game-state branch matched the closest recorded visible combat state.',proof:proofForPoint(nearest.point,nearest.distance)};
    }
    let title='STATE READ NEEDS REVIEW';
    let detail='The visible state around this click pointed to a different branch.';
    if(branch==='AHEAD'&&actual==='THEM_STRONGER'){title='YOU OVERREAD THE ADVANTAGE';detail='You selected AHEAD while the closest visible comparison favoured the opponent.'}
    else if(branch==='BEHIND'&&actual==='YOU_STRONGER'){title='YOU UNDERREAD YOUR WINDOW';detail='You selected BEHIND while the closest visible comparison favoured you.'}
    else if(branch==='EVEN'&&actual==='YOU_STRONGER'){title='YOU MISSED A STRONGER WINDOW';detail='You selected EVEN while the closest visible comparison favoured you.'}
    else if(branch==='EVEN'&&actual==='THEM_STRONGER'){title='YOU UNDERESTIMATED THE DEFICIT';detail='You selected EVEN while the closest visible comparison favoured the opponent.'}
    else if(branch==='AHEAD'&&actual==='EVEN'){title='AHEAD WAS TOO OPTIMISTIC';detail='You selected AHEAD while the closest visible state was roughly even.'}
    else if(branch==='BEHIND'&&actual==='EVEN'){title='BEHIND WAS TOO CAUTIOUS';detail='You selected BEHIND while the closest visible state was roughly even.'}
    return{kind:'BRANCH',choice:branch,atSeconds:gameSeconds,minuteLabel:minute(gameSeconds),status:'REVIEW',confidence,title,detail,proof:proofForPoint(nearest.point,nearest.distance)};
  }

  function reviewContingencySelection(selection,points,fights,contingencyMap){
    const choice=upper(selection?.contingency);
    const gameSeconds=finite(selection?.gameSeconds);
    if(!['PLAN_A','PLAN_B','RECOVERY'].includes(choice)||gameSeconds===null)return null;
    const available=Boolean(contingencyMap?.contingencies?.[choice]?.available);
    if(!available)return{kind:'CONTINGENCY',choice,atSeconds:gameSeconds,minuteLabel:minute(gameSeconds),status:'NOT_VERIFIABLE',confidence:'LOW',title:choice.replace('_',' ')+' WAS NOT AVAILABLE',detail:'The frozen pre-game map did not expose this route.',proof:'No grade.'};
    const nearest=nearestPoint(points,gameSeconds);
    const fight=nearbyFight(fights,gameSeconds);
    const verdict=upper(nearest?.point?.verdict);
    const recentDeath=upper(fight?.fight?.outcome)==='DEATH';
    const confidence=nearest?.distance<=45?'HIGH':nearest?'MEDIUM':recentDeath?'MEDIUM':'LOW';

    if(choice==='PLAN_B'){
      return{kind:'CONTINGENCY',choice,atSeconds:gameSeconds,minuteLabel:minute(gameSeconds),status:'NOT_VERIFIABLE',confidence:'LOW',title:'PLAN B SWITCH RECORDED',detail:'PLAN B was a valid frozen option, but local visible-state evidence cannot prove that the primary carry condition had stopped being playable.',proof:'OP CLIMB records the recognition choice without inventing team-carry viability.'};
    }

    if(choice==='RECOVERY'){
      if(verdict==='THEM_STRONGER'||recentDeath){
        return{kind:'CONTINGENCY',choice,atSeconds:gameSeconds,minuteLabel:minute(gameSeconds),status:'SUPPORTED',confidence,title:'RECOVERY READ SUPPORTED',detail:recentDeath?'A death occurred close to the switch, supporting a lower-risk recovery route.':'The closest visible combat state favoured the opponent, supporting the recovery route.',proof:nearest?proofForPoint(nearest.point,nearest.distance):'A recorded death occurred within 90 seconds of the selection.'};
      }
      if(verdict==='YOU_STRONGER'){
        return{kind:'CONTINGENCY',choice,atSeconds:gameSeconds,minuteLabel:minute(gameSeconds),status:'REVIEW',confidence,title:'RECOVERY MAY HAVE BEEN EARLY',detail:'You switched to RECOVERY while the closest visible combat comparison still favoured you.',proof:proofForPoint(nearest.point,nearest.distance)};
      }
    }

    if(choice==='PLAN_A'){
      if(verdict==='YOU_STRONGER'||verdict==='EVEN'){
        return{kind:'CONTINGENCY',choice,atSeconds:gameSeconds,minuteLabel:minute(gameSeconds),status:'SUPPORTED',confidence,title:'PLAN A STILL LOOKED PLAYABLE',detail:verdict==='YOU_STRONGER'?'The closest visible state still favoured you, so keeping the original route was supported.':'The closest visible state was roughly even, so there was not enough evidence to abandon the original route.',proof:proofForPoint(nearest.point,nearest.distance)};
      }
      if(verdict==='THEM_STRONGER'&&recentDeath){
        return{kind:'CONTINGENCY',choice,atSeconds:gameSeconds,minuteLabel:minute(gameSeconds),status:'REVIEW',confidence,title:'PLAN A MAY HAVE LASTED TOO LONG',detail:'You kept PLAN A while the closest visible state favoured the opponent and a death occurred near the read.',proof:proofForPoint(nearest.point,nearest.distance)};
      }
    }

    return{kind:'CONTINGENCY',choice,atSeconds:gameSeconds,minuteLabel:minute(gameSeconds),status:'NOT_VERIFIABLE',confidence,title:choice.replace('_',' ')+' READ NOT GRADED',detail:'The recorded evidence was not strong enough to say whether this route change was needed.',proof:'Recognition is only graded when visible evidence supports the claim.'};
  }

  function dedupeSelections(items,key){
    const result=[];
    for(const raw of safeArray(items)){
      const choice=upper(raw?.[key]);
      const seconds=finite(raw?.gameSeconds);
      if(!choice||seconds===null)continue;
      const prev=result[result.length-1];
      if(prev&&upper(prev?.[key])===choice&&Math.abs(Number(prev.gameSeconds)-seconds)<20)continue;
      result.push({...raw,[key]:choice,gameSeconds:seconds});
    }
    return result.slice(-12);
  }

  function reviewPlanRecognition(input){
    const branchSelections=dedupeSelections(input?.branchSelections,'branch');
    const contingencySelections=dedupeSelections(input?.contingencySelections,'contingency');
    const points=safeArray(input?.strengthPoints);
    const fights=safeArray(input?.fightReviews);
    const reads=[
      ...branchSelections.map(selection=>reviewBranchSelection(selection,points)).filter(Boolean),
      ...contingencySelections.map(selection=>reviewContingencySelection(selection,points,fights,input?.contingencyMap||null)).filter(Boolean),
    ].sort((a,b)=>a.atSeconds-b.atSeconds);
    const supported=reads.filter(item=>item.status==='SUPPORTED').length;
    const review=reads.filter(item=>item.status==='REVIEW').length;
    const notVerifiable=reads.filter(item=>item.status==='NOT_VERIFIABLE').length;
    const graded=supported+review;
    const rate=graded?Math.round(supported/graded*100):null;
    const best=[...reads].filter(item=>item.status==='SUPPORTED').sort((a,b)=>(a.confidence==='HIGH'?1:0)-(b.confidence==='HIGH'?1:0)).at(-1)||null;
    const biggestReview=[...reads].filter(item=>item.status==='REVIEW').sort((a,b)=>(a.confidence==='HIGH'?1:0)-(b.confidence==='HIGH'?1:0)).at(-1)||null;
    return{
      version:1,
      active:reads.length>0,
      reads,
      supported,
      review,
      notVerifiable,
      graded,
      supportRate:rate,
      bestRead:best,
      biggestReview,
      headline:graded?String(supported)+'/'+String(graded)+' GRADED READS SUPPORTED':reads.length?String(reads.length)+' READ'+(reads.length===1?'':'S')+' RECORDED · NONE GRADED':'NO MANUAL GAME READS TO GRADE',
      boundary:'POST-GAME ONLY. OP CLIMB REVIEWS PLAYER-SELECTED BRANCHES AGAINST RECORDED VISIBLE STATE; IT NEVER AUTO-SELECTS OR CHANGES THE IN-GAME PLAN.',
    };
  }

  return{reviewPlanRecognition,reviewBranchSelection,reviewContingencySelection,nearestPoint,nearbyFight};
});
