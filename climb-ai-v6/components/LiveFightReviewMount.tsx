'use client';
import {useCallback,useEffect,useState} from 'react';
import {useAccount} from './AccountContext';
import {FightDecisionReview,type FightReview} from './FightDecisionReview';
import type {ProMatchAnalysis} from '@/lib/riot/proAnalysis';
import type {ProLearningProfile} from '@/lib/riot/proHistory';

type Review={status:string;snapshotCount:number;summary?:{fightReviews?:FightReview[]};proAnalysis?:ProMatchAnalysis|null;historyProfile?:ProLearningProfile|null};

export function LiveFightReviewMount(){
  const {active}=useAccount();
  const [review,setReview]=useState<Review|null>(null);
  const refresh=useCallback(async()=>{try{const response=await fetch(`/api/live/telemetry?accountId=${encodeURIComponent(active.id)}`,{cache:'no-store'});if(!response.ok)return;const body=await response.json();setReview(body.review??null)}catch{}},[active.id]);
  useEffect(()=>{void refresh();const id=window.setInterval(()=>void refresh(),15_000);return()=>window.clearInterval(id)},[refresh]);
  if(!review||!['COMPLETE','ABORTED'].includes(review.status))return null;
  const fights=review.summary?.fightReviews??[];
  return <section className="dash-section" style={{display:'grid',gap:14}}><div><div className="eyebrow">COACHING DECISION REVIEW</div><h2 style={{margin:'5px 0 0'}}>Open the exact moments that changed your game</h2></div><FightDecisionReview fights={fights} proAnalysis={review.proAnalysis} historyProfile={review.historyProfile}/></section>;
}
