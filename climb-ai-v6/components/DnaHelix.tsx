'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import type {GameRecord} from '@/lib/dna/career';
import type {HabitId} from '@/lib/habits/library';

/**
 * The Career DNA as a double helix, drawn as a broadcast HUD.
 *
 * Each rung is one ranked game, oldest on the left. A rung is split into the
 * colours of the habits that happened in that game; a plain rung is a clean
 * game, a dotted one could not be measured, and faint rungs past the end are
 * games still to come. The volt strand carries results (filled = win, hollow
 * red = loss). The strand turns slowly, can be dragged round, and every rung
 * opens its game.
 */

/** `group` is the Game DNA strand the habit belongs to; chips are grouped under it. */
export interface HelixHabit{id:HabitId;name:string;occursAt:number;colour:string;group?:string;groupColour?:string}

const SPACING=34;
const HEIGHT=268;
const TOP=34;
const MID=132;
const AMP=74;
const PAD=30;
const RULER=HEIGHT-26;
/** One full twist every 10 games — the size of the DNA window. */
const TWIST=(2*Math.PI)/10;
const SAMPLE=3;
/** Radians per second of idle spin. */
const SPIN=0.22;
const DRAG=0.012;
const TAU=Math.PI*2;

const reducedMotion=()=>typeof window!=='undefined'&&!!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const pad2=(n:number)=>String(n).padStart(2,'0');

/** A backbone as two path strings: the half facing the viewer and the half behind. */
function backbone(width:number,phase:number,sign:1|-1){
  let front='',back='';
  let px=0,py=0,pf=false,first=true;
  for(let x=PAD-SPACING/2;x<=width-PAD+SPACING/2+0.01;x+=SAMPLE){
    const th=((x-PAD)/SPACING)*TWIST+phase;
    const y=MID+sign*AMP*Math.sin(th);
    const f=sign*Math.cos(th)>0;
    if(!first){
      const seg=`M${px.toFixed(1)} ${py.toFixed(1)}L${x.toFixed(1)} ${y.toFixed(1)}`;
      if(pf&&f)front+=seg;else back+=seg;
    }
    px=x;py=y;pf=f;first=false;
  }
  return {front,back};
}

const hitsOf=(g:GameRecord,habits:HelixHabit[])=>habits.filter(h=>{const n=g.habits[h.id];return typeof n==='number'&&n>=h.occursAt});
const measuredIn=(g:GameRecord,habits:HelixHabit[])=>habits.some(h=>typeof g.habits[h.id]==='number');

