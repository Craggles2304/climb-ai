'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {AppShell} from '@/components/AppShell';
import {useAccount,matchesFor} from '@/components/AccountContext';
import {useSubscription} from '@/components/SubscriptionContext';
import {filterHistoryForTier,historyWindowLabel} from '@/lib/subscription';
import {analyseMatch} from '@/lib/engine';
import {buildReview} from '@/lib/review';
import type {Match,Role} from '@/lib/types';
import {canonicalLeagueRole} from '@/lib/roleAwareLearning';

const CHAMPION_ASSET_IDS:Record<string,string>={
  Wukong:'MonkeyKing','Nunu & Willump':'Nunu','Renata Glasc':'Renata',"K'Sante":'KSante',"Cho'Gath":'Chogath',"Kai'Sa":'Kaisa',"Vel'Koz":'Velkoz',LeBlanc:'Leblanc',"Bel'Veth":'Belveth',"Rek'Sai":'RekSai',"Kog'Maw":'KogMaw','Dr. Mundo':'DrMundo','Master Yi':'MasterYi','Miss Fortune':'MissFortune','Jarvan IV':'JarvanIV','Lee Sin':'LeeSin','Aurelion Sol':'AurelionSol','Twisted Fate':'TwistedFate','Tahm Kench':'TahmKench','Xin Zhao':'XinZhao'
};
const championAsset=(name:string)=>CHAMPION_ASSET_IDS[name]||name.replace(/[^A-Za-z0-9]/g,'');
const championSplash=(name:string)=>`https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${championAsset(name)}_0.jpg`;
const clock=(seconds:number)=>`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
const clean=(value:string)=>value.replaceAll('_',' ');
const ROLE_ORDER:Role[]=['TOP','JUNGLE','MID','ADC','SUPPORT'];

type Preview={report:ReturnType<typeof analyseMatch>;review:ReturnType<typeof buildReview>};

export default function MyGames(){
  const {active}=useAccount();
  const {tier}=useSubscription();
  const matches=useMemo(()=>filterHistoryForTier(matchesFor(active.id),tier),[active.id,tier]);
  const [role,setRole]=useState<'ALL'|Role>('ALL');
  const [champion,setChampion]=useState('ALL');
  const [visible,setVisible]=useState(10);

  const champions=useMemo(()=>['ALL',...Array.from(new Set(matches.filter(m=>role==='ALL'||canonicalLeagueRole(m.role)===role).map(m=>m.champion)))],[matches,role]);
  const filtered=useMemo(()=>matches.filter(m=>(role==='ALL'||canonicalLeagueRole(m.role)===role)&&(champion==='ALL'||m.champion===champion)),[matches,role,champion]);
  useEffect(()=>{setVisible(10);if(champion!=='ALL'&&!champions.includes(champion))setChampion('ALL')},[role,champion,champions]);

  const previews=useMemo(()=>{
    const map=new Map<string,Preview>();
    for(const currentRole of ROLE_ORDER){
      const roleMatches=matches.filter(match=>canonicalLeagueRole(match.role)===currentRole);
      roleMatches.forEach((match,index)=>{
        const report=analyseMatch(match,roleMatches.slice(index+1,index+6));
        map.set(match.id,{report,review:buildReview(match,report)});
      });
    }
    return map;
  },[matches]);

  const latest=filtered[0]??matches[0];
  const latestPreview=latest?previews.get(latest.id):undefined;

  return <AppShell>
    <header className="page-head">
      <div>
        <div className="eyebrow">MY GAMES · REVIEW</div>
        <h1>Every game has a lesson.</h1>
        <p>What happened → why it happened → what you carry into the next game. <span className="history-window-tag">{historyWindowLabel(tier)}</span></p>
      </div>
      <Link className="btn btn-small" href="/uploads">Add a game</Link>
    </header>

    {!latest?<section className="panel panel-padding">
      <div className="eyebrow">NO MATCHES YET</div>
      <h2 style={{margin:'10px 0'}}>Your first review starts with one tracked game.</h2>
      <p className="muted">Connect the Companion or add a match. OP CLIMB will turn it into one clear lesson and one next-game rule.</p>
      <div className="mission-actions" style={{marginTop:18}}><Link className="btn primary" href="/live">Open Match Room →</Link><Link className="btn" href="/uploads">Add a game</Link></div>
    </section>:<>
      <section className="mission games-latest">
        <img className="mission-art" src={championSplash(latest.champion)} alt="" aria-hidden="true"/>
        <div className="mission-copy">
          <div className="eyebrow">{latest.result==='WIN'?'VICTORY':'DEFEAT'} · {latest.role} · {clock(latest.durationSeconds)}</div>
          <h2>{latest.champion}<br/><em>{latestPreview?.review.headline||'Review ready.'}</em></h2>
          <p><strong>KDA · {latest.kills}/{latest.deaths}/{latest.assists}</strong><br/>{latestPreview?.review.biggestMistake.title||'Open the review to see the decision that mattered.'}</p>
          <div className="mission-actions"><Link className="btn primary" href={'/analyse/'+encodeURIComponent(latest.id)}>Open latest review →</Link></div>
        </div>
      </section>

      <section className="games-history-head">
        <div><div className="eyebrow">REVIEW HISTORY</div><h2>Your games, in coaching order.</h2></div>
        <details className="games-filter">
          <summary>FILTER GAMES</summary>
          <div>
            <label><span>ROLE</span><select value={role} onChange={e=>setRole(e.target.value as 'ALL'|Role)}><option value="ALL">All roles</option>{ROLE_ORDER.map(r=><option key={r} value={r}>{r}</option>)}</select></label>
            <label><span>CHAMPION</span><select value={champion} onChange={e=>setChampion(e.target.value)}>{champions.map(name=><option key={name} value={name}>{name==='ALL'?'All champions':name}</option>)}</select></label>
          </div>
        </details>
      </section>

      <div className="games-review-grid">
        {filtered.slice(0,visible).map(match=><GameCard key={match.id} match={match} preview={previews.get(match.id)}/>)}
      </div>

      {visible<filtered.length&&<div className="games-more"><button className="btn" onClick={()=>setVisible(v=>v+10)}>Show 10 more</button></div>}
    </>}
  </AppShell>;
}

function GameCard({match,preview}:{match:Match;preview?:Preview}){
  const review=preview?.review;
  return <Link className="panel games-review-card" href={'/analyse/'+encodeURIComponent(match.id)}>
    <div className="games-card-art"><img src={championSplash(match.champion)} alt="" aria-hidden="true"/><span className={match.result==='WIN'?'win':'loss'}>{match.result}</span></div>
    <div className="games-card-body">
      <div className="games-card-top"><div><strong>{match.champion}</strong><small>{match.role} · {match.rank}</small></div><b>{match.kills}/{match.deaths}/{match.assists}</b></div>
      <div className="games-story">
        <div><span>WHAT HAPPENED</span><p>{review?.headline||'Match review ready.'}</p></div>
        <div><span>WHY IT MATTERS</span><p>{review?.biggestMistake.title||clean(preview?.report.primary.category||'MATCH EVIDENCE')}</p></div>
        <div><span>TAKE INTO NEXT GAME</span><p>{review?.mission.rule||'Open the review for one clear next-game rule.'}</p></div>
      </div>
      <span className="games-open">OPEN REVIEW →</span>
    </div>
  </Link>;
}
