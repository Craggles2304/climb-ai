'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Script from 'next/script';

export type ClientDnaMission={
  c:'lane'|'wave'|'vision'|'obj'|'fight'|'mind';
  n:string;
  s:0|1|2|3;
  p?:number;
  level?:number;
  levelProgress?:number;
  xpIntoLevel?:number;
  xpForNextLevel?:number;
};

type Props={
  player:string;
  role:string;
  missions:ClientDnaMission[];
  compact?:boolean;
  preview?:boolean;
  tier?:'FREE'|'PLUS'|'PRO';
  baselineGames?:number;
  baselineRequired?:number;
};

declare global{
  interface Window{
    opDna?:{
      panel:(input?:{player?:string;role?:string;missions?:ClientDnaMission[];real?:boolean;preview?:boolean;tier?:string;baselineGames?:number;baselineRequired?:number})=>string;
      mount?:(root:HTMLElement)=>void;
      configure?:(input:{player?:string;role?:string;missions?:ClientDnaMission[];real?:boolean;preview?:boolean;tier?:string;baselineGames?:number;baselineRequired?:number})=>void;
    };
  }
}

export function ClientGameDna({player,role,missions,compact=false,preview=false,tier='PRO',baselineGames=3,baselineRequired=3}:Props){
  const host=useRef<HTMLDivElement>(null);
  const [scriptReady,setScriptReady]=useState(false);

  const render=useCallback(()=>{
    const api=window.opDna;
    const el=host.current;
    if(!api?.panel||!api.mount||!el)return;
    el.innerHTML=api.panel({player,role,missions,real:true,preview,tier,baselineGames,baselineRequired});
    const root=el.querySelector<HTMLElement>('[data-dna]');
    if(root)api.mount(root);
  },[player,role,missions,preview,tier,baselineGames,baselineRequired]);

  useEffect(()=>{
    if(window.opDna?.panel&&window.opDna?.mount){
      setScriptReady(true);
      render();
    }
  },[render]);

  useEffect(()=>{
    if(scriptReady)render();
  },[scriptReady,render]);

  return <>
    <Script src="/client/dna.js" strategy="afterInteractive" onLoad={()=>setScriptReady(true)}/>
    <div ref={host} className={(compact?"client-original-dna-host dna-preview-compact":"client-original-dna-host")+(preview?" dna-preview-mode":"")}/>
  </>;
}