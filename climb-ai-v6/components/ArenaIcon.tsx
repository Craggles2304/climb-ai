'use client';
import type {CSSProperties} from 'react';
import type {DnaDomain} from '@/lib/types';

export type ArenaIconName=
  |'home'|'dna'|'progress'|'missions'|'match'|'history'|'coach'
  |'trophy'|'sword'|'coins'|'target'|'eye'|'wave'|'shield'
  |'repeat'|'baron'|'external'|'gear'|'account'|'signal'|'spark'|'clock';

const graphics:Record<ArenaIconName,React.ReactNode>={
  home:<><path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/><path d="m3 10 9-7 9 7"/></>,
  dna:<><path d="M12 2 20 6.5v11L12 22 4 17.5v-11z"/><path d="m12 5 5 7-5 7-5-7z"/><path d="M12 5v14M7 12h10"/></>,
  progress:<><path d="M3 20h18M5 16l5-5 4 3 6-9"/><path d="M15 5h5v5"/></>,
  missions:<><path d="m12 2 2.8 5.8L21 9l-4.5 4.6 1 6.4-5.5-3.1-5.5 3.1 1-6.4L3 9l6.2-1.2z"/><path d="m10 12 1.5 1.5L15 10"/></>,
  match:<><path d="M4 9 12 3l8 6v10H4z"/><path d="M8 13h8M12 9v8"/><path d="M7 20h10"/></>,
  history:<><path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h4"/><path d="M4 6v12"/></>,
  coach:<><circle cx="12" cy="7" r="3.3"/><path d="M4.5 21v-3.5C4.5 14.5 7 13 12 13s7.5 1.5 7.5 4.5V21"/><path d="m17 7 2-2m-14 2L3 5"/></>,
  trophy:<><path d="M8 3h8v9a4 4 0 0 1-8 0z"/><path d="M8 5H4v3a4 4 0 0 0 4 4M16 5h4v3a4 4 0 0 1-4 4M12 16v4M8 20h8"/></>,
  sword:<><path d="m4 20 4.5-4.5M16 8l5-5-8 1-7 9 5 5z"/><path d="m7 14 3 3M4 17l3 3"/></>,
  coins:<><ellipse cx="12" cy="7" rx="8" ry="3.3"/><path d="M4 7v5c0 2 3.6 4 8 4s8-2 8-4V7M4 12v5c0 2 3.6 4 8 4s8-2 8-4v-5"/></>,
  target:<><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/></>,
  eye:<><path d="M2 12c3-4 6-6 10-6s7 2 10 6c-3 4-6 6-10 6S5 16 2 12Z"/><circle cx="12" cy="12" r="3"/><path d="M12 9V6"/></>,
  wave:<><path d="M2 16c3 0 3-7 6-7s3 7 6 7 3-7 6-7h2M2 21c3 0 3-7 6-7s3 7 6 7 3-7 6-7h2"/></>,
  shield:<><path d="M12 2 21 6v6c0 5-4 8-9 10-5-2-9-5-9-10V6z"/><path d="m8 12 3 3 5-6"/></>,
  repeat:<><path d="M20 8a8 8 0 0 0-14-3L4 8m0-5v5h5M4 16a8 8 0 0 0 14 3l2-3m0 5v-5h-5"/></>,
  baron:<><path d="m3 16 3-9 6 5 6-5 3 9-9 5z"/><path d="m8 6 4-4 4 4M7 17h10"/></>,
  external:<><path d="M12 4h8v8M20 4l-10 10"/><path d="M19 14v6H4V5h6"/></>,
  gear:<><circle cx="12" cy="12" r="3.4"/><path d="m9 2-.7 2.6-2.4 1L3.5 4 2 7l2 2.2v5.6L2 17l1.5 3 2.4-1.6 2.4 1L9 22h6l.7-2.6 2.4-1L20.5 20l1.5-3-2-2.2V9.2L22 7l-1.5-3-2.4 1.6-2.4-1L15 2z"/></>,
  account:<><circle cx="12" cy="7" r="4"/><path d="M4 21c0-5 3-8 8-8s8 3 8 8"/></>,
  signal:<><path d="M4 18h3v-5H4zM10 18h3V9h-3zM16 18h3V4h-3z"/></>,
  spark:<><path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7z"/><path d="m4 2 .7 1.3L6 4l-1.3.7L4 6l-.7-1.3L2 4l1.3-.7z"/></>,
  clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/></>,
};

const domainIcons:Record<DnaDomain,ArenaIconName>={
  LANING:'sword',WAVES_CS:'wave',VISION_MAP:'eye',
  OBJECTIVES:'baron',TEAMFIGHTS:'target',CONSISTENCY:'repeat',
};

export function ArenaIcon({name,size=21,className='',style}:{name:ArenaIconName;size?:number;className?:string;style?:CSSProperties}){
  return <svg className={'arena-v-icon '+className} xmlns="http://www.w3.org/2000/svg"
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
    aria-hidden="true" focusable="false" style={style}>{graphics[name]}</svg>;
}
export function ArenaDomainIcon({domain,size=22,className=''}:{domain:DnaDomain;size?:number;className?:string}){
 return <ArenaIcon name={domainIcons[domain]} size={size} className={className}/>;
}
