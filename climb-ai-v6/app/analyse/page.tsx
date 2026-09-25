'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {analyseMatch} from '@/lib/engine';
import {buildReview} from '@/lib/review';
import type {Match} from '@/lib/types';

const CHAMPION_ASSET_IDS:Record<string,string>={
  Wukong:'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',"K'Sante":'KSante',"Cho'Gath":'Chogath',"Kai'Sa":'Kaisa',"Vel'Koz":'Velkoz',LeBlanc:'Leblanc',"Bel'Veth":'Belveth',"Rek'Sai":'RekSai',"Kog'Maw":'KogMaw','Dr. Mundo':'DrMundo','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Jarvan IV':'JarvanIV','Lee Sin':'LeeSin','Aurelion Sol':'AurelionSol','Twisted Fate':'TwistedFate','Tahm Kench':'TahmKench','Xin Zhao':'XinZhao'
};
const championAsset=(name:string)=>CHAMPION_ASSET_IDS[name]||name.replace(/[^A-Za-z0-9]/g,'');
const championSplash=(name:string)=>`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championAsset(name)}_0.jpg`;
const avg=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0;
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
const issueLabel=(value:string)=>value.replaceAll('_',' ');

type ReviewPreview={
  report:ReturnType<typeof analyseMatch>;
  review:ReturnType<typeof buildReview>;
};

export default function AnalyseHub(){
  const {active}=useAccount();
  const matches=matchesFor(active.id);
  const [roleFilter,setRoleFilter]=useState('ALL');
  const [championFilter,setChampionFilter]=useState('ALL');
  const [visibleCount,setVisibleCount]=useState(10);

  const roles=useMemo(()=>['ALL',...Array.from(new Set(matches.map(match=>match.role)))],[matches]);
  const champions=useMemo(()=>['ALL',...Array.from(new Set(matches.map(match=>match.champion)))],[matches]);
  const filtered=useMemo(()=>matches.filter(match=>
    (roleFilter==='ALL'||match.role===roleFilter)&&
    (championFilter==='ALL'||match.champion===championFilter)
  ),[matches,roleFilter,championFilter]);

  useEffect(()=>setVisibleCount(10),[roleFilter,championFilter]);

  const previews=useMemo(()=>{
    const map=new Map<string,ReviewPreview>();
    for(let index=0;index<filtered.length;index++){
      const match=filtered[index];
      const older=filtered.slice(index+1,index+6);
      const report=analyseMatch(match,older);
      map.set(match.id,{report,review:buildReview(match,report)});
    }
    return map;
  },[filtered]);

  const recent=filtered.slice(0,5);
  const previous=filtered.slice(5,10);
  const latest=filtered[0];
  const latestPreview=latest?previews.get(latest.id):undefined;
  const winRate=recent.length?Math.round(recent.filter(match=>match.result==='WIN').length/recent.length*100):0;
  const previousWinRate=previous.length?Math.round(previous.filter(match=>match.result==='WIN').length/previous.length*100):0;
  const cs=avg(recent.map(match=>match.metrics.csPerMin));
  const prevCs=avg(previous.map(match=>match.metrics.csPerMin));
  const deaths=avg(recent.map(match=>match.deaths));
  const prevDeaths=avg(previous.map(match=>match.deaths));
  const cleanEarly=recent.filter(match=>match.metrics.deathsPre10===0).length;
  const shown=filtered.slice(0,visibleCount);

  return <AppShell>
    <section className="ar-toolbar">
      <div>
        <div className="eyebrow">POST-GAME REVIEW</div>
        <h1>Find the decision worth fixing.</h1>
      </div>
      <Link href="/uploads" className="btn secondary">ADD A GAME</Link>
    </section>

    {!latest?<section className="ar-empty">
      <div className="eyebrow">NO MATCHES YET</div>
      <h2>Your first review starts with one tracked game.</h2>
      <p>Connect the Companion or add a match. OP CLIMB will turn the evidence into one clear review and a next-game target.</p>
      <div><Link className="btn primary" href="/live">CONNECT COMPANION</Link><Link className="btn secondary" href="/uploads">ADD A GAME</Link></div>
    </section>:<>
      <section className="ar-latest">
        <img className="ar-latest-art" src={championSplash(latest.champion)} alt="" aria-hidden="true"/>
        <div className="ar-latest-shade"/>
        <div className="ar-latest-content">
          <div className="ar-latest-top">
            <span className={latest.result==='WIN'?'win':'loss'}>{latest.result==='WIN'?'VICTORY':'DEFEAT'}</span>
            <small>{latest.role} · {latest.rank} · {clock(latest.durationSeconds)}</small>
          </div>
          <div className="ar-latest-main">
            <div>
              <div className="eyebrow">LATEST REVIEW READY</div>
              <h2>{latest.champion}{latest.opponent?' vs '+latest.opponent:''}</h2>
              <p>{latestPreview?.review.headline||'Your latest game is ready to review.'}</p>
            </div>
            <div className="ar-latest-kda">
              <span>K / D / A</span>
              <b>{latest.kills}<i>/</i>{latest.deaths}<i>/</i>{latest.assists}</b>
            </div>
          </div>
          <div className="ar-latest-bottom">
            <div className="ar-focus-preview">
              <span>REVIEW FOCUS</span>
              <b>{latestPreview?issueLabel(latestPreview.report.primary.category):'MATCH EVIDENCE'}</b>
              <small>{latestPreview?.review.biggestMistake.title||'Open the game to see the coaching read.'}</small>
            </div>
            <Link className="btn primary" href={'/analyse/'+encodeURIComponent(latest.id)}>REVIEW THIS GAME →</Link>
          </div>
        </div>
      </section>

      <section className="ar-trend-strip">
        <TrendCard label="LAST 5" value={recent.length?winRate+'%':'—'} sub="win rate" delta={previous.length?winRate-previousWinRate:null}/>
        <TrendCard label="CS / MIN" value={recent.length?cs.toFixed(1):'—'} sub="last 5 average" delta={previous.length?cs-prevCs:null}/>
        <TrendCard label="DEATHS" value={recent.length?deaths.toFixed(1):'—'} sub="last 5 average" delta={previous.length?prevDeaths-deaths:null}/>
        <TrendCard label="CLEAN EARLY GAMES" value={recent.length?`${cleanEarly}/${recent.length}`:'—'} sub="0 deaths before 10" delta={null}/>
      </section>

      <section className="ar-controls">
        <div className="ar-role-filter">
          <span>ROLE</span>
          <div>{roles.map(role=><button key={role} type="button" className={roleFilter===role?'active':''} onClick={()=>setRoleFilter(role)}>{role}</button>)}</div>
        </div>
        <label className="ar-champ-filter"><span>CHAMPION</span><select value={championFilter} onChange={event=>setChampionFilter(event.target.value)}>{champions.map(champion=><option key={champion}>{champion}</option>)}</select></label>
        {(roleFilter!=='ALL'||championFilter!=='ALL')&&<button className="ar-clear" type="button" onClick={()=>{setRoleFilter('ALL');setChampionFilter('ALL')}}>CLEAR FILTERS</button>}
      </section>

      <section className="ar-queue-head">
        <div><div className="eyebrow">REVIEW QUEUE</div><h2>Your games, without the stat wall.</h2></div>
        <span>{filtered.length} GAME{filtered.length===1?'':'S'}</span>
      </section>

      <div className="ar-game-list">
        {shown.map((match,index)=><ReviewRow
          key={match.id}
          match={match}
          preview={previews.get(match.id)}
          latest={index===0}
        />)}
      </div>

      {visibleCount<filtered.length&&<div className="ar-more"><button className="btn secondary" type="button" onClick={()=>setVisibleCount(count=>count+10)}>SHOW 10 MORE</button></div>}
    </>}
  </AppShell>;
}

