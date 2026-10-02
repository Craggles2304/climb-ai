'use client';

import type {Role} from '@/lib/types';
import {LEAGUE_ROLES} from '@/lib/roleAwareLearning';

type Props={
  role:Role;
  primaryRole:Role;
  gameCounts:Partial<Record<Role,number>>;
  baselineRequired?:number;
  onChange:(role:Role)=>void;
  compact?:boolean;
  label?:string;
};

export function DnaRoleSwitcher({
  role,
  primaryRole,
  gameCounts,
  baselineRequired=3,
  onChange,
  compact=false,
  label='DNA ROLE PROFILE',
}:Props){
  return <section className={'dna-role-switcher'+(compact?' compact':'')} aria-label="Switch Game DNA role">
    <div className="dna-role-switcher-copy">
      <span>{label}</span>
      <b>{role} DNA</b>
      <small>Viewing only. Switching role here never merges XP, missions or history.</small>
    </div>
    <div className="dna-role-switcher-tabs" role="tablist" aria-label="Game DNA roles">
      {LEAGUE_ROLES.map(item=>{
        const games=Math.max(0,Number(gameCounts[item]||0));
        const ready=games>=baselineRequired;
        const selected=item===role;
        const main=item===primaryRole;
        return <button
          key={item}
          type="button"
          role="tab"
          aria-selected={selected}
          className={(selected?'active ':'')+(main?'primary-role':'')}
          onClick={()=>onChange(item)}
        >
          <strong>{item}</strong>
          <small>{ready?`${games} GAMES`:`${Math.min(games,baselineRequired)}/${baselineRequired} BASELINE`}{main?' · MAIN':''}</small>
        </button>;
      })}
    </div>
  </section>;
}