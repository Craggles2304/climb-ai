'use client';

import {useEffect,useState} from 'react';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import {loadProMatchAnalysis} from '@/lib/proMatchClient';

export function useProMatch(matchId:string|undefined){
  const [analysis,setAnalysis]=useState<ProMatchAnalysis|null>(null);
  const [loading,setLoading]=useState(false);
  useEffect(()=>{
    if(!matchId){setAnalysis(null);return}
    const controller=new AbortController();
    setLoading(true);
    void loadProMatchAnalysis(matchId,controller.signal).then(value=>setAnalysis(value)).finally(()=>{if(!controller.signal.aborted)setLoading(false)});
    return()=>controller.abort();
  },[matchId]);
  return{analysis,loading};
}
