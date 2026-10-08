'use client';

import Link from 'next/link';
import type {CSSProperties} from 'react';
import type {DnaDomain,ILPTask,Match} from '@/lib/types';
import type {StrengthEvidence} from '@/lib/positiveEvidence';
import {DNA_DOMAINS,DNA_DOMAIN_COLORS,DNA_DOMAIN_LABELS,dnaDomainLabel} from '@/lib/dnaDomain';
import {plainLanguageFocus} from '@/lib/plainLanguageCoaching';
import {missionSummary} from '@/lib/missionLoop';
import {verifiedMissionRep} from '@/lib/verifiedMissionProof';

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
  if(!baselineReady)return <BaselineImpact match={match} games={baselineGames} required={baselineRequired} strengths={strengths}/>;
  if(!match)return <section className="mc-impact"><div className="panel panel-padding"><div className="eyebrow">MY CLIMB</div><h2>Waiting for your first tracked game.</h2><p className="muted">OP CLIMB needs a completed match before it can show last-game impact.</p></div></section>;
  const primaryLearning=learning.find(item=>verifiedMissionRep(item.task,item.attempt))??learning[0]??null;
  const primaryTask=primaryLearning?.task??activeTasks[0]??null;
  const primarySummary=primaryLearning?.summary??(primaryTask?missionSummary(primaryTask):null);
  const primaryAttempt=primaryLearning?.attempt??null;
  const primaryStrength=strengths[0]??null;
  const domain=(primaryTask?.dnaDomain??primaryStrength?.dnaDomain??'CONSISTENCY') as DnaDomain;
  const required=Math.max(1,primarySummary?.required??3);
  const afterReps=primarySummary?.confirmed??0;
  const beforeReps=Math.max(0,afterReps-((primaryTask&&verifiedMissionRep(primaryTask,primaryAttempt))?1:0));
  const afterProgress=Math.round(Math.min(required,afterReps)/required*100);
  const repDelta=(primaryTask&&verifiedMissionRep(primaryTask,primaryAttempt))?Math.max(1,Math.round(100/required)):0;
  const beforeProgress=Math.max(0,afterProgress-repDelta);
  const dnaMoved=Boolean((primaryTask&&verifiedMissionRep(primaryTask,primaryAttempt)));
  const keyMoments=buildKeyMoments(match,strengths).slice(0,3);
  const dnaRows=DNA_DOMAINS.map(dnaDomain=>{
    const task=activeTasks.find(row=>row.dnaDomain===dnaDomain);
    const summary=task?missionSummary(task):null;
    const progress=summary?Math.round(Math.min(summary.required,summary.confirmed)/Math.max(1,summary.required)*100):0;
    const touched=learning.some(item=>item.task.dnaDomain===dnaDomain&&verifiedMissionRep(item.task,item.attempt));
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
        <small>MISSION TRACKER</small>
        <strong>{beforeProgress}% <i>→</i> <em>{afterProgress}%</em></strong>
        <b>{dnaMoved?`+${Math.max(0,afterProgress-beforeProgress)}% FROM THIS GAME`:'NO CHANGE THIS GAME'}</b>
      </article>
      <article style={styleFor(domain)}>
        <span>{primaryStrength?.subskill||clean(primaryTask?.category||'LEARNING')}</span>
        <small>COMPLETED GAMES</small>
        <strong>{beforeReps}/{required} <i>→</i> <em>{afterReps}/{required}</em></strong>
        <b>{(primaryTask&&verifiedMissionRep(primaryTask,primaryAttempt))?'✓ GAME BANKED':'○ NO GAME BANKED'}</b>
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
        <div className="mc-card-head"><div><span>WHAT CHANGED THIS GAME</span><h2>{(primaryTask&&verifiedMissionRep(primaryTask,primaryAttempt))?'This game moved your Climb.':'This game added evidence.'}</h2></div>{(primaryTask&&verifiedMissionRep(primaryTask,primaryAttempt))&&<b>PROGRESS ✓</b>}</div>
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
        <div className="mc-card-head"><div><span>DNA MISSION FROM THIS GAME</span><h2>{primaryTask?plainLanguageFocus(primaryTask).name:'Your next challenge is building'}</h2></div><b>IN PROGRESS</b></div>
        {primaryTask&&primarySummary?<>
          <p className="mc-mission-rule">{plainLanguageFocus(primaryTask).nextGame}</p>
          <div className="mc-mission-reps"><strong>{primarySummary.confirmed}/{primarySummary.required}</strong><span>COMPLETED GAMES</span><em>{Math.round(Math.min(primarySummary.required,primarySummary.confirmed)/Math.max(1,primarySummary.required)*100)}%</em></div>
          <div className="mc-progressbar"><i style={{width:Math.round(Math.min(primarySummary.required,primarySummary.confirmed)/Math.max(1,primarySummary.required)*100)+'%'}}/></div>
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

function BaselineImpact({match,games,required,strengths}:{match?:Match;games:number;required:number;strengths:StrengthEvidence[]}){
  const safeGames=Math.max(0,Math.min(required,games));
  const left=Math.max(0,required-safeGames);
  const moments=(match?.moments??[]).slice(0,3);
  const issues=baselineIssues(match);
  const topIssue=issues[0]??null;

  return <section className="mc-impact mc-impact-baseline">
    <header className="mc-impact-hero">
      <div>
        <div className="eyebrow">MY CLIMB · DNA BASELINE</div>
        <h1>BUILDING YOUR STARTING POINT.</h1>
        <p>{match?match.champion+' · '+(match.result==='WIN'?'VICTORY':'DEFEAT')+' · '+match.kills+'/'+match.deaths+'/'+match.assists+' · ':''}Game {safeGames} of {required} observed. OP CLIMB is collecting evidence before it tells you what to change.</p>
      </div>
      <div className="mission-actions">
        {match&&<Link className="btn secondary" href={'/analyse/'+encodeURIComponent(match.id)}>DETAILED REVIEW</Link>}
        <Link className="btn primary" href="/live">TRACK ROLE GAME {Math.min(safeGames+1,required)} →</Link>
      </div>
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
        <span>DNA MISSIONS</span><small>ONE PER STRAND</small>
        <h3>6 LOCKED</h3><b>UNLOCK AFTER BASELINE</b>
      </article>
      <article className="baseline-card">
        <span>LEARNING</span><small>COMPLETED GAMES</small>
        <h3>0</h3><b>STARTS AFTER GAME 3</b>
      </article>
    </div>

    <div className="mc-impact-grid">
      <article className="mc-change panel baseline-panel">
        <div className="mc-card-head"><div><span>WHAT WENT WRONG LAST GAME</span><h2>{topIssue?topIssue.title:match?'No verified leak cleared the evidence bar.':'Waiting for a tracked game.'}</h2></div><b>{topIssue?'MEASURED':'OBSERVATION'}</b></div>
        <div className="mc-baseline-message">
          <strong>{match?match.champion+' · '+match.kills+'/'+match.deaths+'/'+match.assists:'NO MATCH YET'}</strong>
          <p>{topIssue?'This is a real single-game read. Long-term DNA and persistent missions still wait for three games in this role so one unusual match cannot become your identity.':'OP CLIMB will not invent a mistake when the evidence is not strong enough.'}</p>
        </div>
        <div className="mc-strength-list">
          {issues.map(issue=><div key={issue.key}>
            <i>!</i><div><span>{issue.clock?issue.clock+' · ':''}{issue.score}</span><b>{issue.title}</b><small>{issue.detail}</small></div><em>REVIEW</em>
          </div>)}
          {!issues.length&&match&&<p className="muted">Open the detailed review for the full recorded timeline. This match did not produce a reliable negative signal strong enough to headline here.</p>}
        </div>
        <div className="mc-baseline-steps">
          {[0,1,2].map(index=><div key={index} className={index<safeGames?'done':index===safeGames?'current':''}>
            <i>{index<safeGames?'✓':index+1}</i><span>ROLE GAME {index+1}</span><small>{index<safeGames?'OBSERVED':index===safeGames?'NEXT':'WAITING'}</small>
          </div>)}
        </div>
      </article>

      <article className="mc-mission panel baseline-panel">
        <div className="mc-card-head"><div><span>YOUR NEXT GAME FOCUS</span><h2>{topIssue?topIssue.title:'Play normally.'}</h2></div><b>{safeGames}/{required} ROLE GAMES</b></div>
        <p className="mc-mission-rule">{topIssue?topIssue.action:'Keep playing normally until OP CLIMB has enough role-specific evidence to set a persistent challenge.'}</p>
        <div className="mc-how-pass"><span>PROVISIONAL · SINGLE-GAME COACHING</span><b>This gives you something useful to work on now. It does not move Game DNA or become a long-term pattern until the role baseline is complete.</b></div>
        <Link className="btn primary" href="/live" style={{marginTop:14}}>TRACK NEXT ROLE GAME →</Link>
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
        <div className="mc-card-head"><div><span>WHAT YOU DID WELL · MEASURED</span><h2>{strengths.length?'Keep these behaviours.':'Still observing.'}</h2></div><b>{strengths.length?strengths.length+' VERIFIED':'BUILDING'}</b></div>
        <div className="mc-strength-list">
          {strengths.slice(0,3).map(item=><div key={item.id} style={styleFor(item.dnaDomain)}>
            <i>✓</i><div><span>{dnaDomainLabel(item.dnaDomain)} → {item.subskill}</span><b>{item.title}</b><small>{item.whatHappened}</small></div><em>VERIFIED</em>
          </div>)}
          {!strengths.length&&<div className="mc-baseline-message"><strong>NO VERIFIED STRENGTH YET</strong><p>The match is still reviewable; OP CLIMB simply did not find a positive behaviour strong enough to label as verified.</p></div>}
        </div>
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

type BaselineIssue={key:string;title:string;detail:string;score:string;clock:string;action:string};

function baselineIssues(match?:Match):BaselineIssue[]{
  const analysis=match?.proAnalysis;
  if(!analysis)return[];
  const severityRank:Record<string,number>={CRITICAL:0,MAJOR:1,ACTIVE:2,POLISH:3};
  const out:BaselineIssue[]=[];
  const leaks=[...(analysis.leakSignals??[])]
    .filter(leak=>Number(leak.count)>0)
    .sort((a,b)=>(severityRank[a.severity]??9)-(severityRank[b.severity]??9)||Number(b.count)-Number(a.count));
  for(const leak of leaks){
    const sec=leak.evidenceSeconds?.find(value=>Number.isFinite(value));
    out.push({
      key:'leak-'+leak.key,
      title:leak.label,
      detail:leak.detail,
      score:leak.count+'× observed',
      clock:typeof sec==='number'?clock(sec):'',
      action:baselineAction(leak.key,leak.label),
    });
    if(out.length>=3)return out;
  }
  const metrics=Object.values(analysis.metrics??{})
    .filter((metric):metric is NonNullable<typeof metric>=>Boolean(metric&&typeof metric.score==='number'&&(metric.status==='MEASURED'||metric.status==='DERIVED')&&metric.score<85))
    .sort((a,b)=>(a.score??100)-(b.score??100));
  for(const metric of metrics){
    if(out.some(item=>item.title===metric.label))continue;
    const sec=metric.evidence?.find(item=>typeof item?.atSeconds==='number')?.atSeconds;
    const detail=metric.evidence?.[0]?.detail||metric.summary;
    out.push({
      key:'metric-'+metric.key,
      title:metric.label,
      detail,
      score:Math.round(metric.score??0)+'/100',
      clock:typeof sec==='number'?clock(sec):'',
      action:baselineAction(metric.key,metric.label),
    });
    if(out.length>=3)break;
  }
  return out;
}

function baselineAction(key:string,label:string){
  const value=(key+' '+label).toLowerCase();
  if(value.includes('lead')||value.includes('thrown'))return 'When you are ahead, protect the advantage first: wait for the main enemy threat to be committed or covered before you extend for the next fight.';
  if(value.includes('chain')||value.includes('recovery'))return 'After a death, rebuild one safe resource cycle before re-entering another fight. Do not turn one mistake into two.';
  if(value.includes('reset')||value.includes('unspent')||value.includes('resource'))return 'Spend your gold before the next voluntary fight or objective window. Do not carry earned power in your pocket.';
  if(value.includes('objective'))return 'Reset early enough to arrive alive, healthy and spent before the objective setup begins.';
  if(value.includes('fight')||value.includes('red'))return 'Before committing, check numbers, visible level/item state and the main enemy engage threat. If the state is already bad, do not enter it.';
  if(value.includes('farm')||value.includes('cs'))return 'After each recall, identify the safest high-value wave before grouping so your income does not collapse after lane.';
  return 'Use the detailed-review timestamp as your recognition trigger next game: spot the same situation earlier and choose the safer repeatable decision.';
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