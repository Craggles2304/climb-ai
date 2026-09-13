'use client';
import {useMemo,useState} from 'react';
import {TftShell} from '@/components/TftShell';
import {analyseDecisionReplay,type BoardStrength,type DecisionStage,type StreakState} from '@/lib/tft/advancedCoach';
import type {TftContested} from '@/lib/tft/types';

export default function TftDecisionLab(){
  const [stage,setStage]=useState<DecisionStage>('4-2');
  const [hp,setHp]=useState(46);
  const [gold,setGold]=useState(42);
  const [level,setLevel]=useState(7);
  const [boardStrength,setBoardStrength]=useState<BoardStrength>('WEAK');
  const [streak,setStreak]=useState<StreakState>('LOSS_3_PLUS');
  const [contested,setContested]=useState<TftContested>('LIGHT');
  const [upgradesNeeded,setUpgradesNeeded]=useState(2);
  const result=useMemo(()=>analyseDecisionReplay({stage,hp,gold,level,boardStrength,streak,contested,upgradesNeeded}),[stage,hp,gold,level,boardStrength,streak,contested,upgradesNeeded]);

  return <TftShell><main className="container section">
    <div className="eyebrow">POST-GAME / PRACTICE TOOL</div><h1>DECISION REPLAY LAB</h1><p className="muted" style={{maxWidth:820}}>Rebuild a past decision point and test the principle behind it. This is a retrospective training simulator—not a live game assistant. It never reads your current match or changes recommendations from live board actions.</p>

    <section style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(300px,.8fr)',gap:16,marginTop:20}}>
      <div className="glass card">
        <div className="eyebrow">RECONSTRUCT THE MOMENT</div><h2>WHAT DID THE BOARD STATE LOOK LIKE?</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginTop:14}}>
          <label><span className="eyebrow">STAGE</span><select value={stage} onChange={e=>setStage(e.target.value as DecisionStage)}>{['2-1','2-5','3-2','3-5','4-1','4-2','4-5','5-1+'].map(x=><option key={x}>{x}</option>)}</select></label>
          <label><span className="eyebrow">HP</span><input type="number" min={1} max={100} value={hp} onChange={e=>setHp(Number(e.target.value)||1)}/></label>
          <label><span className="eyebrow">GOLD</span><input type="number" min={0} max={200} value={gold} onChange={e=>setGold(Number(e.target.value)||0)}/></label>
          <label><span className="eyebrow">LEVEL</span><input type="number" min={3} max={10} value={level} onChange={e=>setLevel(Number(e.target.value)||3)}/></label>
          <label><span className="eyebrow">BOARD STRENGTH</span><select value={boardStrength} onChange={e=>setBoardStrength(e.target.value as BoardStrength)}><option value="WEAK">Weak</option><option value="EVEN">Even</option><option value="STRONG">Strong</option></select></label>
          <label><span className="eyebrow">STREAK</span><select value={streak} onChange={e=>setStreak(e.target.value as StreakState)}><option value="LOSS_3_PLUS">Loss 3+</option><option value="LOSS_1_2">Loss 1–2</option><option value="NONE">No meaningful streak</option><option value="WIN_1_2">Win 1–2</option><option value="WIN_3_PLUS">Win 3+</option></select></label>
          <label><span className="eyebrow">CONTESTED?</span><select value={contested} onChange={e=>setContested(e.target.value as TftContested)}><option value="NONE">No</option><option value="LIGHT">Light / 1 player</option><option value="HEAVY">Heavy / 2+ players</option><option value="UNKNOWN">Unknown</option></select></label>
          <label><span className="eyebrow">KEY UPGRADES MISSING</span><input type="number" min={0} max={8} value={upgradesNeeded} onChange={e=>setUpgradesNeeded(Number(e.target.value)||0)}/></label>
        </div>
      </div>

      <div className="glass card">
        <div className="eyebrow">REPLAY VERDICT</div><h1 style={{fontSize:34,marginBottom:8}}>{result.call}</h1>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}><div className="cue-row"><span>URGENCY</span><b>{result.urgency}</b></div><div className="cue-row"><span>RULE CONFIDENCE</span><b>{result.score}%</b></div></div>
        <div style={{marginTop:14,display:'grid',gap:8}}>{result.reasons.map((reason,i)=><div key={i} style={{padding:'10px 12px',border:'1px solid rgba(255,255,255,.08)',borderRadius:10}}><b>{i+1}.</b> {reason}</div>)}</div>
        <div style={{marginTop:14,padding:14,border:'1px solid rgba(255,255,255,.12)',borderRadius:12}}><div className="eyebrow">COACH CHECKPOINT</div><b>{result.checkpoint}</b></div>
      </div>
    </section>

    <section className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">HOW TO USE THIS</div><h2>REPLAY THE DECISION, NOT THE RESULT.</h2>
      <p className="muted">A #2 can still contain a bad roll-down and a #7 can contain the correct decision with poor shops. Use the state that existed before the outcome was known, then compare the simulator principle with what you actually did. Add the result to Decision Review in your next match log so the long-term coach can detect repetition.</p>
    </section>
  </main></TftShell>;
}
