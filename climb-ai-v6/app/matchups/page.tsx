'use client';
import {useEffect,useState} from 'react';
import {AppShell} from '@/components/AppShell';
import {PageHead} from '@/components/UI';
import type {MatchupRead,Edge} from '@/lib/champions/matchup';
import type {ChampionProfile} from '@/lib/champions/profile';

/**
 * The matchup page used to show three hard-coded lines ("Respect early
 * all-in") regardless of which champions were typed in. Everything here now
 * comes from Riot's static champion data via /api/champions, and anything that
 * data cannot answer is listed rather than filled in with a guess.
 */

type Payload={
  ok:boolean;error?:string;patch?:string;
  profile?:ChampionProfile;matchup?:MatchupRead|null;names?:string[];
};

const EDGE_LABEL:Record<Edge,string>={YOU:'YOU',THEM:'THEM',EVEN:'EVEN'};

function EdgeTag({edge}:{edge:Edge}){
  return <span className={`edge-tag edge-${edge.toLowerCase()}`}>{EDGE_LABEL[edge]}</span>;
}

export default function Matchups(){
  const [mine,setMine]=useState("Kog'Maw");
  const [opp,setOpp]=useState('Draven');
  const [level,setLevel]=useState(6);
  const [data,setData]=useState<Payload|null>(null);
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    // Debounced so typing a champion name does not fire a request per keystroke.
    const id=setTimeout(async()=>{
      setLoading(true);
      try{
        const params=new URLSearchParams({champion:mine,opponent:opp,level:String(level)});
        const res=await fetch(`/api/champions?${params}`);
        setData(await res.json());
      }catch{
        setData({ok:false,error:'Could not reach champion data. Check your connection.'});
      }finally{setLoading(false)}
    },400);
    return ()=>clearTimeout(id);
  },[mine,opp,level]);

  const m=data?.matchup;

  return <AppShell>
    <PageHead
      title="Matchup Assistant"
      subtitle="What the two champions can actually do to each other, measured from Riot's own champion data."/>

    <div className="glass card form">
      <div className="field"><label>My champion</label>
        <input className="input" value={mine} onChange={e=>setMine(e.target.value)} list="champion-names"/></div>
      <div className="field"><label>Opponent</label>
        <input className="input" value={opp} onChange={e=>setOpp(e.target.value)} list="champion-names"/></div>
      <div className="field"><label>Level</label>
        <select className="input" value={level} onChange={e=>setLevel(Number(e.target.value))}>
          {[1,2,3,6,9,11,16,18].map(l=><option key={l} value={l}>Level {l}</option>)}
        </select></div>
      <datalist id="champion-names">
        {(data?.names??[]).map(n=><option key={n} value={n}/>)}
      </datalist>
    </div>

    {loading&&!m&&<div className="glass card" style={{marginTop:18}}><p className="muted">Reading champion data…</p></div>}

    {data&&!data.ok&&
      <div className="glass card" style={{marginTop:18}}>
        <h2>Could not read that matchup.</h2>
        <p className="muted">{data.error}</p>
      </div>}

    {m&&<>
      <div className="glass card" style={{marginTop:18}}>
        <div className="eyebrow">{m.you.name.toUpperCase()} VS {m.them.name.toUpperCase()} · LEVEL {m.level}</div>
        <h2>Measured differences</h2>
        <div className="matchup-facts">
          {m.facts.map(f=>
            <div key={f.key} className="matchup-fact">
              <div className="matchup-fact-head">
                <span className="label">{f.label}</span><EdgeTag edge={f.edge}/>
              </div>
              <div className="matchup-fact-values">
                <span><b>{m.you.name}</b> {f.you}</span>
                <span><b>{m.them.name}</b> {f.them}</span>
              </div>
              {f.note&&<p className="muted">{f.note}</p>}
            </div>)}
        </div>
      </div>

      {m.howToPlayIt.length>0&&
        <div className="glass card" style={{marginTop:18}}>
          <div className="eyebrow">HOW TO PLAY IT</div>
          <ol className="matchup-plan">{m.howToPlayIt.map((x,i)=>
            <li key={x}><span>0{i+1}</span><p>{x}</p></li>)}</ol>
        </div>}

      {m.riotSaysAboutThem.length>0&&
        <div className="glass card" style={{marginTop:18}}>
          <div className="eyebrow">RIOT&rsquo;S OWN ADVICE ON {m.them.name.toUpperCase()}</div>
          <ul className="riot-tips">{m.riotSaysAboutThem.map(t=><li key={t}>{t}</li>)}</ul>
          <p className="muted">Published by Riot Games as part of {m.them.name}&rsquo;s champion data, quoted unchanged.</p>
        </div>}

      <div className="glass card data-note" style={{marginTop:18}}>
        <div className="eyebrow">WHAT THIS IS NOT</div>
        <p className="muted">{m.caveat}</p>
        <ul className="riot-tips">{m.unavailable.map(u=><li key={u}>{u}</li>)}</ul>
        {data?.patch&&<p className="muted">Champion data from patch {data.patch}.</p>}
      </div>
    </>}
  </AppShell>;
}
