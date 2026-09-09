'use client';
import {createContext,useContext,useEffect,useState,useCallback} from 'react';
import {getBrowserClient} from '@/lib/supabase/client';
import {authService,AuthUser} from '@/lib/services/authService';
import {authConfigured} from '@/lib/auth/config';

/**
 * The signed-in user, for client components.
 *
 * Subscribes to Supabase auth changes so signing in or out updates every
 * consumer without a reload. When auth is unconfigured this settles immediately
 * with no user and `configured:false`, which is what the UI keys off to show
 * demo-mode copy instead of a broken account menu.
 */

interface Ctx{
  user:AuthUser|null;
  loading:boolean;
  configured:boolean;
  signOut:()=>Promise<void>;
}

const SessionContext=createContext<Ctx|null>(null);

export function SessionProvider({children}:{children:React.ReactNode}){
  const configured=authConfigured();
  const [user,setUser]=useState<AuthUser|null>(null);
  const [loading,setLoading]=useState(configured);

  useEffect(()=>{
    if(!configured){setLoading(false);return}
    let cancelled=false;

    authService.currentUser()
      .then(u=>{if(!cancelled){setUser(u);setLoading(false)}})
      .catch(()=>{if(!cancelled)setLoading(false)});

    let unsubscribe=()=>{};
    getBrowserClient().then(client=>{
      if(!client||cancelled)return;
      const {data}=client.auth.onAuthStateChange((_event,session)=>{
        setUser(session?.user?{id:session.user.id,email:session.user.email??''}:null);
        setLoading(false);
      });
      unsubscribe=()=>data.subscription.unsubscribe();
    });
    return ()=>{cancelled=true;unsubscribe()};
  },[configured]);

  const signOut=useCallback(async()=>{
    await authService.signOut();
    setUser(null);
  },[]);

  return <SessionContext.Provider value={{user,loading,configured,signOut}}>
    {children}
  </SessionContext.Provider>;
}

export function useSession(){
  const ctx=useContext(SessionContext);
  if(!ctx)throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
