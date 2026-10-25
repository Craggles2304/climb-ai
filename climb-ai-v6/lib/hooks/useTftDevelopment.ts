'use client';
import {useCallback,useEffect,useState} from 'react';
import type {TftDevelopment} from '@/lib/tft/development';
import type {TftMatch} from '@/lib/tft/types';
type View=TftDevelopment&{accountId:string;matches:TftMatch[]};
export function useTftDevelopment(accountId:string){
  const [data,setData]=useState<View|null>(null);
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const refresh=useCallback(()=>setRevision(r=>r+1),[]);
  useEffect(()=>{
    let cancelled=false;
    const controller=new AbortController();
    setData(null);setError('');
    const load=async()=>{
      try{
        const response=await fetch('/api/tft/current-mission?accountId='+encodeURIComponent(accountId),{cache:'no-store',signal:controller.signal});
        const body=await response.json();
        if(!response.ok||!body.ok)throw new Error(body.error||'Could not load TFT development.');
        if(!cancelled){setData(body);setError('')}
      }catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Could not load TFT development.')}
    };
    void load();
    const timer=setInterval(()=>{if(document.visibilityState==='visible')void load()},30000);
    return()=>{cancelled=true;controller.abort();clearInterval(timer)};
  },[accountId,revision]);
  return{data:data?.accountId===accountId?data:null,error,refresh};
}
