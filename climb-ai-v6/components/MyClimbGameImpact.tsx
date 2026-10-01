'use client';

import Link from 'next/link';
import type {CSSProperties} from 'react';
import type {DnaDomain,ILPTask,Match} from '@/lib/types';
import type {StrengthEvidence} from '@/lib/positiveEvidence';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS,dnaDomainLabel} from '@/lib/dnaDomain';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionSummary} from '@/lib/missionLoop';

type LearningRow={
  task:ILPTask;
  attempt:NonNullable<ILPTask['missionHistory']>[number];
  summary:ReturnType<typeof missionSummary>;
};

const styleFor=(domain:DnaDomain)=>({'--strand-color':DNA_DOMAIN_COLORS[domain]} as CSSProperties);

export function MyClimbGameImpact({
  match,
  learning,
  strengths,
  activeTasks,
  baselineGames=3,
  baselineRequired=3,
}:{
  match?:Match;
  learning:LearningRow[];
  strengths:StrengthEvidence[];
  activeTasks:ILPTask[];
  baselineGames?:number;
  baselineRequired?:number;
}){
  const baselineReady=baselineGames>=baselineRequired;
  if(!baselineReady)return <BaselineImpact match={match} games={baselineGames} required={baselineRequired}/>;
  if(!match)return <section className="mc-impact"><div className="panel panel-padding"><div className="eyebrow">MY CLIMB</div><h2>Waiting for your first tracked game.</h2><p className="muted">OP CLIMB needs a completed match before it can show last-game impact.</p></div></section>;
  const primaryLearning=learning.find(item=>item.attempt.banksPass)??learning[0]??null;
  const primaryTask=primaryLearning?.task??activeTasks[0]??null;
  const primarySummary=primaryLearning?.summary??(primaryTask?missionSummary(primaryTask):null);
  const primaryAttempt=primaryLearning?.attempt??null;
  const primaryStrength=strengths[0]??null;
  const domain=(primaryTask?.dnaDomain??primaryStrength?.dnaDomain??'CONSISTENCY') as DnaDomain;
  const required=Math.max(1,primarySummary?.required??3);
  const afterReps=primarySummary?.confirmed??0;
  const beforeReps=Math.max(0,afterReps-(primaryAttempt?.banksPass?1:0));
  const afterProgress=Math.max(0,Math.min(100,Math.round(primaryTask?.progress??0)));
  const repDelta=primaryAttempt?.banksPass?Math.max(1,Math.round(100/required)):0;
  const beforeProgress=Math.max(0,afterProgress-repDelta);
  const dnaMoved=Boolean(primaryAttempt?.banksPass);
  const keyMoments=buildKeyMoments(match,strengths).slice(0,3);
  const dnaRows=DNA_DOMAINS.map(dnaDomain=>{
    const related=activeTasks.filter(task=>task.dnaDomain===dnaDomain);
    const progress=related.length
      ?Math.round(related.reduce((sum,task)=>sum+Math.max(0,Math.min(100,task.status==='MASTERED'?100:Number(task.progress)||0)),0)/related.length)
      :0;
    const touched=learning.some(item=>item.task.dnaDomain===dnaDomain&&item.attempt.banksPass);
    return{domain:dnaDomain,progress,touched};
  });

  return <section className="mc-impact">
    <header className="mc-impact-hero">
      <div>
        <div className="eyebrow">MY CLIMB · LAST GAME IMPACT</div>
        <h1>{match.champion} · {match.result==='WIN'?'VICTORY':'DEFEAT'}</h1>
        <p>{match.role} · {match.kills}/{match.deaths}/{match.assists} · {Math.floor(match.durationSeconds/60)}:{String(match.durationSeconds%60).padStart(2,'0')} · This is what changed from your last tracked game.</p>
      </div>
      <Link className="btn secondary" href={'/analyse/'+encodeURIComponent(match.id)}>DETAILED REVIEW</Link>
    </header>

    <div className="mc-impact-strip">
      <article style={styleFor(domain)}>
        <span>{dnaDomainLabel(domain)}</span>
        <small>CHALLENGE PROGRESS</small>
        <strong>{beforeProgress}% <i>→</i> <em>{afterProgress}%</em></strong>
        <b>{dnaMoved?`+${Math.max(0,afterProgress-beforeProgress)}% FROM THIS GAME`:'NO CHANGE THIS GAME'}</b>
      </article>
      <article style={styleFor(domain)}>
        <span>{primaryStrength?.subskill||clean(primaryTask?.category||'LEARNING')}</span>
        <small>PROVEN REPS</small>
        <strong>{beforeReps}/{required} <i>→</i> <em>{afterReps}/{required}</em></strong>
        <b>{primaryAttempt?.banksPass?'✓ REP BANKED':'○ NO REP BANKED'}</b>
      </article>
      <article className="is-strength" style={styleFor(primaryStrength?.dnaDomain??domain)}>
        <span>STRENGTH CONFIRMED</span>
        <small>WHAT HELD</small>
        <h3>{primaryStrength?.title||'Still building reliable positive evidence'}</h3>
        <b>{primaryStrength?'✓ MEASURED':'WAITING FOR EVIDENCE'}</b>
      </article>
      <article className="is-dna" style={styleFor(domain)}>
        <span>GAME DNA</span>
        <small>LAST GAME EFFECT</small>
        <h3>{dnaMoved?'STRAND MOVED':'STRAND HELD'}</h3>
        <b>{dnaMoved?'EVIDENCE-BACKED GROWTH':'NO FALSE PROGRESS'}</b>
      </article>
    </div>

    <div className="mc-impact-grid">
      <article className="mc-change panel" style={styleFor(primaryStrength?.dnaDomain??domain)}>
        <div className="mc-card-head"><div><span>WHAT CHANGED THIS GAME</span><h2>{primaryAttempt?.banksPass?'This game moved your Climb.':'This game added evidence.'}</h2></div>{primaryAttempt?.banksPass&&<b>PROGRESS ✓</b>}</div>
        {primaryStrength?<div className="mc-change-main">
          <div className="mc-strength-mark">✦</div>
          <div>
            <span className="mc-domain">{dnaDomainLabel(primaryStrength.dnaDomain)} → {primaryStrength.subskill}</span>
            <h3>{primaryStrength.title}</h3>
            <div className="mc-explain"><b>WHAT YOU DID</b><p>{primaryStrength.whatHappened}</p></div>
            <div className="mc-explain"><b>WHY IT MATTERED</b><p>{primaryStrength.whyItMattered}</p></div>
            <details>
              <summary>SHOW THE PROOF</summary>
              <div className="mc-proof"><strong>{primaryStrength.value}</strong><span>{primaryStrength.target} · {primaryStrength.confidence} confidence</span>{primaryStrength.proof.map(line=><small key={line}>{line}</small>)}</div>
            </details>
          </div>
        </div>:<div className="mc-empty-evidence"><b>No verified strength yet.</b><p>OP CLIMB will not invent praise. It will wait for evidence strong enough to explain.</p></div>}
      </article>

      <article className="mc-mission panel" style={styleFor(domain)}>
        <div className="mc-card-head"><div><span>YOUR ACTIVE CLIMB MISSION</span><h2>{primaryTask?plainLanguageFocus(primaryTask).name:'Your next challenge is building'}</h2></div><b>IN PROGRESS</b></div>
        {primaryTask&&primarySummary?<>
          <p className="mc-mission-rule">{plainLanguageFocus(primaryTask).nextGame}</p>
          <div className="mc-mission-reps"><strong>{primarySummary.confirmed}/{primarySummary.required}</strong><span>PROVEN REPS</span><em>{primaryTask.progress}%</em></div>
          <div className="mc-progressbar"><i style={{width:Math.max(0,Math.min(100,primaryTask.progress))+'%'}}/></div>
          <MiniLearningPath stage={primarySummary.stage}/>
          <div className="mc-how-pass"><span>HOW YOU PASS</span><b>{plainLanguageFocus(primaryTask).success}</b></div>
        </>:<p className="muted">OP CLIMB is waiting for enough evidence to set the next measurable mission.</p>}
      </article>

      <article className="mc-dna panel">
        <div className="mc-card-head"><div><span>YOUR GAME DNA</span><h2>See what is actually growing.</h2></div><b>REAL DATA</b></div>
        <div className="mc-dna-list">
          {dnaRows.map(row=><div key={row.domain} style={styleFor(row.domain)}>
            <span>{DNA_DOMAIN_LABELS[row.domain]}</span>
            <div><i style={{width:row.progress+'%'}}/></div>
            <b>{row.progress}%</b>
            <em>{row.touched?'↑ LAST GAME':''}</em>
          </div>)}
        </div>
      </article>

      <article className="mc-strengths panel">
        <div className="mc-card-head"><div><span>WHAT YOU DID WELL · MEASURED</span><h2>Keep these.</h2></div><b>{strengths.length} VERIFIED</b></div>
        <div className="mc-strength-list">
          {strengths.slice(0,3).map(item=><div key={item.id} style={styleFor(item.dnaDomain)}>
            <i>✓</i><div><span>{dnaDomainLabel(item.dnaDomain)} → {item.subskill}</span><b>{item.title}</b><small>{item.whatHappened}</small></div><em>VERIFIED</em>
          </div>)}
          {!strengths.length&&<p className="muted">No positive behaviour cleared the evidence bar strongly enough yet.</p>}
        </div>
      </article>

      <article className="mc-moments panel">
        <div className="mc-card-head"><div><span>KEY MOMENTS</span><h2>3 moments worth remembering.</h2></div><b>TIMESTAMPS</b></div>
        <div className="mc-moment-list">
          {keyMoments.map((moment,index)=><div key={moment.key} style={styleFor(moment.domain)}>
            <strong>{moment.clock}</strong><i>{index+1}</i><p>{moment.text}</p>
          </div>)}
          {!keyMoments.length&&<p className="muted">No reliable timestamped moments were available for this match.</p>}
        </div>
        <footer>No video required · timestamps come from match/timeline evidence.</footer>
      </article>
    </div>
  </section>;
}

