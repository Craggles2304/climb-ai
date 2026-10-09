'use client';

import {useState,type CSSProperties} from 'react';
import type {Role} from '@/lib/types';
import type {MainChampion,RankInfo,RecentForm} from '@/lib/dashboard/model';
import {championCentered} from '@/lib/championArt';
import {ChampionPortrait} from '@/components/arena/ChampionPortrait';
import {RankEmblem} from '@/components/arena/RankEmblem';
import {Eyebrow,Stat,Tooltip} from '@/components/arena/Primitives';
import {ArenaIcon,type ArenaIconName} from '@/components/arena/ArenaIcon';
import s from './Dashboard.module.css';

export type CompanionState={loaded:boolean;linked:boolean;online:boolean};

const ROLE_LABEL:Record<Role,string>={TOP:'Top',JUNGLE:'Jungle',MID:'Mid',ADC:'Bot · ADC',SUPPORT:'Support'};
const ROLE_ICON:Record<Role,ArenaIconName>={TOP:'roleTop',JUNGLE:'roleJungle',MID:'roleMid',ADC:'roleBot',SUPPORT:'roleSupport'};
const RANK_VAR:Record<string,string>={IRON:'--arena-rank-iron',BRONZE:'--arena-rank-bronze',SILVER:'--arena-rank-silver',GOLD:'--arena-rank-gold',PLATINUM:'--arena-rank-platinum',EMERALD:'--arena-rank-emerald',DIAMOND:'--arena-rank-diamond',MASTER:'--arena-rank-master',GRANDMASTER:'--arena-rank-grandmaster',CHALLENGER:'--arena-rank-challenger'};

export function CompanionPill({state}:{state:CompanionState}){
  const label=!state.loaded?'Checking Companion':state.online?'Companion live':state.linked?'Companion paired · offline':'Companion not connected';
  return <span className={[s.status,state.online?s.statusLive:state.linked?s.statusPaired:''].join(' ')} role="status"><i aria-hidden="true"/>{label}</span>;
}

/** A. Player identity: who the player is, where they stand and how their recent games went. */
export function PlayerHero({gameName,tagline,region,rank,role,main,form,formWindow,companion,baseline}:{
  gameName:string;tagline:string;region:string;rank:RankInfo;role:Role;main:MainChampion|null;
  form:RecentForm;formWindow:string;companion:CompanionState;
  baseline:{games:number;required:number;ready:boolean};
}){
  const [artFailed,setArtFailed]=useState(false);
  const art=main?championCentered(main.name):'';
  const tag=tagline.replace(/^#?/,'#');
  const rankStyle=rank.tier?{'--rank':`var(${RANK_VAR[rank.tier]})`} as CSSProperties:undefined;
  const noGames=form.games===0;
  return <section className={s.hero} aria-labelledby="hq-player-name">
    {art&&!artFailed&&<img className={s.heroArt} src={art} alt="" aria-hidden="true" fetchPriority="high" decoding="async" onError={()=>setArtFailed(true)}/>}
    <div className={s.heroTop}>
      <Eyebrow toneColor="var(--arena-lime)">Player profile · {region||'—'}</Eyebrow>
      <CompanionPill state={companion}/>
    </div>

    <div className={s.heroIdentity}>
      <RankEmblem rank={rank} size={92}/>
      <div className={s.heroName}>
        <h1 id="hq-player-name">{gameName||'Player'}{tagline&&<span>{tag}</span>}</h1>
        <div className={s.heroMeta}>
          <span className={s.heroRank} style={rankStyle}>
            <b>{rank.ranked?rank.label:'Unranked'}</b>
            {rank.ranked&&<small>{rank.lp!==null?`${rank.lp} LP`:'LP unavailable'}</small>}
          </span>
          <span className={s.heroMain}>
            <span className={s.roleGlyph}><ArenaIcon name={ROLE_ICON[role]} size={18}/></span>
            <span><b>{ROLE_LABEL[role]}</b><small>Primary role</small></span>
          </span>
          {main?<span className={s.heroMain}>
            <ChampionPortrait champion={main.name} size={30} priority/>
            <span><b>{main.name}</b><small>{main.source==='TRACKED'?`Main · ${main.games} of last ${main.sample}`:'Declared main'}</small></span>
          </span>:<span className={s.heroMain}><span style={{paddingLeft:8}}><b>No main yet</b><small>Play tracked games</small></span></span>}
        </div>
      </div>
    </div>

    <div className={s.heroStats} aria-label={`Recent performance, ${formWindow}`}>
      <div>
        <Stat label={<>Recent form · {formWindow}</>} value={noGames?'—':<>{form.wins}W <span style={{color:'var(--arena-muted)'}}>{form.losses}L</span></>} unknown={noGames}/>
        <div className={s.formStrip} aria-hidden="true">
          {Array.from({length:10},(_,index)=>{
            // Oldest on the left, newest game on the right.
            const result=form.results[9-index];
            return <i key={index} className={result==='WIN'?s.formWin:result==='LOSS'?s.formLoss:s.formEmpty}/>;
          })}
        </div>
      </div>
      <Stat label="Win rate" value={form.winRate===null?'—':form.winRate+'%'} unknown={form.winRate===null} sub={noGames?'No tracked games':`${form.games} game${form.games===1?'':'s'}`}/>
      <Stat label="KDA" value={form.kdaRatio===null?'—':form.kdaRatio.toFixed(2)} unknown={form.kdaRatio===null} sub={form.kills===null?'Unavailable':`${form.kills} / ${form.deaths} / ${form.assists}`}/>
      <Stat label="CS / min" value={form.csPerMin===null?'—':form.csPerMin.toFixed(1)} unknown={form.csPerMin===null} sub={form.csPerMin===null?'Not measured':'Measured games only'}/>
      <div>
        <Stat label="Game DNA" value={baseline.ready?'Active':`${Math.min(baseline.games,baseline.required)}/${baseline.required}`}
          sub={baseline.ready?`${role} baseline complete`:<Tooltip label={`Game DNA stays neutral until OP CLIMB has seen ${baseline.required} real ${role} games.`}>Baseline building ⓘ</Tooltip>}/>
      </div>
    </div>
    {main&&!artFailed&&<small className={s.credit} aria-hidden="true">{main.name} · Riot Games art</small>}
  </section>;
}
