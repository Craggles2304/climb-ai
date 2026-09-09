'use client';
import {useMemo,useState} from 'react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine} from 'recharts';
import {Match,Role} from '@/lib/types';

/**
 * The product thesis as one picture: farm rate in lane versus farm rate after 15
 * minutes, game by game. The distance between the two lines IS the leak the ILP
 * is trying to close, and the reference line is the mission target.
 *
 * Series colours are validated against the OVERPOWERED dark surface #121417:
 * lightness band, chroma floor, CVD separation (protan ΔE 27.4, tritan 26.6),
 * normal-vision ΔE 29.6 and contrast all pass. Brand blue carries post-15 — the
 * brand colour sits on the number the plan is trying to move.
 */

export const LANE_COLOR='#C2703C';   // copper
export const POST15_COLOR='#4A90FF'; // brand blue
const TARGET=6.0;

interface Point{game:string;lane:number;post15:number;result:string;champion:string}

export function EconomyCurve({matches,role,target=TARGET,maxPoints=15}:{matches:Match[];role?:Role;target?:number;maxPoints?:number}){
  const [view,setView]=useState<'chart'|'table'>('chart');

  const data=useMemo<Point[]>(()=>{
    return matches
      .filter(m=>typeof m.metrics.laneCsPerMin==='number'&&typeof m.metrics.post15CsPerMin==='number')
      .slice(0,maxPoints)   // matches arrive newest-first, so this is recent form
      .reverse()            // then oldest-first, so the x-axis reads left to right
      .map((m,i)=>({
        game:`G${i+1}`,
        lane:m.metrics.laneCsPerMin as number,
        post15:m.metrics.post15CsPerMin as number,
        result:m.result,
        champion:m.champion,
      }));
  },[matches,maxPoints]);

  // Early returns live below every hook so the hook order never changes when the
  // player switches to an account with a different role.
  if(role==='JUNGLE'){
    // A jungler has no lane phase, so a lane-versus-post-15 split is not their
    // economy story even when those fields are populated on the match record.
    return <div className="glass chart-card">
      <div className="chart-head"><div>
        <div className="eyebrow">ECONOMY CURVE</div>
        <h3>The lane-versus-post-15 split does not describe a jungler.</h3>
      </div></div>
      <p className="muted chart-empty">
        Your economy story is camp uptime and objective conversion, not a lane split.
        The jungle economy curve is not built yet — until it is, this card stays empty
        rather than showing you a number that means nothing for your role.
      </p>
    </div>;
  }

  if(data.length<3){
    // Honest empty state: this metric pair is role-dependent and may not exist.
    return <div className="glass chart-card">
      <div className="chart-head"><div>
        <div className="eyebrow">ECONOMY CURVE</div>
        <h3>Not enough lane-versus-post-15 evidence yet.</h3>
      </div></div>
      <p className="muted chart-empty">
        This chart needs at least three games with both a lane and a post-15 farm sample.
        Jungle and support games often will not produce one — that is a limit of the data, not a gap in your play.
      </p>
    </div>;
  }

  const values=data.flatMap(d=>[d.lane,d.post15,target]);
  // Whole-number bounds so the axis lands on readable CS/min ticks rather than
  // whatever the data's min and max happen to be.
  const domain:[number,number]=[
    Math.max(0,Math.floor(Math.min(...values))-1),
    Math.ceil(Math.max(...values))+1,
  ];
  const ticks=Array.from({length:domain[1]-domain[0]+1},(_,i)=>domain[0]+i);
  const avgLane=data.reduce((n,d)=>n+d.lane,0)/data.length;
  const avgPost=data.reduce((n,d)=>n+d.post15,0)/data.length;
  const gap=avgLane-avgPost;

  return <div className="glass chart-card">
    <div className="chart-head">
      <div>
        <div className="eyebrow">ECONOMY CURVE</div>
        <h3>Your farm rate falls {gap.toFixed(1)} CS/min once lane ends.</h3>
        <p className="muted chart-sub">
          Last {data.length} games · lane average {avgLane.toFixed(1)} · post-15 average {avgPost.toFixed(1)} · target {target.toFixed(1)}
        </p>
      </div>
      <div className="chart-tools">
        <div className="chart-legend">
          <span><i style={{background:LANE_COLOR}}/>Lane CS/min</span>
          <span><i style={{background:POST15_COLOR}}/>Post-15 CS/min</span>
        </div>
        <button
          className="btn secondary chart-toggle"
          onClick={()=>setView(v=>v==='chart'?'table':'chart')}
          aria-pressed={view==='table'}
        >{view==='chart'?'TABLE':'CHART'}</button>
      </div>
    </div>

    {view==='chart'?(
      <div className="chart-plot">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{top:14,right:38,bottom:6,left:-14}}>
            <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false}/>
            <XAxis dataKey="game" tick={{fill:'#8B9298',fontSize:11}} tickLine={false} axisLine={{stroke:'rgba(255,255,255,.09)'}}/>
            <YAxis domain={domain} ticks={ticks} allowDecimals={false} tick={{fill:'#8B9298',fontSize:11}} tickLine={false} axisLine={false} width={44}/>
            <ReferenceLine
              y={target}
              stroke="rgba(242,244,244,.34)"
              strokeWidth={1}
              label={{value:`TARGET ${target.toFixed(1)}`,position:'insideTopRight',fill:'#8B9298',fontSize:10,letterSpacing:'.1em'}}
            />
            <Tooltip content={<EconomyTooltip/>} cursor={{stroke:'rgba(255,255,255,.22)',strokeWidth:1}}/>
            <Line
              type="monotone" dataKey="lane" name="Lane CS/min"
              stroke={LANE_COLOR} strokeWidth={2}
              dot={false} activeDot={{r:5,strokeWidth:2,stroke:'#121417'}}
              isAnimationActive={false}
            />
            <Line
              type="monotone" dataKey="post15" name="Post-15 CS/min"
              stroke={POST15_COLOR} strokeWidth={2}
              dot={false} activeDot={{r:5,strokeWidth:2,stroke:'#121417'}}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    ):(
      <div className="chart-table-wrap">
        <table className="table chart-table">
          <caption className="sr-only">Lane and post-15 CS per minute for each recent game</caption>
          <thead>
            <tr><th scope="col">Game</th><th scope="col">Champion</th><th scope="col">Result</th>
              <th scope="col">Lane CS/min</th><th scope="col">Post-15 CS/min</th><th scope="col">Drop</th></tr>
          </thead>
          <tbody>
            {data.map(d=><tr key={d.game}>
              <th scope="row">{d.game}</th>
              <td>{d.champion}</td>
              <td className={d.result==='WIN'?'success':'danger'}>{d.result}</td>
              <td>{d.lane.toFixed(1)}</td>
              <td>{d.post15.toFixed(1)}</td>
              <td>{(d.lane-d.post15).toFixed(1)}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
    )}
  </div>;
}

interface TooltipPayload{payload:Point}
function EconomyTooltip({active,payload}:{active?:boolean;payload?:TooltipPayload[]}){
  if(!active||!payload?.length)return null;
  const p=payload[0].payload;
  const drop=p.lane-p.post15;
  return <div className="chart-tip">
    <div className="chart-tip-head">
      <b>{p.game}</b>
      <span className={p.result==='WIN'?'success':'danger'}>{p.result}</span>
    </div>
    <div className="chart-tip-champ">{p.champion}</div>
    <dl>
      <div><dt><i style={{background:LANE_COLOR}}/>Lane</dt><dd>{p.lane.toFixed(1)}</dd></div>
      <div><dt><i style={{background:POST15_COLOR}}/>Post-15</dt><dd>{p.post15.toFixed(1)}</dd></div>
      <div className="chart-tip-drop"><dt>Drop</dt><dd>{drop.toFixed(1)} CS/min</dd></div>
    </dl>
  </div>;
}
