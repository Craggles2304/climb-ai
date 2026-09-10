'use client';
import {useState} from 'react';
import {ResponsiveContainer,LineChart,Line,XAxis,YAxis,CartesianGrid,Tooltip,ReferenceLine} from 'recharts';
import type {DpsPoint} from '@/lib/champions/dps';

/**
 * Auto-attack damage per second across all 18 levels.
 *
 * Two series: what the champion does with nothing bought, and what they do
 * with the item currently being compared. The gap between them is what that
 * item is worth, drawn rather than asserted.
 *
 * Colours match the EconomyCurve pair, which were validated against the
 * OVERPOWERED dark surface for lightness, chroma, CVD separation and contrast.
 */

export const BASE_COLOR='#C2703C';   // copper
export const ITEM_COLOR='#4A90FF';   // brand blue

interface Row{level:number;base:number;withItem?:number}

export function DpsCurve({
  base,withItem,itemName,spikeLevels=[6,11,16],
}:{
  base:DpsPoint[];
  withItem?:DpsPoint[];
  itemName?:string;
  spikeLevels?:number[];
}){
  const [view,setView]=useState<'chart'|'table'>('chart');

  const data:Row[]=base.map((p,i)=>({
    level:p.level,
    base:p.dps,
    withItem:withItem?withItem[i]?.dps:undefined,
  }));

  return <div className="glass card" style={{marginTop:16}}>
    <div className="section-row">
      <div>
        <div className="eyebrow">AUTO-ATTACK DPS BY LEVEL</div>
        <h2 style={{margin:'6px 0 0'}}>Damage per second</h2>
      </div>
      <button className="btn secondary" style={{minHeight:38,fontSize:11}}
        onClick={()=>setView(view==='chart'?'table':'chart')}>
        {view==='chart'?'TABLE':'CHART'}
      </button>
    </div>

    {view==='chart'
      ?<div style={{height:280,marginTop:14}}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{top:8,right:12,bottom:4,left:-14}}>
            <CartesianGrid stroke="rgba(255,255,255,.07)" vertical={false}/>
            <XAxis dataKey="level" stroke="#8B9298" fontSize={11} tickLine={false}
              label={{value:'Level',position:'insideBottom',offset:-2,fill:'#8B9298',fontSize:10}}/>
            <YAxis stroke="#8B9298" fontSize={11} tickLine={false} axisLine={false}/>
            <Tooltip
              contentStyle={{background:'#121417',border:'1px solid rgba(255,255,255,.10)',borderRadius:12,fontSize:12}}
              labelFormatter={(l)=>`Level ${l}`}
              formatter={(v:number,name:string)=>[`${v} DPS`,name==='base'?'No items':itemName??'With item']}/>
            {spikeLevels.map(l=>
              <ReferenceLine key={l} x={l} stroke="rgba(74,144,255,.28)" strokeDasharray="3 3"/>)}
            <Line type="monotone" dataKey="base" stroke={BASE_COLOR} strokeWidth={2} dot={false} name="base"/>
            {withItem&&
              <Line type="monotone" dataKey="withItem" stroke={ITEM_COLOR} strokeWidth={2} dot={false} name="withItem"/>}
          </LineChart>
        </ResponsiveContainer>
      </div>
      :<div style={{overflowX:'auto',marginTop:14}}>
        <table className="table">
          <thead><tr>
            <th>Level</th><th>Attack damage</th><th>Attack speed</th><th>DPS</th>
            {withItem&&<th>With {itemName??'item'}</th>}
          </tr></thead>
          <tbody>{base.map((p,i)=>
            <tr key={p.level}>
              <td>{p.level}</td><td>{p.attackDamage}</td><td>{p.attackSpeed.toFixed(2)}</td><td>{p.dps}</td>
              {withItem&&<td>{withItem[i]?.dps}</td>}
            </tr>)}
          </tbody>
        </table>
      </div>}

    <p className="muted" style={{marginTop:12,fontSize:12}}>
      Auto-attacks only, with crit averaged in. Dashed lines mark ultimate ranks.
      Ability damage is not included — Riot no longer publishes ability
      coefficients, so there is nothing to calculate it from.
    </p>
  </div>;
}
