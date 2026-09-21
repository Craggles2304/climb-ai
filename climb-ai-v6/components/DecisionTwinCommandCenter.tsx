'use client';

import {useEffect,useMemo,useState} from 'react';
import type {DecisionTwinV2Profile,DecisionTwinActiveFocus,DecisionContextProfile} from '@/lib/decisionTwinV2';
import type {ScenarioMemoryProfile,ScenarioMemoryCard} from '@/lib/scenarioMemory';
import type {DecisionTransferProfile,DecisionTransferCard} from '@/lib/decisionTransfer';
import type {ClimbCurriculum,CurriculumLesson} from '@/lib/climbCurriculum';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function pretty(value:string){return value.replaceAll('_',' ').toLowerCase().replace(/(^|\s)\S/g,part=>part.toUpperCase())}
function pct(value:number|null){return value===null?'BUILDING':value+'%'}

function ContextCard({item}:{item:DecisionContextProfile}){
  return <article className={`dt2-context-card ${item.state.toLowerCase()}`}>
    <div className="dt2-card-top"><span>{item.label}</span><b>{item.state}</b></div>
    <h3>{item.recentFailureRate===null?'BUILDING':`${item.recentFailureRate}% recent fail`}</h3>
    <p>{item.summary}</p>
    <div className="dt2-mini-row"><span>{item.observations} observations</span><span>{item.confidence} confidence</span></div>
  </article>;
}

function MemoryCard({item}:{item:ScenarioMemoryCard}){
  return <article className={`dt4-memory-card ${item.state.toLowerCase()}`}>
    <div className="dt2-card-top"><span>{pretty(item.situationTag)}</span><b>{item.state}</b></div>
    <h3>{item.behaviourLabel}</h3>
    <p>{item.summary}</p>
    <div className="dt4-memory-meter"><i style={{width:`${item.memoryStrength}%`}}/><span>{item.memoryStrength}/100 memory</span></div>
    <div className="dt2-mini-row"><span>{item.comparableGames} comparable games</span><span>{item.dueNextGame?'DUE NEXT MATCH':item.gamesUntilReview+' games to review'}</span></div>
  </article>;
}

function TransferCard({item}:{item:DecisionTransferCard}){
  const breadth=item.dimension==='BOTH'?'Champion + Context':item.dimension==='CHAMPION'?'New Champions':item.dimension==='CONTEXT'?'New Contexts':'Local Only';
  return <article className={`dt5-transfer-card ${item.state.toLowerCase()}`}>
    <div className="dt2-card-top"><span>{breadth}</span><b>{item.state.replaceAll('_',' ')}</b></div>
    <h3>{item.behaviourLabel}</h3>
    <p>{item.summary}</p>
    <div className="dt5-transfer-path"><span>{item.sourceChampion}</span><i>→</i><strong>{item.novelChampions.length?item.novelChampions.slice(0,2).join(' / '):item.novelContexts.length?item.novelContexts.slice(0,2).map(pretty).join(' / '):'NEXT NOVEL TEST'}</strong></div>
    <div className="dt5-transfer-meter"><i style={{width:`${item.transferStrength}%`}}/><span>{item.transferStrength}/100 transfer</span></div>
    <div className="dt2-mini-row"><span>{item.transferGames} novel games</span><span>{item.transferCleanRate===null?'NO TEST YET':item.transferCleanRate+'% clean'}</span></div>
  </article>;
}

function CurriculumQueueItem({item,index}:{item:CurriculumLesson;index:number}){
  return <article className={`dt6-queue-item ${item.readiness.toLowerCase()}`}>
    <div className="dt6-queue-index">{String(index+1).padStart(2,'0')}</div>
    <div>
      <div className="dt2-card-top"><span>{item.phase}</span><b>{item.readiness}</b></div>
      <h4>{item.label}</h4>
      <small>{item.readiness==='LOCKED'&&item.prerequisiteLabel?`Unlock: ${item.prerequisiteLabel}`:item.graduationRule}</small>
    </div>
  </article>;
}