function TrendCard({label,value,sub,delta}:{label:string;value:string;sub:string;delta:number|null}){
  const meaningful=delta!==null&&Math.abs(delta)>=0.05;
  return <article>
    <span>{label}</span>
    <b>{value}</b>
    <small>{sub}</small>
    {delta!==null&&<em className={meaningful?(delta>0?'up':'down'):''}>{meaningful?(delta>0?'▲ ':'▼ '):'• '}{meaningful?Math.abs(delta).toFixed(Math.abs(delta)<1?1:0):'steady'} vs previous 5</em>}
  </article>;
}

function ReviewRow({match,preview,latest}:{match:Match;preview?:ReviewPreview;latest:boolean}){
  return <Link className="ar-game-row" href={'/analyse/'+encodeURIComponent(match.id)}>
    <div className="ar-row-result">
      <i className={match.result==='WIN'?'win':'loss'}/>
      <div><span>{latest?'LATEST':match.result}</span><b>{match.champion}</b><small>{match.role}{match.opponent?' · vs '+match.opponent:''}</small></div>
    </div>
    <div className="ar-row-kda"><span>KDA</span><b>{match.kills}/{match.deaths}/{match.assists}</b></div>
    <div className="ar-row-metric"><span>CS/MIN</span><b>{match.metrics.csPerMin.toFixed(1)}</b></div>
    <div className="ar-row-focus"><span>REVIEW FOCUS</span><b>{preview?issueLabel(preview.report.primary.category):'MATCH REVIEW'}</b><small>{preview?.review.biggestMistake.title||'Open review'}</small></div>
    <div className="ar-row-arrow">→</div>
  </Link>;
}
