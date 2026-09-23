'use client';

import {useEffect,useMemo,useState} from 'react';
import type {ClimbCareerExperience,CareerSkillNode,CareerMilestone} from '@/lib/climbCareerExperience';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const GROUPS:Array<{key:CareerSkillNode['group'];label:string;copy:string}>=[
  {key:'DECISION_FOUNDATIONS',label:'01 · DECISION FOUNDATIONS',copy:'The core decisions that stop avoidable losses and create a stable base.'},
  {key:'CONVERSION_AND_TIMING',label:'02 · CONVERSION & TIMING',copy:'Turn advantages, gold and map windows into useful pressure.'},
  {key:'CARRY_OWNERSHIP',label:'03 · CARRY OWNERSHIP',copy:'Preserve your value when the game asks you to be the win condition.'},
];

function pretty(value:string){return value.replaceAll('_',' ').toLowerCase().replace(/(^|\s)\S/g,s=>s.toUpperCase())}
function shortDate(value:string){const d=new Date(value);return Number.isNaN(d.getTime())?'':d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})}

function SkillNode({skill}:{skill:CareerSkillNode}){
  return <article className={`career3-skill ${skill.state.toLowerCase()}`}>
    <div className="career3-skill-top">
      <span>{skill.phase==='UNSEEN'?'EVIDENCE':skill.phase.replaceAll('_',' ')}</span>
      <b>{skill.state}</b>
    </div>
    <h4>{skill.label}</h4>
    <p>{skill.reason}</p>
    <div className="career3-path"><i style={{width:`${skill.pathPosition}%`}}/></div>
    <div className="career3-skill-foot">
      <span>{skill.pathPosition}% PATH</span>
      {skill.prerequisiteLabel&&<span>REQ · {skill.prerequisiteLabel}</span>}
    </div>
    {skill.gameRule&&['ACTIVE','REOPENED'].includes(skill.state)&&<div className="career3-rule">{skill.gameRule}</div>}
  </article>;
}

function Milestone({item}:{item:CareerMilestone}){
  return <article className={`career3-milestone ${item.tone.toLowerCase()}`}>
    <div className="career3-milestone-pin"><i/></div>
    <div>
      <div className="career3-milestone-top"><span>{item.label}</span><small>GAME {item.gameNumber} · {shortDate(item.at)}</small></div>
      <h4>{item.title}</h4>
      <p>{item.detail}</p>
    </div>
  </article>;
}

