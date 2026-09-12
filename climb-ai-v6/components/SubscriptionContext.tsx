'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {getBrowserClient} from '@/lib/supabase/client';
import {normalizeTier,SubscriptionTier} from '@/lib/subscription';

type Ctx={tier:SubscriptionTier;loading:boolean;refresh:()=>Promise<void>};
const C=createContext<Ctx|null>(null);

export function SubscriptionProvider({children}:{children:React.ReactNode}){
  const [tier,setTier]=useState<SubscriptionTier>('FREE');
  const [loading,setLoading]=useState(true);
  const refresh=async()=>{
    try{
      const client=await getBrowserClient();
      if(!client){setTier('FREE');return}
      const {data}=await client.auth.getUser();
      setTier(normalizeTier(data.user?.app_metadata?.subscription_tier));
    }finally{setLoading(false)}
  };
  useEffect(()=>{void refresh()},[]);
  const value=useMemo(()=>({tier,loading,refresh}),[tier,loading]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useSubscription(){const c=useContext(C);if(!c)throw new Error('useSubscription outside provider');return c}
