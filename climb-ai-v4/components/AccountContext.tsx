'use client';
import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {demoAccounts,matchesFor,missionFor} from '@/data/demo';
import {RiotAccount} from '@/lib/types';

type Ctx={accounts:RiotAccount[];active:RiotAccount;setActive:(id:string)=>void};
const AccountContext=createContext<Ctx|null>(null);
export function AccountProvider({children}:{children:React.ReactNode}){
 const [activeId,setActiveId]=useState('acct-main');
 useEffect(()=>{const saved=localStorage.getItem('climb_active_account');if(saved&&demoAccounts.some(a=>a.id===saved))setActiveId(saved)},[]);
 const active=useMemo(()=>demoAccounts.find(a=>a.id===activeId)||demoAccounts[0],[activeId]);
 const setActive=(id:string)=>{setActiveId(id);localStorage.setItem('climb_active_account',id)};
 return <AccountContext.Provider value={{accounts:demoAccounts,active,setActive}}>{children}</AccountContext.Provider>
}
export function useAccount(){const ctx=useContext(AccountContext);if(!ctx)throw new Error('useAccount must be used inside AccountProvider');return ctx}
export {matchesFor,missionFor};