export function CareerDevelopmentMap({accountId}:{accountId:string}){
  const [career,setCareer]=useState<ClimbCareerExperience|null>(null);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const valid=UUID.test(accountId);

  useEffect(()=>{
    let cancelled=false;
    if(!valid){setCareer(null);setError('');return}
    setLoading(true);setError('');
    fetch(`/api/career-experience?accountId=${encodeURIComponent(accountId)}`,{cache:'no-store'})
      .then(async response=>{
        const body=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(body?.error||'Could not load Development Career.');
        return body;
      })
      .then(body=>{if(!cancelled)setCareer(body?.career??null)})
      .catch(err=>{if(!cancelled)setError(err instanceof Error?err.message:'Could not load Development Career.')})
      .finally(()=>{if(!cancelled)setLoading(false)});
    return()=>{cancelled=true};
  },[accountId,valid]);

  const groups=useMemo(()=>GROUPS.map(group=>({
    ...group,
    skills:career?.skills.filter(skill=>skill.group===group.key)??[],
  })),[career]);

  if(!valid)return null;

  return <section className="career3-shell">
    <div className="career3-head">
      <div>
        <div className="eyebrow">PLAYER DEVELOPMENT CAREER · STAGE 3</div>
        <h2>Your League career, as a learning path.</h2>
        <p className="muted">One map for what you own, what you are learning now, what comes next and what still has to be unlocked.</p>
      </div>
      {career&&<div className="career3-stage"><span>DEVELOPMENT STAGE</span><b>{pretty(career.developmentStage)}</b><small>{career.gamesAnalyzed} games modelled</small></div>}
    </div>

    {loading&&<div className="glass card career3-empty">BUILDING YOUR DEVELOPMENT CAREER…</div>}
    {!loading&&error&&<div className="glass card career3-empty">{error}</div>}

    {!loading&&!error&&career&&<>
      <div className="career3-hero glass">
        <div className="career3-hero-copy">
          <span>WHERE YOU ARE NOW</span>
          <h3>{career.headline}</h3>
          <p>{career.activeObjective?.nextTest||career.boundary}</p>
        </div>
        <div className="career3-hero-stats">
          <div><b>{career.summary.owned}</b><span>PRINCIPLES OWNED</span></div>
          <div><b>{career.summary.active+career.summary.reopened}</b><span>ACTIVE CHAPTER</span></div>
          <div><b>{career.summary.ready}</b><span>READY NEXT</span></div>
          <div><b>{career.summary.locked}</b><span>LOCKED</span></div>
        </div>
      </div>

      {career.activeObjective&&<div className="career3-now">
        <div className="career3-now-main glass">
          <div className="career3-now-top"><span>ACTIVE CHAPTER</span><b>{career.activeObjective.phase}</b></div>
          <h3>{career.activeObjective.label}</h3>
          <div className="career3-now-meter">
            <div><i style={{width:`${career.activeObjective.completion??0}%`}}/></div>
            <span>{career.activeObjective.completion===null?'EVIDENCE BUILDING':`${career.activeObjective.completion}% CONTRACT COMPLETE`}</span>
          </div>
          <div className="career3-now-grid">
            <div><span>SUPPORT</span><b>{career.activeObjective.supportPolicy||'BUILDING'}</b></div>
            <div><span>GRADUATE WHEN</span><b>{career.activeObjective.graduationRule}</b></div>
          </div>
        </div>
        <div className="career3-next glass">
          <span>WHAT REPLACES IT</span>
          <h3>{career.activeObjective.replacementLabel||career.nextObjective?.label||'NOT UNLOCKED YET'}</h3>
          <p>{career.nextObjective?.reason||'OP CLIMB will not invent the next objective until the current evidence and prerequisites make it valid.'}</p>
        </div>
      </div>}

      <div className="career3-map">
        {groups.map(group=><section className="career3-group" key={group.key}>
          <div className="career3-group-head">
            <div><span>{group.label}</span><p>{group.copy}</p></div>
            <small>{group.skills.filter(skill=>skill.state==='OWNED').length}/{group.skills.length} owned</small>
          </div>
          <div className="career3-skill-grid">{group.skills.map(skill=><SkillNode key={skill.key} skill={skill}/>)}</div>
        </section>)}
      </div>

      <div className="career3-story-grid">
        <div className="career3-story glass">
          <span>LATEST BREAKTHROUGH</span>
          {career.recentBreakthrough?<><h3>{career.recentBreakthrough.title}</h3><p>{career.recentBreakthrough.detail}</p><small>GAME {career.recentBreakthrough.gameNumber} · {shortDate(career.recentBreakthrough.at)}</small></>:<><h3>NO VERIFIED BREAKTHROUGH YET</h3><p>OP CLIMB is waiting for repeated evidence before claiming one.</p></>}
        </div>
        <div className={`career3-story glass ${career.latestRegression?'danger':''}`}>
          <span>LATEST REGRESSION</span>
          {career.latestRegression?<><h3>{career.latestRegression.title}</h3><p>{career.latestRegression.detail}</p><small>GAME {career.latestRegression.gameNumber} · {shortDate(career.latestRegression.at)}</small></>:<><h3>NO VERIFIED REGRESSION</h3><p>No previously learned pattern has been reopened in the current history window.</p></>}
        </div>
      </div>

      {career.milestones.length>0&&<div className="career3-timeline glass">
        <div className="career3-timeline-head"><div><span>CAREER HISTORY</span><h3>The moments that actually changed your player model.</h3></div><small>{career.summary.milestones} verified milestones</small></div>
        <div className="career3-milestone-list">{career.milestones.slice(0,10).map(item=><Milestone key={item.id} item={item}/>)}</div>
      </div>}

      <div className="career3-boundary">{career.boundary}</div>
    </>}
  </section>;
}
