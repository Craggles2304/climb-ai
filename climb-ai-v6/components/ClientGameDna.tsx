'use client';

import {useCallback,useEffect,useRef,useState} from 'react';
import Script from 'next/script';

export type ClientDnaMission={
  c:'lane'|'wave'|'vision'|'obj'|'fight'|'mind';
  n:string;
  s:0|1|2|3;
};

type Props={
  player:string;
  missions:ClientDnaMission[];
  compact?:boolean;
  preview?:boolean;
  tier?:'FREE'|'PLUS'|'PRO';
};

declare global{
  interface Window{
    opDna?:{
      panel:(input?:{player?:string;missions?:ClientDnaMission[];real?:boolean;preview?:boolean;tier?:string})=>string;
      mount?:(root:HTMLElement)=>void;
      configure?:(input:{player?:string;missions?:ClientDnaMission[];real?:boolean;preview?:boolean;tier?:string})=>void;
    };
  }
}

export function ClientGameDna({player,missions,compact=false,preview=false,tier='PRO'}:Props){
  const host=useRef<HTMLDivElement>(null);
  const [scriptReady,setScriptReady]=useState(false);

  const render=useCallback(()=>{
    const api=window.opDna;
    const el=host.current;
    if(!api?.panel||!api.mount||!el)return;
    el.innerHTML=api.panel({player,missions,real:true,preview,tier});
    const root=el.querySelector<HTMLElement>('[data-dna]');
    if(root)api.mount(root);
  },[player,missions,preview,tier]);

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
