'use client';

import {useEffect,useMemo,useState} from 'react';
import type {DecisionTwinV2Profile,DecisionTwinActiveFocus,DecisionContextProfile} from '@/lib/decisionTwinV2';

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
        <div><span>NEXT TWIN</span><strong>{item.targetScore}</strong></div>
        <small>+{gap}</small>
      </div>
      <div className="dt2-rule">{item.rule}</div>
      <div className="dt2-mini-row"><span>{item.situationTag?pretty(item.situationTag):'General pattern'}</span><span>Priority {item.priority}</span></div>
    </div>
  </article>;
}

export function DecisionTwinCommandCenter({accountId}:{accountId:string}){
  const [twin,setTwin]=useState<DecisionTwinV2Profile|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [challengeChoice,setChallengeChoice]=useState<'ACTUAL'|'ALTERNATIVE'|null>(null);
  const valid=UUID.test(accountId);

  useEffect(()=>{
    let cancelled=false;
    if(!valid){setTwin(null);setError('');return}
    setLoading(true);setError('');
    fetch(`/api/decision-twin?accountId=${encodeURIComponent(accountId)}`,{cache:'no-store'})
      .then(async response=>{
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body?.error||'Could not load Decision Twin.');
        return body;
      })
      .then(body=>{if(!cancelled){setTwin(body?.twin??null);setChallengeChoice(null)}})
      .catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Could not load Decision Twin.')})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[accountId,valid]);

  const contexts=useMemo(()=>twin?.contextProfiles?.slice(0,4)??[],[twin]);
  const primary=twin?.identity.primary??null;
  const strongest=twin?.identity.strongest??null;
  const ledger=twin?.riskLedger??null;

  if(!valid)return null;

  return <section className="dt2-shell">
    <div className="dt2-head">
      <div>
        <div className="eyebrow">DECISION TWIN V2 · PLAYER OPERATING MODEL</div>
        <h2>Your game does not have one version of you.</h2>
        <p className="muted">OP CLIMB models the decisions you repeat, the contexts that change you, the risks it can forecast before draft lock and the next realistic version of your play.</p>
      </div>
      {twin&&<div className="dt2-version"><span>MODEL</span><b>V2</b><small>{twin.gamesAnalyzed} games</small></div>}
    </div>

    {loading&&<div className="glass card dt2-empty">BUILDING YOUR DECISION MODEL…</div>}
    {!loading&&error&&<div className="glass card dt2-empty">{error}</div>}

    {!loading&&!error&&twin&&<>
      <div className={`dt2-identity glass ${twin.identity.status.toLowerCase()}`}>
        <div className="dt2-identity-main">
          <span>PRIMARY DECISION IDENTITY</span>
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
        <div><span>CONTEXTUAL SELVES</span><h3>The player changes when the situation changes.</h3></div>
        <small>Only repeated Decision Graph evidence is promoted.</small>
      </div>
      {contexts.length?<div className="dt2-context-grid">{contexts.map(item=><ContextCard key={item.tag} item={item}/>)}</div>:<div className="glass card dt2-empty">NO VERIFIED CONTEXTUAL SELF YET · KEEP PLAYING FULLY TRACKED GAMES</div>}

      <div className="dt2-target glass">
        <div className="dt2-target-copy">
          <span>TWIN → NEXT TWIN</span>
          <h3>Train the next version of you, not an imaginary perfect player.</h3>
          <p>{twin.targetTwin.rule}</p>
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

      <div className="dt2-section-head">
        <div><span>ACTIVE FIVE · TWIN-RANKED</span><h3>The five behaviours costing the most controllable value now.</h3></div>
        <small>The list changes as your evidence changes.</small>
      </div>
      {twin.activeFive.length?<div className="dt2-focus-list">{twin.activeFive.map(item=><FocusCard key={item.key} item={item}/>)}</div>:<div className="glass card dt2-empty">NO EVIDENCE-BACKED ACTIVE FIVE YET · OP CLIMB WILL NOT FILL THE BOARD WITH GUESSES</div>}

      <div className="dt2-ledger glass">
        <div className="dt2-ledger-copy">
          <span>RISK MAP LEDGER</span>
          <h3>Did the Decision Twin recognise the decision windows that actually appeared?</h3>
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
          <div><span>WHAT WOULD MY TWIN DO?</span><h3>Pause the decision. Choose before you see the model.</h3></div>
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
            <span>YOUR DECISION TWIN</span>
            <b>{twin.challenge.twinTendency==='ACTUAL'?'LEANED A':twin.challenge.twinTendency==='ALTERNATIVE'?'LEANED B':'NOT ENOUGH EVIDENCE'}</b>
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

      <div className="dt2-policy">THE MODEL CHANGES WHEN YOU CHANGE · NO IDENTITY FROM ONE BAD GAME · NO “ACCURACY” CREDIT FOR A RISK WINDOW THAT NEVER OCCURRED</div>
    </>}
  </section>;
}
