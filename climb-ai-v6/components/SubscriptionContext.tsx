'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {getBrowserClient} from '@/lib/supabase/client';
import {normalizeTier,SubscriptionProduct,SubscriptionTier} from '@/lib/subscription';

type Ctx={
  tier:SubscriptionTier;
  lolTier:SubscriptionTier;
  tftTier:SubscriptionTier;
  tierFor:(product:SubscriptionProduct)=>SubscriptionTier;
  loading:boolean;
  refresh:()=>Promise<void>;
};
const C=createContext<Ctx|null>(null);

const FOUNDER_RIOT_ACCOUNTS=[{gameName:'craggles',tagline:'EUW'}] as const;

export function SubscriptionProvider({children}:{children:React.ReactNode}){
  const [lolTier,setLolTier]=useState<SubscriptionTier>('FREE');
  const [tftTier,setTftTier]=useState<SubscriptionTier>('FREE');
  const [loading,setLoading]=useState(true);
  const refresh=async()=>{
    setLoading(true);
    try{
      const client=await getBrowserClient();
      if(!client){setLolTier('FREE');setTftTier('FREE');return}
      const {data}=await client.auth.getUser();
      const user=data.user;
      if(!user){setLolTier('FREE');setTftTier('FREE');return}

      // Legacy app_metadata subscription_tier belongs to League. Product-specific
      // entitlements override it once Stripe writes product_entitlements rows.
      const legacyLeagueTier=normalizeTier(user.app_metadata?.subscription_tier);
      const [{data:profile},{data:riotAccounts},{data:entitlements}]=await Promise.all([
        client.from('profiles').select('is_founder').eq('id',user.id).maybeSingle(),
        client.from('riot_accounts').select('game_name,tagline,region').eq('user_id',user.id),
        client.from('product_entitlements').select('product,tier,status,current_period_end').eq('user_id',user.id),
      ]);

      const founderByProfile=profile?.is_founder===true;
      const founderByRiot=(riotAccounts??[]).some(account=>FOUNDER_RIOT_ACCOUNTS.some(founder=>
        String(account.game_name??'').trim().toLowerCase()===founder.gameName&&
        String(account.tagline??'').trim().toUpperCase()===founder.tagline
      ));
      if(founderByProfile||founderByRiot){setLolTier('PRO');setTftTier('PRO');return}

      const live=(entitlements??[]).filter((row:any)=>['active','trialing'].includes(String(row.status||'active')));
      const productTier=(product:SubscriptionProduct,fallback:SubscriptionTier)=>{
        const row=live.find((item:any)=>String(item.product).toUpperCase()===product);
        return row?normalizeTier(row.tier):fallback;
      };
      setLolTier(productTier('LOL',legacyLeagueTier));
      setTftTier(productTier('TFT','FREE'));
    }finally{setLoading(false)}
  };
  useEffect(()=>{void refresh()},[]);
  const value=useMemo<Ctx>(()=>({
    tier:lolTier,lolTier,tftTier,tierFor:(product)=>product==='TFT'?tftTier:lolTier,loading,refresh,
  }),[lolTier,tftTier,loading]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export function useSubscription(){const c=useContext(C);if(!c)throw new Error('useSubscription outside provider');return c}
