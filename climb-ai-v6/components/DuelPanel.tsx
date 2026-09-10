'use client';
import type {DuelResult,DuelVerdict} from '@/lib/combat/duel';

const COPY:Record<DuelVerdict,{title:string;detail:string;tone:string}>={
  YOU_KILL:{title:'YOU WIN THE DUEL',detail:'Your script reaches lethal first on the shared combat clock.',tone:'edge-you'},
  THEM_KILL:{title:'THEY WIN THE DUEL',detail:'Their response reaches lethal before your script finishes.',tone:'edge-them'},
  DOUBLE_KO:{title:'DOUBLE KO',detail:'Both lethal actions began on the same timestamp and both resolve.',tone:'edge-even'},
  YOU_AHEAD:{title:'YOU FINISH AHEAD',detail:'No lethal inside the selected window, but you retain more effective health.',tone:'edge-you'},
  THEM_AHEAD:{title:'THEY FINISH AHEAD',detail:'No lethal inside the selected window, but they retain more effective health.',tone:'edge-them'},
  EVEN:{title:'DUEL IS CLOSE',detail:'Neither side creates a meaningful effective-health edge in this script.',tone:'edge-even'},
};

export function DuelPanel({result,you,them}:{result:DuelResult;you:string;them:string}){
  const copy=COPY[result.verdict];
  return <div className="glass card" style={{marginTop:16}}>
    <div className="section-row" style={{gap:14,alignItems:'flex-start'}}>
      <div>
        <div className="eyebrow">SIMULTANEOUS DUEL · SHARED CLOCK</div>
        <h2 style={{margin:'6px 0 4px'}}>{copy.title}</h2>
        <p className="muted" style={{margin:0,fontSize:12}}>{copy.detail}</p>
      </div>
      <div className={`tag-chip ${copy.tone}`}>{result.durationSeconds}s · {result.stopReason.replaceAll('_',' ')}</div>
    </div>

    <div className="lab-grid" style={{marginTop:14}}>
      <HealthCard label="YOU" champion={you} health={result.you.health} maxHealth={result.you.maxHealth} shield={result.you.shield} damage={result.you.damageDealt}/>
      <HealthCard label="ENEMY" champion={them} health={result.them.health} maxHealth={result.them.maxHealth} shield={result.them.shield} damage={result.them.damageDealt}/>
    </div>

    {result.incomplete&&<p className="lab-floor" style={{marginTop:12}}>PARTIAL: at least one damage component in the shared duel is not yet deterministic, so do not treat the margin as exact.</p>}

    <div style={{overflowX:'auto',marginTop:14}}>
      <table className="table">
        <thead><tr><th>At</th><th>Action</th><th>Damage</th><th>Your state</th><th>Enemy state</th></tr></thead>
        <tbody>{result.timeline.map((frame,index)=><tr key={`${frame.atSeconds}-${index}`}>
          <td>{frame.atSeconds}s</td>
          <td style={{textAlign:'left'}}>{frame.actions.map(action=><div key={`${action.side}-${action.step}-${action.label}`} style={{marginBottom:action===frame.actions[frame.actions.length-1]?0:5}}>
            <b>{action.side==='YOU'?'YOU':'THEM'} · {action.step}</b> <span className="muted">{action.label}</span>
            {action.status!=='CAST'&&<span className="lab-floor" style={{marginLeft:6}}>{action.status.replaceAll('_',' ')}</span>}
            {action.shieldGranted>0&&<span className="tag-chip" style={{marginLeft:6}}>+{action.shieldGranted} shield</span>}
            {action.healApplied>0&&<span className="tag-chip" style={{marginLeft:6}}>+{action.healApplied} heal</span>}
            {action.controlAppliedSeconds>0&&<span className="tag-chip" style={{marginLeft:6}}>{action.controlAppliedSeconds}s CC</span>}
          </div>)}</td>
          <td>{frame.actions.map(action=><div key={`${action.side}-${action.step}-dmg`}>{action.side==='YOU'?'→':'←'} {action.damageApplied||'—'}</div>)}</td>
          <td>{frame.you.health} HP{frame.you.shield>0?` + ${frame.you.shield} shield`:''}</td>
          <td>{frame.them.health} HP{frame.them.shield>0?` + ${frame.them.shield} shield`:''}</td>
        </tr>)}</tbody>
      </table>
    </div>

    <div className="build-summary" style={{marginTop:12}}>
      <span>{you}: <b>{result.you.damageDealt}</b> dealt</span>
      <span>{them}: <b>{result.them.damageDealt}</b> dealt</span>
      {result.you.shieldDamageAbsorbed>0&&<span>Your shields absorbed <b>{result.you.shieldDamageAbsorbed}</b></span>}
      {result.them.shieldDamageAbsorbed>0&&<span>Their shields absorbed <b>{result.them.shieldDamageAbsorbed}</b></span>}
    </div>

    {result.blocked.length>0&&<p className="muted" style={{fontSize:11,margin:'10px 0 0'}}>Blocked script steps: {result.blocked.map(x=>`${x.side} ${x.step} — ${x.reason}`).join(' · ')}</p>}
    <p className="muted" style={{fontSize:10,lineHeight:1.45,margin:'10px 0 0'}}>{result.modelNote}</p>
  </div>;
}

function HealthCard({label,champion,health,maxHealth,shield,damage}:{label:string;champion:string;health:number;maxHealth:number;shield:number;damage:number}){
  const pct=Math.max(0,Math.min(100,maxHealth>0?health/maxHealth*100:0));
  return <div style={{padding:13,border:'1px solid var(--border)',borderRadius:14,background:'rgba(255,255,255,.02)'}}>
    <div className="section-row"><div><div className="eyebrow">{label}</div><b>{champion}</b></div><strong>{health} / {maxHealth}</strong></div>
    <div style={{height:8,borderRadius:999,background:'rgba(255,255,255,.08)',overflow:'hidden',marginTop:10}}><div style={{height:'100%',width:`${pct}%`,background:'var(--accent)'}}/></div>
    <div className="build-summary" style={{marginTop:9}}><span>{pct.toFixed(1)}% HP</span>{shield>0&&<span>Shield <b>{shield}</b></span>}<span>Damage <b>{damage}</b></span></div>
  </div>;
}