export function DnaHelix({games,offset,birthEnd,habits,focus,onFocus,selectId=null}:{
  /** Relevant games shown, oldest first. */
  games:GameRecord[];
  /** Games before the first one shown, so numbering matches the whole career. */
  offset:number;
  /** Columns that fall inside the first 10 games (the birth DNA). */
  birthEnd:number;
  habits:HelixHabit[];
  focus:HabitId|null;
  onFocus:(id:HabitId|null)=>void;
  /** A game to open on (a review's "see it in your DNA" link); defaults to the latest. */
  selectId?:string|null;
}){
  const slots=Math.max(games.length,10);
  const width=PAD*2+(slots-1)*SPACING;
  const startAt=()=>{const i=selectId?games.findIndex(g=>g.id===selectId):-1;return i>=0?i:games.length?games.length-1:null};
  const [phase,setPhase]=useState(0.6);
  const [hover,setHover]=useState<number|null>(null);
  const [selected,setSelected]=useState<number|null>(startAt);
  const [spinning,setSpinning]=useState(true);
  const [still,setStill]=useState(false);
  const drag=useRef<{x:number;phase:number}|null>(null);
  const idle=useRef(true);
  const scroller=useRef<HTMLDivElement>(null);

  useEffect(()=>{setStill(reducedMotion())},[]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{setSelected(startAt())},[games.length,selectId]);
  // Open on the latest games — the ones the current read is built from — or on the game asked for.
  useEffect(()=>{
    const el=scroller.current;if(!el)return;
    const i=selectId?games.findIndex(g=>g.id===selectId):-1;
    el.scrollLeft=i>=0?Math.max(0,(PAD+i*SPACING)/width*el.scrollWidth-el.clientWidth/2):el.scrollWidth;
  // Only on a new game or a new target, never on every render, so a player's own scrolling is left alone.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[games.length,selectId,width]);

  useEffect(()=>{
    if(still||!spinning)return;
    let raf=0,last=performance.now();
    const tick=(now:number)=>{
      const dt=Math.min(0.1,(now-last)/1000);last=now;
      if(idle.current&&!drag.current)setPhase(p=>(p+dt*SPIN)%TAU);
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(raf);
  },[still,spinning]);

  const active=hover??selected;
  const activeGame=active!==null&&active<games.length?games[active]:null;
  const A=backbone(width,phase,1),B=backbone(width,phase,-1);
  const last=games.length-1;

  const cols=Array.from({length:slots},(_,i)=>{
    const x=PAD+i*SPACING;
    const th=i*TWIST+phase;
    const yA=MID+AMP*Math.sin(th),yB=MID-AMP*Math.sin(th);
    return {i,x,yA,yB,depthA:Math.cos(th),g:i<games.length?games[i]:null};
  });

  const node=(x:number,y:number,depth:number,g:GameRecord|null,strand:'A'|'B',key:string)=>{
    const r=2.8+2*(depth+1)/2;
    const o=0.35+0.65*(depth+1)/2;
    if(!g)return <circle key={key} cx={x} cy={y} r={r*0.7} className="helix-node future" opacity={o*0.6}/>;
    // The volt strand carries the result: filled for a win, hollow red for a loss.
    const cls=strand==='A'?(g.result==='WIN'?'win':'loss'):'plain';
    return <circle key={key} cx={x} cy={y} r={r} opacity={o} className={`helix-node ${cls}`}/>;
  };

  const move=(to:number)=>{if(!games.length)return;setSelected(Math.max(0,Math.min(games.length-1,to)))};
  const first=offset+1,latest=offset+games.length;

  const chip=(h:HelixHabit)=>{
    const count=games.filter(g=>hitsOf(g,[h]).length).length;
    const on=focus===h.id;
    // A habit that never showed up has no colour on the strand, so no chip either.
    if(!count&&!on)return null;
    return <button key={h.id} type="button" className={`helix-chip${on?' on':''}${focus&&!on?' dim':''}`}
      style={{'--habit':h.colour} as React.CSSProperties} aria-pressed={on}
      onClick={()=>onFocus(on?null:h.id)}>
      <i aria-hidden="true"/>{h.name}<small>{pad2(count)}</small>
    </button>;
  };
  // Chips sit under the Game DNA strand each habit belongs to, in the order the habits arrive.
  const groups:{label:string;colour?:string;habits:HelixHabit[]}[]=[];
  for(const h of habits){
    const label=h.group??'';
    const group=groups.find(g=>g.label===label);
    if(group)group.habits.push(h);else groups.push({label,colour:h.groupColour,habits:[h]});
  }

  return <div className="helix">
    <div className="helix-legend" role="group" aria-label="Habits on the strand — choose one to light it up">
      {groups.map(g=>{
        const chips=g.habits.map(chip).filter(Boolean);
        if(!chips.length)return null;
        if(!g.label)return chips;
        return <div key={g.label} className="helix-group" style={{'--strand':g.colour} as React.CSSProperties}>
          <span className="helix-group-label">{g.label}</span>{chips}
        </div>;
      })}
    </div>

    <div className="helix-stage">
      <div className="helix-hud-top" aria-hidden="true">
        <span>SEQ // G{pad2(first)}–G{pad2(latest)}</span>
        <span className={still||!spinning?'':'live'}><i/>{still||!spinning?'STRAND HELD':'STRAND LIVE'}</span>
      </div>
      <div className="helix-scroll" ref={scroller}>
        <svg className="helix-svg" viewBox={`0 0 ${width} ${HEIGHT}`}
          style={{minWidth:Math.min(width,Math.max(560,slots*22))}}
          role="group" aria-label="Your Career DNA strand. Use the arrow keys to move between games."
          tabIndex={0}
          onKeyDown={e=>{
            if(e.key==='ArrowLeft'){e.preventDefault();move((selected??games.length)-1)}
            if(e.key==='ArrowRight'){e.preventDefault();move((selected??-1)+1)}
          }}
          onPointerEnter={()=>{idle.current=false}}
          onPointerLeave={()=>{idle.current=true;setHover(null);drag.current=null}}
          onPointerDown={e=>{
            if(e.pointerType!=='mouse')return; // touch scrolls; the strand still turns on its own
            drag.current={x:e.clientX,phase};
            (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          }}
          onPointerMove={e=>{if(drag.current)setPhase(drag.current.phase+(e.clientX-drag.current.x)*DRAG)}}
          onPointerUp={()=>{drag.current=null}}>
          <defs>
            <pattern id="helix-grid" width={SPACING} height={SPACING/2} patternUnits="userSpaceOnUse" x={PAD-SPACING/2}>
              <path d={`M${SPACING} 0V${SPACING/2}M0 ${SPACING/2}H${SPACING}`} className="helix-grid-line"/>
            </pattern>
            <linearGradient id="helix-fade" x1="0" x2="1">
              <stop offset="0" stopColor="#fff" stopOpacity="0"/>
              {/* Fade only the loose backbone ends, never the first or last game. */}
              <stop offset={(PAD-8)/width} stopColor="#fff" stopOpacity="1"/>
              <stop offset={1-(PAD-8)/width} stopColor="#fff" stopOpacity="1"/>
              <stop offset="1" stopColor="#fff" stopOpacity="0"/>
            </linearGradient>
            <mask id="helix-mask"><rect x="0" y="0" width={width} height={HEIGHT} fill="url(#helix-fade)"/></mask>
            <linearGradient id="helix-scan-glow" x1="0" x2="1">
              <stop offset="0" className="helix-scan-stop" stopOpacity="0"/>
              <stop offset="1" className="helix-scan-stop" stopOpacity=".22"/>
            </linearGradient>
          </defs>

          <rect x={0} y={TOP-12} width={width} height={RULER-TOP+4} fill="url(#helix-grid)"/>

          {birthEnd>0&&offset+games.length>10&&<g className="helix-birth">
            <rect x={PAD-SPACING/2} y={TOP-12} width={birthEnd*SPACING} height={RULER-TOP+4}/>
            <text x={PAD-SPACING/2+8} y={TOP}>BIRTH DNA · G01–G10</text>
          </g>}

          {active!==null&&<rect className="helix-focus-col" x={PAD+active*SPACING-SPACING/2+3} y={TOP-8} width={SPACING-6} height={RULER-TOP-2}/>}

          {!still&&spinning&&<rect className="helix-scan" x={-60} y={TOP-12} width={60} height={RULER-TOP+4} fill="url(#helix-scan-glow)">
            <animate attributeName="x" from={-60} to={width} dur="5.5s" repeatCount="indefinite"/>
          </rect>}

          <g mask="url(#helix-mask)">
            <path d={A.back} className="helix-backbone back a"/>
            <path d={B.back} className="helix-backbone back b"/>
            {cols.map(c=>c.depthA<=0?node(c.x,c.yA,c.depthA,c.g,'A',`a${c.i}`):null)}
            {cols.map(c=>c.depthA>0?node(c.x,c.yB,-c.depthA,c.g,'B',`b${c.i}`):null)}

            {cols.map(c=>{
              const top=Math.min(c.yA,c.yB),len=Math.abs(c.yA-c.yB);
              if(len<4)return null;
              if(!c.g)return <line key={`r${c.i}`} x1={c.x} x2={c.x} y1={top} y2={top+len} className="helix-rung future"/>;
              const hits=hitsOf(c.g,habits);
              const lit=!focus||hits.some(h=>h.id===focus);
              const cls=`helix-rung-group${lit?'':' dim'}${active===c.i?' active':''}`;
              if(!hits.length){
                return <line key={`r${c.i}`} x1={c.x} x2={c.x} y1={top} y2={top+len}
                  className={`${cls} helix-rung ${measuredIn(c.g,habits)?'clean':'na'}`}/>;
              }
              const part=len/hits.length;
              return <g key={`r${c.i}`} className={cls}>
                {hits.map((h,k)=>{
                  const gap=hits.length>1?1.8:0;
                  return <line key={h.id} x1={c.x} x2={c.x} y1={top+k*part+gap} y2={top+(k+1)*part-gap}
                    className={`helix-rung hit${focus===h.id?' focus':''}`} stroke={h.colour}/>;
                })}
              </g>;
            })}

            <path d={A.front} className="helix-backbone front a"/>
            <path d={B.front} className="helix-backbone front b"/>
            {cols.map(c=>c.depthA>0?node(c.x,c.yA,c.depthA,c.g,'A',`A${c.i}`):null)}
            {cols.map(c=>c.depthA<=0?node(c.x,c.yB,-c.depthA,c.g,'B',`B${c.i}`):null)}
          </g>

          {last>=0&&<g className="helix-latest" aria-hidden="true">
            <path d={`M${PAD+last*SPACING-5} ${TOP-9}h10l-5 6z`}/>
            <text x={PAD+last*SPACING} y={TOP-13}>LATEST</text>
          </g>}

          <line x1={PAD-SPACING/2} x2={width-PAD+SPACING/2} y1={RULER} y2={RULER} className="helix-ruler"/>
          {cols.map(c=>{
            const n=offset+c.i+1;
            const major=c.g&&(n===3||n===5||n%10===0||c.i===last);
            return <g key={`t${c.i}`}>
              <line x1={c.x} x2={c.x} y1={RULER} y2={RULER+(major?7:4)} className={`helix-tick${c.g?'':' future'}${active===c.i?' active':''}`}/>
              {(major||active===c.i)&&<text x={c.x} y={RULER+19} className={`helix-num${active===c.i?' active':''}`}>G{pad2(n)}</text>}
            </g>;
          })}

          {games.map((g,i)=>{
            const hits=hitsOf(g,habits);
            const n=offset+i+1;
            return <rect key={g.id} className="helix-hit" x={PAD+i*SPACING-SPACING/2} y={0} width={SPACING} height={HEIGHT}
              role="button" aria-label={`Game ${n}, ${g.champion}, ${g.result==='WIN'?'win':'loss'}: ${hits.length?hits.map(h=>h.name).join(', '):'clean'}`}
              aria-pressed={selected===i}
              onPointerEnter={()=>setHover(i)}
              onClick={()=>setSelected(i)}/>;
          })}
        </svg>
      </div>
    </div>

    <div className="helix-foot">
      <p className="helix-key">
        <span><i className="k win"/>WIN</span><span><i className="k loss"/>LOSS</span>
        <span><i className="k clean"/>{habits.length===1?`NO ${habits[0].name.toUpperCase()}`:'CLEAN GAME'}</span><span><i className="k na"/>NOT MEASURABLE</span>
      </p>
      {!still&&<button type="button" className="helix-spin" onClick={()=>setSpinning(s=>!s)} aria-pressed={!spinning}>
        {spinning?'❚❚ PAUSE':'▶ SPIN'}
      </button>}
    </div>

    <div className={`helix-detail${activeGame?` ${activeGame.result==='WIN'?'win':'loss'}`:''}`} aria-live="polite">
      {activeGame?<GameDetail g={activeGame} n={offset+(active as number)+1} habits={habits} focus={focus}/>
        :<p className="muted">{games.length?'Hover or tap a rung to open that game.':'Your strand starts growing with your first synced ranked game.'}</p>}
    </div>
  </div>;
}

function GameDetail({g,n,habits,focus}:{g:GameRecord;n:number;habits:HelixHabit[];focus:HabitId|null}){
  const hits=hitsOf(g,habits);
  const when=new Date(g.at).toLocaleDateString('en-GB',{day:'numeric',month:'short'}).toUpperCase();
  return <>
    <div className="helix-detail-num">G{pad2(n)}</div>
    <div className="helix-detail-body">
      <div className="helix-detail-head">
        <b>{g.champion}</b>
        <span className="helix-result">{g.result==='WIN'?'VICTORY':'DEFEAT'}</span>
        <span className="helix-meta">{when} · {Math.round(g.minutes)} MIN · {g.role}</span>
        <Link className="helix-open" href={`/analyse/${encodeURIComponent(g.id)}`}>OPEN REVIEW →</Link>
      </div>
      {hits.length
        ?<ul className="helix-detail-hits">{hits.map(h=><li key={h.id} className={focus===h.id?'focus':''} style={{'--habit':h.colour} as React.CSSProperties}>
          <i aria-hidden="true"/>{h.name}<small>×{g.habits[h.id]}</small>
        </li>)}</ul>
        :<p className="helix-clean">{!measuredIn(g,habits)?'This game could not be measured for these habits.'
          :habits.length===1?`✓ NO ${habits[0].name.toUpperCase()} IN THIS GAME.`:'✓ CLEAN GAME — none of your tracked habits showed up.'}</p>}
    </div>
  </>;
}