function BaselineImpact({match,games,required}:{match?:Match;games:number;required:number}){
  const safeGames=Math.max(0,Math.min(required,games));
  const left=Math.max(0,required-safeGames);
  const moments=(match?.moments??[]).slice(0,3);

  return <section className="mc-impact mc-impact-baseline">
    <header className="mc-impact-hero">
      <div>
        <div className="eyebrow">MY CLIMB · DNA BASELINE</div>
        <h1>BUILDING YOUR STARTING POINT.</h1>
        <p>{match?match.champion+' · '+(match.result==='WIN'?'VICTORY':'DEFEAT')+' · '+match.kills+'/'+match.deaths+'/'+match.assists+' · ':''}Game {safeGames} of {required} observed. OP CLIMB is collecting evidence before it tells you what to change.</p>
      </div>
      <Link className="btn primary" href="/live">TRACK GAME {Math.min(safeGames+1,required)} →</Link>
    </header>

    <div className="mc-impact-strip">
      <article className="baseline-card">
        <span>DNA BASELINE</span><small>OBSERVATION PROGRESS</small>
        <strong>{safeGames}/{required}</strong><b>{left?left+' GAME'+(left===1?'':'S')+' LEFT':'READY TO REVEAL'}</b>
      </article>
      <article className="baseline-card">
        <span>GAME DNA</span><small>CURRENT STATE</small>
        <strong>0%</strong><b>GREY UNTIL GAME 3</b>
      </article>
      <article className="baseline-card">
        <span>CLIMB MISSION</span><small>PERSONALISED CHALLENGE</small>
        <h3>LOCKED</h3><b>UNLOCKS AFTER BASELINE</b>
      </article>
      <article className="baseline-card">
        <span>LEARNING</span><small>PROVEN REPS</small>
        <h3>0</h3><b>STARTS AFTER GAME 3</b>
      </article>
    </div>

    <div className="mc-impact-grid">
      <article className="mc-change panel baseline-panel">
        <div className="mc-card-head"><div><span>WHAT HAPPENED LAST GAME</span><h2>{match?'Game recorded. Not judged yet.':'Waiting for a tracked game.'}</h2></div><b>OBSERVATION</b></div>
        <div className="mc-baseline-message">
          <strong>{match?match.champion+' · '+match.kills+'/'+match.deaths+'/'+match.assists:'NO MATCH YET'}</strong>
          <p>OP CLIMB is deliberately not turning one or two games into a coaching conclusion. It is watching for what repeats across the first three games.</p>
        </div>
        <div className="mc-baseline-steps">
          {[0,1,2].map(index=><div key={index} className={index<safeGames?'done':index===safeGames?'current':''}>
            <i>{index<safeGames?'✓':index+1}</i><span>GAME {index+1}</span><small>{index<safeGames?'OBSERVED':index===safeGames?'NEXT':'WAITING'}</small>
          </div>)}
        </div>
      </article>

      <article className="mc-mission panel baseline-panel">
        <div className="mc-card-head"><div><span>YOUR NEXT STEP</span><h2>Play normally.</h2></div><b>{safeGames}/{required}</b></div>
        <p className="mc-mission-rule">Do not change your play for OP CLIMB yet. The baseline needs your real habits before a challenge starts influencing them.</p>
        <div className="mc-how-pass"><span>AFTER GAME 3</span><b>DNA reveals → first challenge unlocks → proven reps begin → strands grow from evidence.</b></div>
        <Link className="btn primary" href="/live" style={{marginTop:14}}>TRACK NEXT GAME →</Link>
      </article>

      <article className="mc-dna panel baseline-panel">
        <div className="mc-card-head"><div><span>YOUR GAME DNA</span><h2>Nothing coloured in yet.</h2></div><b>0%</b></div>
        <div className="mc-dna-list">
          {DNA_DOMAINS.map(domain=><div key={domain} className="baseline-dna-row">
            <span>{DNA_DOMAIN_LABELS[domain]}</span><div><i style={{width:'0%'}}/></div><b>0%</b><em>LOCKED</em>
          </div>)}
        </div>
      </article>

      <article className="mc-strengths panel baseline-panel">
        <div className="mc-card-head"><div><span>WHAT YOU DID WELL · MEASURED</span><h2>Still observing.</h2></div><b>LOCKED</b></div>
        <div className="mc-baseline-message"><strong>NO EARLY PRAISE OR CRITICISM</strong><p>OP CLIMB can record the match, but it waits for the third game before turning patterns into strengths or challenges.</p></div>
      </article>

      <article className="mc-moments panel baseline-panel">
        <div className="mc-card-head"><div><span>KEY MOMENTS</span><h2>Last-game timestamps.</h2></div><b>OBSERVATION</b></div>
        <div className="mc-moment-list">
          {moments.map((moment,index)=><div key={moment.atMs+'-'+moment.type} className="baseline-moment">
            <strong>{moment.clock}</strong><i>{index+1}</i><p>{moment.text}</p>
          </div>)}
          {!moments.length&&<p className="muted">No reliable timestamped moments were available for this match yet.</p>}
        </div>
        <footer>Recorded for context · not used to score learning until the baseline is complete.</footer>
      </article>
    </div>
  </section>;
}

