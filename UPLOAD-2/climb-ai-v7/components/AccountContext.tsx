'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {demoAccounts,matchesFor as demoMatchesFor,missionFor} from '@/data/demo';
import {RiotAccount,Match} from '@/lib/types';
import {loadProfile,PlayerProfile,PROFILE_ACCOUNT_ID,PROFILE_EVENT} from '@/lib/profile';

/**
 * Accounts available to the app.
 *
 * An onboarded player gets a real account of their own — with no matches in it —
 * placed first and selected by default. Before this, onboarding threw its answers
 * away and dropped the player onto the demo account, so their first session was
 * spent looking at somebody else's games.
 *
 * The demo accounts stay, clearly labelled, because they are how the product is
 * shown to someone who has not connected anything yet.
 */

type Ctx={
  accounts:RiotAccount[];
  active:RiotAccount;
  setActive:(id:string)=>void;
  /** The onboarded profile, if the player has been through onboarding. */
  profile:PlayerProfile|null;
  /** True when the active account is the player's own rather than a demo. */
  isOwnAccount:boolean;
  /** True when the active account has no matches to reason about yet. */
  isEmpty:boolean;
};

const AccountContext=createContext<Ctx|null>(null);
const ACTIVE_KEY='climb_active_account';

function accountFromProfile(p:PlayerProfile):RiotAccount{
  return {
    id:p.id,label:'YOU',gameName:p.gameName||'Your account',tagline:p.tagline||'',
    region:p.region||'EUW',role:p.role,rank:p.rank,champions:p.champions,
    isPrimary:true,syncStatus:'PENDING',
  };
}

/** Matches for any account. The onboarded account genuinely has none yet. */
export function matchesFor(accountId:string):Match[]{
  if(accountId===PROFILE_ACCOUNT_ID)return [];
  return demoMatchesFor(accountId);
}

export function AccountProvider({children}:{children:React.ReactNode}){
  const [profile,setProfile]=useState<PlayerProfile|null>(null);
  const [activeId,setActiveId]=useState<string>('acct-main');
  const [hydrated,setHydrated]=useState(false);

  useEffect(()=>{
    const p=loadProfile();
    setProfile(p);
    const saved=localStorage.getItem(ACTIVE_KEY);
    const valid=saved&&(saved===PROFILE_ACCOUNT_ID?!!p:demoAccounts.some(a=>a.id===saved));
    // A player who has onboarded lands on their own account, not the demo.
    setActiveId(valid?saved as string:(p?PROFILE_ACCOUNT_ID:'acct-main'));
    setHydrated(true);

    // Onboarding completes without remounting this provider, so listen for the
    // profile it writes and switch the player onto their own account.
    const onProfile=()=>{
      const next=loadProfile();
      if(!next)return;
      setProfile(next);
      setActiveId(PROFILE_ACCOUNT_ID);
      try{localStorage.setItem(ACTIVE_KEY,PROFILE_ACCOUNT_ID)}catch{/* private mode */}
    };
    window.addEventListener(PROFILE_EVENT,onProfile);
    return ()=>window.removeEventListener(PROFILE_EVENT,onProfile);
  },[]);

  const accounts=useMemo(
    ()=>profile?[accountFromProfile(profile),...demoAccounts]:demoAccounts,
    [profile],
  );

  const active=useMemo(
    ()=>accounts.find(a=>a.id===activeId)||accounts[0],
    [accounts,activeId],
  );

  const setActive=(id:string)=>{
    setActiveId(id);
    try{localStorage.setItem(ACTIVE_KEY,id)}catch{/* private mode */}
  };

  const isOwnAccount=active.id===PROFILE_ACCOUNT_ID;
  const isEmpty=hydrated&&matchesFor(active.id).length===0;

  return <AccountContext.Provider value={{accounts,active,setActive,profile,isOwnAccount,isEmpty}}>
    {children}
  </AccountContext.Provider>;
}

export function useAccount(){
  const ctx=useContext(AccountContext);
  if(!ctx)throw new Error('useAccount must be used inside AccountProvider');
  return ctx;
}

export {missionFor};
