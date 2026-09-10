'use client';
import type {BestBuild} from '@/lib/champions/build';
import type {SkillOrder} from '@/lib/champions/skillOrder';

/**
 * The highest DPS this champion can reach, and the ability order.
 *
 * The two tables sit together because they answer the same question from
 * opposite ends — what you buy and what you rank — but they do NOT have the
 * same standing. The build is exact arithmetic. The ability order is a
 * cooldown-uptime ordering, because Riot does not publish ability damage, and
 * it says so rather than letting the table imply otherwise.
 */

export function MaxDpsTable({
  champion,level,maxDps,bySize,budget,
}:{
  champion:string;level:number;maxDps:BestBuild;bySize:BestBuild[];budget:number|null;
}){
  if(!maxDps.items.length)
    return <div className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">MAXIMUM DPS</div>
      <p className="muted">
        No item in the catalogue raises {champion}&rsquo;s auto-attack damage
        {budget!==null&&<> within {budget}g</>}.
      </p>
    </div>;

  return <>
    <div className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">MAXIMUM DPS · LEVEL {level}</div>
      <h2>{maxDps.dps} DPS for {maxDps.gold}g</h2>
      <p className="muted">
        The highest auto-attack DPS {champion} can reach with {maxDps.items.length} item
        {maxDps.items.length===1?'':'s'}
        {budget!==null?<> inside a {budget}g budget</>:<>, ignoring what you could actually afford</>}.
        {maxDps.exhaustive
          ?' Every combination was checked.'
          : ` Found by searching ${maxDps.evaluated.toLocaleString()} combinations — a full check of all six-item builds would be about three billion.`}
      </p>
      <div style={{overflowX:'auto',marginTop:14}}>
        <table className="table">
          <thead><tr><th>Buy order</th><th>DPS added</th><th>DPS after</th><th>Spent</th></tr></thead>
          <tbody>{maxDps.steps.map((s,i)=>
            <tr key={s.name}>
              <td>{i+1}. {s.name}</td>
              <td>+{s.gain}</td>
              <td><b>{s.dpsAfter}</b></td>
              <td>{s.goldAfter}g</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>

    <div className="glass card" style={{marginTop:16}}>
      <div className="eyebrow">BEST DPS AT EACH BUILD SIZE</div>
      <h2>How damage scales with each item</h2>
      {/*
        Not "where returns diminish" — for a crit champion they do the opposite.
        Attack damage, crit and attack speed multiply together, so Caitlyn's
        damage per 1000 gold climbs from 42.8 at one item to 68.6 at six. Worth
        saying out loud, because the usual intuition is backwards here.
      */}
      <p className="muted">
        Damage per gold often <i>rises</i> with each item rather than falling: attack damage,
        crit and attack speed multiply together, so each one makes the others worth more.
      </p>
      <div style={{overflowX:'auto',marginTop:14}}>
        <table className="table">
          <thead><tr><th>Items</th><th>DPS</th><th>Gold</th><th>DPS per 1000g</th><th>Build</th></tr></thead>
          <tbody>{bySize.map((b,i)=>
            <tr key={i}>
              <td>{i+1}</td>
              <td><b>{b.dps}</b></td>
              <td>{b.gold}g</td>
              <td>{b.gold>0?Math.round(b.dps/b.gold*1000*10)/10:'—'}</td>
              <td className="muted" style={{fontSize:12}}>{b.items.map(x=>x.name).join(', ')||'—'}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </div>
  </>;
}

export function SkillOrderTable({order}:{order:SkillOrder}){
  const slots=order.sequence.length?['Q','W','E','R'] as const:[];

  return <div className="glass card" style={{marginTop:16}}>
    <div className="eyebrow">ABILITY ORDER · BY UPTIME</div>
    <h2>{order.shorthand||'No abilities listed'}</h2>

    {/* The limit goes above the table, not in a footnote under it. */}
    <div className="skill-basis">{order.basis}</div>

    {order.maxOrder.length>0&&
      <div className="spike-list" style={{marginTop:14}}>
        {order.maxOrder.map((a,i)=>
          <div className="spike" key={a.slot}>
            <div className="spike-level">{a.slot}</div>
            <div>
              <b>{i+1}. {a.name}{a.maxedAtLevel?` — maxed at level ${a.maxedAtLevel}`:''}</b>
              <p>{a.fact}</p>
            </div>
          </div>)}
        {order.ultimate&&
          <div className="spike">
            <div className="spike-level">R</div>
            <div>
              <b>{order.ultimate.name} — ranks at 6, 11 and 16</b>
              <p>{order.ultimate.fact}</p>
            </div>
          </div>}
      </div>}

    {slots.length>0&&
      <div style={{overflowX:'auto',marginTop:16}}>
        <table className="table skill-grid">
          <thead>
            <tr><th>Level</th>{order.sequence.map(s=><th key={s.level}>{s.level}</th>)}</tr>
          </thead>
          <tbody>{slots.map(slot=>
            <tr key={slot}>
              <td><b>{slot}</b></td>
              {order.sequence.map(s=>
                <td key={s.level} className={s.slot===slot?'skill-hit':''}>
                  {s.slot===slot?s.rankAfter:''}
                </td>)}
            </tr>)}
          </tbody>
        </table>
      </div>}

    {order.unavailable.length>0&&
      <ul className="riot-tips" style={{marginTop:14}}>
        {order.unavailable.map(u=><li key={u}>{u}</li>)}
      </ul>}
  </div>;
}