function FocusCard({item}:{item:DecisionTwinActiveFocus}){
  const gap=Math.max(0,item.targetScore-item.currentScore);
  return <article className="dt2-focus-card">
    <div className="dt2-focus-rank">{String(item.rank).padStart(2,'0')}</div>
    <div className="dt2-focus-main">
      <div className="dt2-card-top"><span>{item.status.replaceAll('_',' ')}</span><b>{item.confidence}</b></div>
      <h3>{item.label}</h3>
      <p>{item.reason}</p>
      <div className="dt2-score-line">
        <div><span>CURRENT</span><strong>{item.currentScore}</strong></div>
        <i>→</i>
        <div><span>NEXT LEVEL</span><strong>{item.targetScore}</strong></div>
        <small>+{gap}</small>
      </div>
      <div className="dt2-rule">{item.rule}</div>
      <div className="dt2-mini-row"><span>{item.situationTag?pretty(item.situationTag):'General pattern'}</span><span>Priority {item.priority}</span></div>
    </div>
  </article>;
}

export function DecisionTwinCommandCenter({accountId}:{accountId:string}){
  const [twin,setTwin]=useState<DecisionTwinV2Profile|null>(null);
  const [memory,setMemory]=useState<ScenarioMemoryProfile|null>(null);
  const [transfer,setTransfer]=useState<DecisionTransferProfile|null>(null);
  const [curriculum,setCurriculum]=useState<ClimbCurriculum|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [challengeChoice,setChallengeChoice]=useState<'ACTUAL'|'ALTERNATIVE'|null>(null);
  const valid=UUID.test(accountId);

  useEffect(()=>{
    let cancelled=false;
    if(!valid){setTwin(null);setMemory(null);setTransfer(null);setCurriculum(null);setError('');return}
    setLoading(true);setError('');
    fetch(`/api/decision-twin?accountId=${encodeURIComponent(accountId)}`,{cache:'no-store'})
      .then(async response=>{
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body?.error||'Could not load CLIMB Profile.');
        return body;
      })
      .then(body=>{if(!cancelled){setTwin(body?.twin??null);setMemory(body?.scenarioMemory??null);setTransfer(body?.decisionTransfer??null);setCurriculum(body?.curriculum??null);setChallengeChoice(null)}})
      .catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Could not load CLIMB Profile.')})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[accountId,valid]);

  const contexts=useMemo(()=>twin?.contextProfiles?.slice(0,4)??[],[twin]);
  const primary=twin?.identity.primary??null;
  const strongest=twin?.identity.strongest??null;
  const ledger=twin?.riskLedger??null;
  const memoryCards=useMemo(()=>memory?.cards?.filter(item=>item.state!=='BUILDING').slice(0,5)??[],[memory]);
  const activeRep=memory?.activeRep??null;
  const transferCards=useMemo(()=>transfer?.cards?.slice(0,5)??[],[transfer]);
  const activeTransfer=transfer?.activeTransfer??null;
  const currentLesson=curriculum?.currentLesson??null;
  const nextLesson=curriculum?.nextLesson??null;
  const curriculumQueue=useMemo(()=>curriculum?.queue?.slice(0,4)??[],[curriculum]);

  if(!valid)return null;

  return <section className="dt2-shell">
    <div className="dt2-head">
      <div>
        <div className="eyebrow">CLIMB PROFILE</div>
        <h2>How you play. How you're changing.</h2>
        <p className="muted">Your recurring patterns, strongest habits and next coaching priorities — built from your real games.</p>
      </div>
      {twin&&<div className="dt2-version"><span>PROFILE</span><b>LIVE</b><small>{twin.gamesAnalyzed} games</small></div>}
    </div>

    {loading&&<div className="glass card dt2-empty">BUILDING YOUR CLIMB PROFILE…</div>}
    {!loading&&error&&<div className="glass card dt2-empty">{error}</div>}

    {!loading&&!error&&twin&&<>
      <div className={`dt2-identity glass ${twin.identity.status.toLowerCase()}`}>
        <div className="dt2-identity-main">
          <span>YOUR CURRENT PATTERN</span>
          <h3>{twin.identity.headline}</h3>
          <p>{twin.identity.summary}</p>
          <div className="dt2-identity-proof">
            <b>{twin.identity.confidence} CONFIDENCE</b>
            <span>{primary?.evidence||'More comparable games required before OP CLIMB names a recurring risk identity.'}</span>
          </div>
        </div>
        <div className="dt2-identity-side">
          <div>
            <span>PRIMARY RISK</span>
            <b>{primary?.label||'BUILDING'}</b>
            <small>{primary?.behaviourLabel||'No verified risk identity yet'}</small>
          </div>
          <div>
            <span>VERIFIED STRENGTH</span>
            <b>{strongest?.label||'BUILDING'}</b>
            <small>{strongest?.behaviourLabel||'More evidence required'}</small>
          </div>
        </div>
      </div>

      <div className="dt2-section-head">
        <div><span>WHEN YOUR PLAY CHANGES</span><h3>See which game situations change your decisions.</h3></div>
        <small>Only repeated match evidence is promoted.</small>
      </div>
      {contexts.length?<div className="dt2-context-grid">{contexts.map(item=><ContextCard key={item.tag} item={item}/>)}</div>:<div className="glass card dt2-empty">NO VERIFIED CONTEXTUAL SELF YET · KEEP PLAYING FULLY TRACKED GAMES</div>}

      <div className="dt2-target glass">
        <div className="dt2-target-copy">
          <span>CURRENT → NEXT LEVEL</span>
          <h3>Build the next realistic level of your game.</h3>
          <p>{'Targets move only when new match evidence shows your play has changed.'}</p>
        </div>
        <div className="dt2-target-score">
          <div><span>CURRENT</span><b>{twin.targetTwin.currentAverage??'—'}</b></div>
          <i>→</i>
          <div><span>NEXT</span><b>{twin.targetTwin.targetAverage??'—'}</b></div>
        </div>
        <div className="dt2-target-metrics">
          {twin.targetTwin.metrics.slice(0,3).map(metric=><div key={metric.key}>
            <span>{metric.label}</span>
            <b>{metric.currentScore} → {metric.targetScore}</b>
            <small>{metric.status.replaceAll('_',' ')}</small>
          </div>)}
        </div>
      </div>

      <div className="dt6-curriculum glass">
        <div className="dt6-head">
          <div>
            <span>CLIMB CURRICULUM</span>
            <h3>{currentLesson?currentLesson.label:'Building your learning order'}</h3>
            <p>{curriculum?.summary||'OP CLIMB is waiting for repeated verified decisions before choosing what you should learn next.'}</p>
          </div>
          <div className={`dt6-status ${(curriculum?.status||'BUILDING').toLowerCase()}`}>
            <b>{curriculum?.status||'BUILDING'}</b>
            <small>{curriculum?.gamesAnalyzed??0} games</small>
          </div>
        </div>
        {currentLesson?<div className="dt6-current">
          <div className="dt6-current-main">
            <span>CURRENT LESSON · {currentLesson.phase}</span>
            <h4>{currentLesson.label}</h4>
            <p>{currentLesson.whyNow}</p>
            {curriculum?.decision&&<div className="dt6-decision"><b>CURRICULUM DECISION · {curriculum.decision.action}</b><span>{curriculum.decision.reason}</span></div>}
            <div className="dt7-rep">
              <div className="dt7-rep-head"><span>REP DIFFICULTY</span><b>LEVEL {currentLesson.repLadder.level}/5 · {currentLesson.repLadder.stage}</b></div>
              <strong>{currentLesson.repLadder.label}</strong>
              <p>{currentLesson.repLadder.objective}</p>
              <small>{currentLesson.repLadder.reason}</small>
            </div>
            <div className="dt6-rule">{currentLesson.gameRule}</div>
          </div>
          <div className="dt6-gates">
            <div>
              <span>REP PROMOTION GATE</span>
              <strong>{currentLesson.repLadder.promotionGate}</strong>
            </div>
            <div>
              <span>GRADUATION TEST</span>
              <strong>{currentLesson.graduationRule}</strong>
            </div>
            <div>
              <span>NEXT UNLOCK</span>
              <strong>{currentLesson.nextUnlock||nextLesson?.label||'WAIT FOR NEW VERIFIED LIMITER'}</strong>
            </div>
          </div>
        </div>:<div className="dt2-empty">NO EVIDENCE-BACKED LESSON YET · OP CLIMB WILL NOT INVENT A CURRICULUM FROM ONE GAME</div>}
        {curriculumQueue.length>1&&<div className="dt6-queue">
          {curriculumQueue.map((item,index)=><CurriculumQueueItem key={item.behaviourKey} item={item} index={index}/>)}
        </div>}
        <div className="dt6-boundary">{curriculum?.boundary||'One clean game cannot graduate a lesson.'}</div>
      </div>

      <div className="dt4-lab glass">
        <div className="dt4-lab-head">
          <div><span>DECISION LAB</span><h3>Scenario Memory · train the decision again only when it is due.</h3><p>{memory?.summary||'Scenario Memory is still building from repeated Decision Graph evidence.'}</p></div>
          <div className="dt4-lab-stats">
            <div><b>{memory?.dueNextGame??0}</b><span>DUE NEXT</span></div>
            <div><b>{memory?.mastered??0}</b><span>MASTERED</span></div>
            <div><b>{memory?.regressed??0}</b><span>REOPENED</span></div>
          </div>
        </div>
        {activeRep&&<div className="dt4-active-rep">
          <div>
            <span>NEXT SPACED REP</span>
            <h4>{activeRep.behaviourLabel} · {pretty(activeRep.situationTag)}</h4>
            <p>{activeRep.trigger}</p>
          </div>
          <div>
            <span>OLD BRANCH</span>
            <strong>{activeRep.oldBranch}</strong>
          </div>
          <div className="target">
            <span>NEW BRANCH</span>
            <strong>{activeRep.targetBranch}</strong>
          </div>
        </div>}
        {memoryCards.length?<div className="dt4-memory-grid">{memoryCards.map(item=><MemoryCard key={item.id} item={item}/>)}</div>:<div className="dt2-empty">NO REPEATED SCENARIO MEMORY YET · OP CLIMB WILL NOT INVENT DRILLS FROM ONE GAME</div>}
        <div className="dt4-boundary">{memory?.boundary||'One game cannot create mastery.'}</div>
      </div>

      <div className="dt5-map glass">
        <div className="dt5-map-head">
          <div><span>SKILL TRANSFER</span><h3>Did you learn the decision — or only memorise the original cue?</h3><p>{transfer?.summary||'Transfer Learning begins after a Scenario Memory is locally mastered.'}</p></div>
          <div className="dt5-map-stats">
            <div><b>{transfer?.locallyMastered??0}</b><span>LOCAL</span></div>
            <div><b>{transfer?.transferring??0}</b><span>TRANSFERRING</span></div>
            <div><b>{transfer?.principleOwned??0}</b><span>OWNED</span></div>
          </div>
        </div>
        {activeTransfer&&<div className="dt5-active-transfer">
          <div><span>NEXT GENERALISATION TARGET</span><h4>{activeTransfer.behaviourLabel}</h4><p>{activeTransfer.principle}</p></div>
          <div><span>LEARNED LOCALLY</span><strong>{activeTransfer.sourceChampion} · {pretty(activeTransfer.sourceTag)}</strong></div>
          <div className="target"><span>PROVE IT BEYOND THE CUE</span><strong>{activeTransfer.state==='REGRESSED'?'REOPEN TRANSFER':activeTransfer.state==='LOCAL_ONLY'?'FIRST NOVEL TEST':'KEEP EXPANDING BREADTH'}</strong></div>
        </div>}
        {transferCards.length?<div className="dt5-transfer-grid">{transferCards.map(item=><TransferCard key={item.id} item={item}/>)}</div>:<div className="dt2-empty">NO LOCALLY MASTERED MEMORY IS READY FOR TRANSFER TESTING YET</div>}
        <div className="dt5-boundary">{transfer?.boundary||'Generalisation is never claimed from one clean game.'}</div>
      </div>

      <div className="dt2-section-head">
        <div><span>YOUR ACTIVE FIVE</span><h3>The five behaviours costing the most controllable value now.</h3></div>
        <small>The list changes as your evidence changes.</small>
      </div>
      {twin.activeFive.length?<div className="dt2-focus-list">{twin.activeFive.map(item=><FocusCard key={item.key} item={item}/>)}</div>:<div className="glass card dt2-empty">NO EVIDENCE-BACKED ACTIVE FIVE YET · OP CLIMB WILL NOT FILL THE BOARD WITH GUESSES</div>}

      <div className="dt2-ledger glass">
        <div className="dt2-ledger-copy">
          <span>RISK MAP LEDGER</span>
          <h3>Did your expected patterns actually appear in games?</h3>
          <p>{ledger?.boundary}</p>
        </div>
        <div className="dt2-ledger-stats">
          <div><span>FROZEN MAPS</span><b>{ledger?.frozenRiskMaps??0}</b></div>
          <div><span>RISKS OBSERVED</span><b>{ledger?.observedRisks??0}</b><small>{pct(ledger?.observedRate??null)} of frozen risks appeared</small></div>
          <div><span>PATTERN HIT</span><b>{ledger?.hitRisks??0}</b><small>{pct(ledger?.hitShare??null)} of observed</small></div>
          <div><span>PATTERN BEATEN</span><b>{ledger?.beatenRisks??0}</b><small>{pct(ledger?.beatShare??null)} of observed</small></div>
          <div><span>MIXED</span><b>{ledger?.mixedRisks??0}</b></div>
          <div><span>NOT OBSERVED</span><b>{ledger?.unobservedRisks??0}</b></div>
        </div>
      </div>

      {twin.challenge&&<div className="dt2-challenge glass">
        <div className="dt2-challenge-head">
          <div><span>WHAT WOULD YOU DO?</span><h3>Pause the decision. Choose before you see the model.</h3></div>
          <small>{twin.challenge.minuteLabel} · {twin.challenge.behaviourLabel} · {twin.challenge.confidence}</small>
        </div>
        <p className="dt2-challenge-situation">{twin.challenge.situation}</p>
        <div className="dt2-challenge-options">
          <button className={challengeChoice==='ACTUAL'?'selected':''} onClick={()=>setChallengeChoice('ACTUAL')}>
            <span>A</span><b>{twin.challenge.actual}</b>
          </button>
          <button className={challengeChoice==='ALTERNATIVE'?'selected':''} onClick={()=>setChallengeChoice('ALTERNATIVE')}>
            <span>B</span><b>{twin.challenge.alternative}</b>
          </button>
        </div>
        {challengeChoice&&<div className="dt2-challenge-reveal">
          <div>
            <span>YOU CHOSE</span>
            <b>{challengeChoice==='ACTUAL'?'A · RECORDED BRANCH':'B · REVIEWED ALTERNATIVE'}</b>
          </div>
          <div>
            <span>YOUR PATTERN</span>
            <b>{twin.challenge.twinTendency==='ACTUAL'?'USUALLY A':twin.challenge.twinTendency==='ALTERNATIVE'?'USUALLY B':'NOT ENOUGH EVIDENCE'}</b>
            <small>{twin.challenge.twinEvidence}</small>
          </div>
          <div>
            <span>COACHING READ</span>
            <b>{twin.challenge.whyBetter}</b>
            <small>{twin.challenge.tradeoff}</small>
          </div>
          <p>{twin.challenge.outcomeBoundary}</p>
        </div>}
      </div>}

      <div className="dt2-policy">THE MODEL CHANGES WHEN YOU CHANGE · LOCAL MASTERY ≠ GENERALISATION · NO TRANSFER CREDIT WITHOUT A FROZEN NOVEL TEST</div>
    </>}
  </section>;
}
