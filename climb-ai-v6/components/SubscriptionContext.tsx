'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {getBrowserClient} from '@/lib/supabase/client';
import {normalizeTier,SubscriptionTier} from '@/lib/subscription';

type Ctx={tier:SubscriptionTier;loading:boolean;refresh:()=>Promise<void>};
const C=createContext<Ctx|null>(null);

const FOUNDER_RIOT_ACCOUNTS=[
  {gameName:'craggles',tagline:'EUW'},
] as const;

export function SubscriptionProvider({children}:{children:React.ReactNode}){
  const [tier,setTier]=useState<SubscriptionTier>('FREE');
  const [loading,setLoading]=useState(true);
  const refresh=async()=>{
    try{
      const client=await getBrowserClient();
      if(!client){setTier('FREE');return}
      const {data}=await client.auth.getUser();
      const user=data.user;
      if(!user){setTier('FREE');return}

      const metadataTier=normalizeTier(user.app_metadata?.subscription_tier);
      if(metadataTier==='PRO'){
        setTier('PRO');
        return;
      }

      const [{data:profile},{data:riotAccounts}]=await Promise.all([
        client.from('profiles').select('is_founder').eq('id',user.id).maybeSingle(),
        client.from('riot_accounts').select('game_name,tagline,region').eq('user_id',user.id),
      ]);

      const founderByProfile=profile?.is_founder===true;
      const founderByRiot=(riotAccounts??[]).some(account=>
        FOUNDER_RIOT_ACCOUNTS.some(founder=>
          String(account.game_name??'').trim().toLowerCase()===founder.gameName&&
          String(account.tagline??'').trim().toUpperCase()===founder.tagline
        )
      );

      setTier(founderByProfile||founderByRiot?'PRO':metadataTier);
    }finally{setLoading(false)}
  };
  useEffect(()=>{void refresh()},[]);
  const value=useMemo(()=>({tier,loading,refresh}),[tier,loading]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useSubscription(){const c=useContext(C);if(!c)throw new Error('useSubscription outside provider');return c}
