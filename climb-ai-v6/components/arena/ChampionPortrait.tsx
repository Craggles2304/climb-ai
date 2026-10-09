'use client';

import {useState,type CSSProperties} from 'react';
import {championDisplayName,championTile} from '@/lib/championArt';
import s from './Media.module.css';

/**
 * Square champion portrait from Data Dragon. Falls back to initials when the
 * champion is unknown or the image fails, so a row never shows a broken image.
 */
export function ChampionPortrait({champion,size=44,ring,label,priority=false,className}:{champion:string|null|undefined;size?:number;ring?:string;label?:string;priority?:boolean;className?:string}){
  const [failed,setFailed]=useState(false);
  const name=championDisplayName(champion);
  const src=champion?championTile(champion):'';
  const style={'--size':size+'px',...(ring?{'--ring':ring}:{})} as CSSProperties;
  return <span className={[s.portrait,ring?s.portraitRing:'',className].filter(Boolean).join(' ')} style={style} title={label??name}>
    {src&&!failed
      ?<img src={src} alt={label??name} width={size} height={size} loading={priority?'eager':'lazy'} decoding="async" onError={()=>setFailed(true)}/>
      :<span className={s.portraitFallback} aria-label={label??name} role="img">{name==='Unknown'?'?':name.slice(0,2)}</span>}
  </span>;
}