function MiniLearningPath({stage}:{stage:string}){
  const rows=[['DISCOVER','RECOGNISE'],['PRACTISE','EXECUTE'],['REPEAT','REPEAT'],['MASTERED','MASTERED']] as const;
  const active=Math.max(0,rows.findIndex(([key])=>key===stage));
  return <ol className="mc-learning-path">{rows.map(([key,label],index)=><li key={key} className={index<active?'done':index===active?'active':''}><i>{index<active?'✓':index+1}</i><span>{label}</span></li>)}</ol>;
}

function buildKeyMoments(match:Match,strengths:StrengthEvidence[]){
  const out:Array<{key:string;clock:string;text:string;domain:DnaDomain}>=[];
  for(const strength of strengths){
    if(typeof strength.atSeconds!=='number')continue;
    out.push({
      key:'strength-'+strength.id,
      clock:clock(strength.atSeconds),
      text:strength.whatHappened,
      domain:strength.dnaDomain,
    });
  }
  for(const moment of match.moments??[]){
    out.push({
      key:'moment-'+moment.atMs+'-'+moment.type,
      clock:moment.clock,
      text:moment.cost?moment.text+' '+moment.cost:moment.text,
      domain:moment.type==='OBJECTIVE_TAKEN'||moment.type==='OBJECTIVE_LOST'?'OBJECTIVES':moment.type==='DEATH'?'TEAMFIGHTS':'CONSISTENCY',
    });
  }
  const seen=new Set<string>();
  return out.filter(item=>{
    const key=item.clock+'|'+item.text;
    if(seen.has(key))return false;
    seen.add(key);
    return true;
  }).slice(0,3);
}

function clock(seconds:number){
  const whole=Math.max(0,Math.floor(seconds));
  return Math.floor(whole/60)+':'+String(whole%60).padStart(2,'0');
}

function clean(value:string){
  return String(value||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,char=>char.toUpperCase());
}
