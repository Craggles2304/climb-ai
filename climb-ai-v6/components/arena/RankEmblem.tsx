import {useId} from 'react';
import type {RankInfo,RankTier} from '@/lib/dashboard/model';
import s from './Media.module.css';

const TIER_COLOUR:Record<RankTier,string>={
  IRON:'var(--arena-rank-iron)',BRONZE:'var(--arena-rank-bronze)',SILVER:'var(--arena-rank-silver)',GOLD:'var(--arena-rank-gold)',
  PLATINUM:'var(--arena-rank-platinum)',EMERALD:'var(--arena-rank-emerald)',DIAMOND:'var(--arena-rank-diamond)',
  MASTER:'var(--arena-rank-master)',GRANDMASTER:'var(--arena-rank-grandmaster)',CHALLENGER:'var(--arena-rank-challenger)',
};
const ORDER:RankTier[]=['IRON','BRONZE','SILVER','GOLD','PLATINUM','EMERALD','DIAMOND','MASTER','GRANDMASTER','CHALLENGER'];

/**
 * OP CLIMB's own ranked emblem: a crest whose tier sets the colour and whose
 * height in the ladder adds wings and a crown. Original artwork, so it needs no
 * licence and renders instantly at any size.
 */
export function RankEmblem({rank,size=72}:{rank:RankInfo;size?:number}){
  const id=useId().replace(/:/g,'');
  const tier=rank.tier;
  const colour=tier?TIER_COLOUR[tier]:'var(--arena-rank-unranked)';
  const height=tier?ORDER.indexOf(tier):-1;
  // Division I sits highest in a tier, so it shows the most pips.
  const pips=rank.division?Math.max(0,4-['I','II','III','IV'].indexOf(rank.division)):0;
  const label=rank.ranked?`${rank.label}${rank.lp!==null?` · ${rank.lp} LP`:''}`:'Unranked';
  return <svg className={s.emblem} width={size} height={size} viewBox="0 0 72 72" role="img" aria-label={label} style={{color:colour}}>
    <title>{label}</title>
    <defs>
      <linearGradient id={id+'g'} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="currentColor" stopOpacity=".95"/>
        <stop offset="1" stopColor="currentColor" stopOpacity=".45"/>
      </linearGradient>
      <linearGradient id={id+'d'} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#fff" stopOpacity=".9"/>
        <stop offset=".45" stopColor="currentColor"/>
        <stop offset="1" stopColor="currentColor" stopOpacity=".55"/>
      </linearGradient>
    </defs>
    {height>=6&&<g opacity=".85" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M14 30c-6 2-9 8-8 14 4-1 7-4 9-8"/><path d="M58 30c6 2 9 8 8 14-4-1-7-4-9-8"/>
      {height>=8&&<><path d="M12 40c-4 3-5 8-3 12 3-2 5-5 6-8"/><path d="M60 40c4 3 5 8 3 12-3-2-5-5-6-8"/></>}
    </g>}
    {height>=7&&<path d="M27 9.5 31 4l5 4.5L41 4l4 5.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>}
    <path d="M36 9 56 18v17c0 13-9 22-20 27-11-5-20-14-20-27V18z" fill={rank.ranked?`url(#${id}g)`:'none'} stroke="currentColor" strokeWidth="1.6" opacity={rank.ranked?1:.7}/>
    <path d="M36 15.5 50.5 22v12.6c0 9.5-6.3 16.2-14.5 20.2-8.2-4-14.5-10.7-14.5-20.2V22z" fill="#081018" opacity=".9"/>
    {rank.ranked
      ?<path d="M36 22 44.5 34 36 46 27.5 34z" fill={`url(#${id}d)`} stroke="#081018" strokeWidth="1"/>
      :<path d="M30 34h12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>}
    {rank.division&&<g fill="currentColor">{Array.from({length:pips},(_,index)=>{
      const x=36-(pips*7-3)/2+index*7;
      return <rect key={index} x={x} y="49.5" width="4" height="4" rx="1" transform={`rotate(45 ${x+2} 51.5)`}/>;
    })}</g>}
  </svg>;
}
